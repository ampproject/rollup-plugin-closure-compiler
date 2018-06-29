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
const google_closure_compiler_1 = require("google-closure-compiler");
const temp_write_1 = require("temp-write");
const fs_1 = require("fs");
exports.defaultCompileOptions = (outputOptions) => {
    // Defaults for Rollup Projects are slightly different than Closure Compiler defaults.
    // - Users of Rollup tend to transpile their code before handing it to a minifier,
    // so no transpile is default.
    // - When Rollup output is set to "es" it is expected the code will live in a ES Module,
    // so safely be more aggressive in minification.
    // - When Rollup is configured to output an iife, ensure Closure Compiler does not
    // mangle the name of the iife wrapper.
    const options = {
        language_out: 'NO_TRANSPILE',
        assume_function_wrapper: outputOptions.format === 'es' ? true : false,
        warning_level: 'QUIET',
    };
    if (outputOptions.format === 'iife' && outputOptions.name) {
        options['externs'] = temp_write_1.sync(`function ${outputOptions.name}(){}`);
    }
    return options;
};
function closureCompiler(compileOptions = {}) {
    return {
        name: 'closure-compiler',
        transformBundle: (code, outputOptions) => {
            const temp = {
                js: temp_write_1.sync(code),
                map: temp_write_1.sync(''),
            };
            compileOptions = Object.assign(exports.defaultCompileOptions(outputOptions), compileOptions, {
                js: temp.js,
                create_source_map: temp.map,
            });
            const compile = new Promise((resolve, reject) => {
                new google_closure_compiler_1.compiler(compileOptions).run((exitCode, stdOut, stdErr) => {
                    if (exitCode !== 0) {
                        reject(new Error(`Google Closure Compiler exit ${exitCode}: ${stdErr}`));
                    }
                    else {
                        resolve(stdOut);
                    }
                });
            });
            return compile.then(stdOut => {
                const sourceMap = JSON.parse(fs_1.readFileSync(temp.map, 'utf8'));
                return { code: stdOut, map: sourceMap };
            }, (error) => {
                throw error;
            });
        },
    };
}
exports.default = closureCompiler;
//# sourceMappingURL=index.js.map