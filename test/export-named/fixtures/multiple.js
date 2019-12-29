const foo = 1;
const bar = function() {
  console.log(foo);
}
const baz = function(name) {
  console.log(name);
}
class ExportedClass {
  constructor(name) {
    /**
     * @private {string}
     */
    this.name_ = name;
  }

  console() {
    console.log(this.name_);
  }
}
export{foo, bar, baz, ExportedClass};
