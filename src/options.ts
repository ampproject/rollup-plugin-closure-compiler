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

import { Transform } from './types';
import { OutputOptions } from 'rollup';
import { CompileOptions } from 'google-closure-compiler';
import { sync } from 'temp-write';

/**
 * Generate default Closure Compiler CompileOptions an author can override if they wish.
 * These must be derived from configuration or input sources.
 * @param transformers
 * @param options
 * @return derived CompileOptions for Closure Compiler
 */
export const defaults = (
  options: OutputOptions,
  transformers: Array<Transform> | null,
): CompileOptions => {
  // Defaults for Rollup Projects are slightly different than Closure Compiler defaults.
  // - Users of Rollup tend to transpile their code before handing it to a minifier,
  // so no transpile is default.
  // - When Rollup output is set to "es" it is expected the code will live in a ES Module,
  // so safely be more aggressive in minification.
  // - When Rollup is configured to output an iife, ensure Closure Compiler does not
  // mangle the name of the iife wrapper.

  const externs = transformers
    ? transformers.map(transform => sync(transform.extern(options)))
    : '';

  return {
    language_out: 'NO_TRANSPILE',
    assume_function_wrapper: options.format === 'es' ? true : false,
    warning_level: 'QUIET',
    externs,
  };
};

/**
 * Compile Options is the final configuration to pass into Closure Compiler.
 * defaultCompileOptions are overrideable by ones passed in directly to the plugin
 * but the js source and sourcemap are not overrideable, since this would break the output if passed.
 * @param compileOptions
 * @param outputOptions
 * @param code
 * @param transforms
 */
export default function(
  compileOptions: CompileOptions,
  outputOptions: OutputOptions,
  code: string,
  transforms: Array<Transform> | null,
): [CompileOptions, string] {
  const mapFile = sync('');

  return [
    {
      ...defaults(outputOptions, transforms),
      ...compileOptions,
      js: sync(code),
      create_source_map: mapFile,
    },
    mapFile,
  ];
}
