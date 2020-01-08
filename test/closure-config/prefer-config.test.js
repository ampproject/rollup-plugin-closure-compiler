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
import options from '../../transpile-tests/options';
import { generator } from '../generator';

test('platform unspecified is respected', async t => {
  const typical = await options({}, 'let x = 1;', []);

  t.is(typical[0].platform, undefined);
});

test('platform javascript is respected', async t => {
  const javascriptPlatform = await options(
    {
      platform: 'javascript',
    },
    'let x = 1;',
    [],
  );

  t.is(javascriptPlatform[0].platform, 'javascript');
});

generator('closure-config', 'prefer-config', undefined, undefined, {
  javascript: {
    platform: 'javascript',
  },
});
