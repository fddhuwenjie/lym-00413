import * as ws from 'ws';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { HMRUpdate, BundlerConfig } from './types';

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

export class HMRServer {
  private wss: ws.Server | null = null;
  private server: http.Server | null = null;
  private clients: Set<ws.WebSocket> = new Set();
  private port: number;

  constructor(port: number = 8081) {
    this.port = port;
  }

  start(): Promise<void> {
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

      this.wss.on('connection', (client: ws.WebSocket) => {
        this.clients.add(client);
        console.log('[HMR] Client connected');

        const update: HMRUpdate = {
          type: 'connected',
          hash: Date.now().toString(36),
        };
        client.send(JSON.stringify(update));

        client.on('close', () => {
          this.clients.delete(client);
          console.log('[HMR] Client disconnected');
        });

        client.on('error', (err: Error) => {
          console.error('[HMR] Client error:', err.message);
          this.clients.delete(client);
        });
      });

      this.server.listen(this.port, () => {
        console.log(`[HMR] Server listening on port ${this.port}`);
        resolve();
      });

      this.server.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  broadcastUpdate(modules: string[], hash?: string): void {
    const update: HMRUpdate = {
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

  broadcastFullReload(): void {
    const update: HMRUpdate = { type: 'full-reload' };
    const message = JSON.stringify(update);
    for (const client of this.clients) {
      if (client.readyState === ws.OPEN) {
        client.send(message);
      }
    }
    console.log('[HMR] Broadcasting full reload');
  }

  getClientInjectionScript(): string {
    return `<script src="http://localhost:${this.port}/__hmr_client.js"></script>`;
  }

  getHMRClientCode(): string {
    return HMR_CLIENT_CODE;
  }

  stop(): void {
    for (const client of this.clients) {
      client.close();
    }
    this.clients.clear();
    this.wss?.close();
    this.server?.close();
  }
}

export function injectHMRRuntime(bundleCode: string, hmrPort: number): string {
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
