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
import { OutputChunk } from '../node_modules/rollup';

enum Platform {
  NATIVE = 'native',
  JAVA = 'java',
  JAVASCRIPT = 'javascript',
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
  chunk: OutputChunk,
  transforms: Array<Transform>,
): Promise<string> {
  return new Promise((resolve: (stdOut: string) => void, reject: (error: any) => void) => {
    const instance = new compiler(compileOptions);

    if (getFirstSupportedPlatform(PLATFORM_PRECEDENCE) === Platform.NATIVE) {
      // We would like to use the native platform instead of Java or Javascript on this system.

      // TODO(KB): Provide feedback on this API. It's a little strange to nullify the JAR_PATH
      // and provide a fake java path.
      instance.JAR_PATH = null;
      instance.javaPath = getNativeImagePath();
    }

    instance.run(async (exitCode: number, code: string, stdErr: string) => {
      console.log(compileOptions, exitCode, stdErr);
      if (exitCode !== 0) {
        reject(new Error(`Google Closure Compiler exit ${exitCode}: ${stdErr}`));
      } else {
        resolve(await postCompilation(code, chunk, transforms));
      }
    });
  });
}
