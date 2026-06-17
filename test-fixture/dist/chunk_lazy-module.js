// Chunk: chunk_lazy-module
(function(modules) {
  var installedModules = {};
  function __mini_require__(moduleId) {
    if (installedModules[moduleId]) return installedModules[moduleId].exports;
    var module = installedModules[moduleId] = { exports: {}, id: moduleId, loaded: false };
    modules[moduleId].call(module.exports, module, module.exports, __mini_require__);
    module.loaded = true;
    return module.exports;
  }
  if (typeof window !== 'undefined') {
    window.__mini_require__ = __mini_require__;
  }
})({
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
});