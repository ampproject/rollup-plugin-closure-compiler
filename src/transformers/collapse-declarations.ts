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

import { Transform } from './transform';
import {
  TransformInterface,
  MangledTransformSourceDescription,
  MangledWords,
  CodeTransform,
} from '../types';
import { RenderedChunk } from 'rollup';
import { parse, walk, range } from '../acorn';
import { VariableDeclaration, ClassDeclaration } from 'estree';

export default class CollapseDeclarations extends Transform implements TransformInterface {
  public name: string = 'CollapseDeclarations';

  /**
   * When outputting ES2017+ code there is neglagible differences between `const` and `let` for runtime performance.
   * So, we replace all usages of `const` with `let` to enable more variable folding.
   * @param code source following closure compiler minification
   * @return code after removing the strict mode declaration (when safe to do so)
   */
  public async preCompilation(
    code: string,
    chunk: RenderedChunk,
    mangled: MangledWords,
  ): Promise<MangledTransformSourceDescription> {
    const declarations: Array<string> = [];
    const changes: Array<CodeTransform> = [];
    let allowTransform = true;
    const program = parse(code);

    walk.simple(program, {
      ClassDeclaration(node: ClassDeclaration) {
        const classDeclarationRange = range(node);

        if (node.id !== null && node.id.type === 'Identifier') {
          const idRange = range(node.id);
          declarations.push(
            `${node.id.name}=${code.substring(
              classDeclarationRange[0],
              idRange[0],
            )}${code.substring(idRange[1], classDeclarationRange[1])}`,
          );
          changes.push({
            type: 'remove',
            range: classDeclarationRange,
          });
        } else {
          allowTransform = false;
        }
      },
      VariableDeclaration(node: VariableDeclaration) {
        let allDeclarationsRemoved = true;
        const variableDeclarations: Array<string> = [];
        const variableDeclarationRange = range(node);

        node.declarations.forEach(declaration => {
          const declarationRange = range(declaration);

          if (declaration.id.type !== 'Identifier') {
            this.context.warn(
              'Rollup Plugin Closure Compiler was unable to collapse variable declarations.',
            );

            allowTransform = false;
            allDeclarationsRemoved = false;
          } else {
            variableDeclarations.push(code.substring(declarationRange[0], declarationRange[1]));
          }
        }, this);

        if (allDeclarationsRemoved) {
          declarations.push(...variableDeclarations);
          changes.push({
            type: 'remove',
            range: variableDeclarationRange,
          });
        }
      },
    });

    if (declarations.length > 0) {
      changes.push({
        type: 'prepend',
        content: `var ${declarations.join(',')};`,
      });
    }

    if (allowTransform) {
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
}
