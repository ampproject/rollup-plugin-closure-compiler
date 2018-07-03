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
import { PluginContext } from 'rollup';
import { NamedDeclaration, DefaultDeclaration } from './parsing-utilities';
import { sync } from 'temp-write';
import {
  ExportNameToClosureMapping,
  ALL_EXPORT_TYPES,
  EXPORT_NAMED_DECLARATION,
  EXPORT_DEFAULT_DECLARATION,
  EXPORT_ALL_DECLARATION,
  ExportClosureMapping,
  ClosureTransformPlugin,
} from '../types';

const exported: ExportNameToClosureMapping = {};

export const closureTransform: ClosureTransformPlugin = {
  externFile(options) {
    let content = `/**
 * @fileoverview Externs built via derived configuration from Rollup or input code.
 * This extern contains top level exported members. 
 * @externs
 */
`;
    if (options.format === 'es') {
      Object.keys(exported).forEach(key => {
        content += `window.prototype.${key} = ${key};\n`;
      });
    }

    return sync(content);
  },
  transform(code: string, id: string): void {
    const self = this as PluginContext;
    const program = self.parse(code, {});
    const exportNodes = program.body.filter(node => ALL_EXPORT_TYPES.includes(node.type));

    exportNodes.forEach((node: ModuleDeclaration) => {
      switch (node.type) {
        case EXPORT_NAMED_DECLARATION:
          const namedDeclarationValues = NamedDeclaration(self, node as ExportNamedDeclaration);
          if (namedDeclarationValues !== null) {
            Object.assign(exported, namedDeclarationValues);
          }
          break;
        case EXPORT_DEFAULT_DECLARATION:
          // TODO(KB): This case is not fully supported – only named default exports.
          // `export default Foo(){};`, or `export default Foo;`, not `export default function(){};`
          const defaultDeclarationValues = DefaultDeclaration(self, node as ExportDefaultDeclaration);
          if (defaultDeclarationValues !== null) {
            exported[defaultDeclarationValues] = ExportClosureMapping.NAMED_FUNCTION;
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
  },
};
