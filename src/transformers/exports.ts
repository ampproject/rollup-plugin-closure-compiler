/**
 * Copyright 2018 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  ExportAllDeclaration,
  Identifier,
  Node,
} from 'estree';
import { TransformSourceDescription } from 'rollup';
import { NamedDeclaration, DefaultDeclaration } from '../parsing/export-details';
import { isESMFormat } from '../options';
import {
  Transform,
  TransformInterface,
  ExportClosureMapping,
  ExportDetails,
  Range,
} from '../types';
import MagicString from 'magic-string';
import { parse, walk } from '../acorn';

const EXTERN_OVERVIEW = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* @externs
*/`;

/**
 * This Transform will apply only if the Rollup configuration is for 'esm' output.
 *
 * In order to preserve the export statements:
 * 1. Create extern definitions for them (to keep them their names from being mangled).
 * 2. Insert additional JS referencing the exported names on the window scope
 * 3. After Closure Compilation is complete, replace the window scope references with the original export statements.
 */
export default class ExportTransform extends Transform implements TransformInterface {
  public name = 'ExportTransform';
  private originalExports: Map<string, ExportDetails> = new Map();
  private currentSourceExportCount: number = 0;

  /**
   * Store an export from a source into the originalExports Map.
   * @param mapping mapping of details from this declaration.
   */
  private storeExport = (mapping: Array<ExportDetails>): void =>
    mapping.forEach(map => {
      if (map.source === null) {
        this.currentSourceExportCount++;
      }
      this.originalExports.set(map.closureName, map);
    });

  private static storeExportToAppend(
    collected: Map<string | null, Array<string>>,
    exportDetails: ExportDetails,
  ): Map<string | null, Array<string>> {
    const update = collected.get(exportDetails.source) || [];

    if (exportDetails.exported === exportDetails.local) {
      update.push(exportDetails.exported);
    } else {
      update.push(`${exportDetails.local} as ${exportDetails.exported}`);
    }
    collected.set(exportDetails.source, update);

    return collected;
  }

  private async deriveExports(code: string): Promise<void> {
    const { context, storeExport } = this;
    const program = parse(code);

    walk.simple(program, {
      ExportNamedDeclaration(node: ExportNamedDeclaration) {
        storeExport(NamedDeclaration(node));
      },
      ExportDefaultDeclaration(node: ExportDefaultDeclaration) {
        storeExport(DefaultDeclaration(node));
      },
      ExportAllDeclaration(node: ExportAllDeclaration) {
        // TODO(KB): This case `export * from "./import"` is not currently supported.
        context.error(
          new Error(
            `Rollup Plugin Closure Compiler does not support export all syntax for externals.`,
          ),
        );
      },
    });
  }

  public extern(): string | null {
    if (Array.from(this.originalExports.keys()).length > 0) {
      let output = EXTERN_OVERVIEW;

      for (const key of this.originalExports.keys()) {
        const value: ExportDetails = this.originalExports.get(key) as ExportDetails;
        if (value.source !== null) {
          output += `function ${value.closureName}(){};\n`;
        }
      }

      return output;
    }

    return null;
  }

  /**
   * Before Closure Compiler modifies the source, we need to ensure it has window scoped
   * references to the named exports. This prevents Closure from mangling their names.
   * @param code source to parse, and modify
   * @param chunk OutputChunk from Rollup for this code.
   * @param id Rollup id reference to the source
   * @return modified input source with window scoped references.
   */
  public async preCompilation(code: string): Promise<TransformSourceDescription> {
    if (isESMFormat(this.outputOptions.format)) {
      await this.deriveExports(code);
      const source = new MagicString(code);

      for (const key of this.originalExports.keys()) {
        const value: ExportDetails = this.originalExports.get(key) as ExportDetails;

        // Remove export statements before Closure Compiler sees the code
        // This prevents CC from transpiling `export` statements when the language_out is set to a value
        // where exports were not part of the language.
        source.remove(...value.range);
        // Window scoped references for each key are required to ensure Closure Compilre retains the code.
        if (value.source === null) {
          source.append(`\nwindow['${value.closureName}'] = ${value.local};`);
        } else {
          source.append(`\nwindow['${value.closureName}'] = ${value.exported};`);
        }
      }

      return {
        code: source.toString(),
        map: source.generateMap().mappings,
      };
    }

    return {
      code,
    };
  }

  /**
   * After Closure Compiler has modified the source, we need to replace the window scoped
   * references we added with the intended export statements
   * @param code source post Closure Compiler Compilation
   * @param chunk OutputChunk from Rollup for this code.
   * @param id Rollup identifier for the source
   * @return Promise containing the repaired source
   */
  public async postCompilation(code: string): Promise<TransformSourceDescription> {
    if (isESMFormat(this.outputOptions.format)) {
      const source = new MagicString(code);
      const program = parse(code);
      let collectedExportsToAppend: Map<string | null, Array<string>> = new Map();
      const { originalExports, currentSourceExportCount } = this;

      source.trimEnd();

      walk.ancestor(program, {
        // We inserted window scoped assignments for all the export statements during `preCompilation`
        // Now we need to find where Closure Compiler moved them, and restore the exports of their name.
        // ASTExporer Link: https://astexplorer.net/#/gist/94f185d06a4105d64828f1b8480bddc8/0fc5885ae5343f964d0cdd33c7d392a70cf5fcaf
        Identifier(node: Identifier, ancestors: Array<Node>) {
          if (node.name === 'window') {
            ancestors.forEach((ancestor: Node) => {
              if (
                ancestor.type === 'ExpressionStatement' &&
                ancestor.expression.type === 'AssignmentExpression' &&
                ancestor.expression.left.type === 'MemberExpression' &&
                ancestor.expression.left.object.type === 'Identifier' &&
                ancestor.expression.left.object.name === 'window'
              ) {
                const { property: leftProperty } = ancestor.expression.left;
                let exportName: string | null = null;
                if (leftProperty.type === 'Identifier') {
                  exportName = leftProperty.name;
                } else if (
                  leftProperty.type === 'Literal' &&
                  typeof leftProperty.value === 'string'
                ) {
                  exportName = leftProperty.value;
                }

                if (exportName !== null && originalExports.get(exportName)) {
                  const exportDetails: ExportDetails = originalExports.get(
                    exportName,
                  ) as ExportDetails;
                  switch (exportDetails.type) {
                    case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
                    case ExportClosureMapping.DEFAULT:
                      if (ancestor.expression.left.range) {
                        source.overwrite(
                          ancestor.expression.left.range[0],
                          ancestor.expression.left.range[1] + ancestor.expression.operator.length,
                          'export default ',
                        );
                      }
                      break;
                    case ExportClosureMapping.NAMED_CONSTANT:
                      const exportFromCurrentSource: boolean = exportDetails.source === null;
                      const inlineExport: boolean =
                        exportFromCurrentSource && currentSourceExportCount === 1;
                      let exportCollected: boolean = false;
                      if (exportFromCurrentSource) {
                        const { object: leftObject } = ancestor.expression.left;
                        if (leftObject.range) {
                          const { left, right } = ancestor.expression;
                          switch (right.type) {
                            case 'FunctionExpression':
                              // Function Expressions can be inlined instead of preserved as variable references.
                              // window['foo'] = function(){}; => export function foo(){} / function foo(){}
                              if (right.params.length > 0) {
                                // FunctionExpression has parameters.
                                source.overwrite(
                                  (leftObject.range as Range)[0],
                                  (right.params[0].range as Range)[0],
                                  `${inlineExport ? 'export ' : ''}function ${
                                    exportDetails.exported
                                  }(`,
                                );
                              } else {
                                source.overwrite(
                                  (leftObject.range as Range)[0],
                                  (right.body.range as Range)[0],
                                  `${inlineExport ? 'export ' : ''}function ${
                                    exportDetails.exported
                                  }()`,
                                );
                              }
                              break;
                            case 'Identifier':
                              if (left.property.type === 'Identifier') {
                                // Identifiers are present when a complex object (class) has been saved as an export.
                                // In this case we currently opt out of inline exporting, since the identifier
                                // is a mangled name for the export.
                                exportDetails.local = right.name;
                                exportDetails.closureName = left.property.name;

                                source.remove(
                                  (ancestor.expression.left.range as Range)[0],
                                  (ancestor.expression.right.range as Range)[1] + 1,
                                );

                                // Since we're manually mapping the name back from the changes done by Closure
                                // Ensure the export isn't stored for insertion here and later on.
                                collectedExportsToAppend = ExportTransform.storeExportToAppend(
                                  collectedExportsToAppend,
                                  exportDetails,
                                );
                                exportCollected = true;
                              }
                              break;
                            default:
                              const statement = inlineExport ? 'export var ' : 'var ';
                              source.overwrite(
                                leftObject.range[0],
                                leftObject.range[1] + 1,
                                statement,
                              );
                              break;
                          }
                        }
                        if (exportDetails.local !== exportDetails.exported) {
                          exportDetails.local = exportDetails.exported;
                          exportDetails.closureName = exportDetails.local;
                        }
                      } else if (
                        ancestor.expression.left.range &&
                        ancestor.expression.right.range
                      ) {
                        source.remove(
                          ancestor.expression.left.range[0],
                          ancestor.expression.right.range[1] + 1,
                        );
                      }

                      if (!inlineExport && !exportCollected) {
                        collectedExportsToAppend = ExportTransform.storeExportToAppend(
                          collectedExportsToAppend,
                          exportDetails,
                        );
                      }
                      break;
                  }
                }
              }
            });
          }
        },
      });

      for (const exportSource of collectedExportsToAppend.keys()) {
        const toAppend = collectedExportsToAppend.get(exportSource);
        if (toAppend && toAppend.length > 0) {
          if (exportSource === null) {
            source.append(`export{${toAppend.join(',')}}`);
          } else {
            source.prepend(`export{${toAppend.join(',')}}from'${exportSource}';`);
          }
        }
      }

      return {
        code: source.toString(),
        map: source.generateMap().mappings,
      };
    }

    return {
      code,
    };
  }
}
