/**
 * Copyright 2020 The AMP HTML Authors. All Rights Reserved.
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

import { v4 } from 'uuid';

type OriginalSourcePath = string;
type SourcePathId = string;
type OriginalName = string;
type MangledName = string;

function createId(): string {
  return v4().replace(/-/g, '$');
}

function mangledValue(name: string, sourceId: string): string {
  return `${name}_${sourceId}`;
}

export class Mangle {
  private sources: Map<OriginalSourcePath, SourcePathId> = new Map();
  private mangled: Map<OriginalName, MangledName> = new Map();

  public sourceId = (source: string): string => {
    let uuid = this.sources.get(source);
    if (!uuid) {
      this.sources.set(source, (uuid = createId()));
    }

    return uuid;
  };

  public mangle = (name: string, sourceId: string): string => {
    const mangled = mangledValue(name, sourceId);
    const stored = this.mangled.get(name);

    if (stored && stored !== mangled) {
      console.log('SetIdentifier for Mangled Name more than once', { name, sourceId });
    } else {
      this.mangled.set(name, mangled);
    }

    return mangled;
  };

  public getMangledName = (originalName: string): string | undefined => {
    return this.mangled.get(originalName);
  };
}
