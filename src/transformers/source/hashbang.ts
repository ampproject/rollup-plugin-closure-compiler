/**
 * Copyright 2020 The AMP HTML Authors. All Rights Reserved.
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

import { SourceTransform } from '../../transform';
import { TransformInterface } from '../../types';
import MagicString from 'magic-string';

/**
 * Closure Compiler will not compile code that is prefixed with a hashbang (common to rollup output for CLIs).
 *
 * This transform will remove the hashbang (if present) and ask Ebbinghaus to remember if for after compilation.
 */
export default class HashbangTransform extends SourceTransform implements TransformInterface {
  public name = 'HashbangTransform';

  public transform = async (id: string, source: MagicString): Promise<MagicString> => {
    const stringified = source.trim().toString();
    const match = /^#!.*/.exec(stringified);

    if (!match) {
      return source;
    }

    this.memory.hashbang = match[0];
    source.remove(0, match[0].length);
    return source;
  };
}
