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
import { ChunkTransform } from './types';
import IifeTransform from './chunk-transformers/iife';
import CJSTransform from './chunk-transformers/cjs';
import LiteralComputedKeys from './chunk-transformers/literal-computed-keys';
import ExportTransform from './chunk-transformers/exports';
import ImportTransform from './chunk-transformers/imports';
import StrictTransform from './chunk-transformers/strict';
import ConstTransform from './chunk-transformers/const';
import { logTransformChain } from './debug';

/**
 * Instantiate transform class instances for the plugin invocation.
 * @param context Plugin context to bind for each transform instance.
 * @param inputOptions Rollup input options
 * @param outputOptions Rollup output options
 * @return Instantiated transform class instances for the given entry point.
 */
export const createTransforms = (
  context: PluginContext,
  inputOptions: InputOptions,
  outputOptions: OutputOptions,
): Array<ChunkTransform> => [
  new ConstTransform(context, inputOptions, outputOptions),
  new IifeTransform(context, inputOptions, outputOptions),
  new CJSTransform(context, inputOptions, outputOptions),
  new LiteralComputedKeys(context, inputOptions, outputOptions),
  new StrictTransform(context, inputOptions, outputOptions),
  new ExportTransform(context, inputOptions, outputOptions),
  new ImportTransform(context, inputOptions, outputOptions),
];

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
  transforms: Array<ChunkTransform>,
): Promise<string> {
  // Each transform has a 'preCompilation' step that must complete before passing
  // the resulting code to Closure Compiler.
  const log: Array<[string, string]> = [];

  log.push(['before', code]);
  for (const transform of transforms) {
    const result = await transform.pre(code);
    if (result && result.code) {
      log.push([transform.name, code]);
      code = result.code;
    }
  }

  log.push(['after', code]);
  await logTransformChain(chunk.fileName, 'PreCompilation', log);

  return code;
}

/**
 * Run each transform's `postCompilation` phase.
 * @param code source code to modify with `postCompilation` after Closure Compiler has finished.
 * @param transforms Transforms to execute.
 * @return source code following `postCompilation`
 */
export async function postCompilation(
  code: string,
  chunk: RenderedChunk,
  transforms: Array<ChunkTransform>,
): Promise<string> {
  // Following successful Closure Compiler compilation, each transform needs an opportunity
  // to clean up work is performed in preCompilation via postCompilation.
  const log: Array<[string, string]> = [];

  try {
    log.push(['before', code]);
    for (const transform of transforms) {
      const result = await transform.post(code);
      if (result && result.code) {
        log.push([transform.name, result.code]);
        code = result.code;
      }
    }

    log.push(['after', code]);
    await logTransformChain(chunk.fileName, 'PostCompilation', log);
  } catch (e) {
    await logTransformChain(chunk.fileName, 'PostCompilation', log);
    throw e;
  }

  return code;
}
