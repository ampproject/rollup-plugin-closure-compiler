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

const DEBUG_ENABLED = false;

/* c8 ignore next 15 */
export async function logTransformChain(
  file: string,
  stage: string,
  messages: Array<[string, string]>,
): Promise<void> {
  if (!DEBUG_ENABLED) return;
  let output: string = `\n${file} - ${stage}`;
  for (const [message, source] of messages) {
    output += `\n${message.substr(0, 15).padEnd(18, '.')} - file://${await writeTempFile(
      source,
      '.js',
    )}`;
  }
  console.log(output);
}

/* c8 ignore next 7 */
export const log = (preamble: string | undefined, message: string | object): void | null => {
  if (!DEBUG_ENABLED) return;
  if (preamble) {
    console.log(preamble);
  }
  console.log(message);
};
