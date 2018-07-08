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
import * as path from 'path';
import { promisify } from 'util';
import {
  OutputOptions,
  RawSourceMap,
  Plugin,
  InputOptions,
  TransformSourceDescription,
  PluginContext,
  OutputChunk,
} from 'rollup';
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
export const instantiateTransforms = (
  context: PluginContext,
  inputOptions: InputOptions | null,
  outputOptions: OutputOptions,
  id: string,
): Array<Transform> | null => {
  const entry = inputOptions && inputOptions.entry && path.resolve(inputOptions.entry);
  if (entry === id) {
    return [
      new IifeTransform(context, entry, outputOptions),
      new ExportTransform(context, entry, outputOptions),
      new StrictTransform(context, entry, outputOptions),
    ];
  }

  return null;
};

/**
 * Invoke all transformations for this Plugin invocation.
 * @param transforms Bound Transformations instances to apply
 * @param code source code to transform
 * @param id Rollup's id entry for this source
 * @return Transformed source from all transforms associated with this Plugin invocation.
 */
export const transform = async (
  transforms: Array<Transform> | null,
  code: string,
  id: string,
): Promise<TransformSourceDescription> => {
  let output: TransformSourceDescription = {
    code,
  };

  if (transforms) {
    for (let iterator = 0; iterator < transforms.length; iterator++) {
      const transformed = await transforms[iterator].input(output.code, id);
      if (transformed) {
        output = transformed;
      }
    }
  }

  return output;
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
  compileOptions: CompileOptions,
  transforms: Array<Transform> | null,
  code: string,
  outputOptions: OutputOptions,
): Promise<{ code: string; map: RawSourceMap } | void> => {
  const jsAsFile = sync(code);
  const mapAsFile = sync('');

  compileOptions = Object.assign(defaultCompileOptions(transforms, outputOptions), compileOptions, {
    js: jsAsFile,
    create_source_map: mapAsFile,
  });

  const compile: Promise<string> = new Promise((resolve: (stdOut: string) => void, reject: (error: any) => void) => {
    new compiler(compileOptions).run(async (exitCode: number, stdOut: string, stdErr: string) => {
      if (exitCode !== 0) {
        reject(new Error(`Google Closure Compiler exit ${exitCode}: ${stdErr}`));
      } else {
        if (transforms) {
          for (let iterator = 0; iterator < transforms.length; iterator++) {
            const transformed = await transforms[iterator].output(stdOut, 'none');
            if (transformed && transformed.code) {
              stdOut = transformed.code;
            }
          }
        }
        resolve(stdOut);
      }
    });
  });

  return compile.then(
    async stdOut => {
      const sourceMap: RawSourceMap = JSON.parse(await readFile(mapAsFile, 'utf8'));
      return { code: stdOut, map: sourceMap };
    },
    (error: Error) => {
      throw error;
    },
  );
};

export default function closureCompiler(outputOptions: OutputOptions = {}, compileOptions: CompileOptions = {}): Plugin {
  let inputOptions: InputOptions | null = null;
  let transforms: Array<Transform> | null = null;

  return {
    name: 'closure-compiler',
    options: options => (inputOptions = options),
    load(id: string) {
      if (outputOptions.format === undefined) {
        this.warn(
          'When invoking Rollup Plugin Closure Compiler, pass OutputOptions directly. See: https://github.com/ampproject/rollup-plugin-closure-compiler/faq/OPTIONS.md for more details.',
        );
      }
      transforms = transforms || instantiateTransforms(this, inputOptions, outputOptions, id);
    },
    transform: async (code: string, id: string) => await transform(transforms, code, id),
    transformChunk: async (code: string, outputOptions: OutputOptions, chunk: OutputChunk) =>
      await transformChunk(compileOptions, transforms, code, outputOptions),
  };
}
