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
import sanitize from 'sanitize-filename';

type ExportDeclarationsWithFunctions = ExportNamedDeclaration | ExportDefaultDeclaration;

function functionDeclarationName(
  context: PluginContext,
  declaration: ExportDeclarationsWithFunctions,
): string | null {
  // For the Declaration passed, there can be a function declaration.
  if (declaration.declaration && declaration.declaration.type === 'FunctionDeclaration') {
    const functionDeclaration = declaration.declaration;

    if (
      functionDeclaration !== null &&
      functionDeclaration.id !== null &&
      functionDeclaration.id.name !== null
    ) {
      return functionDeclaration.id.name;
    }
  }

  return null;
}

function classDeclarationName(
  context: PluginContext,
  declaration: ExportDeclarationsWithFunctions,
): string | null {
  // For the Declaration passed, there can be a function declaration.
  if (declaration.declaration && declaration.declaration.type === 'ClassDeclaration') {
    const classDeclaration = declaration.declaration;

    if (
      classDeclaration !== null &&
      classDeclaration.id !== null &&
      classDeclaration.id.name !== null
    ) {
      // This class declaration is the export name we need to know.
      return classDeclaration.id.name;
    }
  }

  return null;
}

function closureMangleExportName(exportName: string, source: string | null): string {
  if (source === null) {
    return exportName;
  }
  return `__CLOSURE_MANGLE_NAME__${exportName}__${sanitize(source)}`;
}

export function NamedDeclaration(
  context: PluginContext,
  declaration: ExportNamedDeclaration,
): Array<ExportDetails> {
  const functionName = functionDeclarationName(context, declaration);
  const className = classDeclarationName(context, declaration);
  const range: Range = declaration.range as Range;

  // TODO(KB): This logic isn't great. If something has a named declaration, lets instead use the AST to find out what it is.
  // var Foo=function(){}export{Foo as default} => default export function

  if (functionName !== null) {
    return [
      {
        local: functionName,
        exported: functionName,
        closureName: closureMangleExportName(functionName, null),
        type: ExportClosureMapping.NAMED_FUNCTION,
        range,
        source: null,
      },
    ];
  } else if (className !== null) {
    return [
      {
        local: className,
        exported: className,
        closureName: closureMangleExportName(className, null),
        type: ExportClosureMapping.NAMED_CLASS,
        range,
        source: null,
      },
    ];
  } else if (declaration.declaration && declaration.declaration.type === 'VariableDeclaration') {
    const { declarations } = declaration.declaration;
    const exportDetails: Array<ExportDetails> = [];

    for (const declarator of declarations) {
      if (declarator.id.type === 'Identifier') {
        exportDetails.push({
          local: declarator.id.name,
          exported: declarator.id.name,
          closureName: closureMangleExportName(declarator.id.name, null),
          type: ExportClosureMapping.NAMED_CONSTANT,
          range,
          source: null,
        });
      }
    }
    return exportDetails;
  } else if (declaration.specifiers) {
    const exportDetails: Array<ExportDetails> = [];

    for (const specifier of declaration.specifiers) {
      exportDetails.push({
        local: specifier.local.name,
        exported: specifier.exported.name,
        closureName: closureMangleExportName(specifier.local.name, null),
        type: ExportClosureMapping.NAMED_CONSTANT,
        range,
        source: null,
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

    switch (declaration.declaration.type) {
      case 'FunctionDeclaration':
        const functionName = functionDeclarationName(context, declaration);
        if (functionName !== null) {
          return [
            {
              local: functionName,
              exported: functionName,
              closureName: closureMangleExportName(functionName, null),
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
              range,
              source: null,
            },
          ];
        }
        break;
      case 'ClassDeclaration':
        const className = classDeclarationName(context, declaration);
        if (className !== null) {
          return [
            {
              local: className,
              exported: className,
              closureName: closureMangleExportName(className, null),
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
              range,
              source: null,
            },
          ];
        }
        break;
      case 'Identifier':
        if (declaration.declaration.name) {
          return [
            {
              local: declaration.declaration.name,
              exported: declaration.declaration.name,
              closureName: closureMangleExportName(declaration.declaration.name, null),
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
              range,
              source: null,
            },
          ];
        }
        break;
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
  const returnableSpecifiers: Array<string> = [];

  if (declaration.specifiers) {
    declaration.specifiers.forEach(specifier => {
      switch (specifier.type) {
        case IMPORT_SPECIFIER:
        case IMPORT_NAMESPACE_SPECIFIER:
        case IMPORT_DEFAULT_SPECIFIER:
          returnableSpecifiers.push(specifier.local.name);
          break;
        default:
          break;
      }
    });
  }

  return returnableSpecifiers;
}
