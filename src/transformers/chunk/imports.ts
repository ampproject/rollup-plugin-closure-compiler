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
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import { Identifier } from 'estree';
import { parse, walk, isIdentifier, isImportDeclaration, isImportExpression } from '../../acorn';
import { walk as estreeWalk } from '@kristoferbaxter/estree-walker';

const DYNAMIC_IMPORT_KEYWORD = 'import';
const DYNAMIC_IMPORT_REPLACEMENT = `import_${new Date().getMilliseconds()}`;

const HEADER = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains the external import names, to prevent compilation failures.
* @externs
*/
`;

// interface RangedImport {
//   type: string;
//   range: Range;
// }

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

  // private foundImportDeclaration = (node: ImportDeclaration, source: MagicString, skip: () => void) => {
  //   const [importDeclarationStart, importDeclarationEnd]: Range = node.range as Range;
  //   const originalName = literalName(node.source);

  //   let specifiers = Specifiers(node.specifiers);
  //   specifiers = {
  //     ...specifiers,
  //     default: this.mangler.getName(specifiers.default || '') || specifiers.default,
  //     specific: specifiers.specific.map(specific => {
  //       if (specific.includes(' as ')) {
  //         const split = specific.split(' as ');
  //         return `${this.mangler.getName(split[0]) || split[0]} as ${this.mangler.getName(split[1])}`;
  //       }
  //       return this.mangler.getName(specific) as string;
  //     }),
  //     local: specifiers.local.map(local => this.mangler.getName(local) as string),
  //   };

  //   const unmangledName = this.mangler.getName(originalName) || originalName;
  //   this.importedExternalsSyntax[unmangledName] = FormatSpecifiers(specifiers, unmangledName);
  //   this.importedExternalsLocalNames.push(...specifiers.local);
  //   source.remove(importDeclarationStart, importDeclarationEnd);

  //   skip();
  // };

  /**
   * Before Closure Compiler modifies the source, we need to ensure external imports have been removed
   * since Closure will error out when it encounters them.
   * @param code source to parse, and modify
   * @return modified input source with external imports removed.
   */
  public pre = async (code: string): Promise<TransformSourceDescription> => {
    let source = new MagicString(code);
    let program = parse(code);
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
            default: mangler.getName(specifiers.default || '') || null,
            specific: specifiers.specific.map(specific => {
              if (specific.includes(' as ')) {
                const split = specific.split(' as ');
                return `${mangler.getName(split[0]) || split[0]} as ${mangler.getName(split[1])}`;
              }
              return mangler.getName(specific) as string;
            }),
            local: specifiers.local.map(local => mangler.getName(local) as string),
          };

          const unmangledName = mangler.getName(originalName) || originalName;
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

    // walk.simple(program, {
    //   ImportDeclaration: (node: ImportDeclaration) => {
    //     const name = literalName(node.source);
    //     const range: Range = node.range as Range;
    //     const specifiers = Specifiers(node.specifiers);

    //     // console.log('local', specifiers.local.map(local => ({local, unmangled: this.mangler.getName(local)})));
    //     // console.log(this.mangler.getName(specifiers))

    //     this.importedExternalsSyntax[name] = FormatSpecifiers(specifiers, name);
    //     this.importedExternalsLocalNames.push(...specifiers.local);
    //     source.remove(...range);
    //   },
    //   Import: (node: RangedImport) => {
    //     const [start, end] = node.range;
    //     this.dynamicImportPresent = true;
    //     // Rename the `import` method to something we can put in externs.
    //     // CC doesn't understand dynamic import yet.
    //     source.overwrite(
    //       start,
    //       end,
    //       code.substring(start, end).replace(DYNAMIC_IMPORT_KEYWORD, DYNAMIC_IMPORT_REPLACEMENT),
    //     );
    //   },
    // });

    // console.log(
    //   'import chunk pre done',
    //   this.importedExternalsSyntax,
    //   this.importedExternalsLocalNames,
    // );

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  };

  /**
   * After Closure Compiler has modified the source, we need to re-add the external imports
   * @param code source post Closure Compiler Compilation
   * @return Promise containing the repaired source
   */
  public async post(code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    const program = parse(code);

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

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  }
}
