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
import { TransformSourceDescription, OutputChunk } from 'rollup';
import { NamedDeclaration, DefaultDeclaration, defaultUnamedExportName } from './parsing-utilities';
import { isESMFormat } from '../options';
import {
  ExportNameToClosureMapping,
  Transform,
  TransformInterface,
  ExportClosureMapping,
} from '../types';
import MagicString from 'magic-string';
const walk = require('acorn/dist/walk');

/**
 * This Transform will apply only if the Rollup configuration is for 'esm' output.
 *
 * In order to preserve the export statements:
 * 1. Create extern definitions for them (to keep them their names from being mangled).
 * 2. Insert additional JS referencing the exported names on the window scope
 * 3. After Closure Compilation is complete, replace the window scope references with the original export statements.
 */
export default class ExportTransform extends Transform implements TransformInterface {
  private originalExports: ExportNameToClosureMapping = {};

  /**
   * Before Closure Compiler is given a chance to look at the code, we need to
   * find and store all export statements with their correct type
   * @param code source to parse
   * @param id Rollup id reference to the source
   */
  public async deriveFromInputSource(code: string, id: string): Promise<void> {
    const context = this.context;
    let originalExports: ExportNameToClosureMapping = {};
    const program = context.parse(code, { ranges: true });

    walk.simple(program, {
      ExportNamedDeclaration(node: ExportNamedDeclaration) {
        const namedDeclarationValues = NamedDeclaration(context, id, node);
        if (namedDeclarationValues !== null) {
          originalExports = { ...originalExports, ...namedDeclarationValues };
        }
      },
      ExportDefaultDeclaration(node: ExportDefaultDeclaration) {
        const defaultDeclarationValue = DefaultDeclaration(context, id, node);
        if (defaultDeclarationValue !== null) {
          originalExports = { ...originalExports, ...defaultDeclarationValue };
        }
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

    this.originalExports = originalExports;

    return void 0;
  }

  /**
   * Rollup's naming scheme for default exports can sometimes clash with reserved
   * words.
   *
   * Rollup protects output by renaming the values with it's own algorithm, so we need to
   * ensure that when it changes the name of a default export this transform is aware of its
   * new name in the output.
   *
   * i.e. default class {} => window._class = class {} => default class {}.
   * @param chunk OutputChunk from Rollup for this code.
   * @param id Rollup id reference to the source
   */
  private repairExportMapping(chunk: any, id: string): void {
    const defaultExportName = defaultUnamedExportName(id);
    if (
      chunk.exportNames &&
      chunk.exportNames.default &&
      chunk.exportNames.default.safeName &&
      defaultExportName !== chunk.exportNames.default.safeName &&
      this.originalExports[defaultExportName]
    ) {
      // If there was a detected default export, we need to ensure Rollup
      // did not rename the export.
      this.originalExports[chunk.exportNames.default.safeName] = this.originalExports[
        defaultExportName
      ];
      delete this.originalExports[defaultExportName];
    }
  }

  /**
   * Before Closure Compiler modifies the source, we need to ensure it has window scoped
   * references to the named exports. This prevents Closure from mangling their names.
   * @param code source to parse, and modify
   * @param chunk OutputChunk from Rollup for this code.
   * @param id Rollup id reference to the source
   * @return modified input source with window scoped references.
   */
  public async preCompilation(
    code: string,
    chunk: any,
    id: string,
  ): Promise<TransformSourceDescription> {
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (isESMFormat(this.outputOptions.format)) {
      this.repairExportMapping(chunk, id);

      const source = new MagicString(code);
      // Window scoped references for each key are required to ensure Closure Compilre retains the code.
      Object.keys(this.originalExports).forEach(key => {
        source.append(`\nwindow['${key}'] = ${key}`);
      });

      return {
        code: source.toString(),
        map: source.generateMap(),
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
  public async postCompilation(
    code: string,
    chunk: OutputChunk,
    id: string,
  ): Promise<TransformSourceDescription> {
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (isESMFormat(this.outputOptions.format)) {
      const source = new MagicString(code);
      const program = this.context.parse(code, { ranges: true });
      const collectedExportsToAppend: Array<string> = [];

      const originalExports = this.originalExports;
      const originalExportIdentifiers = Object.keys(originalExports);

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
                originalExportIdentifiers.includes(ancestor.expression.left.property.name)
              ) {
                const exportName = ancestor.expression.left.property.name;
                switch (originalExports[exportName].type) {
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
                      const firstParameter = ancestor.expression.right.params[0];
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
                      const mangledName = ancestor.expression.right.name;

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
                            source.remove(ancestor.range[0], ancestor.range[1]);
                          }
                        },
                      });
                    }
                    break;
                  case ExportClosureMapping.NAMED_CONSTANT:
                    if (ancestor.expression.left.object.range) {
                      source.overwrite(
                        ancestor.expression.left.object.range[0],
                        ancestor.expression.left.object.range[1] + 1,
                        'var ',
                      );
                    }

                    if (originalExports[exportName].alias !== null) {
                      collectedExportsToAppend.push(
                        `${ancestor.expression.left.property.name} as ${
                          originalExports[exportName].alias
                        }`,
                      );
                    } else {
                      collectedExportsToAppend.push(ancestor.expression.left.property.name);
                    }
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
                      source.remove(ancestor.range[0], ancestor.range[1]);
                    }

                    if (ancestor.expression.right.type === 'Identifier') {
                      collectedExportsToAppend.push(
                        `${ancestor.expression.right.name} as ${
                          ancestor.expression.left.property.name
                        }`,
                      );
                    }
                    break;
                }
              }
            });
          }
        },
      });

      if (collectedExportsToAppend.length > 0) {
        source.append(`export{${collectedExportsToAppend.join(',')}};`);
      }

      return {
        code: source.toString(),
        map: source.generateMap(),
      };
    }

    return {
      code,
    };
  }
}
