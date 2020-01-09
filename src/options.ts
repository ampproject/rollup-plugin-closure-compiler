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
import { writeTempFile } from './temp-file';
import { log } from './debug';

export const ERROR_WARNINGS_ENABLED_LANGUAGE_OUT_UNSPECIFIED =
  'Providing the warning_level=VERBOSE compile option also requires a valid language_out compile option.';
export const ERROR_WARNINGS_ENABLED_LANGUAGE_OUT_INVALID =
  'Providing the warning_level=VERBOSE and language_out=NO_TRANSPILE compile options will remove warnings.';

/**
 * Checks if output format is ESM
 * @param outputOptions
 * @return boolean
 */
export const isESMFormat = ({ format }: OutputOptions): boolean =>
  format === 'esm' || format === 'es';

/**
 * Throw Errors if compile options will result in unexpected behaviour.
 * @param compileOptions
 */
function validateCompileOptions(compileOptions: CompileOptions): void {
  if ('warning_level' in compileOptions && compileOptions.warning_level === 'VERBOSE') {
    if (!('language_out' in compileOptions)) {
      throw new Error(ERROR_WARNINGS_ENABLED_LANGUAGE_OUT_UNSPECIFIED);
    }
    if (compileOptions.language_out === 'NO_TRANSPILE') {
      throw new Error(ERROR_WARNINGS_ENABLED_LANGUAGE_OUT_INVALID);
    }
  }
}

/**
 * Generate default Closure Compiler CompileOptions an author can override if they wish.
 * These must be derived from configuration or input sources.
 * @param transformers
 * @param options
 * @return derived CompileOptions for Closure Compiler
 */
export const defaults = async (
  options: OutputOptions,
  providedExterns: Array<string>,
  transformers: Array<Transform> | null,
): Promise<CompileOptions> => {
  // Defaults for Rollup Projects are slightly different than Closure Compiler defaults.
  // - Users of Rollup tend to transpile their code before handing it to a minifier,
  // so no transpile is default.
  // - When Rollup output is set to "es|esm" it is expected the code will live in a ES Module,
  // so safely be more aggressive in minification.

  const transformerExterns: Array<string> = [];
  for (const transform of transformers || []) {
    const extern = transform.extern(options);
    if (extern !== null) {
      const writtenExtern = await writeTempFile(extern);
      transformerExterns.push(writtenExtern);
    }
  }

  return {
    language_out: 'NO_TRANSPILE',
    assume_function_wrapper: isESMFormat(options),
    warning_level: 'QUIET',
    module_resolution: 'NODE',
    externs: transformerExterns.concat(providedExterns),
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
export default async function(
  incomingCompileOptions: CompileOptions,
  outputOptions: OutputOptions,
  code: string,
  transforms: Array<Transform> | null,
): Promise<[CompileOptions, string]> {
  const mapFile: string = await writeTempFile('');
  const compileOptions: CompileOptions = { ...incomingCompileOptions };
  let externs: Array<string> = [];

  validateCompileOptions(compileOptions);
  if ('externs' in compileOptions) {
    switch (typeof compileOptions.externs) {
      case 'boolean':
        externs = [];
        break;
      case 'string':
        externs = [compileOptions.externs as string];
        break;
      default:
        externs = compileOptions.externs as Array<string>;
        break;
    }

    delete compileOptions.externs;
  }

  const options = {
    ...(await defaults(outputOptions, externs, transforms)),
    ...compileOptions,
    js: await writeTempFile(code),
    create_source_map: mapFile,
  };

  log('compile options', options);

  return [options, mapFile];
}
