/**
 * Copyright 2020 The AMP HTML Authors. All Rights Reserved.
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

import * as path from 'path';
import { tmpdir } from 'os';
import { promises } from 'fs';
import * as crypto from 'crypto';

export async function writeTempFile(content: string, extension: string = ''): Promise<string> {
  const stableHash: string = crypto
    .createHash('sha1')
    .update(content)
    .digest('hex');
  const fullpath: string = path.join(tmpdir(), stableHash + extension);
  await promises.mkdir(path.dirname(fullpath), { recursive: true });
  await promises.writeFile(fullpath, content, 'utf-8');

  return fullpath;
}
