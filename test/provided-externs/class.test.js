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

import {
  generator,
  DEFAULT_CLOSURE_OPTIONS,
  PRETTY_PRINT_CLOSURE_OPTIONS,
  ADVANCED_CLOSURE_OPTIONS,
  ES5_STRICT_CLOSURE_OPTIONS,
} from '../generator';
const path = require('path');

const EXTERNS = path.resolve('test', 'provided-externs', 'fixtures', 'class.externs.js');

generator('provided-externs', 'class', false, undefined, {
  default: {
    ...DEFAULT_CLOSURE_OPTIONS.default,
    externs: EXTERNS,
  },
  pretty: {
    ...PRETTY_PRINT_CLOSURE_OPTIONS.pretty,
    externs: EXTERNS,
  },
  advanced: {
    ...ADVANCED_CLOSURE_OPTIONS.advanced,
    externs: EXTERNS,
  },
  es5: {
    ...ES5_STRICT_CLOSURE_OPTIONS.es5,
    externs: EXTERNS,
  },
});
