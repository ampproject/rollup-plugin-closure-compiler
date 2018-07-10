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
const fs = require("fs");
const util_1 = require("util");
const compiler_1 = require("./compiler");
const options_1 = require("./options");
const transforms_1 = require("./transforms");
const readFile = util_1.promisify(fs.readFile);
/**
 * Transform the tree-shaken code from Rollup with Closure Compiler (with derived configuration and transforms)
 * @param compileOptions Closure Compiler compilation options from Rollup configuration.
 * @param transforms Transforms to apply to source followin Closure Compiler completion.
 * @param code Source to compile.
 * @param outputOptions Rollup Output Options.
 * @return Closure Compiled form of the Rollup Chunk
 */
exports.transformChunk = async (transforms, requestedCompileOptions, sourceCode, outputOptions) => {
    const code = await transforms_1.preCompilation(sourceCode, outputOptions, transforms);
    const [compileOptions, mapFile] = options_1.default(requestedCompileOptions, outputOptions, code, transforms);
    return compiler_1.default(compileOptions, transforms).then(async (code) => {
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
            transforms = transforms || transforms_1.createTransforms(this);
        },
        transform: async (code) => transforms_1.deriveFromInputSource(code, transforms),
        transformChunk: async (code, outputOptions, chunk) => await exports.transformChunk(transforms, requestedCompileOptions, code, outputOptions),
    };
}
exports.default = closureCompiler;
//# sourceMappingURL=index.js.map