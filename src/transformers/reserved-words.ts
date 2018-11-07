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

import { RenderedChunk } from 'rollup';
import { parse, walk, range } from '../acorn';
import { Transform } from './transform';
import {
  TransformInterface,
  MangledWords,
  MangledTransformSourceDescription,
  CodeTransform,
} from '../types';
import {
  Identifier,
  ClassDeclaration,
  ImportSpecifier,
  ExportSpecifier,
  ExportNamedDeclaration,
  ImportDeclaration,
  Program,
  ImportNamespaceSpecifier,
  ImportDefaultSpecifier,
} from 'estree';
import { remedy, mangleWord } from '../mangle';

export default class ReservedWords extends Transform implements TransformInterface {
  public name: string = 'ReservedWords';

  private async mangleImportDeclarations(
    program: Program,
    mangled: MangledWords,
  ): Promise<Array<CodeTransform>> {
    const changes: Array<CodeTransform> = [];

    walk.simple(program, {
      async ImportDeclaration(node: ImportDeclaration) {
        node.specifiers.forEach(
          (specifier: ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier) => {
            // Asked to mangle an imported name from an external import.
            // This is doable, so long as the name is retained after Closure Compiler completes its changes.

            // Examples:
            // `import {Storage} from 'storage';`
            // `import {foo as Storage} from 'storage-thing';`
            // `import * as PluginValues from 'plugin-values';`
            // `import PluginDefault from 'plugin-default';`

            // Where 'plugin-values' is not resolved by Rollup, and 'PluginValues' is a word to mangle.

            changes.push(mangleWord(specifier.local.name, range(specifier.local), mangled));
          },
        );
      },
    });

    return changes;
  }

  private async mangleExportDeclarations(
    program: Program,
    mangled: MangledWords,
  ): Promise<Array<CodeTransform>> {
    const changes: Array<CodeTransform> = [];
    const context = this.context;

    walk.simple(program, {
      ExportNamedDeclaration(node: ExportNamedDeclaration) {
        node.specifiers.forEach((specifier: ExportSpecifier) => {
          const localRange = range(specifier.local);
          const exportedRange = range(specifier.exported);
          if (localRange[0] === exportedRange[0] && localRange[1] === exportedRange[1]) {
            // The two ranges start and end at the same locations, this export has a single shared local and exported name.
            // i.e. `export {Plugin};`
            changes.push(mangleWord(specifier.local.name, localRange, mangled));
          } else {
            changes.push(mangleWord(specifier.local.name, localRange, mangled));
            changes.push(mangleWord(specifier.exported.name, exportedRange, mangled));
          }
        });
      },
      ExportAllDeclaration() {
        // TODO(KB): This case `export * from "./import"` is not currently supported.
        context.error(
          new Error(
            `Rollup Plugin Closure Compiler does not support export all syntax for externals.`,
          ),
        );
      },
    });

    return changes;
  }

  /**
   * Mangle the references to reserved words requested via configuration
   * @param code source before closure compiler minification
   * @param chunk Rollup's chunk for this output.
   * @param mangled Reserved words already mangled by the transformer pipeline.
   * @return code after mangling requested reserved words
   */
  public async preCompilation(
    code: string,
    chunk: RenderedChunk,
    mangled: MangledWords,
  ): Promise<MangledTransformSourceDescription> {
    const program = parse(code);
    const changes: Array<CodeTransform> = [];

    changes.push(...(await this.mangleImportDeclarations(program, mangled)));
    changes.push(...(await this.mangleExportDeclarations(program, mangled)));

    walk.simple(program, {
      ClassDeclaration(node: ClassDeclaration) {
        if (node.id !== null) {
          changes.push(mangleWord(node.id.name, range(node.id), mangled));
        }
      },
      Identifier(node: Identifier) {
        changes.push(mangleWord(node.name, range(node), mangled));
      },
    });

    const source = await this.applyChanges(changes, code);

    return {
      code: source.toString(),
      map: source.generateMap(),
      mangledWords: mangled,
    };
  }

  /**
   * Remedy references to reserved words remaining in source.
   * Typically these remaining words are due to external imports that Rollup did not flatten.
   * @param code source after closure compiler minification
   * @param chunk
   * @param mangled
   */
  public async postCompilation(
    code: string,
    chunk: RenderedChunk,
    mangled: MangledWords,
  ): Promise<MangledTransformSourceDescription> {
    const program = parse(code);
    const changes = await remedy(program, mangled);

    const source = await this.applyChanges(changes, code);
    return {
      code: source.toString(),
      map: source.generateMap(),
      mangledWords: mangled,
    };
  }
}
