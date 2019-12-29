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

import {
  Transform,
  Range,
  IMPORT_SPECIFIER,
  IMPORT_NAMESPACE_SPECIFIER,
  IMPORT_DEFAULT_SPECIFIER,
} from '../types';
import { literalName, importLocalNames } from './parsing-utilities';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { ImportDeclaration, Identifier, ImportSpecifier } from 'estree';
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
  public name = 'ImportTransform';

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
    const program = parse(code);

    walk.simple(program, {
      async ImportDeclaration(node: ImportDeclaration) {
        const name = literalName(self.context, node.source);
        const range: Range = node.range as Range;

        let defaultSpecifier: string | null = null;
        const specificSpecifiers: Array<string> = [];
        for (const specifier of node.specifiers) {
          switch (specifier.type) {
            case IMPORT_SPECIFIER:
            case IMPORT_NAMESPACE_SPECIFIER:
              const { name: local } = (specifier as ImportSpecifier).local;
              const { name: imported } = (specifier as ImportSpecifier).imported;
              specificSpecifiers.push(local === imported ? local : `${imported} as ${local}`);
              break;
            case IMPORT_DEFAULT_SPECIFIER:
              defaultSpecifier = specifier.local.name;
              break;
          }
        }
        self.importedExternalsSyntax[name] = `import ${
          defaultSpecifier !== null
            ? `${defaultSpecifier}${specificSpecifiers.length > 0 ? ',' : ''}`
            : ''
        }${
          specificSpecifiers.length > 0 ? `{${specificSpecifiers.join(',')}}` : ''
        } from '${name}';`;
        source.remove(...range);

        self.importedExternalsLocalNames = self.importedExternalsLocalNames.concat(
          importLocalNames(self.context, node),
        );
      },
      Import(node: RangedImport) {
        const [start, end] = node.range;
        self.dynamicImportPresent = true;
        // Rename the `import` method to something we can put in externs.
        // CC doesn't understand dynamic import yet.
        source.overwrite(
          start,
          end,
          code.substring(start, end).replace(DYNAMIC_IMPORT_KEYWORD, DYNAMIC_IMPORT_REPLACEMENT),
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
    const program = parse(code);

    Object.values(this.importedExternalsSyntax).forEach(importedExternalSyntax =>
      source.prepend(importedExternalSyntax),
    );

    walk.simple(program, {
      Identifier(node: Identifier) {
        if (node.name === DYNAMIC_IMPORT_REPLACEMENT) {
          const [start, end] = node.range as Range;
          source.overwrite(start, end, DYNAMIC_IMPORT_KEYWORD);
        }
      },
    });

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  }
}
