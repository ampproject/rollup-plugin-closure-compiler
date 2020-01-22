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
import { parse } from '../../acorn';
import { walk } from 'estree-walker';
import { literalName } from '../../parsing/literal-name';
import { Specifiers, isImportDeclaration, FormatSpecifiers } from '../../parsing/import-specifiers';
import { v4 } from 'uuid';
import { Range } from '../../types';
import { BaseNode, Identifier, ImportDeclaration } from 'estree';

function isIdentifier(node: BaseNode): node is Identifier {
  return node.type === 'Identifier';
}

function getMangledName(name: string, sourceId: string): string {
  return `${name}_${sourceId}`;
}

/*
 * Note: This isn't ready to be used yet, just an example of a SourceTransform
 */
export class ImportTransform extends SourceTransform {
  public name: string = 'ImportTransform';
  private sources: Map<string, string> = new Map();
  private mangled: Map<string, string> = new Map();

  private getSourceId = (name: string): string => {
    let uuid = this.sources.get(name);
    if (!uuid) {
      this.sources.set(name, (uuid = v4()));
    }

    return uuid;
  };

  private setMangledName = (name: string, sourceId: string): string => {
    const mangled = getMangledName(name, sourceId);
    const stored = this.mangled.get(name);

    if (stored && stored !== mangled) {
      console.log('SetIdentifier for Mangled Name more than once', { name, sourceId });
    } else {
      this.mangled.set(name, mangled);
    }

    return mangled;
  };

  private mangleImportDeclaration = (node: ImportDeclaration, source: MagicString): void => {
    const [start, end] = node.range as Range;
    const name = literalName(node.source);
    const sourceId = this.getSourceId(name);
    let specifiers = Specifiers(node.specifiers);

    specifiers = {
      ...specifiers,
      specific: specifiers.specific.map(specific => this.setMangledName(specific, sourceId)),
      local: specifiers.local.map(local => this.setMangledName(local, sourceId)),
    };

    source.overwrite(start, end, FormatSpecifiers(specifiers, name));
  };

  private mangleIdentifier = (node: Identifier, source: MagicString): void => {
    const [start, end] = node.range as Range;
    const mangledIdentifier = this.mangled.get(node.name);
    if (mangledIdentifier) {
      source.overwrite(start, end, mangledIdentifier);
    }
  };

  public async pre(code: string): Promise<TransformSourceDescription> {
    const source = new MagicString(code);
    const program = parse(code);
    const { mangleImportDeclaration, mangleIdentifier } = this;

    // This is a two-phase walk
    // 1. Identify all imports and rename them to indicate where they come from.
    // 2. Find usages of those imports and rename them.
    walk(program, {
      enter: function(node, parent, prop, index) {
        if (isImportDeclaration(node)) {
          mangleImportDeclaration(node, source);
          this.skip();
        }
        if (isIdentifier(node)) {
          mangleIdentifier(node, source);
        }
      },
      // leave: function(node, parent, prop, index) {
      //   if (node.type === 'ImportDeclaration') {
      //     console.log('leave', {node, parent, prop, index});
      //   }
      //   // some code happens
      // },
    });

    console.log('finished import transform', source.toString());

    return {
      code,
    };
  }
}
