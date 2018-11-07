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
  ExportDefaultDeclaration,
  ExportNamedDeclaration,
  ExportAllDeclaration,
  ExpressionStatement,
  Identifier,
  VariableDeclaration,
  ClassDeclaration,
  AssignmentExpression,
} from 'estree';
import { RenderedChunk } from 'rollup';
import { isESMFormat } from '../options';
import {
  TransformInterface,
  MangledWords,
  MangledTransformSourceDescription,
  DiscoveredExport,
  CodeTransform,
} from '../types';
import MagicString from 'magic-string';
import { parse, walk, range } from '../acorn';
import { Transform } from './transform';
import { exportDefaultParser } from '../parsers/ExportDefaultDeclaration';
import { exportNamedParser } from '../parsers/ExportNamedDeclaration';
import { remedy } from '../mangle';

/**
 * This Transform will apply only if the Rollup configuration is for 'esm' output.
 *
 * In order to preserve the export statements:
 * 1. Create extern definitions for them (to keep them their names from being mangled).
 * 2. Insert additional JS referencing the exported names on the window scope
 * 3. After Closure Compilation is complete, replace the window scope references with the original export statements.
 */
export default class ExportTransform extends Transform implements TransformInterface {
  public name: string = 'ExportTransform';
  private exports: Array<DiscoveredExport> = [];

