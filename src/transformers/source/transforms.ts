/**
 * Copyright 2020 The AMP HTML Authors. All Rights Reserved.
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

import { SourceTransform, sourceLifecycle } from '../../transform';
import { Mangle } from '../mangle';
import { PluginContext, InputOptions, OutputOptions, TransformSourceDescription } from 'rollup';
import { CompileOptions } from 'google-closure-compiler';
import HashbangTransform from './hashbang';
import { Ebbinghaus } from '../ebbinghaus';

const TRANSFORMS: Array<typeof SourceTransform> = [HashbangTransform];
// Temporarily disabling many SourceTransforms, aligning for future release.
// ImportTransform, ExportTransform

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
export const create = (
  context: PluginContext,
  requestedCompileOptions: CompileOptions,
  mangler: Mangle,
  memory: Ebbinghaus,
  inputOptions: InputOptions,
  outputOptions: OutputOptions,
): Array<SourceTransform> =>
  TRANSFORMS.map(
    transform => new transform(context, {}, mangler, memory, inputOptions, outputOptions),
  );

/**
 * Run each transform's `transform` lifecycle.
 * @param code
 * @param transforms
 * @return source code following `transform`
 */
export async function transform(
  source: string,
  id: string,
  transforms: Array<SourceTransform>,
): Promise<TransformSourceDescription> {
  return await sourceLifecycle(id, 'Transform', source, transforms);
}
