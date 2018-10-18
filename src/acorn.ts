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

import { Program } from 'estree';
import { DYNAMIC_IMPORT_DECLARATION } from './types';
const acorn = require('acorn');
const acornWalk = require('acorn-walk');
const dynamicImport = require('acorn-dynamic-import');

const DYNAMIC_IMPORT_BASEVISITOR = Object.assign({}, acornWalk.base, {
  [DYNAMIC_IMPORT_DECLARATION]: () => {},
});

export const walk = {
  simple(node: Program, visitors: any): void {
    acornWalk.simple(node, visitors, DYNAMIC_IMPORT_BASEVISITOR);
  },
  ancestor(node: Program, visitors: any): void {
    acornWalk.ancestor(node, visitors, DYNAMIC_IMPORT_BASEVISITOR);
  },
};

const DEFAULT_ACORN_OPTIONS = {
  ecmaVersion: 2019,
  sourceType: 'module',
  preserveParens: false,
  ranges: true,
};

export function parse(source: string): Program {
  return acorn.Parser.extend(dynamicImport.default).parse(source, DEFAULT_ACORN_OPTIONS);
}
