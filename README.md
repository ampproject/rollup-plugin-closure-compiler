# rollup-plugin-closure-compiler

Leverage [Closure Compiler](https://developers.google.com/closure/compiler/) to minify and optimize JavaScript with [Rollup](https://rollupjs.org/guide/en).

Generally Closure Compiler will produce superior minification than other projects, but historically has been more difficult to use. The goal of this plugin is to reduce this friction.

## Installation

```bash
yarn add @ampproject/rollup-plugin-closure-compiler --dev
```

## Usage

Invoke Closure Compiler from your Rollup configuration.

```js
// rollup.config.js
import compiler from '@ampproject/rollup-plugin-closure-compiler';

export default {
  input: 'main.js',
  output: {
    file: 'bundle.js',
    format: 'iife',
  },
  plugins: [
    compiler(),
  ],
}
```

If you would like to provide additional [flags and options](https://github.com/google/closure-compiler/wiki/Flags-and-Options) to Closure Compiler, pass them via key-value pairs.

```js
// rollup.config.js
import compiler from '@ampproject/rollup-plugin-closure-compiler';

export default {
  input: 'main.js',
  output: {
    file: 'bundle.js',
    format: 'iife',
  },
  plugins: [
    compiler({
      formatting: 'PRETTY_PRINT'
    }),
  ],
}
```

### Code Splitting via Dynamic Imports

This plugin supports code splitting with Rollup's `experimentalCodeSplitting` feature. Enable code splitting in your rollup configuration and each output bundle will be minified by Closure Compiler.

```js
// rollup.config.js
import compiler from '@ampproject/rollup-plugin-closure-compiler';

export default {
  input: 'main.js',
  output: {
    dir: 'public/module',
    format: 'es',
  },
  experimentalCodeSplitting: true,
  plugins: [
    compiler(),
  ],
}
```

### Automatic Closure Configuration

This plugin will modify the enable the `assume_function_wrapper` output option for Closure Compiler when `es` format is specifed to Rollup. **Note**: This is overrideable via passed flags and options.

```js
// rollup.config.js
import compiler from '@ampproject/rollup-plugin-closure-compiler';

export default {
  input: 'main.js',
  output: {
    file: 'bundle.js',
    format: 'es',
  },
  plugins: [
    compiler(),
  ],
}
```

If your Rollup configuration outputs an IIFE format bundle with a specified name, this plugin will add an extern to ensure the name does not get mangled. **Note**: This is overrideable via passed flags and options.

```js
// rollup.config.js
import compiler from '@ampproject/rollup-plugin-closure-compiler';

export default {
  input: 'main.js',
  output: {
    file: 'bundle.js',
    format: 'iife',
    name: 'MyAwesomeThing'
  },
  plugins: [
    compiler(),
  ],
}
```

## Security disclosures

The AMP Project accepts responsible security disclosures through the [Google Application Security program](https://www.google.com/about/appsecurity/).

## Code of conduct

The AMP Project strives for a positive and growing project community that provides a safe environment for everyone.  All members, committers and volunteers in the community are required to act according to the [code of conduct](CODE_OF_CONDUCT.md).

## License

rollup-plugin-closure-compiler is licensed under the [Apache License, Version 2.0](LICENSE).