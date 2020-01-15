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

import { CompileOptions } from 'google-closure-compiler';
import { promises as fsPromises } from 'fs';
import {
  OutputOptions,
  Plugin,
  InputOptions,
  PluginContext,
  RenderedChunk,
  SourceMapInput,
} from 'rollup';
import compiler from './compiler';
import options from './options';
import { preCompilation, createTransforms } from './transforms';
import { ChunkTransform } from './types';

/**
 * Transform the tree-shaken code from Rollup with Closure Compiler (with derived configuration and transforms)
 * @param compileOptions Closure Compiler compilation options from Rollup configuration.
 * @param transforms Transforms to apply to source followin Closure Compiler completion.
 * @param code Source to compile.
 * @param outputOptions Rollup Output Options.
 * @return Closure Compiled form of the Rollup Chunk
 */
const renderChunk = async (
  transforms: Array<ChunkTransform>,
  requestedCompileOptions: CompileOptions = {},
  sourceCode: string,
  outputOptions: OutputOptions,
  chunk: RenderedChunk,
): Promise<{ code: string; map: SourceMapInput } | void> => {
  const code = await preCompilation(sourceCode, outputOptions, chunk, transforms);
  const [compileOptions, mapFile] = await options(
    requestedCompileOptions,
    outputOptions,
    code,
    transforms,
  );

  try {
    return {
      code: await compiler(compileOptions, chunk, transforms),
      map: JSON.parse(await fsPromises.readFile(mapFile, 'utf8')),
    };
  } catch (error) {
    throw error;
  }
};

export default function closureCompiler(requestedCompileOptions: CompileOptions = {}): Plugin {
  let inputOptions: InputOptions;
  let context: PluginContext;

  return {
    name: 'closure-compiler',
    options: options => (inputOptions = options),
    buildStart() {
      context = this;
      if (
        'compilation_level' in requestedCompileOptions &&
        requestedCompileOptions.compilation_level === 'ADVANCED_OPTIMIZATIONS' &&
        Array.isArray(inputOptions.input)
      ) {
        context.warn(
          'Code Splitting with Closure Compiler ADVANCED_OPTIMIZATIONS is not currently supported.',
        );
      }
    },
    renderChunk: async (code: string, chunk: RenderedChunk, outputOptions: OutputOptions) => {
      const transforms = createTransforms(context, inputOptions);
      const output = await renderChunk(
        transforms,
        requestedCompileOptions,
        code,
        outputOptions,
        chunk,
      );
      return output || null;
    },
  };
}
