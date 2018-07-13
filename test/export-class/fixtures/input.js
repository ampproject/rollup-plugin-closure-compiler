export class Exported {
  constructor(name) {
    this.name = name;
  }

  console() {
    console.log(this.name);
  }
}

new Exported("kris").console();