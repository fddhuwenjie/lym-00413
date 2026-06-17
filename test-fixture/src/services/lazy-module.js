export function lazyGreet(name) {
  return `Hello from lazy module, ${name}!`;
}

export function lazyCalc(a, b) {
  return a * b + 100;
}

export function lazyTransform(arr) {
  return arr.map(x => x * 2).filter(x => x > 5);
}
