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
  ExportSpecifier,
  ExportNamedDeclaration,
  ExportDefaultDeclaration,
  Literal,
  SimpleLiteral,
} from 'estree';
import * as path from 'path';
import { PluginContext } from 'rollup';
import { ExportNameToClosureMapping, ExportClosureMapping } from '../types';

type ExportDeclarationsWithFunctions = ExportNamedDeclaration | ExportDefaultDeclaration;

export const exportSpecifierName = (exportSpecifier: ExportSpecifier): string =>
  exportSpecifier.exported.name;

const camelcase = (input: string): string =>
  input
    .replace(/^[_.\- ]+/, '')
    .toLowerCase()
    .replace(/[_.\- ]+(\w|$)/g, (m, p1) => p1.toUpperCase());

// When Rollup encounters a default export that is unnamed,
// it uses camelCase(filename) of the id to name the function.
// THIS IS NOT INTUITIVE!
export const defaultUnamedExportName = (id: string) => camelcase(path.basename(id, '.js'));

export function functionDeclarationName(
  context: PluginContext,
  id: string,
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

export function classDeclarationName(
  context: PluginContext,
  id: string,
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

export function NamedDeclaration(
  context: PluginContext,
  id: string,
  declaration: ExportNamedDeclaration,
): ExportNameToClosureMapping | null {
  const functionName = functionDeclarationName(context, id, declaration);
  const className = classDeclarationName(context, id, declaration);

  // TODO(KB): This logic isn't great. If something has a named declaration, lets instead use the AST to find out what it is.
  // var Foo=function(){}export{Foo as default} => default export function

  if (functionName !== null) {
    return {
      [functionName]: {
        alias: null,
        type: ExportClosureMapping.NAMED_FUNCTION,
      },
    };
  } else if (className !== null) {
    return {
      [className]: {
        alias: null,
        type: ExportClosureMapping.NAMED_CLASS,
      },
    };
  } else if (declaration.declaration && declaration.declaration.type === 'VariableDeclaration') {
    const variableDeclarations = declaration.declaration.declarations;
    const exportMap: ExportNameToClosureMapping = {};

    variableDeclarations.forEach(variableDeclarator => {
      if (variableDeclarator.id.type === 'Identifier') {
        exportMap[variableDeclarator.id.name] = {
          alias: null,
          type: ExportClosureMapping.NAMED_CONSTANT,
        };
      }
    });
    return exportMap;
  } else if (declaration.specifiers) {
    const exportMap: ExportNameToClosureMapping = {};
    declaration.specifiers.forEach(exportSpecifier => {
      if (exportSpecifier.exported.name === 'default') {
        // This is a default export in a specifier list.
        // e.g. export { foo as default };
        exportMap[exportSpecifier.local.name] = {
          alias: null,
          type: ExportClosureMapping.DEFAULT,
        };
      } else {
        exportMap[exportSpecifier.local.name] = {
          alias:
            exportSpecifier.local.name !== exportSpecifier.exported.name
              ? exportSpecifier.exported.name
              : null,
          type: ExportClosureMapping.NAMED_CONSTANT,
        };
      }
    });
    return exportMap;
  }

  return null;
}

export function DefaultDeclaration(
  context: PluginContext,
  id: string,
  declaration: ExportDefaultDeclaration,
): ExportNameToClosureMapping | null {
  if (declaration.declaration) {
    const defaultExportName = defaultUnamedExportName(id);
    switch (declaration.declaration.type) {
      case 'FunctionDeclaration':
        const functionName = functionDeclarationName(context, id, declaration);
        if (functionName !== null) {
          return {
            [functionName]: {
              alias: null,
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
            },
          };
        } else {
          return {
            [defaultExportName]: {
              alias: null,
              type: ExportClosureMapping.DEFAULT_FUNCTION,
            },
          };
        }
      case 'ClassDeclaration':
        const className = classDeclarationName(context, id, declaration);
        if (className !== null) {
          return {
            [className]: {
              alias: null,
              type: ExportClosureMapping.NAMED_DEFAULT_CLASS,
            },
          };
        }
        return {
          [defaultExportName]: {
            alias: null,
            type: ExportClosureMapping.DEFAULT_CLASS,
          },
        };
      case 'Identifier':
        if (declaration.declaration.name) {
          return {
            [declaration.declaration.name]: {
              alias: null,
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
            },
          };
        }
        return {
          [defaultExportName]: {
            alias: null,
            type: ExportClosureMapping.DEFAULT_CLASS,
          },
        };
      case 'Identifier':
        if (declaration.declaration.name) {
          return {
            [declaration.declaration.name]: {
              alias: null,
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
            },
          };
        }
        break;
      case 'Literal':
        return {
          [defaultExportName]: {
            alias: null,
            type: ExportClosureMapping.DEFAULT_VALUE,
          },
        };
      case 'ObjectExpression':
        return {
          [defaultExportName]: {
            alias: null,
            type: ExportClosureMapping.DEFAULT_OBJECT,
          },
        };
      case 'ArrayExpression':
        return {
          [defaultExportName]: {
            alias: null,
            type: ExportClosureMapping.DEFAULT_VALUE,
          },
        };
    }
  }

  return null;
}

export function literalName(context: PluginContext, id: string, literal: Literal): string {
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
