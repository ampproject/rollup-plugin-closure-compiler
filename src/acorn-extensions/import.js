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

// Parser support for dynamic import and import meta property syntax.
// https://github.com/tc39/proposal-dynamic-import
// https://github.com/tc39/proposal-import-meta
//
// Dynamic import syntax is based on acorn-dynamic-import.
// Copyright Jordan Gensler. Released under MIT license:
// https://github.com/kesne/acorn-dynamic-import
//
// Import meta property syntax is adapted from the Babel parser.
// Copyright Babel parser contributors. Released under MIT license:
// https://github.com/babel/babel/blob/master/packages/babel-parser/src/parser/expression.js
//
// This fork was created by John-David Dalton, and released under MIT license:
// https://github.com/standard-things/esm

import PARSER_MESSAGE from '../../constant/parser-message.js';

import lookahead from '../../parse/lookahead.js';
import shared from '../../shared.js';
import { tokTypes as tt } from '../../acorn.js';
import wrap from '../../util/wrap.js';

function init() {
  const {
    ILLEGAL_IMPORT_META_OUTSIDE_MODULE,
    UNEXPECTED_IDENTIFIER,
    UNEXPECTED_STRING,
    UNEXPECTED_TOKEN,
  } = PARSER_MESSAGE;

  const Plugin = {
    enable(parser) {
      // Allow `yield import()` to parse.
      tt._import.startsExpr = true;

      parser.parseExprAtom = wrap(parser.parseExprAtom, parseExprAtom);
      parser.parseStatement = wrap(parser.parseStatement, parseStatement);
      return parser;
    },
  };

  function parseExprAtom(func, args) {
    if (this.type === tt._import) {
      const { type } = lookahead(this);

      if (type === tt.dot) {
        return parseImportMetaPropertyAtom(this);
      }

      if (type === tt.parenL) {
        return parseImportCallAtom(this);
      }

      this.unexpected();
    }

    const node = Reflect.apply(func, this, args);
    const { type } = node;

    if (type === tt._false || type === tt._null || type === tt._true) {
      node.raw = '';
    }

    return node;
  }

  function parseStatement(func, args) {
    const [, topLevel] = args;

    if (this.type === tt._import) {
      const { start, type } = lookahead(this);

      if (type === tt.dot) {
        return parseImportMetaProperty(this);
      }

      if (type === tt.parenL) {
        return parseImportCall(this);
      }

      if (!topLevel || !this.inModule) {
        let message;

        if (type === tt.name) {
          message = UNEXPECTED_IDENTIFIER;
        } else if (type === tt.string) {
          message = UNEXPECTED_STRING;
        } else {
          message = UNEXPECTED_TOKEN + ' ' + type.label;
        }

        this.raise(start, message);
      }
    }

    return Reflect.apply(func, this, args);
  }

  function parseImportCall(parser) {
    const node = parser.startNode();
    const { start } = parser;

    const callExpr = parser.startNode();
    const callee = parser.parseExprAtom();

    parser.expect(tt.parenL);

    callExpr.arguments = [parser.parseMaybeAssign()];
    callExpr.callee = callee;

    parser.finishNode(callExpr, 'CallExpression');
    parser.expect(tt.parenR);

    const expr = parser.parseSubscripts(callExpr, start);

    return parser.parseExpressionStatement(node, expr);
  }

  function parseImportMetaProperty(parser) {
    const node = parser.startNode();
    const expr = parser.parseMaybeAssign();

    return parser.parseExpressionStatement(node, expr);
  }

  function parseImportCallAtom(parser) {
    const node = parser.startNode();

    parser.expect(tt._import);
    return parser.finishNode(node, 'Import');
  }

  function parseImportMetaPropertyAtom(parser) {
    const node = parser.startNode();

    node.meta = parser.parseIdent(true);

    parser.expect(tt.dot);
    node.property = parser.parseIdent(true);

    if (node.property.name !== 'meta') {
      parser.raise(node.property.start, UNEXPECTED_IDENTIFIER);
    } else if (!parser.inModule) {
      parser.raise(node.meta.start, ILLEGAL_IMPORT_META_OUTSIDE_MODULE);
    }

    return parser.finishNode(node, 'MetaProperty');
  }

  return Plugin;
}

export default (shared.inited
  ? shared.module.acornParserDynamicImport
  : (shared.module.acornParserDynamicImport = init()));
