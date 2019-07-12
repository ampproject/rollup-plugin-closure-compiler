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

const test = require('ava');
const path = require('path');
const rollup = require('rollup');
const { default: compiler } = require('../../transpile/index');

const options = {
  externs: [
    path.resolve('test', 'provided-externs', 'fixtures', 'class.externs.js'),
  ],
  compilation_level: 'ADVANCED',
};
const optionsCopy = {...options};

async function compile() {
  const bundle = await rollup.rollup({
    input: `test/provided-externs/fixtures/class.js`,
    plugins: [
      compiler(options),
    ],
  });

  await bundle.generate({
    format: 'es',
    sourcemap: true,
  });
}

test(`building does not modify passed configuration`, async t => {
  await compile();

  t.deepEqual(options, optionsCopy);
});