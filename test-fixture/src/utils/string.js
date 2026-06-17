export function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function reverse(str) {
  return str.split('').reverse().join('');
}

export function toUpperCase(str) {
  return str.toUpperCase();
}

export function toLowerCase(str) {
  return str.toLowerCase();
}

export function trim(str) {
  return str.trim();
}

export function repeat(str, times) {
  return str.repeat(times);
}

export function padStart(str, length, char) {
  return str.padStart(length, char);
}

export function padEnd(str, length, char) {
  return str.padEnd(length, char);
}

export function truncate(str, maxLength, suffix) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - (suffix || '...').length) + (suffix || '...');
}

export function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function camelCase(str) {
  return str.replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '');
}

export function kebabCase(str) {
  return str.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
}

export function wordCount(str) {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export function isPalindrome(str) {
  const cleaned = str.toLowerCase().replace(/[^a-z0-9]/g, '');
  return cleaned === cleaned.split('').reverse().join('');
}

export function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return str.replace(/[&<>"']/g, c => map[c]);
}

export function unescapeHtml(str) {
  const map = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#039;': "'" };
  return str.replace(/&(?:amp|lt|gt|quot|#039);/g, c => map[c]);
}
