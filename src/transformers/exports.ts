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
  ClassDeclaration,
} from 'estree';
import { TransformSourceDescription, OutputOptions } from 'rollup';
import { NamedDeclaration, DefaultDeclaration } from './parsing-utilities';
import { isESMFormat } from '../options';
import { Transform, TransformInterface, ExportClosureMapping, ExportDetails } from '../types';
import MagicString from 'magic-string';
import { parse, walk } from '../acorn';

const CJS_EXTERN = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains the export global object so Closure doesn't get confused by its presence.
* @externs
*/

/**
 * @typedef {{
 *   __esModule: boolean,
 * }}
 */
let exports;
`;

/**
 * This Transform will apply only if the Rollup configuration is for 'esm' output.
 *
 * In order to preserve the export statements:
 * 1. Create extern definitions for them (to keep them their names from being mangled).
 * 2. Insert additional JS referencing the exported names on the window scope
 * 3. After Closure Compilation is complete, replace the window scope references with the original export statements.
 */
export default class ExportTransform extends Transform implements TransformInterface {
  private originalExports: Map<string, ExportDetails> = new Map();

  /**
   * Store an export from a source into the originalExports Map.
   * @param mapping mapping of details from this declaration.
   */
  private storeExport = (mapping: Array<ExportDetails>): void =>
    mapping.forEach(map => this.originalExports.set(map.closureName, map));

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
        storeExport(NamedDeclaration(context, node));
      },
      ExportDefaultDeclaration(node: ExportDefaultDeclaration) {
        storeExport(DefaultDeclaration(context, node));
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

  public extern(options: OutputOptions): string {
    if (options.format === 'cjs') {
      return CJS_EXTERN;
    }

    return '';
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
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (isESMFormat(this.outputOptions.format)) {
      await this.deriveExports(code);
      const source = new MagicString(code);

      for (const key of this.originalExports.keys()) {
        const value: ExportDetails = this.originalExports.get(key) as ExportDetails;

        // Remove export statements before Closure Compiler sees the code
        // This prevents CC from transpiling `export` statements when the language_out is set to a value
        // where exports were not part of the language.
        source.remove(...value.range);
        // Window scoped references for each key are required to ensure Closure Compilre retains the code.
        source.append(`\nwindow['${key}'] = ${key};`);
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
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (isESMFormat(this.outputOptions.format)) {
      const source = new MagicString(code);
      const program = parse(code);
      let collectedExportsToAppend: Map<string | null, Array<string>> = new Map();
      const { originalExports } = this;

      source.trimEnd();

      walk.ancestor(program, {
        // We inserted window scoped assignments for all the export statements during `preCompilation`
        // window['exportName'] = exportName;
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
                ancestor.expression.left.object.name === 'window' &&
                ancestor.expression.left.property.type === 'Identifier' &&
                originalExports.get(ancestor.expression.left.property.name)
              ) {
                const { name: exportName } = ancestor.expression.left.property;
                const exportDetails: ExportDetails = originalExports.get(
                  exportName,
                ) as ExportDetails;
                switch (exportDetails.type) {
                  case ExportClosureMapping.DEFAULT_FUNCTION:
                  case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
                  case ExportClosureMapping.DEFAULT:
                    if (ancestor.expression.left.range) {
                      source.overwrite(
                        ancestor.expression.left.range[0],
                        ancestor.expression.left.range[1] + ancestor.expression.operator.length,
                        `export default `,
                      );
                    }
                    break;
                  case ExportClosureMapping.NAMED_FUNCTION:
                    if (
                      ancestor.expression.right.type === 'FunctionExpression' &&
                      ancestor.expression.right.params.length > 0
                    ) {
                      const [firstParameter] = ancestor.expression.right.params;
                      if (ancestor.expression.range && firstParameter.range) {
                        source.overwrite(
                          ancestor.expression.range[0],
                          firstParameter.range[0] - 1,
                          `export function ${ancestor.expression.left.property.name}`,
                        );
                      }
                    }
                    break;
                  case ExportClosureMapping.DEFAULT_CLASS:
                  case ExportClosureMapping.NAMED_DEFAULT_CLASS:
                    if (ancestor.expression.right.type === 'Identifier') {
                      const { name: mangledName } = ancestor.expression.right;

                      walk.simple(program, {
                        ClassDeclaration(node: ClassDeclaration) {
                          if (
                            node.id &&
                            node.id.name === mangledName &&
                            node.range &&
                            node.body.range &&
                            ancestor.range
                          ) {
                            if (node.superClass && node.superClass.type === 'Identifier') {
                              source.overwrite(
                                node.range[0],
                                node.body.range[0],
                                `export default class extends ${node.superClass.name}`,
                              );
                            } else {
                              source.overwrite(
                                node.range[0],
                                node.body.range[0],
                                `export default class`,
                              );
                            }
                            source.remove(...ancestor.range);
                          }
                        },
                      });
                    }
                    break;
                  case ExportClosureMapping.NAMED_CONSTANT:
                    const { object: leftObject } = ancestor.expression.left;
                    if (leftObject.range) {
                      source.overwrite(leftObject.range[0], leftObject.range[1] + 1, 'var ');
                    }

                    collectedExportsToAppend = ExportTransform.storeExportToAppend(
                      collectedExportsToAppend,
                      exportDetails,
                    );
                    break;
                  case ExportClosureMapping.DEFAULT_VALUE:
                  case ExportClosureMapping.DEFAULT_OBJECT:
                    if (ancestor.expression.left.object.range && ancestor.expression.right.range) {
                      source.overwrite(
                        ancestor.expression.left.object.range[0],
                        ancestor.expression.right.range[0],
                        'export default ',
                      );
                    }
                    break;
                  default:
                    if (ancestor.range) {
                      source.remove(...ancestor.range);
                    }

                    if (ancestor.expression.right.type === 'Identifier') {
                      collectedExportsToAppend = ExportTransform.storeExportToAppend(
                        collectedExportsToAppend,
                        exportDetails,
                      );
                      // collectedExportsToAppend.push(
                      //   `${ancestor.expression.right.name} as ${ancestor.expression.left.property.name}`,
                      // );
                    }
                    break;
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
            source.append(`export{${toAppend.join(',')}};`);
          } else {
            source.append(`export{${toAppend.join(',')}} from '${exportSource}';`);
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
