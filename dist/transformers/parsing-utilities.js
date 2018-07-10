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
const types_1 = require("../types");
exports.exportSpecifierName = (exportSpecifier) => exportSpecifier.exported.name;
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
exports.functionDeclarationName = functionDeclarationName;
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
exports.classDeclarationName = classDeclarationName;
function NamedDeclaration(context, declaration) {
    const functionName = functionDeclarationName(context, declaration);
    const className = classDeclarationName(context, declaration);
    if (functionName !== null) {
        return {
            [functionName]: types_1.ExportClosureMapping.NAMED_FUNCTION,
        };
    }
    else if (className !== null) {
        return {
            [className]: types_1.ExportClosureMapping.NAMED_CLASS,
        };
    }
    else if (declaration.specifiers) {
        const exportMap = {};
        declaration.specifiers.forEach(exportSpecifier => {
            exportMap[exports.exportSpecifierName(exportSpecifier)] = types_1.ExportClosureMapping.NAMED_CONSTANT;
        });
        return exportMap;
    }
    return null;
}
exports.NamedDeclaration = NamedDeclaration;
function DefaultDeclaration(context, declaration) {
    if (declaration.declaration) {
        switch (declaration.declaration.type) {
            case 'FunctionDeclaration':
                const functionName = functionDeclarationName(context, declaration);
                if (functionName !== null) {
                    return {
                        [functionName]: types_1.ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
                    };
                }
                break;
            case 'Identifier':
                if (declaration.declaration.name) {
                    return {
                        [declaration.declaration.name]: types_1.ExportClosureMapping.NAMED_DEFAULT_FUNCTION,
                    };
                }
                break;
            case 'ClassDeclaration':
                const className = classDeclarationName(context, declaration);
                if (className !== null) {
                    return {
                        [className]: types_1.ExportClosureMapping.NAMED_DEFAULT_CLASS,
                    };
                }
                break;
        }
    }
    return null;
}
exports.DefaultDeclaration = DefaultDeclaration;
//# sourceMappingURL=parsing-utilities.js.map