  private async deriveExports(code: string): Promise<Array<DiscoveredExport>> {
    const context = this.context;
    const originalExports: Array<DiscoveredExport> = [];
    const program = parse(code);

    walk.simple(program, {
      ExportNamedDeclaration(node: ExportNamedDeclaration) {
        const discovered = exportNamedParser(node);
        if (discovered) {
          originalExports.push(...discovered);
        }
      },
      ExportDefaultDeclaration(node: ExportDefaultDeclaration) {
        const discovered = exportDefaultParser(node);
        if (discovered) {
          originalExports.push(discovered);
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

    return originalExports;
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
    chunk: RenderedChunk,
    mangled: MangledWords,
  ): Promise<MangledTransformSourceDescription> {
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (isESMFormat(this.outputOptions.format)) {
      const changes: Array<CodeTransform> = [];
      this.exports = await this.deriveExports(code);

      this.exports.forEach(discoveredExport => {
        // Remove export statements before Closure Compiler sees the code
        // This prevents CC from transpiling `export` statements when the language_out is set to a value
        // where exports were not part of the language.
        changes.push({
          type: 'remove',
          range: discoveredExport.range,
        });
        // Window scoped references for each key are required to ensure Closure Compilre retains the code.
        changes.push({
          type: 'append',
          content: `\nwindow['${discoveredExport.local}'] = ${discoveredExport.local};`,
        });
      });

      const source = await this.applyChanges(changes, code);
      return {
        code: source.toString(),
        map: source.generateMap(),
        mangledWords: mangled,
      };
    }

    return {
      code,
      mangledWords: mangled,
    };
  }

  private discoverCompiledExport(statement: ExpressionStatement): DiscoveredExport | null {
    if (statement.expression.type === 'AssignmentExpression') {
      const left = statement.expression.left;

      if (
        left.type === 'MemberExpression' &&
        left.object.type === 'Identifier' &&
        left.property.type === 'Identifier' &&
        left.object.name === 'window'
      ) {
        for (const exported of this.exports) {
          if (exported.local === (left.property as Identifier).name) {
            return exported;
          }
        }
      }
      return null;
    }

    return null;
  }

  /**
   *
   * @param code
   * @param chunk
   * @param mangled
   */
  public async postCompilation(
    code: string,
    chunk: RenderedChunk,
    mangled: MangledWords,
  ): Promise<MangledTransformSourceDescription> {
    if (isESMFormat(this.outputOptions.format)) {
      const program = parse(code);
      const discoverCompiledExport = this.discoverCompiledExport.bind(this);
      const moduleMangledWords: MangledWords = new MangledWords();
      const changes: Array<CodeTransform> = [];

      moduleMangledWords.merge(mangled);

      // Alright, here's the plan.
      // 1. Collect source transformations.
      // 2. Apply source transformations.

      walk.simple(program, {
        ExpressionStatement(statement: ExpressionStatement) {
          const statementRange = range(statement);
          const discoveredExport: DiscoveredExport | null = discoverCompiledExport(statement);

          if (discoveredExport !== null) {
            const right = (statement.expression as AssignmentExpression).right;
            const rightRange = range(right);

            const renewedExport = Object.assign({}, discoveredExport, {
              local: mangled.getInitial(discoveredExport.local) || discoveredExport.local,
              exported: mangled.getInitial(discoveredExport.exported) || discoveredExport.exported,
            });
            let exportDiscovered: boolean = false;

            console.log('right type', right.type, right.type === 'Identifier' ? right.name : '');

            if (right.type === 'Identifier') {
              console.log('export', renewedExport, mangled.final);
              changes.push({
                type: 'remove',
                range: statementRange,
              });

              walk.simple(program, {
                VariableDeclaration(variableDeclaration: VariableDeclaration) {
                  const variableDeclarationRange = range(variableDeclaration);
                  variableDeclaration.declarations.forEach(declarator => {
                    if (
                      declarator.id.type === 'Identifier' &&
                      declarator.id.name === renewedExport.local
                    ) {
                      exportDiscovered = true;
                      changes.push({
                        type: 'appendLeft',
                        range: [variableDeclarationRange[0], 0],
                        content: discoveredExport.default ? 'export default ' : 'export ',
                      });

                      if (!discoveredExport.default) {
                        moduleMangledWords.store(renewedExport.local, declarator.id.name);
                      }
                    }
                  });
                },
                ClassDeclaration(classDeclaration: ClassDeclaration) {
                  const classDeclarationRange = range(classDeclaration);
                  if (
                    classDeclaration.id &&
                    classDeclaration.id.type === 'Identifier' &&
                    classDeclaration.id.name === right.name
                  ) {
                    exportDiscovered = true;
                    changes.push({
                      type: 'appendLeft',
                      range: [classDeclarationRange[0], 0],
                      content: discoveredExport.default ? 'export default ' : 'export ',
                    });

                    if (!discoveredExport.default) {
                      moduleMangledWords.store(renewedExport.local, classDeclaration.id.name);
                    }
                  }
                },
              });

              if (!exportDiscovered && discoveredExport.default) {
                changes.push({
                  type: 'append',
                  content: `export default ${renewedExport.exported};`,
                });
              }
            } else if (right.type === 'Literal') {
              changes.push({
                type: 'overwrite',
                range: statementRange,
                content: discoveredExport.default
                  ? `export default ${right.value};`
                  : `export var ${renewedExport.exported}=${right.value};`,
              });
            } else {
              if (right.type === 'FunctionExpression' && right.id === null) {
                // Function without an id, e.g `window.foo=function(a){};`
                const existingFunction = code.substring(rightRange[0], rightRange[1]);
                changes.push({
                  type: 'overwrite',
                  range: [statementRange[0], rightRange[1]],
                  content: `export ${
                    discoveredExport.default ? 'default ' : ''
                  }${existingFunction.replace(
                    'function(',
                    `function${discoveredExport.default ? '' : ` ${renewedExport.local}`}(`,
                  )}`,
                });
              } else {
                changes.push({
                  type: 'overwrite',
                  range: [statementRange[0], rightRange[0]],
                  content: discoveredExport.default ? 'export default ' : 'export ',
                });
              }
            }
            // else {
            //   let rightRange = range(right);
            //   if ()
            //   changes.push({
            //     type: 'overwrite',
            //     range: [statementRange[0], rightRange[0]],
            //     content: discoveredExport.default ? 'export default ' : 'export ',
            //   });
            // }
          }
        },

        //   if (statement.expression.type === 'AssignmentExpression') {
        //     const left = statement.expression.left;
        //     const right = statement.expression.right;
        //     if (
        //       left.type === 'MemberExpression' &&
        //       left.object.type === 'Identifier' &&
        //       left.property.type === 'Identifier' &&
        //       left.object.name === 'window'
        //     ) {
        //       let discoveredExport: DiscoveredExport | null = null;
        //       // let discoveredExportIndex: number | null = null;

        //       originalExports.forEach((exported, index) => {
        //         if (exported.local === (left.property as Identifier).name) {
        //           discoveredExport = exported;
        //           //discoveredExportIndex = index;
        //         }
        //       });

        //       // Replacement is split into several categories.
        //       // 1. Inlined replacements occur when CC determines the exported name is not used elsewhere in the output module.
        //       // 1a. Inline name       .... `window.foo=1` => `export const foo=1;`
        //       // 1b. Inlined functions .... `window.foo=function(){}` => `export function foo(){}`
        //       // 1c. Inlined classes   .... `window.foo=class{}` => `export class foo{}`
        //       // 1d. Default values    .... `window.foo=1` => `export default 1`
        //       // 1e. Default functions .... `window.foo=function(){}` => `export default function(){}`
        //       // 1f. Default classes   .... `window.foo=class{}` => `export default class{}`
        //       // --------------------------------------------------------------------------------------------------------------
        //       // 2. Referenced replacements require changes to the entire module.
        //       // 2a. Reference name    ....

        //       if (discoveredExport !== null) {
        //         source.remove(statementRange[0], statementRange[1]);

        //         // const renewedExportedWord = getRenewedWord((discoveredExport as DiscoveredExport).exported) || (discoveredExport as DiscoveredExport).exported;
        //         const renewedLocalWord =
        //           mangled.getInitial((discoveredExport as DiscoveredExport).local) ||
        //           (discoveredExport as DiscoveredExport).local;
        //         if (right.type === 'Identifier') {
        //           // Assignment is a reference, make the source of the name export its value.
        //           walk.simple(program, {
        //             VariableDeclaration(variableDeclaration: VariableDeclaration) {
        //               const variableDeclarationRange = range(variableDeclaration);
        //               variableDeclaration.declarations.forEach(declarator => {
        //                 if (
        //                   declarator.id.type === 'Identifier' &&
        //                   declarator.id.name === renewedLocalWord
        //                 ) {
        //                   source.appendLeft(variableDeclarationRange[0], 'export ');

        //                   mangledWords.store(renewedLocalWord, declarator.id.name);
        //                 }
        //               });
        //             },
        //             ClassDeclaration(classDeclaration: ClassDeclaration) {
        //               const classDeclarationRange = range(classDeclaration);
        //               if (
        //                 classDeclaration.id &&
        //                 classDeclaration.id.type === 'Identifier' &&
        //                 classDeclaration.id.name === right.name
        //               ) {
        //                 source.appendLeft(classDeclarationRange[0], 'export ');

        //                 mangledWords.store(renewedLocalWord, classDeclaration.id.name);
        //               }
        //             },
        //           });
        //         } else {
        //           // When Closure Compiler inlines a window scoped reference, the value is not leveraged elsewhere within the output module.
        //           // e.g. `window.x=1;`
        //           let rightRange = range(right);
        //           if ((discoveredExport as DiscoveredExport).default) {
        //             source.overwrite(statementRange[0], rightRange[0], `export default `);
        //           } else {
        //             source.overwrite(statementRange[0], rightRange[0], `export `);
        //           }
        //         }
        //       }

        //       // if (right.type === 'Literal' && discoveredExport !== null && discoveredExportIndex !== null) {
        //       //   // Closure Compiler inlined the value of this literal.
        //       //   // e.g. `window.PLUGIN = 1;`
        //       //   if ((discoveredExport as DiscoveredExport).default) {
        //       //     originalExports.splice(discoveredExportIndex, 1);
        //       //     source.overwrite(statementRange[0], statementRange[1], `export default ${right.value};`);
        //       //   } else {
        //       //     originalExports.splice(discoveredExportIndex, 1);
        //       //     const renewedWord = getRenewedWord((discoveredExport as DiscoveredExport).exported) || (discoveredExport as DiscoveredExport).exported;
        //       //     source.overwrite(statementRange[0], statementRange[1], `export var ${renewedWord}=${right.value};`)
        //       //   }
        //       // } else if (discoveredExport !== null) {
        //       //   source.remove(statementRange[0], statementRange[1]);
        //       // };
        //     }
        //   }
        // },
      });

      // let otherExports: Array<string> = [];
      // originalExports.forEach(discoveredExport => {
      //   const renewedWord = getRenewedWord(discoveredExport.local) || discoveredExport.local;
      //   if (discoveredExport.default) {
      //     source.trim();
      //     source.appendRight(source.length(), `export default ${renewedWord};`);
      //   } else if (discoveredExport.local !== discoveredExport.exported) {
      //     otherExports.push(`${renewedWord} as ${discoveredExport.exported}`);
      //   } else {
      //     otherExports.push(renewedWord);
      //   }
      // });
      // if (otherExports.length > 0) {
      //   source.trim();
      //   source.appendRight(source.length(), `export{${otherExports.join(',')}};`)
      // }

      // changes.push(...(await remedy(program, moduleMangledWords)));
      let source = await this.applyChanges(changes, code);
      const updatedCode = source.toString();
      console.log('parsing', updatedCode);
      source = await this.applyChanges(
        await remedy(parse(updatedCode), moduleMangledWords),
        updatedCode,
      );

      return {
        code: source.toString(),
        map: source.generateMap(),
        mangledWords: mangled,
      };
    }

    return {
      code,
      mangledWords: mangled,
    };
  }

  // /**
  //  * After Closure Compiler has modified the source, we need to replace the window scoped
  //  * references we added with the intended export statements
  //  * @param code source post Closure Compiler Compilation
  //  * @param chunk OutputChunk from Rollup for this code.
  //  * @param id Rollup identifier for the source
  //  * @return Promise containing the repaired source
  //  */
  // public async postCompilation(code: string, chunk: RenderedChunk, mangled: MangledWords): Promise<MangledTransformSourceDescription> {
  //   if (this.outputOptions === null) {
  //     this.context.warn(
  //       'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
  //     );
  //   } else if (isESMFormat(this.outputOptions.format)) {
  //     const source = new MagicString(code);
  //     const program = parse(code);
  //     const collectedExportsToAppend: Array<string> = [];

  //     const originalExports = this.originalExports;
  //     const originalExportIdentifiers = Object.keys(originalExports);

  //     source.trimEnd();

  //     console.log(code);

  //     walk.ancestor(program, {
  //       // We inserted window scoped assignments for all the export statements during `preCompilation`
  //       // window['exportName'] = exportName;
  //       // Now we need to find where Closure Compiler moved them, and restore the exports of their name.
  //       // ASTExporer Link: https://astexplorer.net/#/gist/94f185d06a4105d64828f1b8480bddc8/0fc5885ae5343f964d0cdd33c7d392a70cf5fcaf
  //       Identifier(node: Identifier, ancestors: Array<Node>) {
  //         if (node.name === 'window') {
  //           ancestors.forEach((ancestor: Node) => {
  //             if (
  //               ancestor.type === 'ExpressionStatement' &&
  //               ancestor.expression.type === 'AssignmentExpression' &&
  //               ancestor.expression.left.type === 'MemberExpression' &&
  //               ancestor.expression.left.object.type === 'Identifier' &&
  //               ancestor.expression.left.object.name === 'window' &&
  //               ancestor.expression.left.property.type === 'Identifier' &&
  //               originalExportIdentifiers.includes(ancestor.expression.left.property.name)
  //             ) {
  //               const exportName = ancestor.expression.left.property.name;
  //               const renewedWord = getRenewedWord(exportName);
  //               console.log('renewName', originalExports[exportName].type, getRenewedWord(exportName));
  //               // Since these words may have been mangled, remedy all mangled values with the original words.
  //               // mangled.initial.forEach((initialName, index) => {
  //               //   importSource = importSource.replace(new RegExp(mangled.final[index].replace('$', '\\$'), "g"), initialName);
  //               // });

  //               switch (originalExports[exportName].type) {
  //                 case ExportClosureMapping.DEFAULT_FUNCTION:
  //                 case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
  //                 case ExportClosureMapping.DEFAULT:
  //                   // console.log(code.substring(range(ancestor.expression)[0], range(ancestor.expression)[1]));
  //                   if (ancestor.expression.left.range) {
  //                     source.overwrite(
  //                       ancestor.expression.left.range[0],
  //                       ancestor.expression.left.range[1] + ancestor.expression.operator.length,
  //                       `export default `,
  //                     );
  //                     // console.log(source.toString());
  //                   }
  //                   break;
  //                 case ExportClosureMapping.NAMED_FUNCTION:
  //                   if (
  //                     ancestor.expression.right.type === 'FunctionExpression' &&
  //                     ancestor.expression.right.params.length > 0
  //                   ) {
  //                     const firstParameter = ancestor.expression.right.params[0];
  //                     if (ancestor.expression.range && firstParameter.range) {
  //                       source.overwrite(
  //                         ancestor.expression.range[0],
  //                         firstParameter.range[0] - 1,
  //                         `export function ${ancestor.expression.left.property.name}`,
  //                       );
  //                     }
  //                   }
  //                   break;
  //                 case ExportClosureMapping.DEFAULT_CLASS:
  //                 case ExportClosureMapping.NAMED_DEFAULT_CLASS:
  //                   if (ancestor.expression.right.type === 'Identifier') {
  //                     const mangledName = ancestor.expression.right.name;

  //                     walk.simple(program, {
  //                       ClassDeclaration(node: ClassDeclaration) {
  //                         if (
  //                           node.id &&
  //                           node.id.name === mangledName &&
  //                           node.range &&
  //                           node.body.range &&
  //                           ancestor.range
  //                         ) {
  //                           if (node.superClass && node.superClass.type === 'Identifier') {
  //                             source.overwrite(
  //                               node.range[0],
  //                               node.body.range[0],
  //                               `export default class extends ${node.superClass.name}`,
  //                             );
  //                           } else {
  //                             source.overwrite(
  //                               node.range[0],
  //                               node.body.range[0],
  //                               `export default class`,
  //                             );
  //                           }
  //                           source.remove(ancestor.range[0], ancestor.range[1]);
  //                         }
  //                       },
  //                     });
  //                   }
  //                   break;
  //                 case ExportClosureMapping.NAMED_CONSTANT:
  //                   if (ancestor.expression.left.object.range) {
  //                     console.log(code.substring(range(ancestor.expression)[0], range(ancestor.expression)[1]));
  //                     console.log(source.toString());
  //                     source.overwrite(
  //                       ancestor.expression.left.object.range[0],
  //                       ancestor.expression.left.object.range[1] + 1,
  //                       'var ',
  //                     );
  //                     console.log(source.toString());
  //                   }

  //                   if (originalExports[exportName].alias !== null) {
  //                     collectedExportsToAppend.push(
  //                       `${ancestor.expression.left.property.name} as ${
  //                         originalExports[exportName].alias
  //                       }`,
  //                     );
  //                   } else {
  //                     collectedExportsToAppend.push(ancestor.expression.left.property.name);
  //                   }
  //                   break;
  //                 case ExportClosureMapping.DEFAULT_VALUE:
  //                 case ExportClosureMapping.DEFAULT_OBJECT:
  //                   if (ancestor.expression.left.object.range && ancestor.expression.right.range) {
  //                     source.overwrite(
  //                       ancestor.expression.left.object.range[0],
  //                       ancestor.expression.right.range[0],
  //                       'export default ',
  //                     );
  //                   }
  //                   break;
  //                 default:
  //                   if (ancestor.range) {
  //                     source.remove(ancestor.range[0], ancestor.range[1]);
  //                   }

  //                   if (ancestor.expression.right.type === 'Identifier') {
  //                     collectedExportsToAppend.push(
  //                       `${ancestor.expression.right.name} as ${
  //                         ancestor.expression.left.property.name
  //                       }`,
  //                     );
  //                   }
  //                   break;
  //               }
  //             }
  //           });
  //         }
  //       },
  //     });

  //     if (collectedExportsToAppend.length > 0) {
  //       source.append(`export{${collectedExportsToAppend.join(',')}};`);
  //     }

  //     return {
  //       code: source.toString(),
  //       map: source.generateMap(),
  //       mangledWords: mangled,
  //     };
  //   }

  //   return {
  //     code,
  //     mangledWords: mangled,
  //   };
  // }
}
