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

import {
  OutputOptions,
  PluginContext,
  InputOptions,
  RenderedChunk,
  TransformSourceDescription,
} from 'rollup';
import HashbangRemoveTransform from './hashbang-remove';
import HashbangApplyTransform from './hashbang-apply';
import IifeTransform from './iife';
import CJSTransform from './cjs';
import LiteralComputedKeys from './literal-computed-keys';
import ExportTransform from './exports';
import ImportTransform from './imports';
import StrictTransform from './strict';
import ConstTransform from './const';
import { ChunkTransform, chunkLifecycle } from '../../transform';
import { Mangle } from '../mangle';
import { Ebbinghaus } from '../ebbinghaus';
import { CompileOptions } from 'google-closure-compiler';
import { pluckPluginOptions } from '../../options';

const TRANSFORMS: Array<typeof ChunkTransform> = [
  HashbangRemoveTransform,
  // Acorn can parse content starting here
  ConstTransform,
  IifeTransform,
  CJSTransform,
  LiteralComputedKeys,
  StrictTransform,
  ExportTransform,
  ImportTransform,
  // Acorn cannot parse content starting here.
  HashbangApplyTransform,
];

/**
 * Instantiate transform class instances for the plugin invocation.
 * @param context Plugin context to bind for each transform instance.
 * @param requestedCompileOptions Originally requested compile options from configuration.
 * @param mangler Mangle instance used for this transform instance.
 * @param memory Ebbinghaus instance used to store information that could be lost from source.
 * @param inputOptions Rollup input options
 * @param outputOptions Rollup output options
 * @return Instantiated transform class instances for the given entry point.
 */
export function create(
  context: PluginContext,
  requestedCompileOptions: CompileOptions,
  mangler: Mangle,
  memory: Ebbinghaus,
  inputOptions: InputOptions,
  outputOptions: OutputOptions,
): Array<ChunkTransform> {
  const pluginOptions = pluckPluginOptions(requestedCompileOptions);
  return TRANSFORMS.map(
    transform =>
      new transform(context, pluginOptions, mangler, memory, inputOptions, outputOptions),
  );
}

/**
 * Run each transform's `preCompilation` phase.
 * @param code
 * @param chunk
 * @param transforms
 * @return source code following `preCompilation`
 */
export async function preCompilation(
  source: string,
  chunk: RenderedChunk,
  transforms: Array<ChunkTransform>,
): Promise<TransformSourceDescription> {
  return await chunkLifecycle(chunk.fileName, 'PreCompilation', 'pre', source, transforms);
}

/**
 * Run each transform's `postCompilation` phase.
 * @param code
 * @param chunk
 * @param transforms
 * @return source code following `postCompilation`
 */
export async function postCompilation(
  code: string,
  chunk: RenderedChunk,
  transforms: Array<ChunkTransform>,
): Promise<TransformSourceDescription> {
  return await chunkLifecycle(chunk.fileName, 'PostCompilation', 'post', code, transforms);
}
