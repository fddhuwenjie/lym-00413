function cjsAdd(a, b) {
  return a + b;
}

function cjsSubtract(a, b) {
  return a - b;
}

function cjsMultiply(a, b) {
  return a * b;
}

function cjsDivide(a, b) {
  if (b === 0) throw new Error('Cannot divide by zero');
  return a / b;
}

function cjsPower(base, exponent) {
  return Math.pow(base, exponent);
}

function cjsSqrt(n) {
  return Math.sqrt(n);
}

module.exports = {
  add: cjsAdd,
  subtract: cjsSubtract,
  multiply: cjsMultiply,
  divide: cjsDivide,
  power: cjsPower,
  sqrt: cjsSqrt,
};
