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

import MagicString from 'magic-string';
import { SourceRange, MangledWords, CodeTransform } from './types';
import { walk, range } from './acorn';
import {
  Program,
  ClassDeclaration,
  Identifier,
  VariableDeclaration,
  FunctionDeclaration,
} from 'estree';

export function mangleWord(
  source: MagicString,
  name: string,
  range: SourceRange,
  mangled: MangledWords,
): void {
  const mangleName = mangled.getFinal(name);
  if (mangleName) {
    source.overwrite(range[0], range[1], mangleName);
    mangled.store(name, mangleName);
  }
}

function remedyWord(name: string, range: SourceRange, mangled: MangledWords): CodeTransform | null {
  const remedyWord = mangled.getInitial(name);
  if (remedyWord) {
    return {
      type: 'overwrite',
      range,
      content: remedyWord,
    };
  }

  return null;
}
export async function remedy(
  program: Program,
  mangled: MangledWords,
): Promise<Array<CodeTransform>> {
  const changes: Array<CodeTransform | null> = [];

  walk.simple(program, {
    ClassDeclaration(node: ClassDeclaration) {
      if (node.id !== null) {
        changes.push(remedyWord(node.id.name, range(node.id), mangled));
      }
    },
    Identifier(node: Identifier) {
      changes.push(remedyWord(node.name, range(node), mangled));
    },
    VariableDeclaration(node: VariableDeclaration) {
      node.declarations.forEach(declarator => {
        if (declarator.id.type === 'Identifier') {
          changes.push(remedyWord(declarator.id.name, range(declarator.id), mangled));
        }
      });
    },
    FunctionDeclaration(node: FunctionDeclaration) {
      if (node.id) {
        changes.push(remedyWord(node.id.name, range(node.id), mangled));
      }
    },
  });

  return changes.filter(Boolean) as Array<CodeTransform>;
}
