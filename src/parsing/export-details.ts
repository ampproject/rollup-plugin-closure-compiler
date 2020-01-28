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

import {
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  Node,
  ExpressionStatement,
  MemberExpression,
  Expression,
  Identifier,
} from 'estree';
import { ExportDetails, Range, ExportClosureMapping } from '../types';
import {
  isFunctionDeclaration,
  isVariableDeclaration,
  isIdentifier,
  isClassDeclaration,
} from '../acorn';
import { Mangle } from 'src/transformers/mangle';

export function NamedDeclaration(
  node: ExportNamedDeclaration,
  unmangle?: Mangle['getName'],
): Array<ExportDetails> {
  const exportDetails: Array<ExportDetails> = [];
  const range = node.range as Range;
  const source: string | null = typeof node.source?.value === 'string' ? node.source.value : null;
  const value = (input: string) => (unmangle ? unmangle(input) || input : input);
  const { specifiers, declaration } = node;

  // NamedDeclarations either have specifiers or declarations.
  if (specifiers.length > 0) {
    for (const specifier of specifiers) {
      const exported = value(specifier.exported.name);
      exportDetails.push({
        local: value(specifier.local.name),
        exported,
        type: ExportClosureMapping.NAMED_CONSTANT,
        range,
        source,
      });
    }

    return exportDetails;
  }

  if (declaration) {
    if (isFunctionDeclaration(declaration)) {
      // Only default exports can be missing an identifier.
      exportDetails.push({
        local: value((declaration.id as Identifier).name),
        exported: value((declaration.id as Identifier).name),
        type: ExportClosureMapping.NAMED_FUNCTION,
        range,
        source,
      });
    }
    if (isVariableDeclaration(declaration)) {
      for (const eachDeclaration of declaration.declarations) {
        if (isIdentifier(eachDeclaration.id)) {
          exportDetails.push({
            local: value(eachDeclaration.id.name),
            exported: value(eachDeclaration.id.name),
            type: ExportClosureMapping.NAMED_CONSTANT,
            range,
            source,
          });
        }
      }
    }
    if (isClassDeclaration(declaration)) {
      // Only default exports can be missing an identifier.
      exportDetails.push({
        local: value((declaration.id as Identifier).name),
        exported: value((declaration.id as Identifier).name),
        type: ExportClosureMapping.NAMED_CLASS,
        range,
        source,
      });
    }
  }

  return exportDetails;
}

export function DefaultDeclaration(
  defaultDeclaration: ExportDefaultDeclaration,
  unmangle?: Mangle['getName'],
): Array<ExportDetails> {
  const { declaration } = defaultDeclaration;
  const value = (input: string) => (unmangle ? unmangle(input) || input : input);

  if (declaration.type === 'Identifier' && declaration.name) {
    return [
      {
        local: value(declaration.name),
        exported: value(declaration.name),
        type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
        range: defaultDeclaration.range as Range,
        source: null,
      },
    ];
  }

  return [];
}

export function NodeIsPreservedExport(node: Node): node is ExpressionStatement {
  return (
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'AssignmentExpression' &&
    node.expression.left.type === 'MemberExpression' &&
    node.expression.left.object.type === 'Identifier' &&
    node.expression.left.object.name === 'window'
  );
}

export function PreservedExportName(node: MemberExpression): string | null {
  const { property }: { property: Expression } = node;

  if (property.type === 'Identifier') {
    return property.name;
  }
  if (property.type === 'Literal' && typeof property.value === 'string') {
    return property.value;
  }

  return null;
}
