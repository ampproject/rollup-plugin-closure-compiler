export const foo = {};
export const bar = {};
export const baz = function(ziz, zaz) {
  foo.ziz = ziz;
  bar.zaz = zaz;
  console.log(foo, bar);
}
