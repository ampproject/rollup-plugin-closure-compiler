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

import { ModuleDeclaration, ExportNamedDeclaration, ExportDefaultDeclaration } from 'estree';
import { PluginContext, TransformHook } from 'rollup';
import { NamedDeclaration, DefaultDeclaration } from './parsing-utilities';

// @see https://github.com/estree/estree/blob/master/es2015.md#exports

const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration';
const EXPORT_SPECIFIER = 'ExportSpecifier';
const EXPORT_DEFAULT_DECLARATION = 'ExportDefaultDeclaration';
const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration';

const EXPORT_TYPES = [EXPORT_NAMED_DECLARATION, EXPORT_SPECIFIER, EXPORT_DEFAULT_DECLARATION, EXPORT_ALL_DECLARATION];

export enum ExportType {
  NAMED_FUNCTION = 0,
  NAMED_CONSTANT = 1,
  DEFAULT = 2,
};
export interface ExportNameToType {
  [key: string]: ExportType
};
export let DiscoveredExports: ExportNameToType = {};

export const transform: TransformHook = function(code: string, id: string): void {
  const self = this as PluginContext;
  const Program = self.parse(code, {});
  const exportNodes = Program.body.filter(node => EXPORT_TYPES.includes(node.type));

  exportNodes.forEach((node: ModuleDeclaration) => {
    switch (node.type) {
      case EXPORT_NAMED_DECLARATION:
        const namedDeclarationValues = NamedDeclaration(self, node as ExportNamedDeclaration);
        if (namedDeclarationValues !== null) {
          Object.assign(DiscoveredExports, namedDeclarationValues);
        }
        break;
      case EXPORT_DEFAULT_DECLARATION:
        // TODO(KB): This case is not fully supported – only named default exports.
        // `export default Foo(){};`, or `export default Foo;`, not `export default function(){};`
        const defaultDeclarationValues = DefaultDeclaration(self, node as ExportDefaultDeclaration);
        if (defaultDeclarationValues !== null) {
          DiscoveredExports[defaultDeclarationValues] = ExportType.NAMED_FUNCTION;
        }
        break;
      case EXPORT_ALL_DECLARATION:
        // TODO(KB): This case `export * from "./import"` is not currently supported.
        this.error(new Error(`Rollup Plugin Closure Compiler does not support export all syntax.`));
        break;
      default:
        console.log(`unsupported module declaration type, ${node.type}`);
        break;
    }
  });
};
