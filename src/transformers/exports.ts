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
import { TransformSourceDescription } from 'rollup';
import { NamedDeclaration, DefaultDeclaration } from './parsing-utilities';
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
    if (this.isEntryPoint(id)) {
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
            new Error(`Rollup Plugin Closure Compiler does not support export all syntax.`),
          );
        },
      });

      this.originalExports = originalExports;
    }

    return void 0;
  }

  /**
   * Before Closure Compiler modifies the source, we need to ensure it has window scoped
   * references to the named exports. This prevents Closure from mangling their names.
   * @param code source to parse, and modify
   * @param id Rollup id reference to the source
   * @return modified input source with window scoped references.
   */
  public async preCompilation(code: string, id: string): Promise<TransformSourceDescription> {
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (isESMFormat(this.outputOptions.format)) {
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
   * @param id Rollup identifier for the source
   * @return Promise containing the repaired source
   */
  public async postCompilation(code: string, id: string): Promise<TransformSourceDescription> {
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
                switch (originalExports[exportName]) {
                  case ExportClosureMapping.DEFAULT_FUNCTION:
                  case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
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

                    collectedExportsToAppend.push(ancestor.expression.left.property.name);
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
        source.append(`export {${collectedExportsToAppend.join(',')}};`);
      }

      // Object.keys(exportedConstants).forEach(exportedConstant => {
      //   let range: [number, number] | undefined = undefined;
      //   if ((range = exportedConstants[exportedConstant].range)) {
      //     switch(this.exported[exportedConstant]) {
      //       case ExportClosureMapping.NAMED_FUNCTION:
      //       // replace(`window.${key}=function`, `export function ${key}`, code, source);
      //         source.overwrite(range[0], range[1], `export function ${exportedConstant}`);
      //         break;
      //       case ExportClosureMapping.NAMED_CLASS:
      //         break;
      //       case ExportClosureMapping.DEFAULT_FUNCTION:
      //         break;
      //       case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
      //         break;
      //       case ExportClosureMapping.DEFAULT_CLASS:
      //         break;
      //       case ExportClosureMapping.NAMED_DEFAULT_CLASS:
      //         break;
      //       case ExportClosureMapping.NAMED_CONSTANT:
      //         break;
      //       default:
      //         this.context.warn(
      //           'Rollup Plugin Closure Compiler could not restore all exports statements.',
      //         );
      //         break;
      //     }
      //     range && source.overwrite(range[0], range[1], 'new text');
      //   }
      // });

      // console.log('exportedConstants', exportedConstants);
      // Object.keys(this.exported).forEach(key => {
      //   switch (this.exported[key]) {
      //     case ExportClosureMapping.NAMED_FUNCTION:
      //       replace(`window.${key}=function`, `export function ${key}`, code, source);
      //       break;
      //     case ExportClosureMapping.NAMED_CLASS:
      //       const namedClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
      //       if (namedClassMatch && namedClassMatch.length > 0) {
      //         // Remove the declaration on window scope, i.e. `window.Exported=a;`
      //         replace(namedClassMatch[0], '', code, source);
      //         // Store a new export constant to output at the end. `a as Exported`
      //         exportedConstants.push(`${namedClassMatch[1]} as ${key}`);
      //       }
      //       break;
      //     case ExportClosureMapping.DEFAULT_FUNCTION:
      //       replace(`window.${key}=function`, `export default function`, code, source);
      //       break;
      //     case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
      //       replace(`window.${key}=function`, `export default function ${key}`, code, source);
      //       break;
      //     case ExportClosureMapping.DEFAULT_CLASS:
      //       const defaultClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
      //       if (defaultClassMatch && defaultClassMatch.length > 0) {
      //         // Remove the declaration on window scope, i.e. `window.ExportedTwo=a;`
      //         // Replace it with an export statement `export default a;`
      //         replace(`class ${defaultClassMatch[1]}`, `export default class`, code, source);
      //         replace(defaultClassMatch[0], '', code, source);
      //       }
      //       break;
      //     case ExportClosureMapping.NAMED_DEFAULT_CLASS:
      //       const namedDefaultClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
      //       if (namedDefaultClassMatch && namedDefaultClassMatch.length > 0) {
      //         // Remove the declaration on window scope, i.e. `window.ExportedTwo=a;`
      //         // Replace it with an export statement `export default a;`
      //         replace(
      //           namedDefaultClassMatch[0],
      //           `export default ${namedDefaultClassMatch[1]};`,
      //           code,
      //           source,
      //         );
      //       }
      //       break;
      //     case ExportClosureMapping.NAMED_CONSTANT:
      //       // Remove the declaration on the window scope, i.e. `window.ExportedThree=value`
      //       // Replace it with a const declaration, i.e `const ExportedThree=value`
      //       replace(`window.${key}=`, `const ${key}=`, code, source);
      //       // Store a new export constant to output at the end, i.e `ExportedThree`
      //       exportedConstants.push(key);
      //       break;
      //     default:
      //       this.context.warn(
      //         'Rollup Plugin Closure Compiler could not restore all exports statements.',
      //       );
      //       break;
      //   }
      // });

      // if (exportedConstants.length > 0) {
      //   // Remove the newline at the end since we are going to append exports.
      //   if (code.endsWith('\n')) {
      //     source.trimLines();
      //   }
      //   // Append the exports that were gathered, i.e `export {a as Exported, ExportedThree};`
      //   source.append(`export {${exportedConstants.join(',')}};`);
      // }

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
