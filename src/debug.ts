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

import { writeTempFile } from './temp-file';

const DEBUG_ENABLED = true;

/* c8 ignore next 12 */
export const logSource = async (preamble: string, source: string, code?: string): Promise<void> => {
  if (DEBUG_ENABLED) {
    const sourceLocation: string = await writeTempFile(source);
    const codeLocation: string = code ? await writeTempFile(code) : '';

    console.log(preamble);
    console.log(sourceLocation);
    if (code) {
      console.log(codeLocation);
    }
  }
};

/* c8 ignore next 6 */
export const log = (preamble: string, message: string | object): void | null => {
  if (DEBUG_ENABLED) {
    console.log(preamble);
    console.log(message);
  }
};
