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
import { VariableDeclaration } from 'estree';

export default class ConstTransform extends Transform implements TransformInterface {
  public name: string = 'ConstTransform';

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
    const changes: Array<CodeTransform> = [];
    const program = parse(code);

    walk.simple(program, {
      VariableDeclaration(node: VariableDeclaration) {
        if (node.kind === 'const') {
          const declarationRange = range(node);
          changes.push({
            type: 'overwrite',
            range: declarationRange,
            content: code
              .substring(declarationRange[0], declarationRange[1])
              .replace('const ', 'let '),
          });
        }
      },
    });

    const source = await this.applyChanges(changes, code);
    return {
      code: source.toString(),
      map: source.generateMap().mappings,
      mangledWords: mangled,
    };
  }
}
