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
  FunctionDeclaration,
} from 'estree';
import { RenderedChunk, PluginContext } from 'rollup';
import { isESMFormat } from '../options';
import {
  TransformInterface,
  MangledWords,
  MangledTransformSourceDescription,
  DiscoveredExport,
  CodeTransform,
} from '../types';
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

  private static async deriveExports(
    code: string,
    context: PluginContext,
  ): Promise<Array<DiscoveredExport>> {
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
      this.exports = await ExportTransform.deriveExports(code, this.context);

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
        map: source.generateMap().mappings,
        mangledWords: mangled,
      };
    }

    return {
      code,
      mangledWords: mangled,
    };
  }

  private static discoverCompiledExport(
    statement: ExpressionStatement,
    exportArray: Array<DiscoveredExport>,
  ): DiscoveredExport | null {
    if (statement.expression.type === 'AssignmentExpression') {
      const left = statement.expression.left;

      if (
        left.type === 'MemberExpression' &&
        left.object.type === 'Identifier' &&
        left.property.type === 'Identifier' &&
        left.object.name === 'window'
      ) {
        for (const exported of exportArray) {
          if (exported.local === (left.property as Identifier).name) {
            return exported;
          }
        }
      }
      return null;
    }

    return null;
  }

  private static renewVariableDeclarationExport(
    variableDeclaration: VariableDeclaration,
    renewedExport: DiscoveredExport,
    expressionRightName: string,
    changes: Array<CodeTransform>,
    mangledExportWords: MangledWords,
  ): boolean {
    const variableDeclarationRange = range(variableDeclaration);
    variableDeclaration.declarations.forEach(declarator => {
      if (declarator.id.type === 'Identifier' && declarator.id.name === expressionRightName) {
        changes.push({
          type: 'appendLeft',
          range: [variableDeclarationRange[0], 0],
          content: renewedExport.default ? 'export default ' : 'export ',
        });

        if (!renewedExport.default) {
          mangledExportWords.store(renewedExport.local, declarator.id.name);
        }

        return true;
      }
    });

    return false;
  }

  private static renewClassDeclarationExport(
    classDeclaration: ClassDeclaration,
    renewedExport: DiscoveredExport,
    expressionRightName: string,
    changes: Array<CodeTransform>,
    mangledExportWords: MangledWords,
  ): boolean {
    const classDeclarationRange = range(classDeclaration);
    if (
      classDeclaration.id &&
      classDeclaration.id.type === 'Identifier' &&
      classDeclaration.id.name === expressionRightName
    ) {
      changes.push({
        type: 'appendLeft',
        range: [classDeclarationRange[0], 0],
        content: renewedExport.default ? 'export default ' : 'export ',
      });

      if (!renewedExport.default) {
        mangledExportWords.store(renewedExport.local, classDeclaration.id.name);
      }

      return true;
    }

    return false;
  }

  private static renewFunctionDeclarationExport(
    functionDeclaration: FunctionDeclaration,
    renewedExport: DiscoveredExport,
    expressionRightName: string,
    changes: Array<CodeTransform>,
    mangledExportWords: MangledWords,
  ): boolean {
    const functionDeclarationRange = range(functionDeclaration);
    if (functionDeclaration.id && functionDeclaration.id.name === expressionRightName) {
      changes.push({
        type: 'appendLeft',
        range: [functionDeclarationRange[0], 0],
        content: renewedExport.default ? 'export default ' : 'export ',
      });

      if (!renewedExport.default) {
        mangledExportWords.store(renewedExport.local, functionDeclaration.id.name);
      }

      return true;
    }

    return false;
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
      const self = this;
      const program = parse(code);
      const mangledExportWords: MangledWords = new MangledWords();
      const changes: Array<CodeTransform> = [];

      walk.simple(program, {
        ExpressionStatement(statement: ExpressionStatement) {
          const discoveredExport = ExportTransform.discoverCompiledExport(statement, self.exports);

          if (discoveredExport !== null) {
            const right = (statement.expression as AssignmentExpression).right;
            const rightRange = range(right);
            const statementRange = range(statement);

            const renewedExport: DiscoveredExport = {
              ...discoveredExport,
              local: mangled.getInitial(discoveredExport.local) || discoveredExport.local,
              exported: mangled.getInitial(discoveredExport.exported) || discoveredExport.exported,
            };
            let exportLocationDiscovered: boolean = false;

            if (right.type === 'Identifier') {
              changes.push({
                type: 'remove',
                range: statementRange,
              });

              walk.simple(program, {
                VariableDeclaration(variableDeclaration: VariableDeclaration) {
                  exportLocationDiscovered = ExportTransform.renewVariableDeclarationExport(
                    variableDeclaration,
                    renewedExport,
                    right.name,
                    changes,
                    mangledExportWords,
                  );
                },
                ClassDeclaration(classDeclaration: ClassDeclaration) {
                  exportLocationDiscovered = ExportTransform.renewClassDeclarationExport(
                    classDeclaration,
                    renewedExport,
                    right.name,
                    changes,
                    mangledExportWords,
                  );
                },
                FunctionDeclaration(functionDeclaration: FunctionDeclaration) {
                  exportLocationDiscovered = ExportTransform.renewFunctionDeclarationExport(
                    functionDeclaration,
                    renewedExport,
                    right.name,
                    changes,
                    mangledExportWords,
                  );
                },
              });

              if (!exportLocationDiscovered && renewedExport.default) {
                changes.push({
                  type: 'append',
                  content: `export default ${renewedExport.exported};`,
                });
              }
            } else if (right.type === 'Literal') {
              changes.push({
                type: 'overwrite',
                range: statementRange,
                content: renewedExport.default
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
                    renewedExport.default ? 'default ' : ''
                  }${existingFunction.replace(
                    'function(',
                    `function${renewedExport.default ? '' : ` ${renewedExport.local}`}(`,
                  )}`,
                });
              } else if (right.type === 'ArrowFunctionExpression') {
                const existingFunction = code.substring(rightRange[0], rightRange[1]);
                changes.push({
                  type: 'overwrite',
                  range: [statementRange[0], rightRange[1]],
                  content: `export ${renewedExport.default ? 'default ' : ''}var ${
                    renewedExport.local
                  }=${existingFunction}`,
                });
              } else {
                changes.push({
                  type: 'overwrite',
                  range: [statementRange[0], rightRange[0]],
                  content: renewedExport.default ? 'export default ' : 'export ',
                });
              }
            }
          }
        },
      });

      let source = await this.applyChanges(changes, code);
      const updatedCode = source.toString();
      source = await this.applyChanges(
        await remedy(parse(updatedCode), mangledExportWords),
        updatedCode,
      );

      return {
        code: source.toString(),
        map: source.generateMap().mappings,
        mangledWords: mangled,
      };
    }

    return {
      code,
      mangledWords: mangled,
    };
  }
}
