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
  namespace: boolean;
}

export function Specifiers(
  specifiers: Array<ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier>,
): Specifiers {
  const returnable: Specifiers = {
    default: null,
    specific: [],
    local: [],
    namespace: false,
  };

  for (const specifier of specifiers) {
    returnable.local.push(specifier.local.name);

    switch (specifier.type) {
      case IMPORT_SPECIFIER:
        const { name: local } = (specifier as ImportSpecifier).local;
        const { name: imported } = (specifier as ImportSpecifier)?.imported || {
          name: specifier.local,
        };

        if (local === imported) {
          returnable.specific.push(local);
        } else {
          returnable.specific.push(`${imported} as ${local}`);
        }
        break;
      case IMPORT_NAMESPACE_SPECIFIER:
        const { name: namespace } = specifier.local;
        returnable.specific.push(namespace);
        returnable.namespace = true;
        break;
      case IMPORT_DEFAULT_SPECIFIER:
        returnable.default = specifier.local.name;
        break;
    }
  }

  return returnable;
}

export function FormatSpecifiers(specifiers: Specifiers, name: string): string {
  const hasDefault = specifiers.default !== null;
  const hasNamespace = specifiers.namespace === true;
  const hasSpecifics = !hasNamespace && specifiers.specific.length > 0;
  let formatted: string = 'import';
  let values: Array<string> = [];

  if (hasDefault) {
    values.push(`${specifiers.default}`);
  }
  if (hasNamespace) {
    values.push(`* as ${specifiers.specific[0]}`);
  }
  if (hasSpecifics) {
    values.push(`{${specifiers.specific.join(',')}}`);
  }
  formatted += `${hasDefault || hasNamespace ? ' ' : ''}${values.join(',')}${
    hasSpecifics ? '' : ' '
  }from'${name}';`;

  return formatted;
}
