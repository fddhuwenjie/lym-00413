// Chunk: chunk_data-service
(function() {
  if (typeof window === 'undefined') return;
  if (!window.__mini_modules__) window.__mini_modules__ = {};
  if (!window.__mini_installed__) window.__mini_installed__ = {};
  if (!window.__mini_chunk_loaded__) window.__mini_chunk_loaded__ = {};
  if (!window.__mini_chunk_promises__) window.__mini_chunk_promises__ = {};
  window.__mini_chunk_loaded__["chunk_data-service"] = true;
  var chunkModules = {
  11: function(module, exports, __mini_require__) {
    var add = __mini_require__(1)["add"];
    
    function fetchData() {
      return {
        items: [
          { id: 1, name: 'Item 1', value: add(10, 20) },
          { id: 2, name: 'Item 2', value: add(30, 40) },
          { id: 3, name: 'Item 3', value: add(50, 60) },
        ],
        total: 3,
        timestamp: Date.now(),
      };
    }
    
    function transformData(data) {
      return data.items.map(item => ({
        ...item,
        computed: item.value * 2,
      }));
    }
    
    function aggregateData(data) {
      return data.reduce((sum, item) => sum + item.value, 0);
    }
    
    Object.defineProperty(exports, "fetchData", { enumerable: true, get: function() { return fetchData; } });
    Object.defineProperty(exports, "transformData", { enumerable: true, get: function() { return transformData; } });
    Object.defineProperty(exports, "aggregateData", { enumerable: true, get: function() { return aggregateData; } });
  }
  };
  for (var _k in chunkModules) {
    if (Object.prototype.hasOwnProperty.call(chunkModules, _k)) {
      window.__mini_modules__[_k] = chunkModules[_k];
    }
  }
  function __mini_require__(moduleId) {
    if (window.__mini_installed__[moduleId]) return window.__mini_installed__[moduleId].exports;
    if (!window.__mini_modules__[moduleId]) {
      throw new Error('[MiniBundler] Module not found: ' + moduleId + ' (check chunk loading order)');
    }
    var module = window.__mini_installed__[moduleId] = { exports: {}, id: moduleId, loaded: false };
    window.__mini_modules__[moduleId].call(module.exports, module, module.exports, __mini_require__);
    module.loaded = true;
    return module.exports;
  }
  function __mini_require_chunk__(chunkName, moduleId) {
    if (window.__mini_chunk_loaded__[chunkName]) {
      return Promise.resolve(__mini_require__(moduleId));
    }
    if (window.__mini_chunk_promises__[chunkName]) {
      return window.__mini_chunk_promises__[chunkName].then(function() { return __mini_require__(moduleId); });
    }
    var script = document.createElement('script');
    script.src = chunkName + '.js';
    var promise = new Promise(function(resolve, reject) {
      script.onload = resolve;
      script.onerror = reject;
    });
    window.__mini_chunk_promises__[chunkName] = promise;
    document.head.appendChild(script);
    return promise.then(function() { return __mini_require__(moduleId); });
  }
  window.__mini_require__ = __mini_require__;
  window.__mini_require_chunk__ = __mini_require_chunk__;
})();
//# sourceMappingURL=chunk_data-service.js.map
