export const config = {
  appName: 'Mini Bundler Test',
  version: '1.0.0',
  debug: true,
  apiBaseUrl: 'https://api.example.com',
  timeout: 5000,
  maxRetries: 3,
};

export function getConfig(key) {
  return config[key];
}

export function setConfig(key, value) {
  config[key] = value;
}

export function resetConfig() {
  config.debug = true;
  config.timeout = 5000;
  config.maxRetries = 3;
}

export function validateConfig() {
  return config.appName && config.version;
}
