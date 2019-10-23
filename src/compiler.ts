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

import { compiler, CompileOptions } from 'google-closure-compiler';
const {
  getNativeImagePath,
  getFirstSupportedPlatform,
} = require('google-closure-compiler/lib/utils.js');
import { Transform } from './types';
import { postCompilation } from './transforms';

enum Platform {
  NATIVE = 'native',
  JAVA = 'java',
  JAVASCRIPT = 'javascript',
}

/**
 * Splits user `prefer` option from compiler options object
 * returns new object containing options and preferred platform.
 * @param {CompileOptions} content - compiler options object
 * @return {Object}
 * @example in rollup.config.js
 *  buble(),
 *  compiler({
 *    prefer: 'javascript',
 *  }),
 */
function filterContent(content: CompileOptions) {
  let prefer: any = '';
  if ('prefer' in content) {
    prefer = content['prefer'];
    delete content.prefer;
  };
  const res = { config: content, prefer: prefer };
  return res;
}

/**
 * Finds prefered user platform precedence in list of defaults
 * and re-orders the list with prefered option first.
 * @param {Array} haystack - array of allowed platform strings
 * @param {String} needle - preferred platform string
 * @return {Array}
 */
function reOrder(haystack: string[], needle: string) {
  const index = haystack.indexOf(needle);
  const precedent = haystack.splice(index, 1);
  return precedent.concat(haystack);
}

const PLATFORM_PRECEDENCE = [Platform.NATIVE, Platform.JAVA, Platform.JAVASCRIPT];

/**
 * Run Closure Compiler and `postCompilation` Transforms on input source.
 * @param compileOptions Closure Compiler CompileOptions, normally derived from Rollup configuration
 * @param transforms Transforms to run rollowing compilation
 * @return Promise<string> source following compilation and Transforms.
 */
export default function(
  compileOptions: CompileOptions,
  transforms: Array<Transform>,
): Promise<string> {
  return new Promise((resolve: (stdOut: string) => void, reject: (error: any) => void) => {
    
    const options = filterContent(compileOptions);
    
    const { prefer, config } = options;

    const USER_PLATFORM_PRECEDENCE = (prefer !== '') ? reOrder(PLATFORM_PRECEDENCE, prefer) : PLATFORM_PRECEDENCE;

    const instance = new compiler(config);

    const firstSupportedPlatform = getFirstSupportedPlatform(USER_PLATFORM_PRECEDENCE);

    if (firstSupportedPlatform !== Platform.JAVA) {

      // TODO(KB): Provide feedback on this API. It's a little strange to nullify the JAR_PATH
      // and provide a fake java path.
      instance.JAR_PATH = null;
      instance.javaPath = getNativeImagePath();
    }

    instance.run(async (exitCode: number, code: string, stdErr: string) => {
      if (
        'warning_level' in compileOptions &&
        compileOptions.warning_level === 'VERBOSE' &&
        stdErr !== ''
      ) {
        reject(new Error(`Google Closure Compiler ${stdErr}`));
      } else if (exitCode !== 0) {
        reject(new Error(`Google Closure Compiler exit ${exitCode}: ${stdErr}`));
      } else {
        resolve(await postCompilation(code, transforms));
      }
    });
  });
}
