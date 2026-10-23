const test = require('ava');
const fs = require('fs');
const vm = require('vm');

test('explicit platform preferences do not change later compiler defaults', async (t) => {
  const preferences = [];
  const exports = {};
  const compiler = function () {
    this.run = (callback) => callback(0, '', '');
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../transpile-tests/compiler'), 'utf8'), {
    exports,
    require(id) {
      if (id === 'google-closure-compiler') return { compiler };
      if (id === 'google-closure-compiler/lib/utils.js')
        return {
          getFirstSupportedPlatform(platforms) {
            preferences.push(Array.from(platforms));
            return 'java';
          },
        };
      if (id === './transformers/chunk/transforms')
        return {
          postCompilation: async (code) => ({ code }),
        };
      throw new Error(`Unexpected module: ${id}`);
    },
  });
  await exports.default({ platform: 'java' }, {}, []);
  await exports.default({}, {}, []);
  await exports.default({ platform: 'java' }, {}, []);
  t.deepEqual(preferences, [
    ['java', 'native', 'javascript'],
    ['native', 'java', 'javascript'],
    ['java', 'native', 'javascript'],
  ]);
});
