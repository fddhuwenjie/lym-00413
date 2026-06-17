export function isEmail(str) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
}

export function isUrl(str) {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

export function isPhoneNumber(str) {
  return /^\+?[\d\s-()]{10,}$/.test(str);
}

export function isPostalCode(str) {
  return /^\d{5}(-\d{4})?$/.test(str);
}

export function isIPv4(str) {
  const parts = str.split('.');
  return parts.length === 4 && parts.every(p => {
    const n = parseInt(p, 10);
    return n >= 0 && n <= 255;
  });
}

export function isCreditCard(str) {
  return /^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/.test(str);
}
