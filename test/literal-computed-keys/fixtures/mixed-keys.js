function bar(value) {
  return value;
}

console.log({
  0: 'value',
  [1]: 'value',
  [bar(2)]: 'value2',
  [0 + bar(3)]: 'value3',
  [4](value) {
    console.log(bar(value));
  },
  5(value) {
    console.log(bar(value));
  }
});