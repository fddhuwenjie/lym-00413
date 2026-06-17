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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveModulePath = exports.createModuleInfo = exports.parseModule = exports.appendSourceMapUrl = exports.mergeSourceMaps = exports.generateSourceMap = exports.decodeVLQ = exports.encodeVLQ = exports.BuildCache = exports.injectHMRRuntime = exports.HMRServer = exports.createLoaderPipeline = exports.createCssLoader = exports.createBabelLoader = exports.LoaderRunner = exports.CodeSplitter = exports.TreeShaker = exports.DependencyGraph = exports.Bundler = void 0;
var bundler_1 = require("./bundler");
Object.defineProperty(exports, "Bundler", { enumerable: true, get: function () { return bundler_1.Bundler; } });
var dependency_graph_1 = require("./dependency-graph");
Object.defineProperty(exports, "DependencyGraph", { enumerable: true, get: function () { return dependency_graph_1.DependencyGraph; } });
var tree_shaking_1 = require("./tree-shaking");
Object.defineProperty(exports, "TreeShaker", { enumerable: true, get: function () { return tree_shaking_1.TreeShaker; } });
var code_splitting_1 = require("./code-splitting");
Object.defineProperty(exports, "CodeSplitter", { enumerable: true, get: function () { return code_splitting_1.CodeSplitter; } });
var loader_1 = require("./loader");
Object.defineProperty(exports, "LoaderRunner", { enumerable: true, get: function () { return loader_1.LoaderRunner; } });
Object.defineProperty(exports, "createBabelLoader", { enumerable: true, get: function () { return loader_1.createBabelLoader; } });
Object.defineProperty(exports, "createCssLoader", { enumerable: true, get: function () { return loader_1.createCssLoader; } });
Object.defineProperty(exports, "createLoaderPipeline", { enumerable: true, get: function () { return loader_1.createLoaderPipeline; } });
var hmr_1 = require("./hmr");
Object.defineProperty(exports, "HMRServer", { enumerable: true, get: function () { return hmr_1.HMRServer; } });
Object.defineProperty(exports, "injectHMRRuntime", { enumerable: true, get: function () { return hmr_1.injectHMRRuntime; } });
var cache_1 = require("./cache");
Object.defineProperty(exports, "BuildCache", { enumerable: true, get: function () { return cache_1.BuildCache; } });
var sourcemap_1 = require("./sourcemap");
Object.defineProperty(exports, "encodeVLQ", { enumerable: true, get: function () { return sourcemap_1.encodeVLQ; } });
Object.defineProperty(exports, "decodeVLQ", { enumerable: true, get: function () { return sourcemap_1.decodeVLQ; } });
Object.defineProperty(exports, "generateSourceMap", { enumerable: true, get: function () { return sourcemap_1.generateSourceMap; } });
Object.defineProperty(exports, "mergeSourceMaps", { enumerable: true, get: function () { return sourcemap_1.mergeSourceMaps; } });
Object.defineProperty(exports, "appendSourceMapUrl", { enumerable: true, get: function () { return sourcemap_1.appendSourceMapUrl; } });
var parser_1 = require("./parser");
Object.defineProperty(exports, "parseModule", { enumerable: true, get: function () { return parser_1.parseModule; } });
Object.defineProperty(exports, "createModuleInfo", { enumerable: true, get: function () { return parser_1.createModuleInfo; } });
Object.defineProperty(exports, "resolveModulePath", { enumerable: true, get: function () { return parser_1.resolveModulePath; } });
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map