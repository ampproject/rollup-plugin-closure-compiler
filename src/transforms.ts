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

import { OutputOptions, PluginContext, InputOptions, RenderedChunk } from 'rollup';
import IifeTransform from './transformers/iife';
import LiteralComputedKeys from './transformers/literal-computed-keys';
import ExportTransform from './transformers/exports';
import ImportTransform from './transformers/imports';
import StrictTransform from './transformers/strict';
import ReservedWords from './transformers/reserved-words';
import ConstTransform from './transformers/const';
import { logSource } from './debug';
import { Transform } from './transformers/transform';
import { TransformOptions, MangledWords } from './types';

/**
 * Instantiate transform class instances for the plugin invocation.
 * @param context Plugin context to bind for each transform instance.
 * @param options Rollup input options
 * @return Instantiated transform class instances for the given entry point.
 */
export const createTransforms = (
  context: PluginContext,
  inputOptions: InputOptions,
  outputOptions: OutputOptions,
  transformOptions: TransformOptions,
): Array<Transform> => {
  return [
    new ReservedWords(context, inputOptions, outputOptions, transformOptions),
    new ConstTransform(context, inputOptions, outputOptions, transformOptions),
    new IifeTransform(context, inputOptions, outputOptions, transformOptions),
    new LiteralComputedKeys(context, inputOptions, outputOptions, transformOptions),
    new StrictTransform(context, inputOptions, outputOptions, transformOptions),
    new ExportTransform(context, inputOptions, outputOptions, transformOptions),
    new ImportTransform(context, inputOptions, outputOptions, transformOptions),
  ];
};

/**
 * Run each transform's `preCompilation` phase.
 * @param code source code to modify with `preCompilation` before Closure Compiler is given it.
 * @param outputOptions Rollup's configured output options
 * @param transforms Transforms to execute.
 * @return source code following `preCompilation`
 */
export async function preCompilation(
  code: string,
  chunk: RenderedChunk,
  transforms: Array<Transform>,
  globallyMangledWords: MangledWords,
): Promise<{
  code: string;
  moduleMangledWords: MangledWords;
}> {
  // Each transform has a 'preCompilation' step that must complete before passing
  // the resulting code to Closure Compiler.
  const moduleMangledWords: MangledWords = new MangledWords();
  moduleMangledWords.merge(globallyMangledWords);

  logSource('before preCompilation handlers', code);
  for (const transform of transforms) {
    logSource(`before ${transform.name} preCompilation`, code);
    const result = await transform.preCompilation(code, chunk, moduleMangledWords);

    if (result) {
      if (result.code) {
        code = result.code;
      }
      moduleMangledWords.merge(result.mangledWords);
    }

    logSource(`after ${transform.name} preCompilation`, code);
  }

  logSource('after preCompilation handlers', code);
  return {
    code,
    moduleMangledWords,
  };
}

/**
 * Run each transform's `postCompilation` phase.
 * @param code source code to modify with `postCompilation` after Closure Compiler has finished.
 * @param chunk
 * @param transforms Transforms to execute.
 * @param moduleMangledWords
 * @return source code following `postCompilation`
 */
export async function postCompilation(
  code: string,
  chunk: RenderedChunk,
  transforms: Array<Transform>,
  moduleMangledWords: MangledWords,
): Promise<string> {
  // Following successful Closure Compiler compilation, each transform needs an opportunity
  // to clean up work is performed in preCompilation via postCompilation.
  logSource('before postCompilation handlers', code);
  for (const transform of transforms) {
    const result = await transform.postCompilation(code, chunk, moduleMangledWords);
    if (result && result.code) {
      code = result.code;
    }
  }

  logSource('after postCompilation handlers', code);
  return code;
}
