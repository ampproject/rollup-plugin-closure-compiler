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
import { createTransforms } from '../../dist/transforms';
import { defaults } from '../../dist/options';
import * as rollup from 'rollup';
import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

async function input(input) {
  const bundle = await rollup.rollup({
    input: `test/iife/fixtures/${input}.js`,
    plugins: [compiler()],
  });

  return {
    minified: await readFile(join(`test/iife/fixtures/${input}.minified.js`), 'utf8'),
    code: (await bundle.generate({
      format: 'iife',
      name: 'wrapper',
      sourcemap: true,
    })).code,
  };
}

test('generate extern for iife name', async t => {
  const externFixtureContent = await readFile('test/iife/fixtures/iife.extern.js', 'utf8');
  const outputOptions = {
    format: 'iife',
    name: 'wrapper',
  };

  const transforms = createTransforms({});
  const options = defaults(outputOptions, transforms);

  const contentMatch = options.externs.some(async externFilePath => {
    const fileContent = await readFile(externFilePath, 'utf8');
    return fileContent === externFixtureContent;
  });

  t.is(contentMatch, true);
});

test('preserves iife wrapper name', async t => {
  const { minified, code } = await input('iife');

  t.is(code, minified);
});
