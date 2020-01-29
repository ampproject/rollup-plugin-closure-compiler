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

import { logTransformChain } from './debug';
import { TransformInterface } from './types';
import { PluginContext, InputOptions, OutputOptions, TransformSourceDescription } from 'rollup';
import { Mangle } from './transformers/mangle';
import * as path from 'path';
import MagicString, { DecodedSourceMap } from 'magic-string';
import * as remapping from '@ampproject/remapping';

class Transform implements TransformInterface {
  protected context: PluginContext;
  protected mangler: Mangle;
  protected inputOptions: InputOptions;
  protected outputOptions: OutputOptions;
  public name: string = 'Transform';

  constructor(
    context: PluginContext,
    mangler: Mangle,
    inputOptions: InputOptions,
    outputOptions: OutputOptions,
  ) {
    this.context = context;
    this.mangler = mangler;
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

  public async pre(source: MagicString): Promise<MagicString> {
    return source;
  }

  public async post(source: MagicString): Promise<MagicString> {
    return source;
  }
}

export async function chunkLifecycle(
  fileName: string,
  printableName: string,
  method: 'pre' | 'post',
  code: string,
  transforms: Array<ChunkTransform>,
): Promise<TransformSourceDescription> {
  const log: Array<[string, string]> = [];
  const sourcemaps: Array<DecodedSourceMap> = [];
  let source = new MagicString(code);

  log.push(['before', code]);
  for (const transform of transforms) {
    const transformed = await transform[method](source);
    const transformedSource = transformed.toString();
    sourcemaps.push(transformed.generateDecodedMap({ hires: true, source: fileName }));
    source = new MagicString(transformedSource);
    log.push([transform.name, transformedSource]);
  }
  const finalSource = source.toString();

  log.push(['after', finalSource]);
  await logTransformChain(fileName, printableName, log);

  return {
    code: finalSource,
    map: ((remapping as unknown) as any)(sourcemaps, () => null),
  };
}

export async function sourceLifecycle(
  id: string,
  printableName: string,
  code: string,
  transforms: Array<SourceTransform>,
): Promise<TransformSourceDescription> {
  const fileName = path.basename(id);
  const log: Array<[string, string]> = [];
  const sourcemaps: Array<DecodedSourceMap> = [];
  let source = new MagicString(code);

  log.push(['before', code]);
  for (const transform of transforms) {
    const transformed = await transform.transform(id, source);
    const transformedSource = transformed.toString();
    sourcemaps.push(transformed.generateDecodedMap({ hires: true, source: id }));
    source = new MagicString(transformedSource);
    log.push([transform.name, transformedSource]);
  }
  const finalSource = source.toString();

  log.push(['after', finalSource]);
  await logTransformChain(fileName, printableName, log);

  // console.log(source.generateMap({hires: true}));
  // const sourcemap = source.generateDecodedMap({hires: true, source: 'bundle.js'});
  // source.generateDecodedMap({hires: true, source: id})
  // console.log((remapping as unknown as any)([sourcemap], () => null));

  return {
    code: finalSource,
    map: ((remapping as unknown) as any)(sourcemaps, () => null),
  };
}
