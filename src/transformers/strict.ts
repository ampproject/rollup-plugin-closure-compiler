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

import { Transform } from '../types';
import { isESMFormat } from '../options';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { walk, parse } from '../acorn';
import { ExpressionStatement } from 'estree';
import { extname } from 'path';

export default class StrictTransform extends Transform {
  /**
   * When outputting an es module, runtimes automatically apply strict mode conventions.
   * This means we can safely strip the 'use strict'; declaration from the top of the file.
   * @param code source following closure compiler minification
   * @return code after removing the strict mode declaration (when safe to do so)
   */
  public async postCompilation(code: string): Promise<TransformSourceDescription> {
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (
      isESMFormat(this.outputOptions.format) ||
      (this.outputOptions.file && extname(this.outputOptions.file) === '.mjs')
    ) {
      const source = new MagicString(code);
      const program = parse(code);

      walk.simple(program, {
        ExpressionStatement(node: ExpressionStatement) {
          if (
            node.expression.type === 'Literal' &&
            node.expression.value === 'use strict' &&
            node.range
          ) {
            source.remove(node.range[0], node.range[1]);
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
