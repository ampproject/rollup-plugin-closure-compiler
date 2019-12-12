export function exportedFunction() {
  return 'foo';
}

export const constNumber = 1;

export const exportedArray = [1,2,3];

export const constFunction = function(argument) {
  console.log(argument);
};

export class ExportedClass {
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
