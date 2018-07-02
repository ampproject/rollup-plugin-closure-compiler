## ES Modules Patterns

Rough outline:
#### Rollup Ingest Entry Point
Rollup will define both the named and default exports.
1. Modify AST for default export to give it a unique name (i.e. `_default_cc_export_1`)
2. Create a mapping of exports for later usage.
3. Generate window scoped references for these named exports. (`window['namedExport'] = namedExport;`), this should prevent CC from renaming the exports.
4. Append the generated window scoped references to the entry point.
#### Pre CC Compilation
1. Create CC externs for each of the named exports. (`function namedExport(){}`).
#### Post CC Compilation
1. Via `outro` add a `export default _default_cc_export_1` if a default export was present.

### Default exports

#### Input
```
// answer.js
export default 42;

// main.js - entry
import answer from './answer.js';

export default function () {
  console.log( 'the answer is ' + answer );
}
```
#### Output
```
const answer = 42;

function main () {
  console.log( 'the answer is ' + answer );
}

export default main;
```

### Named exports
#### Input
```
// qux.js
export var qux = 'QUX';

// main.js - entry
export var foo = 1;

export function bar () {
  return foo; // try changing this to `foo++`
}

function baz () {
  return bar();
}

export { baz };
export * from './qux';
```

#### Output
```
var qux = 'QUX';

/* NAMED EXPORTS
   There are many ways to export bindings
   from an ES2015 module */
var foo = 1;

function bar () {
	return foo; // try changing this to `foo++`
}

function baz () {
	return bar();
}

export { foo, bar, baz, qux };
````