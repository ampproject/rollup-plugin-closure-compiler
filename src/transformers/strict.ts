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

import { isESMFormat } from '../options';
import { Transform } from './transform';
import {
  TransformInterface,
  MangledTransformSourceDescription,
  MangledWords,
  CodeTransform,
} from '../types';
import { RenderedChunk } from 'rollup';
import { parse, walk, range } from '../acorn';
import { ExpressionStatement } from 'estree';

export default class StrictTransform extends Transform implements TransformInterface {
  public name: string = 'StrictTransform';

  /**
   * When outputting an es module, runtimes automatically apply strict mode conventions.
   * This means we can safely strip the 'use strict'; declaration from the top of the file.
   * @param code source following closure compiler minification
   * @return code after removing the strict mode declaration (when safe to do so)
   */
  public async postCompilation(
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
      const program = parse(code);

      walk.simple(program, {
        ExpressionStatement(node: ExpressionStatement) {
          if (node.expression.type === 'Literal' && node.expression.value === 'use strict') {
            const expressionRange = range(node);
            changes.push({
              type: 'remove',
              range: expressionRange,
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

    return {
      code,
      mangledWords: mangled,
    };
  }
}
