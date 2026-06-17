// Chunk: chunk_data-service
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
});