export function add(a, b) {
  return a + b;
}

export function multiply(a, b) {
  return a * b;
}

export function subtract(a, b) {
  return a - b;
}

export function divide(a, b) {
  if (b === 0) throw new Error('Division by zero');
  return a / b;
}

export function power(base, exp) {
  return Math.pow(base, exp);
}

export function modulo(a, b) {
  return a % b;
}

export function factorial(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
}

export function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

export function gcd(a, b) {
  if (b === 0) return a;
  return gcd(b, a % b);
}

export function lcm(a, b) {
  return (a * b) / gcd(a, b);
}

export function isPrime(n) {
  if (n <= 1) return false;
  if (n <= 3) return true;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
}

export function primeFactors(n) {
  const factors = [];
  while (n % 2 === 0) { factors.push(2); n /= 2; }
  for (let i = 3; i * i <= n; i += 2) {
    while (n % i === 0) { factors.push(i); n /= i; }
  }
  if (n > 2) factors.push(n);
  return factors;
}

export function combination(n, r) {
  return factorial(n) / (factorial(r) * factorial(n - r));
}

export function permutation(n, r) {
  return factorial(n) / factorial(n - r);
}

export function abs(n) {
  return Math.abs(n);
}

export function round(n, decimals) {
  const factor = Math.pow(10, decimals || 0);
  return Math.round(n * factor) / factor;
}

export function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function degreesToRadians(degrees) {
  return degrees * (Math.PI / 180);
}

export function radiansToDegrees(radians) {
  return radians * (180 / Math.PI);
}
