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

import test from 'ava';
import compile from '../../transpile/options';
import path from 'path';
import fs from 'fs';
import util from 'util';
const readFile = util.promisify(fs.readFile);

const PROVIDED_EXTERN = path.resolve('test', 'closure-config', 'fixtures', 'externs.js');
const IIFE_TRANSFORM_EXTERN_CONTENT = '/** @externs */ function wrapper(){}';

const IifeTransform = class {
  // Transforms have a public method `extern` that generates an extern
  // if one is needed for the transform.
  
  // This test ensures the externs created by transforms are passed to
  // closure compiler when the caller also passes externs.
  extern() {
    return IIFE_TRANSFORM_EXTERN_CONTENT;
  }
};

test('when rollup configuration specifies externs, extern is leveraged', async t => {
  t.plan(3);

  const compilerOptionsExterns = compile({
    externs: PROVIDED_EXTERN,
  }, {
    format: 'iife',
    name: 'wrapper',
  }, 'var x = 1;', [new IifeTransform()])[0].externs;

  t.is(compilerOptionsExterns.length, 2);
  t.true(compilerOptionsExterns.includes(PROVIDED_EXTERN));

  // While we can use the path for the provided extern, we need to inspect the content of 
  // the other extern to ensure it is the generated extern.
  // Externs are passed as filepaths to Closure Compiler.
  const fileContent = await readFile(compilerOptionsExterns.filter(path => path !== PROVIDED_EXTERN)[0], 'utf8');
  t.true(fileContent === IIFE_TRANSFORM_EXTERN_CONTENT);
});
