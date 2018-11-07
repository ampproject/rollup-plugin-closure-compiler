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

import { TransformSourceDescription, OutputOptions, RenderedChunk } from 'rollup';
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

export interface DiscoveredExport {
  local: string;
  exported: string;
  default: boolean;
  range: SourceRange;
}

export type SourceRange = [number, number];
export interface RangedImport {
  type: string;
  range: SourceRange;
}

export type TransformMethod = (
  code: string,
  chunk: RenderedChunk,
  mangled: MangledWords,
) => Promise<MangledTransformSourceDescription>;
export interface TransformInterface {
  extern: (options: OutputOptions) => string;
  preCompilation: TransformMethod;
  postCompilation: TransformMethod;
}
export interface TransformOptions {
  mangleReservedWords?: Array<string>;
  mangleSuffix?: string;
}

export interface CodeTransform {
  type: 'remove' | 'append' | 'appendLeft' | 'overwrite';
  range?: SourceRange;
  content?: string;
}

export interface MangledTransformSourceDescription extends TransformSourceDescription {
  mangledWords: MangledWords;
}

export class MangledWords {
  private _initial: Array<string> = [];
  private _final: Array<string> = [];
  private _mangleSuffix: string = `$${new Date().getUTCMilliseconds()}`;

  constructor(words: Array<string> = [], overrideSuffix?: string) {
    if (overrideSuffix != null) {
      this._mangleSuffix = overrideSuffix;
    }

    words.forEach(word => {
      this.store(word, `${word}${this._mangleSuffix}`);
    });
  }

  get initial(): Array<string> {
    return this._initial;
  }
  get final(): Array<string> {
    return this._final;
  }

  public merge(other: MangledWords) {
    other.initial.forEach((initial, index) => {
      this.store(initial, other.final[index]);
    });
  }

  public store(initial: string, final: string) {
    if (!this._initial.includes(initial)) {
      this._initial.push(initial);
      this._final.push(final);
    }
  }

  public getFinal(initial: string): string | null {
    const index = this._initial.indexOf(initial);

    if (index >= 0) {
      return this.final[index];
    }
    return null;
  }

  public getInitial(final: string): string | null {
    const index = this._final.indexOf(final);

    if (index >= 0) {
      return this._initial[index];
    }
    return null;
  }
}
