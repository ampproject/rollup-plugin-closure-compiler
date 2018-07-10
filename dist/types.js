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
// @see https://github.com/estree/estree/blob/master/es2015.md#exports
exports.EXPORT_NAMED_DECLARATION = 'ExportNamedDeclaration';
exports.EXPORT_SPECIFIER = 'ExportSpecifier';
exports.EXPORT_DEFAULT_DECLARATION = 'ExportDefaultDeclaration';
exports.EXPORT_ALL_DECLARATION = 'ExportAllDeclaration';
exports.ALL_EXPORT_TYPES = [
    exports.EXPORT_NAMED_DECLARATION,
    exports.EXPORT_SPECIFIER,
    exports.EXPORT_DEFAULT_DECLARATION,
    exports.EXPORT_ALL_DECLARATION,
];
var ExportClosureMapping;
(function (ExportClosureMapping) {
    ExportClosureMapping[ExportClosureMapping["NAMED_FUNCTION"] = 0] = "NAMED_FUNCTION";
    ExportClosureMapping[ExportClosureMapping["NAMED_CLASS"] = 1] = "NAMED_CLASS";
    ExportClosureMapping[ExportClosureMapping["NAMED_DEFAULT_FUNCTION"] = 2] = "NAMED_DEFAULT_FUNCTION";
    ExportClosureMapping[ExportClosureMapping["NAMED_DEFAULT_CLASS"] = 3] = "NAMED_DEFAULT_CLASS";
    ExportClosureMapping[ExportClosureMapping["NAMED_CONSTANT"] = 4] = "NAMED_CONSTANT";
    ExportClosureMapping[ExportClosureMapping["DEFAULT"] = 5] = "DEFAULT";
})(ExportClosureMapping = exports.ExportClosureMapping || (exports.ExportClosureMapping = {}));
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
exports.Transform = Transform;
//# sourceMappingURL=types.js.map