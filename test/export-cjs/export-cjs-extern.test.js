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
import { createTransforms } from '../../transpile/transforms';
import { defaults } from '../../transpile/options';
import * as fs from 'fs';
import { promisify } from 'util';

const readFile = promisify(fs.readFile);

test('generate extern for cjs export pattern', async t => {
  const externFixtureContent = await readFile('test/export-cjs/fixtures/export.extern.js', 'utf8');
  const outputOptions = {
    format: 'cjs',
  };

  const transforms = createTransforms({});
  const options = defaults(outputOptions, [], transforms);

  const contentMatch = options.externs.some(async externFilePath => {
    const fileContent = await readFile(externFilePath, 'utf8');
    return fileContent === externFixtureContent;
  });

  t.is(contentMatch, true);
});