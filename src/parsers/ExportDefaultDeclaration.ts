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

/**
 * Find information about the ExportDefaultDeclaration passed
 * @param node ExportDefaultDeclaration
 * @return Interesting information about the default export.
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
