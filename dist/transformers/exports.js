"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const parsing_utilities_1 = require("./parsing-utilities");
const types_1 = require("../types");
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
class ExportTransform extends types_1.Transform {
    constructor() {
        super(...arguments);
        this.exported = {};
    }
    extern(options) {
        let content = HEADER;
        if (options.format === 'es') {
            Object.keys(this.exported).forEach(key => {
                content += `window['${key}'] = ${key};\n`;
            });
        }
        return content;
    }
    /**
     * Before Closure Compiler is given a chance to look at the code, we need to
     * find and store all export statements with their correct type
     * @param code source to parse, and modify
     * @param id Rollup id reference to the source
     * @return Promise containing the modified source
     */
    async deriveFromInputSource(code, id) {
        const program = this.context.parse(code, {});
        const exportNodes = program.body.filter(node => types_1.ALL_EXPORT_TYPES.includes(node.type));
        exportNodes.forEach((node) => {
            switch (node.type) {
                case types_1.EXPORT_NAMED_DECLARATION:
                    const namedDeclarationValues = parsing_utilities_1.NamedDeclaration(this.context, node);
                    if (namedDeclarationValues !== null) {
                        this.exported = { ...this.exported, ...namedDeclarationValues };
                    }
                    break;
                case types_1.EXPORT_DEFAULT_DECLARATION:
                    // TODO(KB): This case is not fully supported – only named default exports.
                    // `export default Foo(){};`, or `export default Foo;`, not `export default function(){};`
                    const defaultDeclarationValue = parsing_utilities_1.DefaultDeclaration(this.context, node);
                    if (defaultDeclarationValue !== null) {
                        this.exported = { ...this.exported, ...defaultDeclarationValue };
                    }
                    break;
                case types_1.EXPORT_ALL_DECLARATION:
                    // TODO(KB): This case `export * from "./import"` is not currently supported.
                    this.context.error(new Error(`Rollup Plugin Closure Compiler does not support export all syntax.`));
                    break;
                default:
                    this.context.error(new Error(`Rollup Plugin Closure Compiler found unsupported module declaration type, ${node.type}`));
                    break;
            }
        });
        return void 0;
    }
    /**
     * Before Closure Compiler modifies the source, we need to ensure it has window scoped
     * references to the named exports. This prevents Closure from mangling their names.
     * @param code source to parse, and modify
     * @param id Rollup id reference to the source
     * @return modified input source with window scoped references.
     */
    async preCompilation(code, id) {
        if (this.outputOptions === null) {
            this.context.warn('Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.');
        }
        else if (this.outputOptions.format === 'es') {
            Object.keys(this.exported).forEach(key => {
                code += `\nwindow['${key}'] = ${key}`;
            });
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
    async postCompilation(code, id) {
        if (this.outputOptions === null) {
            this.context.warn('Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.');
        }
        else if (this.outputOptions.format === 'es') {
            const exportedConstants = [];
            Object.keys(this.exported).forEach(key => {
                switch (this.exported[key]) {
                    case types_1.ExportClosureMapping.NAMED_FUNCTION:
                        code = code.replace(`window.${key}=function`, `export function ${key}`);
                        break;
                    case types_1.ExportClosureMapping.NAMED_CLASS:
                        const namedClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
                        if (namedClassMatch && namedClassMatch.length > 0) {
                            // Remove the declaration on window scope, i.e. `window.Exported=a;`
                            code = code.replace(namedClassMatch[0], '');
                            // Store a new export constant to output at the end. `a as Exported`
                            exportedConstants.push(`${namedClassMatch[1]} as ${key}`);
                        }
                        break;
                    case types_1.ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
                        code = code.replace(`window.${key}=function`, `export default function ${key}`);
                        break;
                    case types_1.ExportClosureMapping.NAMED_DEFAULT_CLASS:
                        const namedDefaultClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
                        if (namedDefaultClassMatch && namedDefaultClassMatch.length > 0) {
                            // Remove the declaration on window scope, i.e. `window.ExportedTwo=a;`
                            // Replace it with an export statement `export default a;`
                            code = code.replace(namedDefaultClassMatch[0], `export default ${namedDefaultClassMatch[1]};`);
                        }
                        break;
                    case types_1.ExportClosureMapping.NAMED_CONSTANT:
                        // Remove the declaration on the window scope, i.e. `window.ExportedThree=value`
                        // Replace it with a const declaration, i.e `const ExportedThree=value`
                        code = code.replace(`window.${key}=`, `const ${key}=`);
                        // Store a new export constant to output at the end, i.e `ExportedThree`
                        exportedConstants.push(key);
                        break;
                    default:
                        this.context.warn('Rollup Plugin Closure Compiler could not restore all exports statements.');
                        break;
                }
            });
            if (exportedConstants.length > 0) {
                // Remove the newline at the end since we are going to append exports.
                if (code.endsWith('\n')) {
                    code = code.substr(0, code.lastIndexOf('\n'));
                }
                // Append the exports that were gathered, i.e `export {a as Exported, ExportedThree};`
                code += `export {${exportedConstants.join(',')}};`;
            }
        }
        // TODO(KB): Sourcemaps fail :(
        return {
            code,
        };
    }
}
exports.default = ExportTransform;
//# sourceMappingURL=exports.js.map