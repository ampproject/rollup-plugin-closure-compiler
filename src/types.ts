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

import * as path from 'path';
import {
  OutputOptions,
  TransformSourceDescription,
  PluginContext,
  InputOptions,
  InputOption,
  RenderedChunk,
} from 'rollup';
const dynamicImport = require('acorn-dynamic-import');

// @see https://github.com/estree/estree/blob/master/es2015.md#imports
export const IMPORT_DECLARATION = 'ImportDeclaration';
export const DYNAMIC_IMPORT_DECLARATION = dynamicImport.DynamicImportKey;
export const IMPORT_SPECIFIER = 'ImportSpecifier';
export const IMPORT_DEFAULT_SPECIFIER = 'ImportDefaultSpecifier';
export const IMPORT_NAMESPACE_SPECIFIER = 'ImportNamespaceSpecifier';

// @see https://github.com/estree/estree/blob/master/es2015.md#exports
export const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration';
export const EXPORT_SPECIFIER = 'ExportSpecifier';
export const EXPORT_DEFAULT_DECLARATION = 'ExportDefaultDeclaration';
export const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration';
export const ALL_EXPORT_DECLARATIONS = [
  EXPORT_NAMED_DECLARATION,
  EXPORT_DEFAULT_DECLARATION,
  EXPORT_ALL_DECLARATION,
];

export enum ExportClosureMapping {
  NAMED_FUNCTION = 0,
  NAMED_CLASS = 1,
  NAMED_DEFAULT_FUNCTION = 2,
  DEFAULT_FUNCTION = 3,
  NAMED_DEFAULT_CLASS = 4,
  DEFAULT_CLASS = 5,
  NAMED_CONSTANT = 6,
  DEFAULT = 7,
  DEFAULT_VALUE = 8,
  DEFAULT_OBJECT = 9,
}
export interface ExportNameToClosureMapping {
  [key: string]: {
    alias: string | null;
    type: ExportClosureMapping;
    range: [number, number];
  };
}

export type TransformMethod = (code: string) => Promise<TransformSourceDescription>;
export interface TransformInterface {
  extern: (options: OutputOptions) => string;
  deriveFromInputSource: (code: string, chunk: RenderedChunk) => Promise<void>;
  preCompilation: TransformMethod;
  postCompilation: TransformMethod;
}
export class Transform implements TransformInterface {
  protected context: PluginContext;
  protected inputOptions: InputOptions;
  public outputOptions: OutputOptions | null;

  constructor(context: PluginContext, inputOptions: InputOptions) {
    this.context = context;
    this.inputOptions = inputOptions;
  }

  public extern(options: OutputOptions): string {
    return '';
  }

  public async deriveFromInputSource(code: string, chunk: RenderedChunk): Promise<void> {
    return void 0;
  }

  public async preCompilation(code: string): Promise<TransformSourceDescription> {
    return {
      code,
    };
  }
  public async postCompilation(code: string): Promise<TransformSourceDescription> {
    return {
      code,
    };
  }

  protected isEntryPoint(id: string) {
    const inputs = (input: InputOption): Array<string> => {
      if (typeof input === 'string') {
        return [input];
      } else if (typeof input === 'object') {
        return Object.values(input);
      } else {
        return input;
      }
    };

    return inputs(this.inputOptions.input)
      .map(input => path.resolve(input))
      .includes(id);
  }
}
