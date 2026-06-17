const logLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

let currentLevel = logLevel.INFO;

export const logger = {
  debug(...args) {
    if (currentLevel <= logLevel.DEBUG) console.log('[DEBUG]', ...args);
  },
  log(...args) {
    if (currentLevel <= logLevel.INFO) console.log('[INFO]', ...args);
  },
  warn(...args) {
    if (currentLevel <= logLevel.WARN) console.warn('[WARN]', ...args);
  },
  error(...args) {
    if (currentLevel <= logLevel.ERROR) console.error('[ERROR]', ...args);
  },
  setLevel(level) {
    currentLevel = logLevel[level] ?? logLevel.INFO;
  },
};
