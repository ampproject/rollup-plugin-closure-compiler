export class Exported {
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