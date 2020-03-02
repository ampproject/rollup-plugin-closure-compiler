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

import { ChunkTransform } from '../../transform';
import { Range, TransformInterface } from '../../types';
import { literalName } from '../../parsing/literal-name';
import { FormatSpecifiers, Specifiers } from '../../parsing/import-specifiers';
import MagicString from 'magic-string';
import { Identifier } from 'estree';
import { parse, walk, isIdentifier, isImportDeclaration, isImportExpression } from '../../acorn';
import { asyncWalk as estreeWalk } from 'estree-walker';
import { Mangle } from '../mangle';

const DYNAMIC_IMPORT_KEYWORD = 'import';
const DYNAMIC_IMPORT_REPLACEMENT = `import_${new Date().getMilliseconds()}`;

const HEADER = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains the external import names, to prevent compilation failures.
* @externs
*/
`;

/**
 * Locally within imports we always need a name
 * If value passed is not present in the mangler then use original name.
 * @param input
 * @param unmangle
 */
function getName(input: string, unmangle?: Mangle['getName']): string {
  if (unmangle) {
    return unmangle(input) || input;
  }
  return input;
}

export default class ImportTransform extends ChunkTransform implements TransformInterface {
  private importedExternalsSyntax: { [key: string]: string } = {};
  private importedExternalsLocalNames: Array<string> = [];
  public dynamicImportPresent: boolean = false;
  public name = 'ImportTransform';

  /**
   * Generate externs for local names of external imports.
   * Otherwise, advanced mode compilation will fail since the reference is unknown.
   * @return string representing content of generated extern.
   */
  public extern(): string | null {
    let extern: string = HEADER;

    if (this.importedExternalsLocalNames.length > 0) {
      for (const name of this.importedExternalsLocalNames) {
        extern += `function ${name}(){};\n`;
      }
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

    return extern === HEADER ? null : extern;
  }

  /**
   * Before Closure Compiler modifies the source, we need to ensure external imports have been removed
   * since Closure will error out when it encounters them.
   * @param code source to parse, and modify
   * @return modified input source with external imports removed.
   */
  public pre = async (fileName: string, source: MagicString): Promise<MagicString> => {
    const code = source.toString();
    let program = await parse(fileName, code);
    let dynamicImportPresent: boolean = false;
    let { mangler, importedExternalsSyntax, importedExternalsLocalNames } = this;

    await estreeWalk(program, {
      enter: async function(node) {
        if (isImportDeclaration(node)) {
          const [importDeclarationStart, importDeclarationEnd]: Range = node.range as Range;
          const originalName = literalName(node.source);

          let specifiers = Specifiers(node.specifiers);
          specifiers = {
            ...specifiers,
            default: mangler.getName(specifiers.default || '') || specifiers.default,
            specific: specifiers.specific.map(specific => {
              if (specific.includes(' as ')) {
                const split = specific.split(' as ');
                return `${getName(split[0])} as ${getName(split[1])}`;
              }
              return getName(specific);
            }),
            local: specifiers.local.map(local => getName(local)),
          };

          const unmangledName = getName(originalName);
          importedExternalsSyntax[unmangledName] = FormatSpecifiers(specifiers, unmangledName);
          importedExternalsLocalNames.push(...specifiers.local);
          source.remove(importDeclarationStart, importDeclarationEnd);

          this.skip();
        }

        if (isIdentifier(node)) {
          const unmangled = mangler.getName(node.name);
          if (unmangled) {
            const [identifierStart, identifierEnd] = node.range as Range;
            source.overwrite(identifierStart, identifierEnd, unmangled);
          }
        }

        if (isImportExpression(node)) {
          const [dynamicImportStart, dynamicImportEnd] = node.range as Range;
          dynamicImportPresent = true;
          // Rename the `import` method to something we can put in externs.
          // CC doesn't understand dynamic import yet.
          source.overwrite(
            dynamicImportStart,
            dynamicImportEnd,
            code
              .substring(dynamicImportStart, dynamicImportEnd)
              .replace(DYNAMIC_IMPORT_KEYWORD, DYNAMIC_IMPORT_REPLACEMENT),
          );
        }
      },
    });

    this.dynamicImportPresent = dynamicImportPresent;

    return source;
  };

  /**
   * After Closure Compiler has modified the source, we need to re-add the external imports
   * @param code source post Closure Compiler Compilation
   * @return Promise containing the repaired source
   */
  public async post(fileName: string, source: MagicString): Promise<MagicString> {
    const code = source.toString();
    const program = await parse(fileName, code);

    for (const importedExternalSyntax of Object.values(this.importedExternalsSyntax)) {
      source.prepend(importedExternalSyntax);
    }

    walk.simple(program, {
      Identifier(node: Identifier) {
        if (node.name === DYNAMIC_IMPORT_REPLACEMENT) {
          const [start, end] = node.range as Range;
          source.overwrite(start, end, DYNAMIC_IMPORT_KEYWORD);
        }
      },
    });

    return source;
  }
}
