'use strict';

var googleClosureCompiler = require('google-closure-compiler');
var tempWrite = require('temp-write');
var fs = require('fs');
var util = require('util');

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
// @see https://github.com/estree/estree/blob/master/es2015.md#exports
const EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration';
const EXPORT_SPECIFIER = 'ExportSpecifier';
const EXPORT_DEFAULT_DECLARATION = 'ExportDefaultDeclaration';
const EXPORT_ALL_DECLARATION = 'ExportAllDeclaration';
const ALL_EXPORT_TYPES = [
    EXPORT_NAMED_DECLARATION,
    EXPORT_SPECIFIER,
    EXPORT_DEFAULT_DECLARATION,
    EXPORT_ALL_DECLARATION,
];
var ExportClosureMapping;
(function (ExportClosureMapping) {
    ExportClosureMapping[ExportClosureMapping["NAMED_FUNCTION"] = 0] = "NAMED_FUNCTION";
    ExportClosureMapping[ExportClosureMapping["NAMED_CLASS"] = 1] = "NAMED_CLASS";
    ExportClosureMapping[ExportClosureMapping["NAMED_DEFAULT_FUNCTION"] = 2] = "NAMED_DEFAULT_FUNCTION";
    ExportClosureMapping[ExportClosureMapping["NAMED_DEFAULT_CLASS"] = 3] = "NAMED_DEFAULT_CLASS";
    ExportClosureMapping[ExportClosureMapping["NAMED_CONSTANT"] = 4] = "NAMED_CONSTANT";
    ExportClosureMapping[ExportClosureMapping["DEFAULT"] = 5] = "DEFAULT";
})(ExportClosureMapping || (ExportClosureMapping = {}));
class Transform {
    constructor(context) {
        this.context = context;
    }
    extern(options) {
        return '';
    }
    async deriveFromInputSource(code, id) {
        return void 0;
    }
    async preCompilation(code, id) {
        return {
            code,
        };
    }
    async postCompilation(code, id) {
        return {
            code,
        };
    }
}

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
const HEADER = `/**
* @fileoverview Externs built via derived configuration from Rollup or input code.
* This extern contains the iife name so it does not get mangled at the top level.
* @externs
*/
`;
/**
 * This Transform will apply only if the Rollup configuration is for a iife output with a defined name.
 *
 * In order to preserve the name of the iife output, derive an extern definition for Closure Compiler.
 * This preserves the name after compilation since Closure now believes it to be a well known global.
 */
