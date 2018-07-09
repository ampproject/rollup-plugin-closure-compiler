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
import * as fs from 'fs';
import { promisify } from 'util';
import { OutputOptions, RawSourceMap, Plugin, PluginContext, OutputChunk } from 'rollup';
import { ExportTransform } from './transforms/exports';
import { IifeTransform } from './transforms/iife';
import { StrictTransform } from './transforms/strict';
import { Transform } from './types';

const readFile = promisify(fs.readFile);

/**
 * Generate default Closure Compiler CompileOptions an author can override if they wish.
 * These must be derived from configuration or input sources.
 * @param transformers
 * @param options
 * @return derived CompileOptions for Closure Compiler
 */
export const defaultCompileOptions = (transformers: Array<Transform> | null, options: OutputOptions): CompileOptions => {
  // Defaults for Rollup Projects are slightly different than Closure Compiler defaults.
  // - Users of Rollup tend to transpile their code before handing it to a minifier,
  // so no transpile is default.
  // - When Rollup output is set to "es" it is expected the code will live in a ES Module,
  // so safely be more aggressive in minification.
  // - When Rollup is configured to output an iife, ensure Closure Compiler does not
  // mangle the name of the iife wrapper.

  const externs = transformers ? transformers.map(transform => sync(transform.extern(options))) : '';
  const flags: CompileOptions = {
    language_out: 'NO_TRANSPILE',
    assume_function_wrapper: options.format === 'es' ? true : false,
    warning_level: 'QUIET',
    externs,
  };

  return flags;
};

/**
 * Instantiate transform class instances for the plugin invocation.
 * @param context Plugin context to bind for each transform instance.
 * @param options Rollup input options
 * @param id Rollup's id entry for this source.
 * @return Instantiated transform class instances for the given entry point.
 */
export const instantiateTransforms = (context: PluginContext): Array<Transform> => {
  return [new IifeTransform(context), new ExportTransform(context), new StrictTransform(context)];
};

/**
 * Transform the tree-shaken code from Rollup with Closure Compiler (with derived configuration and transforms)
 * @param compileOptions Closure Compiler compilation options from Rollup configuration.
 * @param transforms Transforms to apply to source followin Closure Compiler completion.
 * @param code Source to compile.
 * @param outputOptions Rollup Output Options.
 * @return Closure Compiled form of the Rollup Chunk
 */
export const transformChunk = async (
  transforms: Array<Transform>,
  compileOptions: CompileOptions,
  code: string,
  outputOptions: OutputOptions,
): Promise<{ code: string; map: RawSourceMap } | void> => {
  // Each transform has a 'preCompilation' step that must complete before passing
  // the resulting code to Closure Compiler.
  for (const transform of transforms) {
    transform.outputOptions = outputOptions;
    const result = await transform.preCompilation(code, 'none');
    if (result && result.code) {
      code = result.code;
    }
  }

  const jsAsFile = sync(code);
  const mapAsFile = sync('');

  // Compile Options is the final configuration to pass into Closure Compiler.
  // defaultCompileOptions are overrideable by ones passed in directly to the plugin
  // but the js source and sourcemap are not overrideable, since this would break the output if passed.
  compileOptions = {
    ...defaultCompileOptions(transforms, outputOptions),
    ...compileOptions,
    ...{
      js: jsAsFile,
      create_source_map: mapAsFile,
    },
  };

  const compile: Promise<string> = new Promise((resolve: (stdOut: string) => void, reject: (error: any) => void) => {
    new compiler(compileOptions).run(async (exitCode: number, code: string, stdErr: string) => {
      if (exitCode !== 0) {
        reject(new Error(`Google Closure Compiler exit ${exitCode}: ${stdErr}`));
      } else {
        // Following successful Closure Compiler compilation, each transform needs an opportunity
        // to clean up work is performed in preCompilation via postCompilation.
        for (const transform of transforms) {
          const result = await transform.postCompilation(code, 'none');
          if (result && result.code) {
            code = result.code;
          }
        }
        resolve(code);
      }
    });
  });

  return compile.then(
    async code => {
      return { code, map: JSON.parse(await readFile(mapAsFile, 'utf8')) };
    },
    (error: Error) => {
      throw error;
    },
  );
};

export default function closureCompiler(compileOptions: CompileOptions = {}): Plugin {
  let transforms: Array<Transform>;

  return {
    name: 'closure-compiler',
    load() {
      transforms = transforms || instantiateTransforms(this);
    },
    transform: async (code: string) => {
      for (const transform of transforms) {
        await transform.deriveFromInputSource(code, 'none');
      }
    },
    transformChunk: async (code: string, outputOptions: OutputOptions, chunk: OutputChunk) =>
      await transformChunk(transforms, compileOptions, code, outputOptions),
  };
}
