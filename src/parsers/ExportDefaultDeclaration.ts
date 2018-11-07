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

import { ExportDefaultDeclaration } from 'estree';
import { DiscoveredExport } from '../types';
import { range } from '../acorn';

/* 
Note: We are only concerned with understanding the output of Rollup in ESM mode.
This means many of the possible output scenarios are unnecessary to resolve.

Not handled
1. Default export of unassigned values.
ASTExplorer - https://astexplorer.net/#/gist/a96bb7088dc3cce7c5dbe2ac9c887b26/dbb7153287f44004f58ecf451713968d836bdd31
Rollup REPL - https://rollupjs.org/repl?version=0.67.0&shareable=JTdCJTIybW9kdWxlcyUyMiUzQSU1QiU3QiUyMm5hbWUlMjIlM0ElMjJtYWluLmpzJTIyJTJDJTIyY29kZSUyMiUzQSUyMiUyRiolMjBUUkVFLVNIQUtJTkclMjAqJTJGJTVDbmV4cG9ydCUyMGRlZmF1bHQlMjA0MiUzQiUyMiU3RCU1RCUyQyUyMm9wdGlvbnMlMjIlM0ElN0IlMjJmb3JtYXQlMjIlM0ElMjJlc20lMjIlMkMlMjJuYW1lJTIyJTNBJTIybXlCdW5kbGUlMjIlMkMlMjJhbWQlMjIlM0ElN0IlMjJpZCUyMiUzQSUyMiUyMiU3RCU3RCUyQyUyMmV4YW1wbGUlMjIlM0FudWxsJTdE

All of these exports will be covered by this Rollup feature.
//export default [];
//export default 42;
//export default { key: "value" }
//export default function (s) {}
//export default function*() {}
//export default x = 1;
//export default class {}

However, we can futher optimize this pattern: `export default function (s) {}`
------------------
Rollup will output the following:
function main (s) {}

export default main;

We can repair this to the intended input with a few changes:
1. Detect export default of a Identifier
2. Find usages of the Identifier
2a. If there is only one, replace the definition with a `export` prefix.
2b. If there is more than one, leave the pattern alone.
*/

export function exportDefaultParser(node: ExportDefaultDeclaration): DiscoveredExport | null {
  const declaration = node.declaration;
  if (declaration.type === 'Identifier') {
    // This is a default export of a known identifier
    // Rollup will call unnamed default exports 'main' or another safeword.
    return {
      local: declaration.name,
      exported: declaration.name,
      default: true,
      range: range(node),
    };
  }

  return null;
}
