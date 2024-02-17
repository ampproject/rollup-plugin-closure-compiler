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

import { ExpressionStatement, AssignmentExpression, FunctionExpression, MemberExpression } from 'estree';
import { ExportDetails, Range } from '../types.js';
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
  const isDefault = exportDetails.exported === 'default';

  const tokens = new Array<string>();
  if (exportInline) tokens.push('export');
  if (isDefault) tokens.push('default');
  if (functionExpression.async) tokens.push('async');
  tokens.push('function');
  if (!isDefault) tokens.push(functionName);

  if (functionExpression.params.length > 0) {
    const [paramsStart] = functionExpression.params[0].range as Range;
    // FunctionExpression has parameters.
    source.overwrite(memberExpressionObjectStart, paramsStart, `${tokens.join(' ')}(`);
  } else {
    const [bodyStart] = functionExpression.body.range as Range;
    source.overwrite(memberExpressionObjectStart, bodyStart, `${tokens.join(' ')}()`);
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
  const [leftStart] = left.range as Range;
  const [rightStart, rightEnd]: Range = right.range as Range;

  if (exportInline) {
    const output =
      (exportDetails.exported === 'default' ? `export default ` : `export var ${exportDetails.exported}=`) +
      `${code.substring(rightStart, rightEnd)};`;
    source.overwrite(ancestorStart, ancestorEnd, output);
  } else if (exportDetails.source === null && 'name' in right) {
    // This is a locally defined identifier with a name we can use.
    exportDetails.local = right.name;
    source.remove(leftStart, ancestorEnd);
    return true;
  } else {
    source.overwrite(ancestorStart, ancestorEnd, `var ${exportDetails.local}=${code.substring(rightStart, rightEnd)};`);
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
