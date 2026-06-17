import { add, multiply } from './utils/math.js';
import { capitalize, reverse } from './utils/string.js';
import { formatDate, parseDate } from './services/date-service.js';
import * as validators from './services/validators.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';
import { EventEmitter } from './services/events.js';
import { cjsMath } from './cjs/cjs-math.js';
import { cjsString } from './cjs/cjs-string.js';

const eventBus = new EventEmitter();

function main() {
  const sum = add(10, 20);
  const product = multiply(5, 6);
  logger.log('Sum:', sum);
  logger.log('Product:', product);

  const greeting = capitalize('hello world');
  const reversed = reverse('abcdef');
  logger.log('Capitalized:', greeting);
  logger.log('Reversed:', reversed);

  const now = new Date();
  const formatted = formatDate(now);
  const parsed = parseDate('2024-01-15');
  logger.log('Formatted date:', formatted);
  logger.log('Parsed date:', parsed);

  const isValid = validators.isEmail('test@example.com');
  const isUrl = validators.isUrl('https://example.com');
  logger.log('Is valid email:', isValid);
  logger.log('Is valid URL:', isUrl);

  const cjsSum = cjsMath.add(100, 200);
  const cjsGreet = cjsString.greet('World');
  logger.log('CJS sum:', cjsSum);
  logger.log('CJS greet:', cjsGreet);

  eventBus.on('update', (data) => {
    logger.log('Event received:', data);
  });
  eventBus.emit('update', { message: 'Hello from events!' });

  const appDiv = document.getElementById('app');
  if (appDiv) {
    appDiv.innerHTML = `
      <h1>Mini Bundler Test</h1>
      <p>Sum: ${sum}</p>
      <p>Product: ${product}</p>
      <p>Greeting: ${greeting}</p>
      <p>Reversed: ${reversed}</p>
      <p>Formatted date: ${formatted}</p>
      <p>Email valid: ${isValid}</p>
      <p>URL valid: ${isUrl}</p>
      <p>CJS sum: ${cjsSum}</p>
      <p>CJS greet: ${cjsGreet}</p>
    `;
  }

  if (module.hot) {
    module.hot.accept('./utils/math.js', () => {
      logger.log('Math module updated via HMR!');
    });
  }

  import('./services/lazy-module.js').then((lazy) => {
    logger.log('Lazy loaded:', lazy.lazyGreet('HMR'));
  });

  import('./services/data-service.js').then((data) => {
    logger.log('Data loaded:', data.fetchData());
  });
}

main();
