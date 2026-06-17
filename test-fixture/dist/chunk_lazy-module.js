// Chunk: chunk_lazy-module
(function() {
  if (typeof window === 'undefined') return;
  if (!window.__mini_modules__) window.__mini_modules__ = {};
  if (!window.__mini_installed__) window.__mini_installed__ = {};
  if (!window.__mini_chunk_loaded__) window.__mini_chunk_loaded__ = {};
  if (!window.__mini_chunk_promises__) window.__mini_chunk_promises__ = {};
  window.__mini_chunk_loaded__["chunk_lazy-module"] = true;
  var chunkModules = {
  10: function(module, exports, __mini_require__) {
    function lazyGreet(name) {
      return `Hello from lazy module, ${name}!`;
    }
    
    function lazyCalc(a, b) {
      return a * b + 100;
    }
    
    function lazyTransform(arr) {
      return arr.map(x => x * 2).filter(x => x > 5);
    }
    
    Object.defineProperty(exports, "lazyGreet", { enumerable: true, get: function() { return lazyGreet; } });
    Object.defineProperty(exports, "lazyCalc", { enumerable: true, get: function() { return lazyCalc; } });
    Object.defineProperty(exports, "lazyTransform", { enumerable: true, get: function() { return lazyTransform; } });
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
//# sourceMappingURL=chunk_lazy-module.js.map
