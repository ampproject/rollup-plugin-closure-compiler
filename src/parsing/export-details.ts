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

import { ExportNamedDeclaration, ExportDefaultDeclaration } from 'estree';
import { ExportDetails, Range, ExportClosureMapping } from '../types';

export function NamedDeclaration(declaration: ExportNamedDeclaration): Array<ExportDetails> {
  const range: Range = declaration.range as Range;
  const source: string | null =
    typeof declaration?.source?.value === 'string' ? declaration.source.value : null;

  if (declaration.specifiers) {
    const exportDetails: Array<ExportDetails> = [];

    for (const specifier of declaration.specifiers) {
      exportDetails.push({
        local: specifier.local.name,
        exported: specifier.exported.name,
        closureName: specifier.exported.name,
        type: ExportClosureMapping.NAMED_CONSTANT,
        range,
        source,
      });
    }

    return exportDetails;
  }

  return [];
}

export function DefaultDeclaration(
  defaultDeclaration: ExportDefaultDeclaration,
): Array<ExportDetails> {
  const range: Range = defaultDeclaration.range as Range;
  const { declaration } = defaultDeclaration;

  if (declaration.type === 'Identifier' && declaration.name) {
    return [
      {
        local: declaration.name,
        exported: declaration.name,
        closureName: declaration.name,
        type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
        range,
        source: null,
      },
    ];
  }

  return [];
}
