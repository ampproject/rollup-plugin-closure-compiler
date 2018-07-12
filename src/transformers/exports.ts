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
import { isESMFormat } from '../options';
import {
  ExportNameToClosureMapping,
  EXPORT_NAMED_DECLARATION,
  EXPORT_DEFAULT_DECLARATION,
  EXPORT_ALL_DECLARATION,
  ExportClosureMapping,
  Transform,
  TransformInterface,
  ALL_EXPORT_DECLARATIONS,
} from '../types';
import MagicString from 'magic-string';
import { replace } from './replacement-utilities';

const HEADER = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains top level exported members.
* @externs
*/
`;

/**
 * This Transform will apply only if the Rollup configuration is for 'esm' output.
 *
 * In order to preserve the export statements:
 * 1. Create extern definitions for them (to keep them their names from being mangled).
 * 2. Insert additional JS referencing the exported names on the window scope
 * 3. After Closure Compilation is complete, replace the window scope references with the original export statements.
 */
export default class ExportTransform extends Transform implements TransformInterface {
  private exported: ExportNameToClosureMapping = {};

  public extern(options: OutputOptions): string {
    let content = HEADER;
    if (isESMFormat(options.format)) {
      Object.keys(this.exported).forEach(key => {
        content += `window['${key}'] = ${key};\n`;
      });
    }

    return content;
  }

  /**
   * Before Closure Compiler is given a chance to look at the code, we need to
   * find and store all export statements with their correct type
   * @param code source to parse
   * @param id Rollup id reference to the source
   */
  public async deriveFromInputSource(code: string, id: string): Promise<void> {
    if (this.isEntryPoint(id)) {
      const program = this.context.parse(code, {});
      const exportNodes = program.body.filter(node => ALL_EXPORT_DECLARATIONS.includes(node.type));

      exportNodes.forEach((node: ModuleDeclaration) => {
        switch (node.type) {
          case EXPORT_NAMED_DECLARATION:
            const namedDeclarationValues = NamedDeclaration(
              this.context,
              id,
              node as ExportNamedDeclaration,
            );
            if (namedDeclarationValues !== null) {
              this.exported = { ...this.exported, ...namedDeclarationValues };
            }
            break;
          case EXPORT_DEFAULT_DECLARATION:
            const defaultDeclarationValue = DefaultDeclaration(
              this.context,
              id,
              node as ExportDefaultDeclaration,
            );
            if (defaultDeclarationValue !== null) {
              this.exported = { ...this.exported, ...defaultDeclarationValue };
            }
            break;
          case EXPORT_ALL_DECLARATION:
            // TODO(KB): This case `export * from "./import"` is not currently supported.
            this.context.error(
              new Error(`Rollup Plugin Closure Compiler does not support export all syntax.`),
            );
            break;
          default:
            this.context.error(
              new Error(
                `Rollup Plugin Closure Compiler found unsupported module declaration type, ${
                  node.type
                }`,
              ),
            );
            break;
        }
      });
    }

    return void 0;
  }

  /**
   * Before Closure Compiler modifies the source, we need to ensure it has window scoped
   * references to the named exports. This prevents Closure from mangling their names.
   * @param code source to parse, and modify
   * @param id Rollup id reference to the source
   * @return modified input source with window scoped references.
   */
  public async preCompilation(code: string, id: string): Promise<TransformSourceDescription> {
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (isESMFormat(this.outputOptions.format)) {
      const source = new MagicString(code);
      // Window scoped references for each key are required to ensure Closure Compilre retains the code.
      Object.keys(this.exported).forEach(key => {
        source.append(`\nwindow['${key}'] = ${key}`);
      });

      return {
        code: source.toString(),
        map: source.generateMap(),
      };
    }

    // TODO(KB): Sourcemaps fail :(
    return {
      code,
    };
  }

  /**
   * After Closure Compiler has modified the source, we need to replace the window scoped
   * references we added with the intended export statements
   * @param code source post Closure Compiler Compilation
   * @param id Rollup identifier for the source
   * @return Promise containing the repaired source
   */
  public async postCompilation(code: string, id: string): Promise<TransformSourceDescription> {
    if (this.outputOptions === null) {
      this.context.warn(
        'Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.',
      );
    } else if (isESMFormat(this.outputOptions.format)) {
      const source = new MagicString(code);
      const exportedConstants: Array<string> = [];

      Object.keys(this.exported).forEach(key => {
        switch (this.exported[key]) {
          case ExportClosureMapping.NAMED_FUNCTION:
            replace(`window.${key}=function`, `export function ${key}`, code, source);
            break;
          case ExportClosureMapping.NAMED_CLASS:
            const namedClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
            if (namedClassMatch && namedClassMatch.length > 0) {
              // Remove the declaration on window scope, i.e. `window.Exported=a;`
              replace(namedClassMatch[0], '', code, source);
              // Store a new export constant to output at the end. `a as Exported`
              exportedConstants.push(`${namedClassMatch[1]} as ${key}`);
            }
            break;
          case ExportClosureMapping.DEFAULT_FUNCTION:
            replace(`window.${key}=function`, `export default function`, code, source);
            break;
          case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
            replace(`window.${key}=function`, `export default function ${key}`, code, source);
            break;
          case ExportClosureMapping.DEFAULT_CLASS:
            const defaultClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
            if (defaultClassMatch && defaultClassMatch.length > 0) {
              // Remove the declaration on window scope, i.e. `window.ExportedTwo=a;`
              // Replace it with an export statement `export default a;`
              replace(`class ${defaultClassMatch[1]}`, `export default class`, code, source);
              replace(defaultClassMatch[0], '', code, source);
            }
            break;
          case ExportClosureMapping.NAMED_DEFAULT_CLASS:
            const namedDefaultClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
            if (namedDefaultClassMatch && namedDefaultClassMatch.length > 0) {
              // Remove the declaration on window scope, i.e. `window.ExportedTwo=a;`
              // Replace it with an export statement `export default a;`
              replace(
                namedDefaultClassMatch[0],
                `export default ${namedDefaultClassMatch[1]};`,
                code,
                source,
              );
            }
            break;
          case ExportClosureMapping.NAMED_CONSTANT:
            // Remove the declaration on the window scope, i.e. `window.ExportedThree=value`
            // Replace it with a const declaration, i.e `const ExportedThree=value`
            replace(`window.${key}=`, `const ${key}=`, code, source);
            // Store a new export constant to output at the end, i.e `ExportedThree`
            exportedConstants.push(key);
            break;
          default:
            this.context.warn(
              'Rollup Plugin Closure Compiler could not restore all exports statements.',
            );
            break;
        }
      });

      if (exportedConstants.length > 0) {
        // Remove the newline at the end since we are going to append exports.
        if (code.endsWith('\n')) {
          source.trimLines();
        }
        // Append the exports that were gathered, i.e `export {a as Exported, ExportedThree};`
        source.append(`export {${exportedConstants.join(',')}};`);
      }

      return {
        code: source.toString(),
        map: source.generateMap(),
      };
    }

    return {
      code,
    };
  }
}
