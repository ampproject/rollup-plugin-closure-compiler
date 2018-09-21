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

import { Transform, ALL_IMPORT_DECLARATIONS, IMPORT_DECLARATION } from '../types';
import { literalName } from './parsing-utilities';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { Program } from 'estree';

// TODO(KB): Need to generate externs for external members if we do not have an extern passed in.
// Otherwise, advanced mode compilation will fail.
// Likely this means moving scanning for external imports from `preCompilation` to the `derive` phase.
// const HEADER = `/**
// * @fileoverview Externs built via derived configuration from Rollup or input code.
// * This extern contains the external import names, to prevent compilation failures.
// * @externs
// */
// `;

export default class ImportTransform extends Transform {
  private importedExternalsSyntax: { [key: string]: string } = {};

  /**
   * Rollup allows configuration for 'external' imports.
   * These are items that will not be bundled with the resulting code, but instead are expected
   * to already be available via `import` or other means.
   * @param source parsed from import statements, this is the source of a particular import statement.
   * @return Promise<boolean> if the import is listed in the external list.
   */
  private async isExternalImport(source: string): Promise<boolean> {
    if (this.inputOptions.external === undefined) {
      return false;
    }
    if (Array.isArray(this.inputOptions.external)) {
      return this.inputOptions.external.includes(source);
    }
    // TODO(KB): Restore if needed.
    // if (typeof this.inputOptions.external === 'function') {
    //   const configDrivenExternal = await this.inputOptions.external(source, parent, true);
    //   return configDrivenExternal !== undefined && configDrivenExternal === true;
    // }

    return false;
  }

  /**
   * Before Closure Compiler modifies the source, we need to ensure external imports have been removed
   * since Closure will error out when it encounters them.
   * @param code source to parse, and modify
   * @param chunk OutputChunk from Rollup for this code.
   * @param id Rollup id reference to the source
   * @return modified input source with external imports removed.
   */
  public async preCompilation(code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    const program: Program = this.context.parse(code, { ranges: true });
    const importNodes = program.body.filter(node => ALL_IMPORT_DECLARATIONS.includes(node.type));

    console.log('importNodes', importNodes);

    for (const node of importNodes) {
      switch (node.type) {
        case IMPORT_DECLARATION:
          const name = literalName(this.context, node.source);
          if (await this.isExternalImport(name)) {
            const range: [number, number] = node.range ? [node.range[0], node.range[1]] : [0, 0];
            this.importedExternalsSyntax[name] = code.slice(range[0], range[1]);
            source.remove(range[0], range[1]);
          }
          break;
        default:
          break;
      }
    }

    return {
      code: source.toString(),
      map: source.generateMap(),
    };
  }

  /**
   * After Closure Compiler has modified the source, we need to re-add the external imports
   * @param code source post Closure Compiler Compilation
   * @return Promise containing the repaired source
   */
  public async postCompilation(code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    Object.values(this.importedExternalsSyntax).forEach(importedExternalSyntax =>
      source.prepend(importedExternalSyntax),
    );

    return {
      code: source.toString(),
      map: source.generateMap(),
    };
  }
}
