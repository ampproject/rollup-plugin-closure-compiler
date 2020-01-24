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

  public async transform(id: string, code: string): Promise<TransformSourceDescription> {
    return {
      code,
    };
  }
}

export class ChunkTransform extends Transform {
  public name: string = 'ChunkTransform';

  public extern(options: OutputOptions): string | null {
    return null;
  }

  public async pre(code: string): Promise<TransformSourceDescription> {
    return {
      code,
    };
  }

  public async post(code: string): Promise<TransformSourceDescription> {
    return {
      code,
    };
  }
}

export async function chunkLifecycle(
  fileName: string,
  printableName: string,
  method: 'pre' | 'post',
  code: string,
  transforms: Array<ChunkTransform>,
): Promise<string> {
  const log: Array<[string, string]> = [];

  log.push(['before', code]);
  for (const transform of transforms) {
    const result = await transform[method](code);
    if (result && result.code) {
      log.push([transform.name, code]);
      code = result.code;
    }
  }

  log.push(['after', code]);
  await logTransformChain(fileName, printableName, log);

  return code;
}

export async function sourceLifecycle(
  id: string,
  printableName: string,
  code: string,
  transforms: Array<SourceTransform>,
): Promise<string> {
  const fileName = path.basename(id);
  const log: Array<[string, string]> = [];

  log.push(['before', code]);
  for (const transform of transforms) {
    const result = await transform.transform(id, code);
    if (result && result.code) {
      log.push([transform.name, code]);
      code = result.code;
    }
  }

  log.push(['after', code]);
  await logTransformChain(fileName, printableName, log);

  return code;
}
