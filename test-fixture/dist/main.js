// Chunk: main
(function(modules) {
  var installedModules = {};
  function __mini_require__(moduleId) {
    if (installedModules[moduleId]) return installedModules[moduleId].exports;
    var module = installedModules[moduleId] = { exports: {}, id: moduleId, loaded: false };
    modules[moduleId].call(module.exports, module, module.exports, __mini_require__);
    module.loaded = true;
    return module.exports;
  }
  __mini_require__(0);
  if (typeof window !== 'undefined') {
    window.__mini_require__ = __mini_require__;
  }
})({
    0: function(module, exports, __mini_require__) {
      var add = __mini_require__(1)["add"];
      var multiply = __mini_require__(1)["multiply"];
      var capitalize = __mini_require__(2)["capitalize"];
      var reverse = __mini_require__(2)["reverse"];
      var formatDate = __mini_require__(3)["formatDate"];
      var parseDate = __mini_require__(3)["parseDate"];
      var validators = __mini_require__(4);
      var logger = __mini_require__(5)["logger"];
      var config = __mini_require__(6)["config"];
      var EventEmitter = __mini_require__(7)["EventEmitter"];
      var cjsMath = __mini_require__(8)["cjsMath"];
      var cjsString = __mini_require__(9)["cjsString"];
      
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
      
        Promise.resolve().then(function() { return __mini_require__(10); }).then((lazy) => {
          logger.log('Lazy loaded:', lazy.lazyGreet('HMR'));
        });
      
        Promise.resolve().then(function() { return __mini_require__(11); }).then((data) => {
          logger.log('Data loaded:', data.fetchData());
        });
      }
      
      main();
      
    },
    2: function(module, exports, __mini_require__) {
      function capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
      }
      
      function reverse(str) {
        return str.split('').reverse().join('');
      }
      
      
      
      
      
      
      
      
      
      
      
      
      
      function escapeHtml(str) {
        const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
        return str.replace(/[&<>"']/g, c => map[c]);
      }
      
      
      Object.defineProperty(exports, "capitalize", { enumerable: true, get: function() { return capitalize; } });
      Object.defineProperty(exports, "reverse", { enumerable: true, get: function() { return reverse; } });
    },
    3: function(module, exports, __mini_require__) {
      function formatDate(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      
      function parseDate(dateStr) {
        const [y, m, d] = dateStr.split('-').map(Number);
        return new Date(y, m - 1, d);
      }
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      Object.defineProperty(exports, "formatDate", { enumerable: true, get: function() { return formatDate; } });
      Object.defineProperty(exports, "parseDate", { enumerable: true, get: function() { return parseDate; } });
    },
    4: function(module, exports, __mini_require__) {
      function isEmail(str) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str);
      }
      
      function isUrl(str) {
        try {
          new URL(str);
          return true;
        } catch {
          return false;
        }
      }
      
      function isPhoneNumber(str) {
        return /^\+?[\d\s-()]{10,}$/.test(str);
      }
      
      function isPostalCode(str) {
        return /^\d{5}(-\d{4})?$/.test(str);
      }
      
      function isIPv4(str) {
        const parts = str.split('.');
        return parts.length === 4 && parts.every(p => {
          const n = parseInt(p, 10);
          return n >= 0 && n <= 255;
        });
      }
      
      function isCreditCard(str) {
        return /^\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}$/.test(str);
      }
      
      Object.defineProperty(exports, "isEmail", { enumerable: true, get: function() { return isEmail; } });
      Object.defineProperty(exports, "isUrl", { enumerable: true, get: function() { return isUrl; } });
      Object.defineProperty(exports, "isPhoneNumber", { enumerable: true, get: function() { return isPhoneNumber; } });
      Object.defineProperty(exports, "isPostalCode", { enumerable: true, get: function() { return isPostalCode; } });
      Object.defineProperty(exports, "isIPv4", { enumerable: true, get: function() { return isIPv4; } });
      Object.defineProperty(exports, "isCreditCard", { enumerable: true, get: function() { return isCreditCard; } });
    },
    5: function(module, exports, __mini_require__) {
      const logLevel = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3,
      };
      
      let currentLevel = logLevel.INFO;
      
      const logger = {
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
      
      Object.defineProperty(exports, "logger", { enumerable: true, get: function() { return logger; } });
    },
    6: function(module, exports, __mini_require__) {
      const config = {
        appName: 'Mini Bundler Test',
        version: '1.0.0',
        debug: true,
        apiBaseUrl: 'https://api.example.com',
        timeout: 5000,
        maxRetries: 3,
      };
      
      
      
      
      
      Object.defineProperty(exports, "config", { enumerable: true, get: function() { return config; } });
    },
    7: function(module, exports, __mini_require__) {
      const listeners = {};
      
      class EventEmitter {
        constructor() {
          this._events = {};
        }
      
        on(event, callback) {
          if (!this._events[event]) {
            this._events[event] = [];
          }
          this._events[event].push(callback);
          return this;
        }
      
        off(event, callback) {
          if (!this._events[event]) return this;
          this._events[event] = this._events[event].filter(cb => cb !== callback);
          return this;
        }
      
        emit(event, ...args) {
          if (!this._events[event]) return false;
          this._events[event].forEach(cb => cb(...args));
          return true;
        }
      
        once(event, callback) {
          const wrapper = (...args) => {
            callback(...args);
            this.off(event, wrapper);
          };
          this.on(event, wrapper);
          return this;
        }
      
        removeAllListeners(event) {
          if (event) {
            delete this._events[event];
          } else {
            this._events = {};
          }
          return this;
        }
      }
      
    },
    8: function(module, exports, __mini_require__) {
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
      
    },
    9: function(module, exports, __mini_require__) {
      function cjsGreet(name) {
        return 'Hello, ' + name + '!';
      }
      
      function cjsShout(str) {
        return str.toUpperCase() + '!!!';
      }
      
      function cjsWhisper(str) {
        return str.toLowerCase() + '...';
      }
      
      function cjsRepeat(str, n) {
        var result = '';
        for (var i = 0; i < n; i++) {
          result += str;
        }
        return result;
      }
      
      function cjsReverse(str) {
        return str.split('').reverse().join('');
      }
      
      module.exports = {
        greet: cjsGreet,
        shout: cjsShout,
        whisper: cjsWhisper,
        repeat: cjsRepeat,
        reverse: cjsReverse,
      };
      
    }
});