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
import { rollup } from 'rollup';
import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

test('es2015 does minify', async t => {
  const source = await readFile(join('test/es2015/fixtures/es2015.js'), 'utf8');
  const compilerBundle = await rollup({
    input: 'test/es2015/fixtures/es2015.js',
    plugins: [compiler()],
  });

  const compilerResults = await compilerBundle.generate({
    format: 'es',
    sourcemap: true,
  });

  t.truthy(compilerResults.code.length < source.length);
});
