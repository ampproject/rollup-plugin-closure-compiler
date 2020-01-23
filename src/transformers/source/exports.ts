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

import { SourceTransform } from '../../transform';
import { TransformSourceDescription } from 'rollup';
import MagicString from 'magic-string';
import {
  parse,
  isExportNamedDeclaration,
  isExportDefaultDeclaration,
  isIdentifier,
  isFunctionDeclaration,
  isExportSpecifier,
  isVariableDeclarator,
  isClassDeclaration,
} from '../../acorn';
import { walk } from 'estree-walker';
// import { ExportDetails, ExportClosureMapping } from '../../types';
// import { DefaultDeclaration } from '../../parsing/export-details';

/**
 * Notes for Kris
 *
 * Left off here with a few questions.
 * 1. How do we know the source to use for export mangling, the current file could be imported with many paths.
 *    - Can rollup tell us somehow?
 * 2.
 */

export class ExportTransform extends SourceTransform {
  public name: string = 'ImportTransform';

  public async transform(fileName: string, code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    const program = parse(code);

    // This will need to be two-pass.
    // 1. Find all exports, and mangle their names.
    // 2. Mangle all internal references

    let insideNamedExport: boolean = false;
    let insideDefaultExport: boolean = false;
    // let insideAllExport: boolean = false;
    let exportSource: string | null | undefined = undefined;
    const toMangle: Array<string> = [];
    walk(program, {
      enter: function(node, parent) {
        if (isExportNamedDeclaration(node)) {
          insideNamedExport = true;
          exportSource = typeof node.source?.value === 'string' ? node.source.value : null;
        }
        if (isExportDefaultDeclaration(node)) {
          insideDefaultExport = true;
          exportSource = null;
        }
        // else if (isExportAllDeclaration(node)) {
        //   insideAllExport = true;
        //   exportSource = typeof node.source?.value === 'string' ? node.source.value : null;
        // }

        if (isIdentifier(node)) {
          if (insideNamedExport) {
            if (isExportSpecifier(parent)) {
              if (parent.exported.name !== 'defualt') {
                // Only mangle exports that are not named defaults.
                toMangle.push(parent.exported.name);
              }
              this.skip();
            } else if (
              isFunctionDeclaration(parent) ||
              isVariableDeclarator(parent) ||
              isClassDeclaration(parent)
            ) {
              toMangle.push(node.name);
            }
          }

          if (insideDefaultExport && isExportDefaultDeclaration(parent)) {
            toMangle.push(node.name);
          }
        }
      },
      leave: function(node) {
        if (isExportNamedDeclaration(node)) {
          insideNamedExport = false;
          exportSource = undefined;
        } else if (isExportDefaultDeclaration(node)) {
          insideDefaultExport = false;
          exportSource = undefined;
        }
        // else if (isExportAllDeclaration(node)) {
        //   insideAllExport = false;
        //   exportSource = undefined;
        // }
      },
    });

    console.log('collected to mangle', { toMangle, fileName });

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  }
}
