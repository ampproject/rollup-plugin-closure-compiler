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

import { PluginContext, InputOptions, OutputOptions, RenderedChunk } from 'rollup';
import {
  TransformInterface,
  TransformOptions,
  MangledTransformSourceDescription,
  MangledWords,
  CodeTransform,
} from '../types';
import MagicString from 'magic-string';

export abstract class Transform implements TransformInterface {
  protected context: PluginContext;
  protected inputOptions: InputOptions;
  protected outputOptions: OutputOptions;
  protected transformOptions: TransformOptions;
  abstract name: string = 'Transform';

  constructor(
    context: PluginContext,
    inputOptions: InputOptions,
    outputOptions: OutputOptions,
    transformOptions: TransformOptions,
  ) {
    this.context = context;
    this.inputOptions = inputOptions;
    this.outputOptions = outputOptions;
    this.transformOptions = transformOptions;
  }

  public extern(options: OutputOptions): string {
    return '';
  }

  public async preCompilation(
    code: string,
    chunk: RenderedChunk,
    mangled: MangledWords,
  ): Promise<MangledTransformSourceDescription> {
    return {
      code,
      mangledWords: mangled,
    };
  }
  public async postCompilation(
    code: string,
    chunk: RenderedChunk,
    mangled: MangledWords,
  ): Promise<MangledTransformSourceDescription> {
    return {
      code,
      mangledWords: mangled,
    };
  }

  protected async applyChanges(changes: Array<CodeTransform>, code: string): Promise<MagicString> {
    const source = new MagicString(code);

    changes.forEach(({ type, range, content }) => {
      switch (type) {
        case 'remove':
          if (range) {
            source.remove(range[0], range[1]);
          }
          break;
        case 'overwrite':
          if (range && content) {
            source.overwrite(range[0], range[1], content);
          }
          break;
        case 'appendLeft':
          if (range && content) {
            source.appendLeft(range[0], content);
          }
          break;
        case 'append':
          if (content) {
            source.append(content);
          }
          break;
      }
      console.log('change applied', [type, range, content], source.toString());
    });

    return source;
  }
}
