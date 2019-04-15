/**
 * Copyright 2019 The AMP HTML Authors. All Rights Reserved.
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

import { Transform, Range, TransformInterface } from '../types';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { ArrowFunctionExpression } from 'estree';
import { parse, walk } from '../acorn';

/**
 * Closure Compiler will occasionally wrap ArrowFunctionExpression Parameters with additional parenthesis.
 * e.g (a)=>a.foo() => a=>a.foo()
 *
 * @see https://astexplorer.net/#/gist/20d7fbe32292c6c9f303c1d9643885ec/6c97fabca987814cced795b8d3d078094e642264
 */
export default class ArrowFunctionTransform extends Transform implements TransformInterface {
  /**
   * @param code source to parse, and modify
   * @return modified input source with computed literal keys
   */
  public async postCompilation(code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    const program = parse(code);

    walk.simple(program, {
      ArrowFunctionExpression(arrowFunction: ArrowFunctionExpression) {
        const functionRange: Range = arrowFunction.range as Range;
        const params = arrowFunction.params;
        if (params.length === 1) {
          const identifier = params[0];
          if ('name' in identifier) {
            const paramRange: Range = params[0].range as Range;
            if (functionRange[0] !== paramRange[0]) {
              const bodyRange = arrowFunction.body.range as Range;
              source.overwrite(functionRange[0], bodyRange[0], `${identifier.name}=>`);
            }
          }
        }
      },
    });

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  }
}
