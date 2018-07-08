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

import { OutputOptions, TransformSourceDescription, PluginContext } from 'rollup';

// @see https://github.com/estree/estree/blob/master/es2015.md#exports
export const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration';
export const EXPORT_SPECIFIER = 'ExportSpecifier';
export const EXPORT_DEFAULT_DECLARATION = 'ExportDefaultDeclaration';
export const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration';
export const ALL_EXPORT_TYPES = [
  EXPORT_NAMED_DECLARATION,
  EXPORT_SPECIFIER,
  EXPORT_DEFAULT_DECLARATION,
  EXPORT_ALL_DECLARATION,
];

export enum ExportClosureMapping {
  NAMED_FUNCTION = 0,
  NAMED_DEFAULT_FUNCTION = 1,
  NAMED_CONSTANT = 2,
  DEFAULT = 3,
}
export interface ExportNameToClosureMapping {
  [key: string]: ExportClosureMapping;
}

// type DeriveExternFromOptions = (options: OutputOptions) => string;
// export interface ClosureTransformPlugin {
//   externFile: DeriveExternFromOptions;
//   transformInput: TransformHook;
//   transformOutput: TransformHook;
//   entry: string | null;
// }
export interface TransformInterface {
  extern: (options: OutputOptions) => string;
  input: (code: string, id: string) => Promise<TransformSourceDescription>;
  output: (code: string, id: string) => Promise<TransformSourceDescription>;
}
export class Transform implements TransformInterface {
  protected context: PluginContext;
  protected entry: string;
  protected outputOptions: OutputOptions;

  constructor(context: PluginContext, entry: string, outputOptions: OutputOptions) {
    this.context = context;
    this.entry = entry;
    this.outputOptions = outputOptions;
  }

  public extern(options: OutputOptions): string {
    return '';
  }

  public async input(code: string, id: string): Promise<TransformSourceDescription> {
    return {
      code,
    };
  }

  public async output(code: string, id: string): Promise<TransformSourceDescription> {
    return {
      code,
    };
  }
}
