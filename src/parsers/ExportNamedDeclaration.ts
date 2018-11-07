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

import { ExportNamedDeclaration } from 'estree';
import { DiscoveredExport } from '../types';
import { range } from '../acorn';

/* 
Note: We are only concerned with understanding the output of Rollup in ESM mode.
This means many of the possible output scenarios are unnecessary to resolve.

All of these exports will be covered by this Rollup feature.
//export class Exported {}
//export function standard(s) {}
//export function* generator() {}
//export const x = 1;
//export class {}
//class Exported {}
//export const x = new Exported();

Rollup will always pull the named exports out into a singular statement.
class Exported {}

export { Exported };
*/

export function exportNamedParser(node: ExportNamedDeclaration): Array<DiscoveredExport> | null {
  const specifiers = node.specifiers;
  const discoveredExports: Array<DiscoveredExport> = [];
  specifiers.forEach(specifier =>
    discoveredExports.push({
      local: specifier.local.name,
      exported: specifier.exported.name,
      default: false,
      range: range(node),
    }),
  );

  return discoveredExports;
}
