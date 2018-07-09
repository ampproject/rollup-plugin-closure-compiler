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

const STRICT_MODE_DECLARATION = `'use strict';`;
const STRICT_MODE_DECLARATION_LENGTH = STRICT_MODE_DECLARATION.length;

export class StrictTransform extends Transform {
  /**
   * When outputting an es module, runtimes automatically apply strict mode conventions.
   * This means we can safely strip the 'use strict'; declaration from the top of the file.
   * @param code source following closure compiler minification
   * @param id Rollup Resource id
   * @return code after removing the strict mode declaration (when safe to do so)
   */
  public async postCompilation(code: string, id: string): Promise<TransformSourceDescription> {
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (this.outputOptions.format === 'es' && code.startsWith(STRICT_MODE_DECLARATION)) {
      // This will only remove the top level 'use strict' directive since we cannot
      // be certain source does not contain strings with the intended content.
      code = code.slice(STRICT_MODE_DECLARATION_LENGTH, code.length);
    }

    return {
      code,
    };
  }
}
