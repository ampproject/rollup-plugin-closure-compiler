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
import compiler, { defaultCompileOptions } from '../dist/index';
import { rollup } from 'rollup';
import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

test('when rollup configuration specifies format iife with a name, an extern is generated', async t => {
  const externFixtureContent = await readFile('test/fixtures/iife-wrapped-extern.js', 'utf8');
  const options = defaultCompileOptions({
    format: 'iife',
    name: 'wrapper',
  });

  const contentMatch = options.externs.some(async externFilePath => {
    const fileContent = await readFile(externFilePath, 'utf8');
    return fileContent === externFixtureContent;
  });
  console.log('match', contentMatch);

  t.is(contentMatch, true);
});

test('preserves iife wrapper name', async t => {
  const minifiedBundle = await readFile(join('test/fixtures/iife-wrapped-minified.js'), 'utf8');
  const compilerBundle = await rollup({
    input: 'test/fixtures/iife-wrapped.js',
    plugins: [compiler()],
  });

  const compilerResults = await compilerBundle.generate({
    format: 'iife',
    name: 'wrapper',
    sourcemap: true,
  });

  t.is(compilerResults.code, minifiedBundle);
});
