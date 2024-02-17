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
import compiler from '../../transpile-tests/index.js';
import * as rollup from 'rollup';
import { promises as fsPromises } from 'fs';
import { join } from 'path';

const closureFlags = {
  default: {
    warning_level: 'VERBOSE',
    language_out: 'ECMASCRIPT5_STRICT',
  },
  advanced: {
    warning_level: 'VERBOSE',
    compilation_level: 'ADVANCED_OPTIMIZATIONS',
    language_out: 'ECMASCRIPT5_STRICT',
  },
};

async function compile(name, option) {
  const bundle = await rollup.rollup({
    input: `test/${name}/fixtures/warnings.js`,
    plugins: [compiler(closureFlags[option])],
  });

  return {
    minified: await fsPromises.readFile(join(`test/${name}/fixtures/warnings.esm.${option}.js`), 'utf8'),
    code: (
      await bundle.generate({
        format: 'es',
        sourcemap: true,
      })
    ).code,
  };
}

Object.keys(closureFlags).forEach((option) => {
  test(`provides warnings – es, ${option}`, async (t) => {
    try {
      await compile('error-reporting', option);
      t.fail('successfully built files without warning about input');
    } catch (e) {
      t.pass();
    }
  });
});
