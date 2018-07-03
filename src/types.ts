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

import { OutputOptions, TransformHook } from 'rollup';

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
  NAMED_CONSTANT = 1,
  DEFAULT = 2,
}
export interface ExportNameToClosureMapping {
  [key: string]: ExportClosureMapping;
}

type DeriveExternFromOptions = (options: OutputOptions) => string;
export interface ClosureTransformPlugin {
  externFile: DeriveExternFromOptions;
  transform: TransformHook;
}
