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
  isImportDeclaration,
  isIdentifier,
  isVariableDeclarator,
  isBlockStatement,
  isExportAllDeclaration,
  isExportNamedDeclaration,
  isExportDefaultDeclaration,
} from '../../acorn';
import { walk } from '@kristoferbaxter/estree-walker';
import { literalName } from '../../parsing/literal-name';
import { Specifiers, FormatSpecifiers } from '../../parsing/import-specifiers';
import { Range } from '../../types';
import { Identifier, ImportDeclaration } from 'estree';

export class ImportTransform extends SourceTransform {
  public name: string = 'ImportTransform';

  private mangleImportDeclaration = async (
    node: ImportDeclaration,
    id: string,
    source: MagicString,
  ): Promise<void> => {
    const [start, end] = node.range as Range;
    const name = literalName(node.source);
    const sourceId = this.mangler.sourceId((await this.context.resolve(name, id))?.id || name);
    let specifiers = Specifiers(node.specifiers);

    specifiers = {
      ...specifiers,
      default:
        specifiers.default !== null ? this.mangler.mangle(specifiers.default, sourceId) : null,
      specific: specifiers.specific.map(specific => {
        if (specific.includes(' as ')) {
          const split = specific.split(' as ');
          return `${this.mangler.mangle(split[0], sourceId)} as ${this.mangler.mangle(
            split[1],
            sourceId,
          )}`;
        }
        return this.mangler.mangle(specific, sourceId);
      }),
      local: specifiers.local.map(local => this.mangler.mangle(local, sourceId)),
    };

    source.overwrite(start, end, FormatSpecifiers(specifiers, name));
  };

  private mangleIdentifier = (node: Identifier, source: MagicString): void => {
    const [start, end] = node.range as Range;
    const mangledIdentifier = this.mangler.getMangledName(node.name);
    if (mangledIdentifier) {
      console.log('mangle overwrite', mangledIdentifier);
      source.overwrite(start, end, mangledIdentifier);
    }
  };

  public async transform(id: string, code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    const program = parse(code);
    const { mangleImportDeclaration, mangleIdentifier, mangler } = this;
    let insideBlockStatement: boolean = false;
    let ignoreIdentfiersInBlockStatement: Array<string> = [];

    // This is a two-part walk
    // 1. Identify all imports and rename them to indicate where they come from.
    // 2. Find usages of those imports and rename them.

    // Importantly, do not rename identifiers that share a name with an import,
    //    but are defined locally within a BlockStatement.
    await walk(program, {
      enter: async function(node) {
        if (
          isExportAllDeclaration(node) ||
          isExportNamedDeclaration(node) ||
          isExportDefaultDeclaration(node)
        ) {
          // All exports are handled by the export source transform.
          this.skip();
        }
        if (isImportDeclaration(node)) {
          await mangleImportDeclaration(node, id, source);
          this.skip();
        }
        if (isBlockStatement(node)) {
          insideBlockStatement = true;
        }
        if (insideBlockStatement) {
          if (
            isVariableDeclarator(node) &&
            isIdentifier(node.id) &&
            !!mangler.getMangledName(node.id.name)
          ) {
            ignoreIdentfiersInBlockStatement.push(node.id.name);
            this.skip();
          }
          if (isIdentifier(node)) {
            if (ignoreIdentfiersInBlockStatement.includes(node.name)) {
              // Identifier was part of a variable declaration within a BlockStatement,
              // meaning it can have the same name as the original value without being mangled.
              this.skip();
            } else {
              mangleIdentifier(node, source);
            }
          }
        } else if (isIdentifier(node)) {
          mangleIdentifier(node, source);
        }
      },
      leave: async function(node) {
        if (isBlockStatement(node)) {
          insideBlockStatement = false;
          ignoreIdentfiersInBlockStatement = [];
        }
      },
    });

    console.log('imports done', source.toString());

    return {
      code: source.toString(),
      map: source.generateMap().mappings,
    };
  }
}
