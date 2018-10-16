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

import { Transform } from '../types';
import { literalName, importLocalNames } from './parsing-utilities';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { ImportDeclaration } from 'estree';
const walk = require('acorn-dynamic-import/lib/walk').default(require('acorn-walk'));

const HEADER = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains the external import names, to prevent compilation failures.
* @externs
*/
`;

export default class ImportTransform extends Transform {
  private importedExternalsSyntax: { [key: string]: string } = {};
  private importedExternalsLocalNames: Array<string> = [];

  /**
   * Rollup allows configuration for 'external' imports.
   * These are items that will not be bundled with the resulting code, but instead are expected
   * to already be available via `import` or other means.
   * @param source parsed from import statements, this is the source of a particular import statement.
   * @return boolean if the import is listed in the external list.
   */
  private isExternalImport(source: string): boolean {
    if (this.inputOptions.external === undefined) {
      return false;
    }
    if (Array.isArray(this.inputOptions.external)) {
      return this.inputOptions.external.includes(source);
    }

    return false;
  }

  /**
   * Generate externs for local names of external imports.
   * Otherwise, advanced mode compilation will fail since the reference is unknown.
   * @return string representing content of generated extern.
   */
  public extern(): string {
    if (this.importedExternalsLocalNames.length > 0) {
      let extern = HEADER;
      this.importedExternalsLocalNames.forEach(name => {
        extern += `function ${name}(){};\n`;
      });

      return extern;
    }

    return '';
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
    const self = this;
    const source = new MagicString(code);
    const program = self.context.parse(code, { ranges: true });

    walk.simple(program, {
      async ImportDeclaration(node: ImportDeclaration) {
        const name = literalName(self.context, node.source);

        if (self.isExternalImport(name)) {
          const range: [number, number] = node.range ? [node.range[0], node.range[1]] : [0, 0];
          self.importedExternalsSyntax[name] = code.slice(range[0], range[1]);
          source.remove(range[0], range[1]);

          self.importedExternalsLocalNames = self.importedExternalsLocalNames.concat(
            importLocalNames(self.context, node),
          );
        }
      },
    });

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
