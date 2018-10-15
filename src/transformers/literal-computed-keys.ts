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
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { ObjectExpression } from 'estree';
const walk = require('acorn-walk');

/**
 * Closure Compiler will not transform computed keys with literal values back to the literal value.
 * e.g {[0]: 'value'} => {0: 'value'}
 *
 * This transform does so only if a computed key is a Literal, and thus easily known to be static.
 * @see https://astexplorer.net/#/gist/d2414b45a81db3a41ee6902bfd09947a/d7176ac33a2733e1a4b1f65ec3ac626e24f7b60d
 */
export default class LiteralComputedKeys extends Transform {
  /**
   * @param code source to parse, and modify
   * @return modified input source with computed literal keys
   */
  public async postCompilation(code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    const program = this.context.parse(code, { ranges: true });

    walk.simple(program, {
      ObjectExpression(node: ObjectExpression) {
        const properties = node.properties;
        properties.forEach(property => {
          if (
            property.computed &&
            property.key.type === 'Literal' &&
            property.range &&
            property.value.range
          ) {
            source.overwrite(
              property.range[0],
              property.value.range[0],
              `${property.key.value}${property.value.type !== 'FunctionExpression' ? ':' : ''}`,
            );
          }
        });
      },
    });

    return {
      code: source.toString(),
      map: source.generateMap(),
    };
  }
}
