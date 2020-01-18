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
import { create } from '../../transpile-tests/chunk-transformers/transforms';
import { defaults } from '../../transpile-tests/options';
import { promises as fsPromises } from 'fs';

test('generate extern for cjs export pattern', async t => {
  const externFixtureContent = await fsPromises.readFile(
    'test/export-cjs/fixtures/export.extern.js',
    'utf8',
  );
  const outputOptions = {
    format: 'cjs',
  };

  const transforms = create({});
  const options = await defaults(outputOptions, [], transforms);

  for (const externFilePath of options.externs) {
    const fileContent = await fsPromises.readFile(externFilePath, 'utf8');
    if (fileContent === externFixtureContent) {
      t.pass();
      return;
    }
  }
  t.fail('None of the externs match the expected format');
});
