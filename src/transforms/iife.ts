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
import { OutputOptions } from 'rollup';

const HEADER = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains the iife name so it does not get mangled at the top level.
* @externs
*/
`;

/**
 * This Transform will apply only if the Rollup configuration is for a iife output with a defined name.
 *
 * In order to preserve the name of the iife output, derive an extern definition for Closure Compiler.
 * This preserves the name after compilation since Closure now believes it to be a well known global.
 */
export class IifeTransform extends Transform {
  public extern(options: OutputOptions): string {
    let content = HEADER;

    if (options.format === 'iife' && options.name) {
      content += `function ${options.name}(){};\n`;
    }

    return content;
  }
}
