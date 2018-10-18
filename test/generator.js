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
const { default: compiler } = require('../transpile/index');
const rollup = require('rollup');
const fs = require('fs');
const path = require('path');
const util = require('util');

const readFile = util.promisify(fs.readFile);

const DEFAULT_CLOSURE_OPTIONS = { default: {} };
const ADVANCED_CLOSURE_OPTIONS = {
  advanced: {
    compilation_level: 'ADVANCED_OPTIMIZATIONS',
    language_out: 'ECMASCRIPT_2015',
  },
};
const ES5_STRICT_CLOSURE_OPTIONS = { 
  es5: {
    language_out: 'ECMASCRIPT5_STRICT',
  },
};
const defaultClosureFlags = {
  ...DEFAULT_CLOSURE_OPTIONS,
  ...ADVANCED_CLOSURE_OPTIONS,
  ...ES5_STRICT_CLOSURE_OPTIONS,
};

const ES_OUTPUT = 'es';
const ESM_OUTPUT = 'esm';

const longest = strings =>
  (strings.length > 0 ? strings.sort((a, b) => b.length - a.length)[0] : strings[0]).length;
const fixtureLocation = (category, name, format, optionsKey, minified = false) =>
  `test/${category}/fixtures/${minified ? `${name}.${format === ES_OUTPUT ? ESM_OUTPUT : format}.${optionsKey}.js` : `${name}.js`}`;

function generate(
  shouldFail,
  category,
  name,
  formats,
  closureFlags,
) {
  const targetLength = longest(formats);
  const optionLength = longest(Object.keys(closureFlags));

  formats.forEach(format => {
    async function compile(optionKey) {
      const bundle = await rollup.rollup({
        input: fixtureLocation(category, name, format, optionKey, false),
        plugins: [compiler(closureFlags[optionKey])],
        external: ['lodash'],
        experimentalCodeSplitting: true,
      });

      const bundles = await bundle.generate({
        format,
        sourcemap: true,
      });

      const output = [];
      for (file in bundles.output) {
        output.push({
          minified: await readFile(
            path.join(fixtureLocation(category, path.parse(bundles.output[file].fileName).name, format, optionKey, true)),
            'utf8',
          ),
          code: bundles.output[file].code
        });
      }

      return output;
    }

    Object.keys(closureFlags).forEach(optionKey => {
      const method = shouldFail ? test.failing : test;
      method(`${name} – ${format.padEnd(targetLength)} – ${optionKey.padEnd(optionLength)}`, async t => {
        const output = await compile(optionKey);

        t.plan(output.length);
        output.forEach(result => {
          t.is(result.code, result.minified);
        })
        // console.log(code);
        // t.is(code, minified);
      });
    });
  });
}

function failureGenerator(
  category,
  name,
  formats = [ESM_OUTPUT],
  closureFlags = defaultClosureFlags,
) {
  generate(true, category, name, formats, closureFlags);
}

function generator(
  category,
  name,
  formats = [ESM_OUTPUT],
  closureFlags = defaultClosureFlags,
) {
  generate(false, category, name, formats, closureFlags);
}

module.exports = {
  DEFAULT_CLOSURE_OPTIONS,
  ADVANCED_CLOSURE_OPTIONS,
  ES_OUTPUT,
  ESM_OUTPUT,
  generator,
  failureGenerator,
};
