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
  ExpressionStatement,
  AssignmentExpression,
  FunctionExpression,
  MemberExpression,
} from 'estree';
import { ExportDetails, Range } from '../types';
import MagicString from 'magic-string';

function PreserveFunction(
  code: string,
  source: MagicString,
  ancestor: ExpressionStatement,
  exportDetails: ExportDetails,
  exportInline: boolean,
): boolean {
  // Function Expressions can be inlined instead of preserved as variable references.
  // window['foo'] = function(){}; => export function foo(){} / function foo(){}
  const assignmentExpression = ancestor.expression as AssignmentExpression;
  const memberExpression = assignmentExpression.left as MemberExpression;
  const functionExpression = assignmentExpression.right as FunctionExpression;
  const [memberExpressionObjectStart] = memberExpression.object.range as Range;
  const functionName = exportInline ? exportDetails.exported : exportDetails.local;

  if (functionExpression.params.length > 0) {
    const [paramsStart] = functionExpression.params[0].range as Range;
    // FunctionExpression has parameters.
    source.overwrite(
      memberExpressionObjectStart,
      paramsStart,
      `${exportInline ? 'export ' : ''}function ${functionName}(`,
    );
  } else {
    const [bodyStart] = functionExpression.body.range as Range;
    source.overwrite(
      memberExpressionObjectStart,
      bodyStart,
      `${exportInline ? 'export ' : ''}function ${functionName}()`,
    );
  }

  return !exportInline;
}

function PreserveIdentifier(
  code: string,
  source: MagicString,
  ancestor: ExpressionStatement,
  exportDetails: ExportDetails,
  exportInline: boolean,
): boolean {
  const assignmentExpression = ancestor.expression as AssignmentExpression;
  const left = assignmentExpression.left;
  const right = assignmentExpression.right;
  const [ancestorStart, ancestorEnd]: Range = ancestor.range as Range;
  const [rightStart, rightEnd]: Range = right.range as Range;

  if (exportInline) {
    source.overwrite(
      ancestorStart,
      ancestorEnd,
      `export var ${exportDetails.exported}=${code.substring(rightStart, rightEnd)};`,
    );
  } else if (exportDetails.source === null && 'name' in right) {
    // This is a locally defined identifier with a name we can use.
    exportDetails.local = right.name;
    source.remove((left.range as Range)[0], rightEnd + 1);
    return true;
  } else {
    // exportDetails.local =
    source.overwrite(
      ancestorStart,
      ancestorEnd,
      `var ${exportDetails.local}=${code.substring(rightStart, rightEnd)};`,
    );
  }

  return !exportInline;
}

export function PreserveNamedConstant(
  code: string,
  source: MagicString,
  ancestor: ExpressionStatement,
  exportDetails: ExportDetails,
  exportInline: boolean,
): boolean {
  const assignmentExpression = ancestor.expression as AssignmentExpression;
  switch (assignmentExpression.right.type) {
    case 'FunctionExpression':
      return PreserveFunction(code, source, ancestor, exportDetails, exportInline);
    default:
      return PreserveIdentifier(code, source, ancestor, exportDetails, exportInline);
  }
}
