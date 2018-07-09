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

import { OutputOptions, PluginContext } from 'rollup';
import { Transform } from './types';
import IifeTransform from './transformers/iife';
import ExportTransform from './transformers/exports';
import StrictTransform from './transformers/strict';

/**
 * Instantiate transform class instances for the plugin invocation.
 * @param context Plugin context to bind for each transform instance.
 * @param options Rollup input options
 * @param id Rollup's id entry for this source.
 * @return Instantiated transform class instances for the given entry point.
 */
export const createTransforms = (context: PluginContext): Array<Transform> => {
  return [new IifeTransform(context), new ExportTransform(context), new StrictTransform(context)];
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
  outputOptions: OutputOptions,
  transforms: Array<Transform>,
): Promise<string> {
  // Each transform has a 'preCompilation' step that must complete before passing
  // the resulting code to Closure Compiler.
  for (const transform of transforms) {
    transform.outputOptions = outputOptions;
    const result = await transform.preCompilation(code, 'none');
    if (result && result.code) {
      code = result.code;
    }
  }

  return code;
}

/**
 * Run each transform's `postCompilation` phase.
 * @param code source code to modify with `postCompilation` after Closure Compiler has finished.
 * @param transforms Transforms to execute.
 * @return source code following `postCompilation`
 */
export async function postCompilation(code: string, transforms: Array<Transform>): Promise<string> {
  // Following successful Closure Compiler compilation, each transform needs an opportunity
  // to clean up work is performed in preCompilation via postCompilation.
  for (const transform of transforms) {
    const result = await transform.postCompilation(code, 'none');
    if (result && result.code) {
      code = result.code;
    }
  }

  return code;
}

/**
 * Run each transform's `deriveFromInputSource` phase in parallel.
 * @param code source code to derive information from, pre Closure Compiler minification.
 * @param transforms Transforms to execute.
 */
export async function deriveFromInputSource(
  code: string,
  transforms: Array<Transform>,
): Promise<void> {
  await Promise.all(
    transforms.map(transform => transform.deriveFromInputSource(code, 'none')),
  ).then(_ => void 0);
}
