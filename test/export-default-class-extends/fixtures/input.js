class Foo {
  constructor(name) {
    this.name = name;
  }

  thing() {
    console.log('name is ' + this.name);
  }
}

export default class Exported extends Foo {
  constructor(name) {
    super(name);
  }

  console() {
    console.log(this.name);
  }
}