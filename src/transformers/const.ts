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

import { Transform, TransformInterface } from '../types';
import { parse, walk } from '../acorn';
import { VariableDeclaration } from 'estree';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';

export default class ConstTransform extends Transform implements TransformInterface {
  /**
   * When outputting ES2017+ code there is neglagible differences between `const` and `let` for runtime performance.
   * So, we replace all usages of `const` with `let` to enable more variable folding.
   * @param code source following closure compiler minification
   * @return code after removing the strict mode declaration (when safe to do so)
   */
  public async preCompilation(code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    const program = parse(code);

    walk.simple(program, {
      VariableDeclaration(node: VariableDeclaration) {
        if (node.kind === 'const' && node.range) {
          source.overwrite(
            node.range[0],
            node.range[1],
            code.substring(node.range[0], node.range[1]).replace('const ', 'let '),
          );
        }
      },
    });

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  }
}
