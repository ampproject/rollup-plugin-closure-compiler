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
import compile, {ERROR_WARNINGS_ENABLED_LANGUAGE_OUT_UNSPECIFIED, ERROR_WARNINGS_ENABLED_LANGUAGE_OUT_INVALID} from '../../transpile-tests/options';

test('with no language out set, and warnings set to verbose... an error is returned', async t => {
  try {
    await compile({
      warning_level: 'VERBOSE',
    }, {
      format: 'es',
    }, 'var x = 1;', []);

    t.fail('compile completed without throwing an error.');
  } catch (e) {
    t.is(e.message, ERROR_WARNINGS_ENABLED_LANGUAGE_OUT_UNSPECIFIED);
  }
});

test('with language out set to no_transpile, and warnings set to verbose... an error is returned', async t => {
  try {
    await compile({
      warning_level: 'VERBOSE',
      language_out: 'NO_TRANSPILE',
    }, {
      format: 'es',
    }, 'var x = 1;', []);

    t.fail('compile completed without throwing an error.');
  } catch (e) {
    t.is(e.message, ERROR_WARNINGS_ENABLED_LANGUAGE_OUT_INVALID);
  }
});
