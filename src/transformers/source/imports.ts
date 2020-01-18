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
// import MagicString from 'magic-string';
import { parse, walk } from '../../acorn';
import { ImportDeclaration } from 'estree';
import { literalName } from '../../parsing/literal-name';
import { Specifiers } from '../../parsing/import-specifiers';

export class ImportTransform extends SourceTransform {
  public name: string = 'ImportTransform';

  public async pre(code: string): Promise<TransformSourceDescription> {
    // const source = new MagicString(code);
    const program = parse(code);

    walk.simple(program, {
      ImportDeclaration: (node: ImportDeclaration) => {
        const name = literalName(node.source);
        const specifiers = Specifiers(node.specifiers);

        console.log({ name, specifiers });
      },
    });

    return {
      code,
    };
  }
}
