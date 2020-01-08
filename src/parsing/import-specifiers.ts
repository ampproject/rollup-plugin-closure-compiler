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

import { IMPORT_SPECIFIER, IMPORT_NAMESPACE_SPECIFIER, IMPORT_DEFAULT_SPECIFIER } from '../types';
import { ImportSpecifier, ImportDefaultSpecifier, ImportNamespaceSpecifier } from 'estree';

export interface Specifiers {
  default: string | null;
  specific: Array<string>;
  local: Array<string>;
}

export function Specifiers(
  specifiers: Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>,
): Specifiers {
  let defaultName: Specifiers['default'] = null;
  let specificNames: Specifiers['specific'] = [];
  let localNames: Specifiers['local'] = [];

  for (const specifier of specifiers) {
    localNames.push(specifier.local.name);

    switch (specifier.type) {
      case IMPORT_SPECIFIER:
      case IMPORT_NAMESPACE_SPECIFIER:
        const { name: local } = (specifier as ImportSpecifier).local;
        const { name: imported } = (specifier as ImportSpecifier).imported;

        if (local === imported) {
          specificNames.push(local);
        } else {
          specificNames.push(`${imported} as ${local}`);
        }
        break;
      case IMPORT_DEFAULT_SPECIFIER:
        defaultName = specifier.local.name;
        break;
    }
  }

  return {
    default: defaultName,
    specific: specificNames,
    local: localNames,
  };
}

export function FormatSpecifiers(specifiers: Specifiers, name: string): string {
  let formatted: string = 'import ';

  if (specifiers.default !== null) {
    formatted += specifiers.default;
  }
  if (specifiers.specific.length > 0) {
    formatted += `${specifiers.default !== null ? ',' : ''}{${specifiers.specific.join(',')}}`;
  }
  formatted += ` from '${name}';`;

  return formatted;
}
