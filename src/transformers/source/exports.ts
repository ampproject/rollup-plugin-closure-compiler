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

import { SourceTransform } from '../../transform.js';
import MagicString from 'magic-string';
import { parse, isExportNamedDeclaration, isExportDefaultDeclaration, isExportAllDeclaration } from '../../acorn.js';
import { asyncWalk as estreeWalk } from 'estree-walker';
import { ExportDetails } from '../../types.js';
import { BaseNode } from 'estree';
import { NamedDeclaration, DefaultDeclaration } from '../../parsing/export-details.js';

/**
 * Notes for Kris
 *
 * Left off here with a few questions.
 * 1. How do we know the source to use for export mangling, the current file could be imported with many paths.
 *    - Can rollup tell us somehow?
 * 2.
 */

export class ExportTransform extends SourceTransform {
  public name: string = 'ExportTransform';

  public transform = async (id: string, source: MagicString): Promise<MagicString> => {
    const program = await parse(id, source.toString());

    // This will need to be two-pass.
    // 1. Find all exports, and mangle their names.
    // 2. Mangle all internal references
    let exportDetails: Array<ExportDetails> = [];
    await estreeWalk(program, {
      enter: async function (node: BaseNode) {
        if (isExportNamedDeclaration(node)) {
          exportDetails.push(...NamedDeclaration(node));
        } else if (isExportDefaultDeclaration(node)) {
          exportDetails.push(...DefaultDeclaration(node));
        } else if (isExportAllDeclaration(node)) {
          // TODO
          exportDetails.push(...[]);
        }
      },
    });

    for (const details of exportDetails) {
      const sourceId = this.mangler.sourceId(details.source || id);
      this.mangler.mangle(details.exported, sourceId);
      this.mangler.mangle(details.local, sourceId);
    }

    await this.mangler.execute(source, program);

    return source;
  };
}
