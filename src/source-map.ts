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

import MagicString from 'magic-string';
import remapping from '@ampproject/remapping';
import SourceMap from '@ampproject/remapping/dist/types/source-map';
import { DecodedSourceMap as RemappingDecodedSourceMap } from '@ampproject/remapping/dist/types/types';
import { ExistingRawSourceMap } from 'rollup';

export function createDecodedSourceMap(
  magicstring: MagicString,
  source: string,
): RemappingDecodedSourceMap {
  return {
    ...magicstring.generateDecodedMap({ hires: true, source }),
    version: 3,
  };
}

export function createExistingRawSourceMap(
  maps: Array<RemappingDecodedSourceMap>,
  file: string,
): ExistingRawSourceMap {
  const remappedSourceMap: SourceMap = remapping(maps, () => null);

  return {
    ...remappedSourceMap,
    sources: remappedSourceMap.sources.map(source => source || ''),
    sourcesContent: remappedSourceMap.sourcesContent?.map(content => content || '') || undefined,
    file,
  };
}
