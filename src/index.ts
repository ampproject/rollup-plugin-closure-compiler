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
import { sync } from 'temp-write';
import { readFileSync } from 'fs';
import { OutputOptions, RawSourceMap, Plugin } from 'rollup';
import { closureTransform as ExternsClosureTransform } from './transforms/identify-exports';
import { closureTransform as IifeClosureTransform } from './transforms/iife-wrapper';

export const defaultCompileOptions = (options: OutputOptions): CompileOptions => {
  // Defaults for Rollup Projects are slightly different than Closure Compiler defaults.
  // - Users of Rollup tend to transpile their code before handing it to a minifier,
  // so no transpile is default.
  // - When Rollup output is set to "es" it is expected the code will live in a ES Module,
  // so safely be more aggressive in minification.
  // - When Rollup is configured to output an iife, ensure Closure Compiler does not
  // mangle the name of the iife wrapper.

  const externs = [IifeClosureTransform.externFile(options), ExternsClosureTransform.externFile(options)];
  const flags: CompileOptions = {
    language_out: 'NO_TRANSPILE',
    assume_function_wrapper: options.format === 'es' ? true : false,
    warning_level: 'QUIET',
    externs,
  };

  return flags;
};

export default function closureCompiler(compileOptions: CompileOptions = {}): Plugin {
  return {
    name: 'closure-compiler',
    transform: ExternsClosureTransform.transform,
    transformBundle: (code: string, outputOptions: OutputOptions): Promise<{ code: string; map: RawSourceMap } | void> => {
      // console.log(code, this.parse);
      const temp = {
        js: sync(code),
        map: sync(''),
      };

      compileOptions = Object.assign(defaultCompileOptions(outputOptions), compileOptions, {
        js: temp.js,
        create_source_map: temp.map,
      });

      const compile: Promise<string> = new Promise((resolve, reject) => {
        new compiler(compileOptions).run((exitCode: number, stdOut: string, stdErr: string) => {
          if (exitCode !== 0) {
            reject(new Error(`Google Closure Compiler exit ${exitCode}: ${stdErr}`));
          } else {
            resolve(stdOut);
          }
        });
      });

      return compile.then(
        stdOut => {
          const sourceMap: RawSourceMap = JSON.parse(readFileSync(temp.map, 'utf8'));
          return { code: stdOut, map: sourceMap };
        },
        (error: Error) => {
          throw error;
        },
      );
    },
  };
}
