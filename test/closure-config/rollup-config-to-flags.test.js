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
import { defaults } from '../../transpile-tests/options.js';

test.beforeEach(async (t) => {
  t.context = {
    default: await defaults({}, [], null),
    esOutput: await defaults(
      {
        format: 'es',
      },
      [],
      null,
    ),
  };
});

test('with no rollup configuration, language out is NO_TRANSPILE', (t) => {
  t.is(t.context.default.language_out, 'NO_TRANSPILE');
});

test('with no rollup configuration, assume_function_wrapper is false', (t) => {
  t.is(t.context.default.assume_function_wrapper, false);
});

test('with no rollup configuration, warning_level is QUIET', (t) => {
  t.is(t.context.default.warning_level, 'QUIET');
});

test('with no rollup configuration, module_resolution is NODE', (t) => {
  t.is(t.context.default.module_resolution, 'NODE');
});

test('when rollup configuration specifies format es, assume_function_wrapper is true', (t) => {
  t.is(t.context.esOutput.assume_function_wrapper, true);
});
