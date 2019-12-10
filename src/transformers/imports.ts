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

import { Transform, Range } from '../types';
import { literalName, importLocalNames } from './parsing-utilities';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { ImportDeclaration, Identifier } from 'estree';
import { parse, walk } from '../acorn';

const DYNAMIC_IMPORT_KEYWORD = 'import';
const DYNAMIC_IMPORT_REPLACEMENT = `import_${new Date().getMilliseconds()}`;

const HEADER = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains the external import names, to prevent compilation failures.
* @externs
*/
`;

interface RangedImport {
  type: string;
  range: Range;
}

export default class ImportTransform extends Transform {
  private importedExternalsSyntax: { [key: string]: string } = {};
  private importedExternalsLocalNames: Array<string> = [];
  private dynamicImportPresent: boolean = false;

  /**
   * Generate externs for local names of external imports.
   * Otherwise, advanced mode compilation will fail since the reference is unknown.
   * @return string representing content of generated extern.
   */
  public extern(): string {
    let extern = HEADER;
    if (this.importedExternalsLocalNames.length > 0) {
      this.importedExternalsLocalNames.forEach(name => {
        extern += `function ${name}(){};\n`;
      });
    }

    if (this.dynamicImportPresent) {
      extern += `
/**
 * @param {string} path
 * @return {!Promise<?>}
 */
function ${DYNAMIC_IMPORT_REPLACEMENT}(path) { return Promise.resolve(path) };
window['${DYNAMIC_IMPORT_REPLACEMENT}'] = ${DYNAMIC_IMPORT_REPLACEMENT};`;
    }

    return extern;
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
    // console.error('parse', code);
    const program = parse(code);

    // console.error(program, code);

    walk.simple(program, {
      ImportDeclaration(node: ImportDeclaration) {
        const name = literalName(self.context, node.source);
        // console.log('import declaration', name);
        const range: Range = node.range ? [node.range[0], node.range[1]] : [0, 0];
        self.importedExternalsSyntax[name] = code.slice(range[0], range[1]);
        source.remove(range[0], range[1]);

        self.importedExternalsLocalNames = self.importedExternalsLocalNames.concat(
          importLocalNames(self.context, node),
        );
      },
      Import(node: RangedImport) {
        self.dynamicImportPresent = true;
        // Rename the `import` method to something we can put in externs.
        // CC doesn't understand dynamic import yet.
        source.overwrite(
          node.range[0],
          node.range[1],
          code
            .substring(node.range[0], node.range[1])
            .replace(DYNAMIC_IMPORT_KEYWORD, DYNAMIC_IMPORT_REPLACEMENT),
        );
      },
    });

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  }

  /**
   * After Closure Compiler has modified the source, we need to re-add the external imports
   * @param code source post Closure Compiler Compilation
   * @return Promise containing the repaired source
   */
  public async postCompilation(code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    // console.log('imports postCompilation', code);
    const program = parse(code);

    Object.values(this.importedExternalsSyntax).forEach(importedExternalSyntax =>
      source.prepend(importedExternalSyntax),
    );

    walk.simple(program, {
      Identifier(node: Identifier) {
        if (node.name === DYNAMIC_IMPORT_REPLACEMENT) {
          const range: Range = node.range ? [node.range[0], node.range[1]] : [0, 0];
          source.overwrite(range[0], range[1], DYNAMIC_IMPORT_KEYWORD);
        }
      },
    });

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  }
}
