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
import compiler from '../../transpile';
import { createTransforms } from '../../transpile/transforms';
import { defaults } from '../../transpile/options';
import * as rollup from 'rollup';
import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);
const formats = ['iife'];
const closureFlags = {
  default: {},
  advanced: {
    compilation_level: 'ADVANCED_OPTIMIZATIONS',
    language_out: 'ECMASCRIPT_2015',
  },
  es5: {
    language_out: 'ECMASCRIPT5_STRICT',
  }
};

test('generate extern for iife name', async t => {
  const externFixtureContent = await readFile('test/iife/fixtures/iife.extern.js', 'utf8');
  const outputOptions = {
    format: 'iife',
    name: 'wrapper',
  };

  const transforms = createTransforms({});
  const options = defaults(outputOptions, [], transforms);

  const contentMatch = options.externs.some(async externFilePath => {
    const fileContent = await readFile(externFilePath, 'utf8');
    return fileContent === externFixtureContent;
  });

  t.is(contentMatch, true);
});

formats.forEach(format => {
  async function compile(name, option) {
    const bundle = await rollup.rollup({
      input: `test/${name}/fixtures/input.js`,
      plugins: [
        compiler(closureFlags[option]),
      ],
    });

    return {
      minified: await readFile(join(`test/${name}/fixtures/${format}.${option}.minified.js`), 'utf8'),
      code: (await bundle.generate({
        format,
        name: 'wrapper',
        sourcemap: true,
      })).code,
    };
  }

  Object.keys(closureFlags).forEach(option => {
    test(`preserves iife wrapper name – ${format}, ${option}`, async t => {
      const { minified, code } = await compile('iife', option);
    
      t.is(code, minified);
    });
  });
});
