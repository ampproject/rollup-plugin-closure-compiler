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

import {
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  Literal,
  SimpleLiteral,
  ImportDeclaration,
} from 'estree';
import { PluginContext } from 'rollup';
import {
  ExportClosureMapping,
  IMPORT_SPECIFIER,
  IMPORT_NAMESPACE_SPECIFIER,
  IMPORT_DEFAULT_SPECIFIER,
  ExportDetails,
  Range,
} from '../types';

export function NamedDeclaration(
  context: PluginContext,
  declaration: ExportNamedDeclaration,
): Array<ExportDetails> {
  const range: Range = declaration.range as Range;
  const source: string | null =
    declaration.source && declaration.source.value && typeof declaration.source.value === 'string'
      ? declaration.source.value
      : null;

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
  context: PluginContext,
  declaration: ExportDefaultDeclaration,
): Array<ExportDetails> {
  if (declaration.declaration) {
    const range: Range = declaration.range as Range;
    const source = null;

    if (declaration.declaration.type === 'Identifier' && declaration.declaration.name) {
      return [
        {
          local: declaration.declaration.name,
          exported: declaration.declaration.name,
          closureName: declaration.declaration.name,
          type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
          range,
          source,
        },
      ];
    }
  }

  return [];
}

export function literalName(context: PluginContext, literal: Literal): string {
  // Literal can either be a SimpleLiteral, or RegExpLiteral
  if ('regex' in literal) {
    // This is a RegExpLiteral
    context.warn(
      'Rollup Plugin Closure Compiler found a Regex Literal Named Import. `import foo from "*/.hbs"`',
    );
    return '';
  }

  const literalValue = (literal as SimpleLiteral).value;
  return typeof literalValue === 'string' ? literalValue : '';
}

export function importLocalNames(
  context: PluginContext,
  declaration: ImportDeclaration,
): Array<string> {
  const VALID_SPECIFIERS = [IMPORT_SPECIFIER, IMPORT_NAMESPACE_SPECIFIER, IMPORT_DEFAULT_SPECIFIER];
  const returnableSpecifiers: Array<string> = [];

  (declaration.specifiers || []).forEach(specifier => {
    if (VALID_SPECIFIERS.includes(specifier.type)) {
      returnableSpecifiers.push(specifier.local.name);
    }
  });

  return returnableSpecifiers;
}
