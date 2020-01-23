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

// export function NamedDeclaration(declaration: ExportNamedDeclaration): Array<ExportDetails> {
//   const exportDetails: Array<ExportDetails> = [];
//   const source: string | null =
//     typeof declaration?.source?.value === 'string' ? declaration.source.value : null;

//   for (const specifier of declaration.specifiers) {
//     exportDetails.push({
//       local: specifier.local.name,
//       exported: specifier.exported.name,
//       type: ExportClosureMapping.NAMED_CONSTANT,
//       range: declaration.range as Range,
//       source,
//     });
//   }

//   return exportDetails;
// }

export function NamedDeclaration(node: ExportNamedDeclaration): Array<ExportDetails> {
  const exportDetails: Array<ExportDetails> = [];
  const range = node.range as Range;
  const source: string | null = typeof node.source?.value === 'string' ? node.source.value : null;
  const { specifiers, declaration } = node;

  // NamedDeclarations either have specifiers or declarations.
  if (specifiers.length > 0) {
    for (const specifier of specifiers) {
      exportDetails.push({
        local: specifier.local.name,
        exported: specifier.exported.name,
        type: ExportClosureMapping.NAMED_CONSTANT,
        range,
        source,
      });
    }

    return exportDetails;
  }

  let id: Identifier;
  if (declaration) {
    if (isFunctionDeclaration(declaration)) {
      // Only default exports can be missing an identifier.
      id = declaration.id as Identifier;

      exportDetails.push({
        local: id.name,
        exported: id.name,
        type: ExportClosureMapping.NAMED_FUNCTION,
        range,
        source,
      });
    }
    if (isVariableDeclaration(declaration)) {
      for (const eachDeclaration of declaration.declarations) {
        if (isIdentifier(eachDeclaration.id)) {
          exportDetails.push({
            local: eachDeclaration.id.name,
            exported: eachDeclaration.id.name,
            type: ExportClosureMapping.NAMED_CONSTANT,
            range,
            source,
          });
        }
      }
    }
    if (isClassDeclaration(declaration)) {
      // Only default exports can be missing an identifier.
      id = declaration.id as Identifier;

      exportDetails.push({
        local: id.name,
        exported: id.name,
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
): Array<ExportDetails> {
  const { declaration } = defaultDeclaration;

  if (declaration.type === 'Identifier' && declaration.name) {
    return [
      {
        local: declaration.name,
        exported: declaration.name,
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
