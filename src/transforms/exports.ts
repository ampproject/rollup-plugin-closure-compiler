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
import { TransformSourceDescription, OutputOptions } from 'rollup';
import { NamedDeclaration, DefaultDeclaration } from './parsing-utilities';
import {
  ExportNameToClosureMapping,
  ALL_EXPORT_TYPES,
  EXPORT_NAMED_DECLARATION,
  EXPORT_DEFAULT_DECLARATION,
  EXPORT_ALL_DECLARATION,
  ExportClosureMapping,
  Transform,
} from '../types';

const HEADER = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains top level exported members. 
* @externs
*/
`;

/**
 * This Transform will apply only if the Rollup configuration is for 'es' output.
 *
 * In order to preserve the export statements:
 * 1. Create extern definitions for them (to keep them their names from being mangled).
 * 2. Insert additional JS referencing the exported names on the window scope
 * 3. After Closure Compilation is complete, replace the window scope references with the original export statements.
 */
export class ExportTransform extends Transform {
  private exported: ExportNameToClosureMapping = {};

  public extern(options: OutputOptions): string {
    let content = HEADER;
    if (options.format === 'es') {
      Object.keys(this.exported).forEach(key => {
        content += `window['${key}'] = ${key};\n`;
      });
    }

    return content;
  }

  /**
   * Before Closure Compiler is given a chance to look at the code, we need to:
   * 1. Find and store all export statements with their correct type
   * 2. Insert JS references to the identifiers on the window scope (so they do not get mangled).
   * @param code source to parse, and modify
   * @param id Rollup id reference to the source
   * @return Promise containing the modified source
   */
  public async input(code: string, id: string): Promise<TransformSourceDescription> {
    if (this.outputOptions.format === 'es' && id === this.entry) {
      // This transform only operates on the entry point.
      const program = this.context.parse(code, {});
      const exportNodes = program.body.filter(node => ALL_EXPORT_TYPES.includes(node.type));

      exportNodes.forEach((node: ModuleDeclaration) => {
        switch (node.type) {
          case EXPORT_NAMED_DECLARATION:
            const namedDeclarationValues = NamedDeclaration(this.context, node as ExportNamedDeclaration);
            if (namedDeclarationValues !== null) {
              Object.keys(namedDeclarationValues).forEach(key => {
                this.exported[key] = namedDeclarationValues[key];
                code += `\nwindow['${key}'] = ${key}`;
              });
            }
            break;
          case EXPORT_DEFAULT_DECLARATION:
            // TODO(KB): This case is not fully supported – only named default exports.
            // `export default Foo(){};`, or `export default Foo;`, not `export default function(){};`
            const defaultDeclarationValue = DefaultDeclaration(this.context, node as ExportDefaultDeclaration);
            if (defaultDeclarationValue !== null) {
              this.exported[defaultDeclarationValue] = ExportClosureMapping.NAMED_DEFAULT_FUNCTION;
              code += `\nwindow['${defaultDeclarationValue}'] = ${defaultDeclarationValue}`;
            }
            break;
          case EXPORT_ALL_DECLARATION:
            // TODO(KB): This case `export * from "./import"` is not currently supported.
            this.context.error(new Error(`Rollup Plugin Closure Compiler does not support export all syntax.`));
            break;
          default:
            this.context.error(
              new Error(`Rollup Plugin Closure Compiler found unsupported module declaration type, ${node.type}`),
            );
            break;
        }
      });
    }

    // TODO(KB): Sourcemaps fail :(
    return {
      code,
    };
  }

  /**
   * After Closure Compiler has modified the source, we need to:
   * 1. Replace the global references we added with the intended export statements
   * @param code source post Closure Compiler Compilation
   * @param id Rollup identifier for the source
   * @return Promise containing the repaired source
   */
  public async output(code: string, id: string): Promise<TransformSourceDescription> {
    if (this.outputOptions.format === 'es') {
      const exportedConstants: Array<string> = [];

      Object.keys(this.exported).forEach(key => {
        switch (this.exported[key]) {
          case ExportClosureMapping.NAMED_FUNCTION:
            code = code.replace(`window.${key}=function`, `export function ${key}`);
            break;
          case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
            code = code.replace(`window.${key}=function`, `export default function ${key}`);
            break;
          case ExportClosureMapping.NAMED_CONSTANT:
          default:
            exportedConstants.push(key);
            code = code.replace(`window.${key}=`, `const ${key}=`);
            break;
        }
      });

      if (exportedConstants.length > 0) {
        if (code.endsWith('\n')) {
          code = code.substr(0, code.lastIndexOf('\n'));
        }
        code += `export {${exportedConstants.join(',')}}`;
      }
    }

    // TODO(KB): Sourcemaps fail :(
    return {
      code,
    };
  }
}
