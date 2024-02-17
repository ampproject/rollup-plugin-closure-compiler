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

import { logTransformChain } from './debug.js';
import { TransformInterface, PluginOptions } from './types.js';
import { PluginContext, InputOptions, OutputOptions, SourceDescription } from 'rollup';
import { Mangle } from './transformers/mangle.js';
import { Ebbinghaus } from './transformers/ebbinghaus.js';
import * as path from 'path';
import MagicString from 'magic-string';
import { DecodedSourceMap as RemappingDecodedSourceMap } from '@ampproject/remapping/dist/types/types';
import { createDecodedSourceMap, createExistingRawSourceMap } from './source-map.js';

class Transform implements TransformInterface {
  protected context: PluginContext;
  protected pluginOptions: PluginOptions;
  protected mangler: Mangle;
  protected memory: Ebbinghaus;
  protected inputOptions: InputOptions;
  protected outputOptions: OutputOptions;
  public name: string = 'Transform';

  constructor(
    context: PluginContext,
    pluginOptions: PluginOptions,
    mangler: Mangle,
    memory: Ebbinghaus,
    inputOptions: InputOptions,
    outputOptions: OutputOptions,
  ) {
    this.context = context;
    this.pluginOptions = pluginOptions;
    this.mangler = mangler;
    this.memory = memory;
    this.inputOptions = inputOptions;
    this.outputOptions = outputOptions;
  }
}

export class SourceTransform extends Transform {
  public name: string = 'SourceTransform';

  public async transform(id: string, source: MagicString): Promise<MagicString> {
    return source;
  }
}

export class ChunkTransform extends Transform {
  public name: string = 'ChunkTransform';

  public extern(options: OutputOptions): string | null {
    return null;
  }

  public async pre(fileName: string, source: MagicString): Promise<MagicString> {
    return source;
  }

  public async post(fileName: string, source: MagicString): Promise<MagicString> {
    return source;
  }
}

export async function chunkLifecycle(
  fileName: string,
  printableName: string,
  method: 'pre' | 'post',
  code: string,
  transforms: Array<ChunkTransform>,
): Promise<SourceDescription> {
  const log: Array<[string, string]> = [];
  const sourcemaps: Array<RemappingDecodedSourceMap> = [];
  let source = new MagicString(code);
  let finalSource: string = '';

  log.push(['before', code]);
  try {
    for (const transform of transforms) {
      const transformed = await transform[method](fileName, source);
      const transformedSource = transformed.toString();
      sourcemaps.push(createDecodedSourceMap(transformed, fileName));
      source = new MagicString(transformedSource);
      log.push([transform.name, transformedSource]);
    }
    finalSource = source.toString();
  } catch (e) {
    log.push(['after', finalSource]);
    await logTransformChain(fileName, printableName, log);

    throw e;
  }

  log.push(['after', finalSource]);
  await logTransformChain(fileName, printableName, log);

  return {
    code: finalSource,
    map: createExistingRawSourceMap(sourcemaps, fileName),
  };
}

export async function sourceLifecycle(
  id: string,
  printableName: string,
  code: string,
  transforms: Array<SourceTransform>,
): Promise<SourceDescription> {
  const fileName = path.basename(id);
  const log: Array<[string, string]> = [];
  const sourcemaps: Array<RemappingDecodedSourceMap> = [];
  let source = new MagicString(code);

  log.push(['before', code]);
  for (const transform of transforms) {
    const transformed = await transform.transform(id, source);
    const transformedSource = transformed.toString();
    sourcemaps.push(createDecodedSourceMap(transformed, id));
    source = new MagicString(transformedSource);
    log.push([transform.name, transformedSource]);
  }
  const finalSource = source.toString();

  log.push(['after', finalSource]);
  await logTransformChain(fileName, printableName, log);

  return {
    code: finalSource,
    map: createExistingRawSourceMap(sourcemaps, fileName),
  };
}
