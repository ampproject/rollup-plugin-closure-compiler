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
import compiler from '../../dist/index';
import * as rollup from 'rollup';
import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

async function input(input) {
  const ROLLUP_OUTPUT_OPTIONS = {
    format: 'iife',
    name: 'foobar',
    sourcemap: true,
  };

  const bundle = await rollup.rollup({
    input: `test/es5/fixtures/${input}.js`,
    plugins: [compiler(ROLLUP_OUTPUT_OPTIONS)],
  });

  return {
    minified: await readFile(join(`test/es5/fixtures/${input}.minified.js`), 'utf8'),
    code: (await bundle.generate(ROLLUP_OUTPUT_OPTIONS)).code,
  };
}

test('es5 does minify', async t => {
  const source = await readFile(join('test/es5/fixtures/es5.js'), 'utf8');
  const { minified, code } = await input('es5');

  //console.log({code, minified, source});
  t.truthy(code.length < source.length);
  t.is(code, minified);
});
