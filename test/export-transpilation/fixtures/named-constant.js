var SMTH = Symbol.for('smth');

const isSmth = (smth) => {
  return smth && !!smth[SMTH]
};

export { isSmth };