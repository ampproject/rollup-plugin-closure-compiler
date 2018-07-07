### Pass Rollup Output Configuration Directly to Plugin

This plugin transforms JavaScript input to achieve maximum compression. It is necessary to know the intended output format of your code when transformations are run on the input source.

Unfortunately, the Rollup API doesn't expose these options until later lifecycle hooks.

As a result, if you want to ensure your code is being maximally minified, you need to ensure the output format is correctly passed to the plugin.

`compiler` accepts two arguments:
1. Rollup [OutputOptions](https://rollupjs.org/guide/en#outputoptions)
2. Closure Compiler Compile [Flags and Options](https://github.com/google/closure-compiler/wiki/Flags-and-Options)

```
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