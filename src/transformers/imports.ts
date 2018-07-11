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

import { Transform } from '../types';

// Note for future self implementing.
// When an import is for something included in the 'externals' configuration from Rollup.
// We need to remove the import statement from the source.
/*
import React from 'react';

export class MyComponent extends React.Component {
  render() {
    return React.createElement("div", null, this.props.string);
  }
}
*/
// Here we need to remove "react" import

// Also, we likely need to generate an extern for all the usages of the import across the files it's imported into.
// for this example... UNLESS ONE IS PASSED TO THE PLUGIN INVOCATION FOR THE IMPORT.
// var React = {}
// React.Component = function() {};
// React.createElement = function(a, b, c);
export default class ImportTransform extends Transform {
  public async deriveFromInputSource(code: string, id: string): Promise<void> {
    // const program = this.context.parse(code, {});
    // const importNodes = program.body.filter(node => ALL_IMPORT_TYPES.includes(node.type));
    // console.log('imports', importNodes);
  }
}
