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

test('with no rollup configuration defaults are valid', t => {
  const options = defaultCompileOptions({});
  const {externs, ...optionsMinusExterns} = options; 

  t.deepEqual(optionsMinusExterns, {
    language_out: 'NO_TRANSPILE',
    assume_function_wrapper: false,
    warning_level: 'QUIET',
  });
  t.is(externs.length, 2);
});

test('when rollup configuration specifies format es, assume_function_wrapper is true', t => {
  const options = defaultCompileOptions({
    format: 'es',
  });

  t.true(options.assume_function_wrapper);
});