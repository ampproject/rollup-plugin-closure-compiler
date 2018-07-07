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

const ROLLUP_OUTPUT_OPTIONS = {
  file: 'bundle.js',
  format: 'iife',
};

export default {
  input: 'main.js',
  output: ROLLUP_OUTPUT_OPTIONS,
  plugins: [
    compiler(ROLLUP_OUTPUT_OPTIONS),
  ],
}
```

If you would like to provide additional [flags and options](https://github.com/google/closure-compiler/wiki/Flags-and-Options) to Closure Compiler, pass them via key-value pairs.

```js
// rollup.config.js
import compiler from '@ampproject/rollup-plugin-closure-compiler';

const ROLLUP_OUTPUT_OPTIONS = {
  file: 'bundle.js',
  format: 'iife',
};

export default {
  input: 'main.js',
  output: ROLLUP_OUTPUT_OPTIONS,
  plugins: [
    compiler(ROLLUP_OUTPUT_OPTIONS, {
      formatting: 'PRETTY_PRINT'
    }),
  ],
}
```

### Automatic Closure Configuration

This plugin will modify the enable the `assume_function_wrapper` output option for Closure Compiler when `es` format is specifed to Rollup. **Note**: This is overrideable via passed flags and options.

```js
// rollup.config.js
import compiler from '@ampproject/rollup-plugin-closure-compiler';

const ROLLUP_OUTPUT_OPTIONS = {
  file: 'bundle.js',
  format: 'es',
};

export default {
  input: 'main.js',
  output: ROLLUP_OUTPUT_OPTIONS,
  plugins: [
    compiler(ROLLUP_OUTPUT_OPTIONS),
  ],
}
```

If your Rollup configuration outputs an IIFE format bundle with a specified name, this plugin will add an extern to ensure the name does not get mangled. **Note**: This is overrideable via passed flags and options.

```js
// rollup.config.js
import compiler from '@ampproject/rollup-plugin-closure-compiler';

const ROLLUP_OUTPUT_OPTIONS = {
  file: 'bundle.js',
  format: 'iife',
  name: 'MyAwesomeThing'
};

export default {
  input: 'main.js',
  output: ROLLUP_OUTPUT_OPTIONS,
  plugins: [
    compiler(ROLLUP_OUTPUT_OPTIONS),
  ],
}
```

## Security disclosures

The AMP Project accepts responsible security disclosures through the [Google Application Security program](https://www.google.com/about/appsecurity/).

## Code of conduct

The AMP Project strives for a positive and growing project community that provides a safe environment for everyone.  All members, committers and volunteers in the community are required to act according to the [code of conduct](CODE_OF_CONDUCT.md).

## License

rollup-plugin-closure-compiler is licensed under the [Apache License, Version 2.0](LICENSE).