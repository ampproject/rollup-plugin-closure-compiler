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

import { ExportSpecifier, ExportNamedDeclaration, ExportDefaultDeclaration, FunctionDeclaration } from 'estree';
import { PluginContext } from 'rollup';
import { ExportNameToType, ExportType } from './identify-exports';

type DeclarationsWithFunctions = ExportNamedDeclaration | ExportDefaultDeclaration;

export const exportSpecifierName = (exportSpecifier: ExportSpecifier): string => exportSpecifier.exported.name;

export function functionDeclarationName(context: PluginContext, declaration: DeclarationsWithFunctions): string | null {
  // For the Declaration passed, there can be a function declaration.
  if (declaration.declaration && declaration.declaration.type === 'FunctionDeclaration') {
    const FunctionDeclaration: FunctionDeclaration = declaration.declaration;

    if (FunctionDeclaration === null) {
      context.error(`Plugin requires exports to be named, 'export function Foo(){}' not 'export function(){}'`);
    }
    // This function declaration is the export name we need to know.
    return FunctionDeclaration.id && FunctionDeclaration.id.name ? FunctionDeclaration.id.name : null;
  }
  
  return null;
}

export function NamedDeclaration(context: PluginContext, declaration: ExportNamedDeclaration): ExportNameToType | null {
  const value = functionDeclarationName(context, declaration);
  if (value !== null) {
    return {
      [value]: ExportType.NAMED_FUNCTION,
    };
  } else if (declaration.specifiers) {
    const exportMap: ExportNameToType = {};
    declaration.specifiers.forEach(exportSpecifier => {
      exportMap[exportSpecifierName(exportSpecifier)] = ExportType.NAMED_CONSTANT;
    });
    return exportMap;
  }

  return null;
}

export function DefaultDeclaration(context: PluginContext, declaration: ExportDefaultDeclaration): string | null {
  return functionDeclarationName(context, declaration);
}
