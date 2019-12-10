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
  // ...ADVANCED_CLOSURE_OPTIONS,
  // ...ES5_STRICT_CLOSURE_OPTIONS,
};

const ES_OUTPUT = 'es';
const ESM_OUTPUT = 'esm';

const longest = strings =>
  (strings.length > 0 ? strings.sort((a, b) => b.length - a.length)[0] : strings[0]).length;
const fixtureLocation = (category, name, format, optionsKey, minified = false) =>
  `test/${category}/fixtures/${
    minified
      ? `${name}.${format === ES_OUTPUT ? ESM_OUTPUT : format}.${optionsKey}.js`
      : `${name}.js`
  }`;

function generate(shouldFail, category, name, codeSplit, formats, closureFlags) {
  const targetLength = longest(formats);
  const optionLength = longest(Object.keys(closureFlags));

  async function compile(optionKey, format) {
    const bundle = await rollup.rollup({
      input: fixtureLocation(category, name, format, optionKey, false),
      plugins: [compiler(closureFlags[optionKey])],
      external: ['lodash'],
      experimentalCodeSplitting: codeSplit,
      onwarn: _ => null,
      external: ['./browser.js'],
    });

    const bundles = await bundle.generate({
      format,
      sourcemap: true,
    });

    const output = [];
    if (bundles.output) {
      for (file in bundles.output) {
        const minified = await fs.promises.readFile(
          path.join(
            fixtureLocation(
              category,
              path.parse(bundles.output[file].fileName).name,
              format,
              optionKey,
              true,
            ),
          ),
          'utf8',
        );
        output.push({
          minified,
          code: bundles.output[file].code,
        });
      }
    } else {
      const minified = await fs.promises.readFile(
        path.join(
          fixtureLocation(category, path.parse(bundles.fileName).name, format, optionKey, true),
        ),
        'utf8',
      );
      output.push({
        minified,
        code: bundles.code,
      });
    }

    return output;
  }

  for (const format of formats) {
    for(const optionKey of Object.keys(closureFlags)) {
      const method = shouldFail ? test.failing.serial : test.serial;
      method(
        `${name} – ${format.padEnd(targetLength)} – ${optionKey.padEnd(optionLength)}`,
        async t => {
          const output = await compile(optionKey, format);

          t.plan(output.length);
          for (result of output) {
            t.is(result.code, result.minified)
          }
        },
      );
    }
  }
}

function failureGenerator(
  category,
  name,
  codeSplit = false,
  formats = [ESM_OUTPUT],
  closureFlags = defaultClosureFlags,
) {
  generate(true, category, name, codeSplit, formats, closureFlags);
}

function generator(
  category,
  name,
  codeSplit = false,
  formats = [ESM_OUTPUT],
  closureFlags = defaultClosureFlags,
) {
  generate(false, category, name, codeSplit, formats, closureFlags);
}

module.exports = {
  DEFAULT_CLOSURE_OPTIONS,
  ADVANCED_CLOSURE_OPTIONS,
  ES5_STRICT_CLOSURE_OPTIONS,
  ES_OUTPUT,
  ESM_OUTPUT,
  generator,
  failureGenerator,
};