class IifeTransform extends Transform {
    extern(options) {
        let content = HEADER;
        if (options.format === 'iife' && options.name) {
            content += `function ${options.name}(){};\n`;
        }
        return content;
    }
}

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
const exportSpecifierName = (exportSpecifier) => exportSpecifier.exported.name;
function functionDeclarationName(context, declaration) {
    // For the Declaration passed, there can be a function declaration.
    if (declaration.declaration && declaration.declaration.type === 'FunctionDeclaration') {
        const functionDeclaration = declaration.declaration;
        if (functionDeclaration === null ||
            functionDeclaration.id === null ||
            functionDeclaration.id.name === null) {
            context.error(`Plugin requires exports to be named, 'export function Foo(){}' not 'export function(){}'`);
        }
        else {
            // This function declaration is the export name we need to know.
            return functionDeclaration.id.name;
        }
    }
    return null;
}
function classDeclarationName(context, declaration) {
    // For the Declaration passed, there can be a function declaration.
    if (declaration.declaration && declaration.declaration.type === 'ClassDeclaration') {
        const classDeclaration = declaration.declaration;
        if (classDeclaration === null ||
            classDeclaration.id === null ||
            classDeclaration.id.name === null) {
            context.error(`Plugin requires exports to be named, 'export class Foo(){}' not 'export class(){}'`);
        }
        else {
            // This class declaration is the export name we need to know.
            return classDeclaration.id.name;
        }
    }
    return null;
}
function NamedDeclaration(context, declaration) {
    const functionName = functionDeclarationName(context, declaration);
    const className = classDeclarationName(context, declaration);
    if (functionName !== null) {
        return {
            [functionName]: ExportClosureMapping.NAMED_FUNCTION,
        };
    }
    else if (className !== null) {
        return {
            [className]: ExportClosureMapping.NAMED_CLASS,
        };
    }
    else if (declaration.specifiers) {
        const exportMap = {};
        declaration.specifiers.forEach(exportSpecifier => {
            exportMap[exportSpecifierName(exportSpecifier)] = ExportClosureMapping.NAMED_CONSTANT;
        });
        return exportMap;
    }
    return null;
}
function DefaultDeclaration(context, declaration) {
    if (declaration.declaration) {
        switch (declaration.declaration.type) {
            case 'FunctionDeclaration':
                const functionName = functionDeclarationName(context, declaration);
                if (functionName !== null) {
                    return {
                        [functionName]: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
                    };
                }
                break;
            case 'Identifier':
                if (declaration.declaration.name) {
                    return {
                        [declaration.declaration.name]: ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
                    };
                }
                break;
            case 'ClassDeclaration':
                const className = classDeclarationName(context, declaration);
                if (className !== null) {
                    return {
                        [className]: ExportClosureMapping.NAMED_DEFAULT_CLASS,
                    };
                }
                break;
        }
    }
    return null;
}

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
const HEADER$1 = `/**
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
class ExportTransform extends Transform {
    constructor() {
        super(...arguments);
        this.exported = {};
    }
    extern(options) {
        let content = HEADER$1;
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
        const exportNodes = program.body.filter(node => ALL_EXPORT_TYPES.includes(node.type));
        exportNodes.forEach((node) => {
            switch (node.type) {
                case EXPORT_NAMED_DECLARATION:
                    const namedDeclarationValues = NamedDeclaration(this.context, node);
                    if (namedDeclarationValues !== null) {
                        this.exported = { ...this.exported, ...namedDeclarationValues };
                    }
                    break;
                case EXPORT_DEFAULT_DECLARATION:
                    // TODO(KB): This case is not fully supported – only named default exports.
                    // `export default Foo(){};`, or `export default Foo;`, not `export default function(){};`
                    const defaultDeclarationValue = DefaultDeclaration(this.context, node);
                    if (defaultDeclarationValue !== null) {
                        this.exported = { ...this.exported, ...defaultDeclarationValue };
                    }
                    break;
                case EXPORT_ALL_DECLARATION:
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
                    case ExportClosureMapping.NAMED_FUNCTION:
                        code = code.replace(`window.${key}=function`, `export function ${key}`);
                        break;
                    case ExportClosureMapping.NAMED_CLASS:
                        const namedClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
                        if (namedClassMatch && namedClassMatch.length > 0) {
                            // Remove the declaration on window scope, i.e. `window.Exported=a;`
                            code = code.replace(namedClassMatch[0], '');
                            // Store a new export constant to output at the end. `a as Exported`
                            exportedConstants.push(`${namedClassMatch[1]} as ${key}`);
                        }
                        break;
                    case ExportClosureMapping.NAMED_DEFAULT_FUNCTION:
                        code = code.replace(`window.${key}=function`, `export default function ${key}`);
                        break;
                    case ExportClosureMapping.NAMED_DEFAULT_CLASS:
                        const namedDefaultClassMatch = new RegExp(`window.${key}=(\\w+);`).exec(code);
                        if (namedDefaultClassMatch && namedDefaultClassMatch.length > 0) {
                            // Remove the declaration on window scope, i.e. `window.ExportedTwo=a;`
                            // Replace it with an export statement `export default a;`
                            code = code.replace(namedDefaultClassMatch[0], `export default ${namedDefaultClassMatch[1]};`);
                        }
                        break;
                    case ExportClosureMapping.NAMED_CONSTANT:
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
const STRICT_MODE_DECLARATION = `'use strict';`;
const STRICT_MODE_DECLARATION_LENGTH = STRICT_MODE_DECLARATION.length;
class StrictTransform extends Transform {
    /**
     * When outputting an es module, runtimes automatically apply strict mode conventions.
     * This means we can safely strip the 'use strict'; declaration from the top of the file.
     * @param code source following closure compiler minification
     * @param id Rollup Resource id
     * @return code after removing the strict mode declaration (when safe to do so)
     */
    async postCompilation(code, id) {
        if (this.outputOptions === null) {
            this.context.warn('Rollup Plugin Closure Compiler, OutputOptions not known before Closure Compiler invocation.');
        }
        else if (this.outputOptions.format === 'es' && code.startsWith(STRICT_MODE_DECLARATION)) {
            // This will only remove the top level 'use strict' directive since we cannot
            // be certain source does not contain strings with the intended content.
            code = code.slice(STRICT_MODE_DECLARATION_LENGTH, code.length);
        }
        return {
            code,
        };
    }
}

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
/**
 * Instantiate transform class instances for the plugin invocation.
 * @param context Plugin context to bind for each transform instance.
 * @param options Rollup input options
 * @param id Rollup's id entry for this source.
 * @return Instantiated transform class instances for the given entry point.
 */
const createTransforms = (context) => {
    return [new IifeTransform(context), new ExportTransform(context), new StrictTransform(context)];
};
/**
 * Run each transform's `preCompilation` phase.
 * @param code source code to modify with `preCompilation` before Closure Compiler is given it.
 * @param outputOptions Rollup's configured output options
 * @param transforms Transforms to execute.
 * @return source code following `preCompilation`
 */
async function preCompilation(code, outputOptions, transforms) {
    // Each transform has a 'preCompilation' step that must complete before passing
    // the resulting code to Closure Compiler.
    for (const transform of transforms) {
        transform.outputOptions = outputOptions;
        const result = await transform.preCompilation(code, 'none');
        if (result && result.code) {
            code = result.code;
        }
    }
    return code;
}
/**
 * Run each transform's `postCompilation` phase.
 * @param code source code to modify with `postCompilation` after Closure Compiler has finished.
 * @param transforms Transforms to execute.
 * @return source code following `postCompilation`
 */
async function postCompilation(code, transforms) {
    // Following successful Closure Compiler compilation, each transform needs an opportunity
    // to clean up work is performed in preCompilation via postCompilation.
    for (const transform of transforms) {
        const result = await transform.postCompilation(code, 'none');
        if (result && result.code) {
            code = result.code;
        }
    }
    return code;
}
/**
 * Run each transform's `deriveFromInputSource` phase in parallel.
 * @param code source code to derive information from, pre Closure Compiler minification.
 * @param transforms Transforms to execute.
 */
async function deriveFromInputSource(code, transforms) {
    await Promise.all(transforms.map(transform => transform.deriveFromInputSource(code, 'none'))).then(_ => void 0);
}

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
/**
 * Run Closure Compiler and `postCompilation` Transforms on input source.
 * @param compileOptions Closure Compiler CompileOptions, normally derived from Rollup configuration
 * @param transforms Transforms to run rollowing compilation
 * @return Promise<string> source following compilation and Transforms.
 */
function compiler (compileOptions, transforms) {
    return new Promise((resolve, reject) => {
        new googleClosureCompiler.compiler(compileOptions).run(async (exitCode, code, stdErr) => {
            if (exitCode !== 0) {
                reject(new Error(`Google Closure Compiler exit ${exitCode}: ${stdErr}`));
            }
            else {
                resolve(await postCompilation(code, transforms));
            }
        });
    });
}

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
/**
 * Generate default Closure Compiler CompileOptions an author can override if they wish.
 * These must be derived from configuration or input sources.
 * @param transformers
 * @param options
 * @return derived CompileOptions for Closure Compiler
 */
const defaults = (options, transformers) => {
    // Defaults for Rollup Projects are slightly different than Closure Compiler defaults.
    // - Users of Rollup tend to transpile their code before handing it to a minifier,
    // so no transpile is default.
    // - When Rollup output is set to "es" it is expected the code will live in a ES Module,
    // so safely be more aggressive in minification.
    // - When Rollup is configured to output an iife, ensure Closure Compiler does not
    // mangle the name of the iife wrapper.
    const externs = transformers
        ? transformers.map(transform => tempWrite.sync(transform.extern(options)))
        : '';
    return {
        language_out: 'NO_TRANSPILE',
        assume_function_wrapper: options.format === 'es' ? true : false,
        warning_level: 'QUIET',
        externs,
    };
};
/**
 * Compile Options is the final configuration to pass into Closure Compiler.
 * defaultCompileOptions are overrideable by ones passed in directly to the plugin
 * but the js source and sourcemap are not overrideable, since this would break the output if passed.
 * @param compileOptions
 * @param outputOptions
 * @param code
 * @param transforms
 */
function options (compileOptions, outputOptions, code, transforms) {
    const mapFile = tempWrite.sync('');
    return [
        {
            ...defaults(outputOptions, transforms),
            ...compileOptions,
            js: tempWrite.sync(code),
            create_source_map: mapFile,
        },
        mapFile,
    ];
}

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
const readFile = util.promisify(fs.readFile);
/**
 * Transform the tree-shaken code from Rollup with Closure Compiler (with derived configuration and transforms)
 * @param compileOptions Closure Compiler compilation options from Rollup configuration.
 * @param transforms Transforms to apply to source followin Closure Compiler completion.
 * @param code Source to compile.
 * @param outputOptions Rollup Output Options.
 * @return Closure Compiled form of the Rollup Chunk
 */
const transformChunk = async (transforms, requestedCompileOptions, sourceCode, outputOptions) => {
    const code = await preCompilation(sourceCode, outputOptions, transforms);
    const [compileOptions, mapFile] = options(requestedCompileOptions, outputOptions, code, transforms);
    return compiler(compileOptions, transforms).then(async (code) => {
        return { code, map: JSON.parse(await readFile(mapFile, 'utf8')) };
    }, (error) => {
        throw error;
    });
};
function closureCompiler(requestedCompileOptions = {}) {
    let transforms;
    return {
        name: 'closure-compiler',
        load() {
            transforms = transforms || createTransforms(this);
        },
        transform: async (code) => deriveFromInputSource(code, transforms),
        transformChunk: async (code, outputOptions, chunk) => await transformChunk(transforms, requestedCompileOptions, code, outputOptions),
    };
}

module.exports = closureCompiler;
