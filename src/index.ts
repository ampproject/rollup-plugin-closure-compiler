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
import * as fs from 'fs';
import { promisify } from 'util';
import {
  OutputOptions,
  RawSourceMap,
  Plugin,
  InputOptions,
  PluginContext,
  RenderedChunk,
} from 'rollup';
import compiler from './compiler';
import options from './options';
import { preCompilation, createTransforms } from './transforms';
import { Transform } from './transformers/transform';
import { TransformOptions, MangledWords } from './types';

const readFile = promisify(fs.readFile);

/**
 * Transform the tree-shaken code from Rollup with Closure Compiler (with derived configuration and transforms)
 * @param compileOptions Closure Compiler compilation options from Rollup configuration.
 * @param transforms Transforms to apply to source followin Closure Compiler completion.
 * @param code Source to compile.
 * @param outputOptions Rollup Output Options.
 * @return Closure Compiled form of the Rollup Chunk
 */
async function renderChunk(
  transforms: Array<Transform>,
  requestedCompileOptions: CompileOptions = {},
  sourceCode: string,
  chunk: RenderedChunk,
  outputOptions: OutputOptions,
  globallyMangledWords: MangledWords,
): Promise<{ code: string; map: RawSourceMap } | void> {
  const preCompiled = await preCompilation(sourceCode, chunk, transforms, globallyMangledWords);
  const [compileOptions, mapFile] = options(
    requestedCompileOptions,
    outputOptions,
    preCompiled.code,
    transforms,
  );

  return compiler(compileOptions, chunk, transforms, preCompiled.moduleMangledWords).then(
    async code => {
      return { code, map: JSON.parse(await readFile(mapFile, 'utf8')) };
    },
    (error: Error) => {
      throw error;
    },
  );
}

export default function closureCompiler(
  requestedCompileOptions: CompileOptions = {},
  transformOptions: TransformOptions = {},
): Plugin {
  let inputOptions: InputOptions;
  let context: PluginContext;
  const globallyMangledWords: MangledWords = new MangledWords(transformOptions.mangleReservedWords);

  return {
    name: 'closure-compiler',
    options: options => (inputOptions = options),
    buildStart() {
      context = this;
      if (
        'compilation_level' in requestedCompileOptions &&
        requestedCompileOptions.compilation_level === 'ADVANCED_OPTIMIZATIONS' &&
        inputOptions.experimentalCodeSplitting
      ) {
        context.warn(
          'Rollup experimentalCodeSplitting with Closure Compiler ADVANCED_OPTIMIZATIONS is not currently supported.',
        );
      }
    },
    renderChunk: async (code: string, chunk: RenderedChunk, outputOptions: OutputOptions) => {
      const transforms = createTransforms(context, inputOptions, outputOptions, transformOptions);
      return await renderChunk(
        transforms,
        requestedCompileOptions,
        code,
        chunk,
        outputOptions,
        globallyMangledWords,
      );
    },
  };
}
