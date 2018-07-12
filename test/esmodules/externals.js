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
import compiler from '../../transpile/index';
import * as rollup from 'rollup';
import * as fs from 'fs';
import { join } from 'path';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

const createTests = format => {
  async function input(input) {
    const bundle = await rollup.rollup({
      input: `test/esmodules/fixtures/${input}.js`,
      external: ['react', 'prop-types'],
      plugins: [compiler({
        externs: join('test/esmodules/fixtures/react.extern.js'),
      })],
    });

    return {
      minified: await readFile(join(`test/esmodules/fixtures/${input}.minified.js`), 'utf8'),
      code: (await bundle.generate({
        format,
        sourcemap: true,
      })).code,
    };
  }

  test(`${format} - import external`, async t => {
    const { minified, code } = await input('external-import');

    t.is(code, minified);
  });
}

// createTests('esm');
createTests('es');