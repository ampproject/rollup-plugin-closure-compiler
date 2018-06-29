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
import {defaultCompileOptions} from '../dist/index';
import { readFileSync } from 'fs';

test('with no rollup configuration defaults are valid', t => {
  const options = defaultCompileOptions({});
  t.deepEqual(options, {
    language_out: 'NO_TRANSPILE',
    assume_function_wrapper: false,
    warning_level: 'QUIET',
  });
});

test('when rollup configuration specifies format iife with a name, an extern is generated', t => {
  const options = defaultCompileOptions({
    format: 'iife',
    name: 'Wrapper'
  });

  t.not(options.externs, undefined);

  const externs = readFileSync(options.externs, 'utf8');
  t.is(externs, `function Wrapper(){}`);
});

test('when rollup configuration specifies format es, assume_function_wrapper is true', t => {
  const options = defaultCompileOptions({
    format: 'es',
  });

  t.true(options.assume_function_wrapper);
});