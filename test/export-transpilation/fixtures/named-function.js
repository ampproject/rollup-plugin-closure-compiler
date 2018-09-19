var SMTH = Symbol.for('smth');

function isSmth(smth) {
  return smth && !!smth[SMTH]
}

export { isSmth };