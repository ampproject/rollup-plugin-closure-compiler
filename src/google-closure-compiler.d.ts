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

// FORK of DefinatelyTyped definitions for `google-closure-compiler`

// Type definitions for google-closure-compiler
// Project: https://github.com/chadkillingsworth/closure-compiler-npm
// Definitions by: Evan Martin <http://neugierig.org>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node" />

declare module 'google-closure-compiler' {
  import * as child_process from 'child_process';

  // The "json_streams" compiler flag lets the compiler accept/produce
  // arrays of JSON objects in this shape for input/output.
  interface JSONStreamFile {
    path: string;
    src: string;
    srcmap?: string; // TODO(evan): pass through source maps.
  }

  interface Compiler {
    JAR_PATH: string | null;
    javaPath: string;
    logger: (...args: any[]) => void;
    spawnOptions: { [key: string]: string };

    run(
      callback?: (exitCode: number, stdout: string, stderr: string) => void,
    ): child_process.ChildProcess;

    getFullCommand(): string;
  }

  type CompileOption = string | boolean;
  type CompileOptions = string[] | { [key: string]: CompileOption | CompileOption[] };
  export const compiler: {
    new (opts: CompileOptions | string[], extraCommandArgs?: string[]): Compiler;

    JAR_PATH: string;
    COMPILER_PATH: string;
    CONTRIB_PATH: string;
  };
}
