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
import { OutputOptions, Plugin, InputOptions, PluginContext, RenderedChunk } from 'rollup';
import compiler from './compiler';
import options from './options';
import {
  transform as sourceTransform,
  create as createSourceTransforms,
} from './transformers/source/transforms';
import { preCompilation, create as createChunkTransforms } from './transformers/chunk/transforms';
import { Mangle } from './transformers/mangle';

export default function closureCompiler(requestedCompileOptions: CompileOptions = {}): Plugin {
  const mangler: Mangle = new Mangle();
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
    transform: async (code: string, id: string) => {
      const transformTransforms = createSourceTransforms(context, mangler, inputOptions, {});
      const output = await sourceTransform(code, id, transformTransforms);

      // console.log('transform done', output);
      return output || null;
    },
    renderChunk: async (code: string, chunk: RenderedChunk, outputOptions: OutputOptions) => {
      mangler.debug();

      // console.log('render chunk', code);
      const renderChunkTransforms = createChunkTransforms(
        context,
        mangler,
        inputOptions,
        outputOptions,
      );
      const preCompileOutput = await preCompilation(code, chunk, renderChunkTransforms);
      const [compileOptions, mapFile] = await options(
        requestedCompileOptions,
        outputOptions,
        preCompileOutput,
        renderChunkTransforms,
      );

      try {
        return {
          code: await compiler(compileOptions, chunk, renderChunkTransforms),
          map: JSON.parse(await fsPromises.readFile(mapFile, 'utf8')),
        };
      } catch (error) {
        throw error;
      }
    },
  };
}
