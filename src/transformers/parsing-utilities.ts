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
  ExportNameToClosureMappingInfo,
  ExportClosureMapping,
  IMPORT_SPECIFIER,
  IMPORT_NAMESPACE_SPECIFIER,
  IMPORT_DEFAULT_SPECIFIER,
  Range,
} from '../types';

type ExportDeclarationsWithFunctions = ExportNamedDeclaration | ExportDefaultDeclaration;

const ILLEGAL_NAME_IDENTIFIERS = ['default'];
function remapKey(key: string): [string, string] {
  return ILLEGAL_NAME_IDENTIFIERS.includes(key)
    ? [`_CLOSURE_COMPATIBLE_KEY_${key}`, key]
    : [key, key];
}

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

export function NamedDeclaration(
  context: PluginContext,
  declaration: ExportNamedDeclaration,
): ExportNameToClosureMappingInfo | null {
  // console.log({ declaration });
  const functionName: string | null = functionDeclarationName(context, declaration);
  const className: string | null = classDeclarationName(context, declaration);
  const range: Range = declaration.range || [0, 0];
  const source: string | null =
    declaration.source && declaration.source.value && typeof declaration.source.value === 'string'
      ? declaration.source.value
      : null;

  // TODO(KB): This logic isn't great. If something has a named declaration, lets instead use the AST to find out what it is.
  // var Foo=function(){}export{Foo as default} => default export function

  if (functionName !== null) {
    const [remappedKey, originalKey] = remapKey(functionName);
    return {
      [remappedKey]: {
        alias: null,
        originalKey,
        type: ExportClosureMapping.NAMED_FUNCTION,
        range,
        source,
      },
    };
  } else if (className !== null) {
    const [remappedKey, originalKey] = remapKey(className);
    return {
      [remappedKey]: {
        alias: null,
        originalKey,
        type: ExportClosureMapping.NAMED_CLASS,
        range,
        source,
      },
    };
  } else if (declaration.declaration && declaration.declaration.type === 'VariableDeclaration') {
    const variableDeclarations = declaration.declaration.declarations;
    const exportMap: ExportNameToClosureMappingInfo = {};

    variableDeclarations.forEach(variableDeclarator => {
      // console.log('looping variableDeclarations');
      if (variableDeclarator.id.type === 'Identifier') {
        const [remappedKey, originalKey] = remapKey(variableDeclarator.id.name);
        exportMap[remappedKey] = {
          alias: null,
          originalKey,
          type: ExportClosureMapping.NAMED_CONSTANT,
          range,
          source,
        };
      }
    });
    return exportMap;
  } else if (declaration.specifiers) {
    const exportMap: ExportNameToClosureMappingInfo = {};
    declaration.specifiers.forEach(exportSpecifier => {
      const [remappedKey, originalKey] = remapKey(exportSpecifier.local.name);
      // console.log('found', [remappedKey, originalKey], exportSpecifier.local.name);
      if (originalKey === 'default') {
        // This is a default export in a specifier list.
        // e.g. export { foo as default };
        exportMap[remappedKey] = {
          alias:
            exportSpecifier.local.name !== exportSpecifier.exported.name
              ? exportSpecifier.exported.name
              : null,
          originalKey,
          type: ExportClosureMapping.DEFAULT,
          range,
          source,
        };
      } else {
        exportMap[remappedKey] = {
          alias:
            exportSpecifier.local.name !== exportSpecifier.exported.name
              ? exportSpecifier.exported.name
              : null,
          originalKey,
          type: ExportClosureMapping.NAMED_CONSTANT,
          range,
          source,
        };
      }
    });
    return exportMap;
  }

  return null;
}

export function DefaultDeclaration(
  context: PluginContext,
  declaration: ExportDefaultDeclaration,
): ExportNameToClosureMappingInfo | null {
  if (declaration.declaration) {
    const range: Range = [
      declaration.range ? declaration.range[0] : 0,
      declaration.range ? declaration.range[1] : 0,
    ];

    switch (declaration.declaration.type) {
      case 'FunctionDeclaration':
        const functionName = functionDeclarationName(context, declaration);
        if (functionName !== null) {
          const [remappedKey, originalKey] = remapKey(functionName);
          return {
            [remappedKey]: {
              alias: null,
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
              originalKey,
              range,
              source: null,
            },
          };
        }
        break;
      case 'ClassDeclaration':
        const className = classDeclarationName(context, declaration);
        if (className !== null) {
          const [remappedKey, originalKey] = remapKey(className);
          return {
            [remappedKey]: {
              alias: null,
              type: ExportClosureMapping.NAMED_DEFAULT_CLASS,
              originalKey,
              range,
              source: null,
            },
          };
        }
        break;
      case 'Identifier':
        if (declaration.declaration.name) {
          const [remappedKey, originalKey] = remapKey(declaration.declaration.name);
          return {
            [remappedKey]: {
              alias: null,
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
              originalKey,
              range,
              source: null,
            },
          };
        }
        break;
      case 'Identifier':
        if (declaration.declaration.name) {
          const [remappedKey, originalKey] = remapKey(declaration.declaration.name);
          return {
            [remappedKey]: {
              alias: null,
              type: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
              originalKey,
              range,
              source: null,
            },
          };
        }
        break;
    }
  }

  return null;
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
