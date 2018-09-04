export class Exported {
  /** 
   * @param {!string} name 
   */
  constructor(name) {
    /**
     * @private {!string}
     */
    this.name_ = name;
  }

  /**
   * @return {string}
   */
  console() {
    console.log(this.name_);
  }
}