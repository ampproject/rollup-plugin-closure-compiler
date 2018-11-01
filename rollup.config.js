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

import pkg from './package.json';
import builtins from 'builtins';
import copy from 'rollup-plugin-copy';

export default {
  input: './transpile/index.js',
  external: [
    ...builtins(),
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.peerDependencies || {}),
  ],
  plugins: [
    copy({
      './transpile/index.d.ts': './dist/index.d.ts',
      verbose: true,
    }),
  ],
  output: [
    {
      file: './dist/index.mjs',
      format: 'es',
    },
    {
      file: './dist/index.js',
      format: 'cjs',
    },
  ],
};
