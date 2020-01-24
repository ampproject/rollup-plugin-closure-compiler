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
  isImportDeclaration,
  isExportAllDeclaration,
} from '../../acorn';
import { walk } from '@kristoferbaxter/estree-walker';
import { Range } from 'src/types';
import { Identifier } from 'estree';
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
  public name: string = 'ExportTransform';

  public transform = async (id: string, code: string): Promise<TransformSourceDescription> => {
    const source = new MagicString(code);
    const program = parse(code);
    const { mangler } = this;

    // This will need to be two-pass.
    // 1. Find all exports, and mangle their names.
    // 2. Mangle all internal references

    let insideNamedExport: boolean = false;
    let insideDefaultExport: boolean = false;
    let insideAllExport: boolean = false;
    let exportSource: string = id;
    await walk(program, {
      enter: async function(node, parent) {
        if (isImportDeclaration(node)) {
          // All import declarations are handledby the import source transform.
          this.skip();
        }

        if (isExportNamedDeclaration(node)) {
          insideNamedExport = true;
          exportSource = typeof node.source?.value === 'string' ? node.source.value : id;
        }
        if (isExportDefaultDeclaration(node)) {
          insideDefaultExport = true;
          exportSource = id;
          // exportSource = null;
        } else if (isExportAllDeclaration(node)) {
          insideAllExport = true;
          exportSource = typeof node.source?.value === 'string' ? node.source.value : id;
        }

        if (isIdentifier(node)) {
          let toMangle: Identifier | undefined = undefined;

          if (insideNamedExport) {
            if (isExportSpecifier(parent)) {
              if (parent.exported.name !== 'defualt') {
                // Only mangle exports that are not named defaults.
                // toMangle.push(parent.exported.name);
                toMangle = parent.exported;

                // const [exportedStart, exportedEnd] = parent.exported.range as Range;
                // const mangled = mangler.mangle(parent.exported.name, exportSource);
                // source.overwrite(exportedStart, exportedEnd, mangled);
              }
              this.skip();
            } else if (
              isFunctionDeclaration(parent) ||
              isVariableDeclarator(parent) ||
              isClassDeclaration(parent)
            ) {
              // toMangle.push(node.name);
              toMangle = node;
              // mangler.mangle(node.name, exportSource);
            }
          }

          if (insideDefaultExport && isExportDefaultDeclaration(parent)) {
            // toMangle.push(node.name);
            toMangle = node;
            // mangler.mangle(node.name, exportSource);
          }

          if (toMangle !== undefined) {
            const [exportedStart, exportedEnd] = toMangle.range as Range;
            const mangled = mangler.mangle(toMangle.name, mangler.sourceId(exportSource));
            source.overwrite(exportedStart, exportedEnd, mangled);
          }
        }
      },
      leave: async function(node) {
        if (isExportNamedDeclaration(node)) {
          insideNamedExport = false;
          exportSource = id;
        } else if (isExportDefaultDeclaration(node)) {
          insideDefaultExport = false;
          exportSource = id;
        } else if (isExportAllDeclaration(node)) {
          insideAllExport = false;
          exportSource = id;
        }
      },
    });

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  };
}
