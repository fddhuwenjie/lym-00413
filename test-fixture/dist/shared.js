// Chunk: shared
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
    1: function(module, exports, __mini_require__) {
      function add(a, b) {
        return a + b;
      }
      
      function multiply(a, b) {
        return a * b;
      }
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      
      // modified
      
      Object.defineProperty(exports, "add", { enumerable: true, get: function() { return add; } });
      Object.defineProperty(exports, "multiply", { enumerable: true, get: function() { return multiply; } });
    }
});