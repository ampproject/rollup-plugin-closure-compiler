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

import { OutputOptions, PluginContext, InputOptions } from 'rollup';
import { Transform } from './types';
import IifeTransform from './transformers/iife';
import CJSTransform from './transformers/cjs';
import LiteralComputedKeys from './transformers/literal-computed-keys';
import ExportTransform from './transformers/exports';
import ImportTransform from './transformers/imports';
import StrictTransform from './transformers/strict';
import ConstTransform from './transformers/const';
import { logSource } from './debug';

/**
 * Instantiate transform class instances for the plugin invocation.
 * @param context Plugin context to bind for each transform instance.
 * @param options Rollup input options
 * @return Instantiated transform class instances for the given entry point.
 */
export const createTransforms = (
  context: PluginContext,
  options: InputOptions,
): Array<Transform> => {
  return [
    new ConstTransform(context, options),
    new IifeTransform(context, options),
    new CJSTransform(context, options),
    new LiteralComputedKeys(context, options),
    new StrictTransform(context, options),
    new ExportTransform(context, options),
    new ImportTransform(context, options),
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
  outputOptions: OutputOptions,
  transforms: Array<Transform>,
): Promise<string> {
  // Each transform has a 'preCompilation' step that must complete before passing
  // the resulting code to Closure Compiler.
  logSource('before preCompilation handlers', code);
  for (const transform of transforms) {
    transform.outputOptions = outputOptions;
    const result = await transform.preCompilation(code);
    if (result && result.code) {
      logSource(`after ${transform.name} preCompilation`, result && result.code);
      code = result.code;
    }
  }

  logSource('after preCompilation handlers', code);
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
  logSource('before postCompilation handlers', code);
  for (const transform of transforms) {
    const result = await transform.postCompilation(code);
    if (result && result.code) {
      logSource(`after ${transform.name} postCompilation`, result && result.code);
      code = result.code;
    }
  }

  logSource('after postCompilation handlers', code);
  return code;
}
