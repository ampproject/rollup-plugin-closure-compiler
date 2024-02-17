/**
 * Copyright 2019 The AMP HTML Authors. All Rights Reserved.
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
import { compile } from '../generator.js';

test.serial('export * is unsupported', async (t) => {
  try {
    await compile('export-all', 'all-external', false, { default: {} }, 'default', 'esm');

    t.fail('expected error, but passed');
  } catch (e) {
    t.is(e.message, 'Rollup Plugin Closure Compiler does not support export all syntax for externals.');
  }
});
