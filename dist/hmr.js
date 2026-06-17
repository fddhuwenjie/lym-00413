"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HMRServer = void 0;
exports.injectHMRRuntime = injectHMRRuntime;
const ws = __importStar(require("ws"));
const http = __importStar(require("http"));
const HMR_CLIENT_CODE = `
(function() {
  var ws = null;
  var retryCount = 0;
  var maxRetries = 10;
  var retryDelay = 1000;

  function connect() {
    var protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(protocol + '//' + window.location.host + '/__hmr_ws');

    ws.onopen = function() {
      console.log('[HMR] Connected');
      retryCount = 0;
    };

    ws.onmessage = function(event) {
      var update = JSON.parse(event.data);
      handleUpdate(update);
    };

    ws.onclose = function() {
      console.log('[HMR] Disconnected, retrying...');
      if (retryCount < maxRetries) {
        setTimeout(connect, retryDelay * Math.pow(2, retryCount));
        retryCount++;
      }
    };

    ws.onerror = function(err) {
      console.error('[HMR] Error:', err);
    };
  }

  function handleUpdate(update) {
    if (update.type === 'full-reload') {
      console.log('[HMR] Full reload required');
      window.location.reload();
      return;
    }

    if (update.type === 'update' && update.modules) {
      console.log('[HMR] Updating modules:', update.modules);
      for (var i = 0; i < update.modules.length; i++) {
        var moduleId = update.modules[i];
        applyUpdate(moduleId);
      }
    }
  }

  function applyUpdate(moduleId) {
    var hot = module.hot;
    if (!hot) {
      console.log('[HMR] No hot API for module', moduleId);
      window.location.reload();
      return;
    }

    var disposeHandlers = hot._disposeHandlers || [];
    var acceptHandlers = hot._acceptHandlers || {};

    for (var i = 0; i < disposeHandlers.length; i++) {
      try {
        disposeHandlers[i]();
      } catch (e) {
        console.error('[HMR] Dispose error:', e);
      }
    }

    if (acceptHandlers[moduleId]) {
      try {
        acceptHandlers[moduleId]();
        console.log('[HMR] Module updated:', moduleId);
      } catch (e) {
        console.error('[HMR] Accept error:', e);
        window.location.reload();
      }
    } else {
      console.log('[HMR] No accept handler for', moduleId, '- full reload');
      window.location.reload();
    }
  }

  var module = { hot: { _disposeHandlers: [], _acceptHandlers: {} } };

  module.hot.accept = function(id, callback) {
    if (typeof id === 'function') {
      callback = id;
      id = null;
    }
    if (!id) {
      module.hot._acceptHandlers['*'] = callback;
    } else {
      module.hot._acceptHandlers[id] = callback;
    }
  };

  module.hot.dispose = function(callback) {
    module.hot._disposeHandlers.push(callback);
  };

  module.hot.decline = function() {};

  module.hot.status = function() {
    return 'idle';
  };

  window.__hmr_module__ = module;

  connect();
})();
`;
class HMRServer {
    constructor(port = 8081) {
        this.wss = null;
        this.server = null;
        this.clients = new Set();
        this.port = port;
    }
    start() {
        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => {
                if (req.url === '/__hmr_client.js') {
                    res.writeHead(200, { 'Content-Type': 'application/javascript' });
                    res.end(HMR_CLIENT_CODE);
                    return;
                }
                res.writeHead(404);
                res.end('Not Found');
            });
            this.wss = new ws.Server({ server: this.server });
            this.wss.on('connection', (client) => {
                this.clients.add(client);
                console.log('[HMR] Client connected');
                const update = {
                    type: 'connected',
                    hash: Date.now().toString(36),
                };
                client.send(JSON.stringify(update));
                client.on('close', () => {
                    this.clients.delete(client);
                    console.log('[HMR] Client disconnected');
                });
                client.on('error', (err) => {
                    console.error('[HMR] Client error:', err.message);
                    this.clients.delete(client);
                });
            });
            this.server.listen(this.port, () => {
                console.log(`[HMR] Server listening on port ${this.port}`);
                resolve();
            });
            this.server.on('error', (err) => {
                reject(err);
            });
        });
    }
    broadcastUpdate(modules, hash) {
        const update = {
            type: 'update',
            modules,
            hash: hash || Date.now().toString(36),
        };
        const message = JSON.stringify(update);
        for (const client of this.clients) {
            if (client.readyState === ws.OPEN) {
                client.send(message);
            }
        }
        console.log(`[HMR] Broadcast update for modules: ${modules.join(', ')}`);
    }
    broadcastFullReload() {
        const update = { type: 'full-reload' };
        const message = JSON.stringify(update);
        for (const client of this.clients) {
            if (client.readyState === ws.OPEN) {
                client.send(message);
            }
        }
        console.log('[HMR] Broadcasting full reload');
    }
    getClientInjectionScript() {
        return `<script src="http://localhost:${this.port}/__hmr_client.js"></script>`;
    }
    getHMRClientCode() {
        return HMR_CLIENT_CODE;
    }
    stop() {
        for (const client of this.clients) {
            client.close();
        }
        this.clients.clear();
        this.wss?.close();
        this.server?.close();
    }
}
exports.HMRServer = HMRServer;
function injectHMRRuntime(bundleCode, hmrPort) {
    const hmrRuntime = `
// ===== HMR Runtime =====
(function() {
  var __hmr_cache = {};
  var __hmr_update_queue = [];

  window.__hmr_update__ = function(moduleId, newCode) {
    __hmr_update_queue.push({ id: moduleId, code: newCode });
    processUpdateQueue();
  };

  function processUpdateQueue() {
    while (__hmr_update_queue.length > 0) {
      var update = __hmr_update_queue.shift();
      applyModuleUpdate(update.id, update.code);
    }
  }

  function applyModuleUpdate(moduleId, newCode) {
    var hot = window.__hmr_module_hot__[moduleId];
    if (!hot) {
      console.log('[HMR] Module not found:', moduleId);
      return;
    }

    var disposeHandlers = hot._disposeHandlers || [];
    for (var i = 0; i < disposeHandlers.length; i++) {
      try { disposeHandlers[i](); } catch (e) { console.error('[HMR] Dispose error:', e); }
    }

    if (hot._acceptCallback) {
      try {
        hot._acceptCallback();
        console.log('[HMR] Module updated:', moduleId);
      } catch (e) {
        console.error('[HMR] Accept error:', e);
        window.location.reload();
      }
    } else {
      console.log('[HMR] No accept handler, reloading...');
      window.location.reload();
    }
  }

  window.__hmr_module_hot__ = {};
})();

// HMR module.hot setup
var module = module || {};
module.hot = {
  accept: function(deps, callback) {
    if (typeof deps === 'function') { callback = deps; deps = null; }
    if (!window.__hmr_module_hot__[module.id]) {
      window.__hmr_module_hot__[module.id] = { _acceptCallback: null, _disposeHandlers: [] };
    }
    window.__hmr_module_hot__[module.id]._acceptCallback = callback;
  },
  dispose: function(callback) {
    if (!window.__hmr_module_hot__[module.id]) {
      window.__hmr_module_hot__[module.id] = { _acceptCallback: null, _disposeHandlers: [] };
    }
    window.__hmr_module_hot__[module.id]._disposeHandlers.push(callback);
  },
  decline: function() {},
  status: function() { return 'idle'; }
};
`;
    return hmrRuntime + '\n' + bundleCode;
}
//# sourceMappingURL=hmr.js.map