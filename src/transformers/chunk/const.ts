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

import { ChunkTransform } from '../../transform.js';
import { Range } from '../../types.js';
import { parse, walk } from '../../acorn.js';
import { VariableDeclaration } from 'estree';
import MagicString from 'magic-string';

export default class ConstTransform extends ChunkTransform {
  public name = 'ConstTransform';

  /**
   * When outputting ES2017+ code there is neglagible differences between `const` and `let` for runtime performance.
   * So, we replace all usages of `const` with `let` to enable more variable folding.
   * @param code source following closure compiler minification
   * @return code after removing the strict mode declaration (when safe to do so)
   */
  public async pre(fileName: string, source: MagicString): Promise<MagicString> {
    const code = source.toString();
    const program = await parse(fileName, code);

    walk.simple(program, {
      VariableDeclaration(node: VariableDeclaration) {
        const [start, end]: Range = node.range as Range;
        if (node.kind === 'const') {
          source.overwrite(start, end, code.substring(start, end).replace('const', 'let'));
        }
      },
    });

    return source;
  }
}
