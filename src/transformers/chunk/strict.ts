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

import { ChunkTransform } from '../../transform';
import { Range, TransformInterface } from '../../types';
import { isESMFormat } from '../../options';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { walk, parse } from '../../acorn';
import { ExpressionStatement, SimpleLiteral } from 'estree';
import { extname } from 'path';

export default class StrictTransform extends ChunkTransform implements TransformInterface {
  public name = 'StrictTransform';

  /**
   * When outputting an es module, runtimes automatically apply strict mode conventions.
   * This means we can safely strip the 'use strict'; declaration from the top of the file.
   * @param code source following closure compiler minification
   * @return code after removing the strict mode declaration (when safe to do so)
   */
  public async post(code: string): Promise<TransformSourceDescription> {
    const { file } = this.outputOptions;

    if (isESMFormat(this.outputOptions) || (file && extname(file) === '.mjs')) {
      const source = new MagicString(code);
      const program = parse(code);

      walk.simple(program, {
        ExpressionStatement(node: ExpressionStatement) {
          const { type, value } = node.expression as SimpleLiteral;
          const range: Range = node.range as Range;

          if (type === 'Literal' && value === 'use strict') {
            source.remove(...range);
          }
        },
      });

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
