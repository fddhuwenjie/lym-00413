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
exports.Bundler = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dependency_graph_1 = require("./dependency-graph");
const tree_shaking_1 = require("./tree-shaking");
const loader_1 = require("./loader");
const hmr_1 = require("./hmr");
const cache_1 = require("./cache");
const sourcemap_1 = require("./sourcemap");
const parser_1 = require("./parser");
const crypto_1 = require("crypto");
class Bundler {
    constructor(config) {
        this.watcher = null;
        this.moduleIdMap = new Map();
        this.idCounter = 0;
        this._lastBuildDuration = 0;
        this.config = {
            format: 'iife',
            sourceMap: true,
            minify: false,
            treeShaking: true,
            hmr: false,
            hmrPort: 8081,
            splitChunks: { minChunks: 2, minSize: 0 },
            cache: true,
            cacheDir: '.mini-bundler-cache',
            sideEffects: true,
            loaders: [],
            ...config,
        };
        this.loaderRunner = (0, loader_1.createLoaderPipeline)(this.config.loaders || []);
        this.hmrServer = new hmr_1.HMRServer(this.config.hmrPort || 8081);
        this.cache = new cache_1.BuildCache(this.config.cacheDir, this.config.cache !== false);
    }
    async build() {
        const startTime = Date.now();
        await this.cache.init();
        const entries = Array.isArray(this.config.entry) ? this.config.entry : [this.config.entry];
        this.graph = new dependency_graph_1.DependencyGraph(this.config);
        for (const entry of entries) {
            this.graph.buildFromEntry(entry);
        }
        this.graph.resolveReExports();
        const modules = this.graph.getModules();
        this.assignModuleIds(modules);
        let cacheHits = 0;
        for (const mod of modules) {
            if (!this.cache.hasChanged(mod.path)) {
                const cached = this.cache.getModuleInfo(mod.path);
                if (cached && cached.moduleInfo) {
                    mod.code = cached.outputCode || cached.moduleInfo.code;
                    cacheHits++;
                    continue;
                }
            }
            const result = await this.loaderRunner.process(mod.originalCode, mod.path, { id: mod.id, path: mod.path });
            mod.code = result.code;
        }
        let bundleSizeBefore = this.computeBundleSize(modules);
        let treeShakenExports = 0;
        if (this.config.treeShaking) {
            const totalExportsBefore = modules.reduce((c, m) => c + m.exports.length, 0);
            const treeShaker = new tree_shaking_1.TreeShaker(this.config);
            treeShaker.shake(this.graph);
            const totalExportsAfter = this.graph.getModules().reduce((c, m) => c + m.exports.filter(e => e.used !== false).length, 0);
            treeShakenExports = totalExportsBefore - totalExportsAfter;
        }
        else {
            for (const mod of modules) {
                for (const exp of mod.exports) {
                    exp.used = true;
                }
            }
        }
        const updatedModules = this.graph.getModules();
        let bundleSizeAfter = this.computeBundleSize(updatedModules);
        const chunks = this.createChunks(updatedModules);
        if (this.config.sourceMap) {
            this.attachSourceMaps(chunks);
        }
        if (this.config.hmr) {
            for (const chunk of chunks) {
                if (chunk.isEntry) {
                    chunk.code = (0, hmr_1.injectHMRRuntime)(chunk.code, this.config.hmrPort || 8081);
                }
            }
        }
        for (const chunk of chunks) {
            chunk.hash = this.computeHash(chunk.code);
        }
        this.cache.updateCache(updatedModules);
        await this.writeOutput(chunks);
        const duration = Date.now() - startTime;
        const prevDuration = this._lastBuildDuration;
        this._lastBuildDuration = duration;
        return { chunks, duration, modulesCount: modules.length, treeShakenExports, cacheHits, bundleSizeBefore, bundleSizeAfter };
    }
    async watch() {
        await this.build();
        await this.hmrServer.start();
        const chokidar = require('chokidar');
        const entries = Array.isArray(this.config.entry) ? this.config.entry : [this.config.entry];
        const watchDirs = entries.map(e => path.dirname(path.resolve(e)));
        this.watcher = chokidar.watch(watchDirs, {
            ignored: /node_modules|\.mini-bundler-cache|dist/,
            persistent: true,
            ignoreInitial: true,
        });
        this.watcher.on('change', async (filePath) => {
            console.log(`[Watch] File changed: ${filePath}`);
            this.cache.invalidate(filePath);
            const result = await this.build();
            const changedModules = [path.resolve(filePath)];
            this.hmrServer.broadcastUpdate(changedModules, this.computeHash(result.chunks[0]?.code || ''));
        });
        console.log('[Watch] Watching for changes...');
    }
    assignModuleIds(modules) {
        this.moduleIdMap.clear();
        this.idCounter = 0;
        for (const mod of modules) {
            this.moduleIdMap.set(mod.path, this.idCounter++);
        }
    }
    getModuleId(modulePath) {
        return this.moduleIdMap.get(modulePath) ?? 0;
    }
    resolveDepPath(source, fromPath) {
        return (0, parser_1.resolveModulePath)(source, fromPath);
    }
    createChunks(modules) {
        const chunks = [];
        const dynamicEntryPaths = new Set();
        const dynamicChunkModules = new Map();
        const allDynamicModulePaths = new Set();
        for (const mod of modules) {
            for (const dynImport of mod.dynamicImports) {
                const depPath = this.resolveDepPath(dynImport.source, mod.path);
                if (depPath) {
                    dynamicEntryPaths.add(depPath);
                    if (!dynamicChunkModules.has(depPath)) {
                        dynamicChunkModules.set(depPath, new Set());
                    }
                    dynamicChunkModules.get(depPath).add(depPath);
                    allDynamicModulePaths.add(depPath);
                    const visited = new Set();
                    const collectDeps = (p) => {
                        if (visited.has(p))
                            return;
                        visited.add(p);
                        const m = this.graph.getModule(p);
                        if (m) {
                            for (const imp of m.imports) {
                                const dp = this.resolveDepPath(imp.source, m.path);
                                if (dp) {
                                    dynamicChunkModules.get(depPath).add(dp);
                                    allDynamicModulePaths.add(dp);
                                    collectDeps(dp);
                                }
                            }
                        }
                    };
                    collectDeps(depPath);
                }
            }
        }
        const moduleRefCount = new Map();
        for (const mod of modules) {
            for (const imp of mod.imports) {
                const dp = this.resolveDepPath(imp.source, mod.path);
                if (dp)
                    moduleRefCount.set(dp, (moduleRefCount.get(dp) || 0) + 1);
            }
            for (const dyn of mod.dynamicImports) {
                const dp = this.resolveDepPath(dyn.source, mod.path);
                if (dp)
                    moduleRefCount.set(dp, (moduleRefCount.get(dp) || 0) + 1);
            }
        }
        const sharedModules = new Set();
        const minChunks = this.config.splitChunks?.minChunks ?? 2;
        const minSize = this.config.splitChunks?.minSize ?? 0;
        for (const [modPath, count] of moduleRefCount) {
            const m = this.graph.getModule(modPath);
            if (count >= minChunks && m && m.code.length >= minSize) {
                sharedModules.add(modPath);
            }
        }
        const mainModulePaths = [];
        for (const mod of modules) {
            if (!allDynamicModulePaths.has(mod.path) && !sharedModules.has(mod.path)) {
                mainModulePaths.push(mod.path);
            }
        }
        const mainModules = mainModulePaths.map(p => this.graph.getModule(p)).filter((m) => !!m);
        if (mainModules.length > 0) {
            chunks.push(this.createChunk('main', mainModules, true, false));
        }
        for (const [dynEntry, chunkModPaths] of dynamicChunkModules) {
            const chunkModules = Array.from(chunkModPaths)
                .filter(p => !sharedModules.has(p))
                .map(p => this.graph.getModule(p))
                .filter((m) => !!m);
            if (chunkModules.length > 0) {
                const name = `chunk_${path.basename(dynEntry, path.extname(dynEntry))}`;
                chunks.push(this.createChunk(name, chunkModules, false, true));
            }
        }
        if (sharedModules.size > 0) {
            const sharedModList = Array.from(sharedModules)
                .map(p => this.graph.getModule(p))
                .filter((m) => !!m);
            if (sharedModList.length > 0) {
                chunks.push(this.createChunk('shared', sharedModList, false, false));
            }
        }
        for (const chunk of chunks) {
            chunk.dependencies = chunks
                .filter(c => c.name !== chunk.name)
                .map(c => c.name);
        }
        return chunks;
    }
    createChunk(name, modules, isEntry, isDynamic) {
        const code = this.generateChunkCode(name, modules);
        return {
            id: name,
            name,
            modules: modules.map(m => m.path),
            code,
            hash: '',
            isEntry,
            isDynamic,
            dependencies: [],
            size: code.length,
        };
    }
    generateChunkCode(chunkName, modules, allChunks) {
        const moduleEntries = [];
        const dynChunkMap = new Map();
        for (const mod of modules) {
            const moduleId = this.getModuleId(mod.path);
            for (const dynImp of mod.dynamicImports) {
                const depPath = this.resolveDepPath(dynImp.source, mod.path);
                if (depPath) {
                    const depId = this.getModuleId(depPath);
                    const depChunkName = `chunk_${path.basename(depPath, path.extname(depPath))}`;
                    dynChunkMap.set(depId, depChunkName);
                }
            }
        }
        for (const mod of modules) {
            const moduleId = this.getModuleId(mod.path);
            let code = mod.code || '';
            if (mod.moduleType === 'cjs') {
                code = this.transformCjsModule(code, mod);
            }
            else if (mod.moduleType === 'esm') {
                code = this.transformEsmModule(code, mod);
            }
            else if (mod.moduleType === 'mixed') {
                code = this.transformEsmModule(code, mod);
                code = this.transformCjsModulePostEsm(code, mod);
            }
            for (const [depId, depChunkName] of dynChunkMap) {
                const re = new RegExp(`__mini_require__\\(${depId}\\)`, 'g');
                code = code.replace(re, `window.__mini_require_chunk__("${depChunkName}", ${depId})`);
            }
            moduleEntries.push(`  ${moduleId}: function(module, exports, __mini_require__) {\n${this.indent(code, 4)}\n  }`);
        }
        const lines = [];
        lines.push(`// Chunk: ${chunkName}`);
        lines.push(`(function() {`);
        lines.push(`  if (typeof window === 'undefined') return;`);
        lines.push(`  if (!window.__mini_modules__) window.__mini_modules__ = {};`);
        lines.push(`  if (!window.__mini_installed__) window.__mini_installed__ = {};`);
        lines.push(`  if (!window.__mini_chunk_loaded__) window.__mini_chunk_loaded__ = {};`);
        lines.push(`  if (!window.__mini_chunk_promises__) window.__mini_chunk_promises__ = {};`);
        lines.push(`  window.__mini_chunk_loaded__["${chunkName}"] = true;`);
        lines.push(`  var chunkModules = {`);
        lines.push(moduleEntries.join(',\n'));
        lines.push(`  };`);
        lines.push(`  for (var _k in chunkModules) {`);
        lines.push(`    if (Object.prototype.hasOwnProperty.call(chunkModules, _k)) {`);
        lines.push(`      window.__mini_modules__[_k] = chunkModules[_k];`);
        lines.push(`    }`);
        lines.push(`  }`);
        lines.push(`  function __mini_require__(moduleId) {`);
        lines.push(`    if (window.__mini_installed__[moduleId]) return window.__mini_installed__[moduleId].exports;`);
        lines.push(`    if (!window.__mini_modules__[moduleId]) {`);
        lines.push(`      throw new Error('[MiniBundler] Module not found: ' + moduleId + ' (check chunk loading order)');`);
        lines.push(`    }`);
        lines.push(`    var module = window.__mini_installed__[moduleId] = { exports: {}, id: moduleId, loaded: false };`);
        lines.push(`    window.__mini_modules__[moduleId].call(module.exports, module, module.exports, __mini_require__);`);
        lines.push(`    module.loaded = true;`);
        lines.push(`    return module.exports;`);
        lines.push(`  }`);
        lines.push(`  function __mini_require_chunk__(chunkName, moduleId) {`);
        lines.push(`    if (window.__mini_chunk_loaded__[chunkName]) {`);
        lines.push(`      return Promise.resolve(__mini_require__(moduleId));`);
        lines.push(`    }`);
        lines.push(`    if (window.__mini_chunk_promises__[chunkName]) {`);
        lines.push(`      return window.__mini_chunk_promises__[chunkName].then(function() { return __mini_require__(moduleId); });`);
        lines.push(`    }`);
        lines.push(`    var script = document.createElement('script');`);
        lines.push(`    script.src = chunkName + '.js';`);
        lines.push(`    var promise = new Promise(function(resolve, reject) {`);
        lines.push(`      script.onload = resolve;`);
        lines.push(`      script.onerror = reject;`);
        lines.push(`    });`);
        lines.push(`    window.__mini_chunk_promises__[chunkName] = promise;`);
        lines.push(`    document.head.appendChild(script);`);
        lines.push(`    return promise.then(function() { return __mini_require__(moduleId); });`);
        lines.push(`  }`);
        lines.push(`  window.__mini_require__ = __mini_require__;`);
        lines.push(`  window.__mini_require_chunk__ = __mini_require_chunk__;`);
        if (chunkName === 'main') {
            for (const mod of modules) {
                if (mod.isEntry) {
                    lines.push(`  __mini_require__(${this.getModuleId(mod.path)});`);
                }
            }
        }
        lines.push(`})();`);
        return lines.join('\n');
    }
    transformCjsModule(code, mod) {
        let result = code;
        for (const imp of mod.imports) {
            const depPath = this.resolveDepPath(imp.source, mod.path);
            if (depPath) {
                const depId = this.getModuleId(depPath);
                const escapedSource = escapeRegex(imp.source);
                result = result.replace(new RegExp(`require\\s*\\(\\s*['"]${escapedSource}['"]\\s*\\)`, 'g'), `__mini_require__(${depId})`);
            }
        }
        return result;
    }
    transformCjsModulePostEsm(code, mod) {
        let result = code;
        for (const imp of mod.imports) {
            if (imp.specifiers.some(s => s.type === 'namespace' && s.local.startsWith('__cjs_'))) {
                const depPath = this.resolveDepPath(imp.source, mod.path);
                if (depPath) {
                    const depId = this.getModuleId(depPath);
                    const escapedSource = escapeRegex(imp.source);
                    result = result.replace(new RegExp(`require\\s*\\(\\s*['"]${escapedSource}['"]\\s*\\)`, 'g'), `__mini_require__(${depId})`);
                }
            }
        }
        return result;
    }
    transformEsmModule(code, mod) {
        let result = code;
        for (const imp of mod.imports) {
            const depPath = this.resolveDepPath(imp.source, mod.path);
            if (!depPath)
                continue;
            const depId = this.getModuleId(depPath);
            const escapedSource = escapeRegex(imp.source);
            for (const spec of imp.specifiers) {
                if (spec.type === 'namespace') {
                    const regex = new RegExp(`import\\s+\\*\\s+as\\s+${escapeRegex(spec.local)}\\s+from\\s+['"]${escapedSource}['"]\\s*;?`, 'g');
                    result = result.replace(regex, `var ${spec.local} = __mini_require__(${depId});`);
                }
                else if (spec.type === 'default') {
                    const regex = new RegExp(`import\\s+${escapeRegex(spec.local)}\\s+from\\s+['"]${escapedSource}['"]\\s*;?`, 'g');
                    result = result.replace(regex, `var ${spec.local} = __mini_require__(${depId})["default"];`);
                }
                else if (spec.type === 'named') {
                    const regex = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escapedSource}['"]\\s*;?`, 'g');
                    result = result.replace(regex, (_match, imports) => {
                        const parts = imports.split(',').map((p) => p.trim()).filter(Boolean);
                        return parts.map((p) => {
                            const [imported, local] = p.split(/\s+as\s+/).map((s) => s.trim());
                            const name = local || imported;
                            return `var ${name} = __mini_require__(${depId})["${imported}"];`;
                        }).join('\n');
                    });
                }
                else if (spec.type === 'side-effect') {
                    const regex = new RegExp(`import\\s+['"]${escapedSource}['"]\\s*;?`, 'g');
                    result = result.replace(regex, `__mini_require__(${depId});`);
                }
            }
        }
        for (const dynImp of mod.dynamicImports) {
            const depPath = this.resolveDepPath(dynImp.source, mod.path);
            if (depPath) {
                const depId = this.getModuleId(depPath);
                const escapedSource = escapeRegex(dynImp.source);
                const regex = new RegExp(`import\\s*\\(\\s*['"]${escapedSource}['"]\\s*\\)`, 'g');
                result = result.replace(regex, `Promise.resolve().then(function() { return __mini_require__(${depId}); })`);
            }
        }
        const exportLines = [];
        for (const exp of mod.exports) {
            if (exp.type === 'named' && exp.local && exp.used !== false) {
                if (exp.local === exp.name || !exp.local) {
                    exportLines.push(`Object.defineProperty(exports, "${exp.name}", { enumerable: true, get: function() { return ${exp.local || exp.name}; } });`);
                }
                else {
                    exportLines.push(`Object.defineProperty(exports, "${exp.name}", { enumerable: true, get: function() { return ${exp.local}; } });`);
                }
            }
            else if (exp.type === 'default' && exp.used !== false) {
                exportLines.push(`exports["default"] = ${exp.name !== 'default' ? exp.name : 'void 0'};`);
            }
            else if (exp.type === 're-export' && exp.source && exp.used !== false) {
                const dp = this.resolveDepPath(exp.source, mod.path);
                if (dp) {
                    const did = this.getModuleId(dp);
                    exportLines.push(`Object.defineProperty(exports, "${exp.name}", { enumerable: true, get: function() { return __mini_require__(${did})["${exp.imported}"]; } });`);
                }
            }
            else if (exp.type === 're-export-all' && exp.source) {
                const dp = this.resolveDepPath(exp.source, mod.path);
                if (dp) {
                    const did = this.getModuleId(dp);
                    exportLines.push(`Object.assign(exports, __mini_require__(${did}));`);
                }
            }
        }
        result = result.replace(/export\s+default\s+/g, '');
        result = result.replace(/export\s+\{[^}]*\}\s*;?\s*/g, '');
        result = result.replace(/export\s+(function|const|let|var|class)\s+/g, '$1 ');
        result = result.replace(/export\s+\*\s+from\s+['"][^'"]+['"]\s*;?\s*/g, '');
        if (exportLines.length > 0) {
            result += '\n' + exportLines.join('\n');
        }
        return result;
    }
    indent(code, spaces) {
        const prefix = ' '.repeat(spaces);
        return code.split('\n').map(line => prefix + line).join('\n');
    }
    attachSourceMaps(chunks) {
        for (const chunk of chunks) {
            const chunkModules = chunk.modules
                .map(p => this.graph.getModule(p))
                .filter((m) => !!m);
            const sources = [];
            const sourcesContent = [];
            const names = [];
            const segmentLines = [];
            let genLine = 0;
            let prevCol = 0;
            let prevSrc = 0;
            let prevOrigLine = 0;
            let prevOrigCol = 0;
            for (const mod of chunkModules) {
                const srcIdx = sources.length;
                sources.push(path.relative(process.cwd(), mod.path));
                sourcesContent.push(mod.originalCode);
                const lines = mod.code.split('\n');
                for (let i = 0; i < lines.length; i++) {
                    const fields = [
                        0 - prevCol,
                        srcIdx - prevSrc,
                        i - prevOrigLine,
                        0 - prevOrigCol,
                    ];
                    segmentLines.push(fields.map(f => (0, sourcemap_1.encodeVLQ)(f)).join(''));
                    prevCol = 0;
                    prevSrc = srcIdx;
                    prevOrigLine = i;
                    prevOrigCol = 0;
                    genLine++;
                }
                segmentLines.push('');
                genLine++;
                prevCol = 0;
                prevOrigLine = 0;
                prevOrigCol = 0;
            }
            const sourceMap = {
                version: 3,
                sources,
                names,
                mappings: segmentLines.join(';'),
                file: `${chunk.name}.js`,
                sourcesContent,
            };
            const mapJson = JSON.stringify(sourceMap);
            chunk.sourceMap = mapJson;
            chunk.code = (0, sourcemap_1.appendSourceMapUrl)(chunk.code, `${chunk.name}.js.map`);
        }
    }
    computeBundleSize(modules) {
        return modules.reduce((size, mod) => size + (mod.code?.length || 0), 0);
    }
    countUsedExports(modules) {
        return modules.reduce((count, mod) => count + mod.exports.filter(e => e.used !== false).length, 0);
    }
    computeHash(code) {
        return (0, crypto_1.createHash)('md5').update(code).digest('hex').slice(0, 8);
    }
    async writeOutput(chunks) {
        const outputDir = path.resolve(this.config.output);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        for (const chunk of chunks) {
            const fileName = chunk.isEntry ? 'main.js' : `${chunk.name}.js`;
            fs.writeFileSync(path.join(outputDir, fileName), chunk.code);
            if (this.config.sourceMap && chunk.sourceMap) {
                fs.writeFileSync(path.join(outputDir, `${chunk.name}.js.map`), chunk.sourceMap);
            }
        }
        const html = this.generateHTML(chunks);
        fs.writeFileSync(path.join(outputDir, 'index.html'), html);
    }
    generateHTML(chunks) {
        const nonDynamicChunks = chunks.filter(c => !c.isDynamic);
        nonDynamicChunks.sort((a, b) => {
            const order = (name) => name === 'shared' ? 0 : (name === 'main' ? 1 : 2);
            return order(a.name) - order(b.name);
        });
        const nonDynamicScripts = nonDynamicChunks
            .map(c => `    <script src="${c.isEntry ? 'main.js' : c.name + '.js'}"></script>`)
            .join('\n');
        const hmrScript = this.config.hmr
            ? `    <script src="http://localhost:${this.config.hmrPort || 8081}/__hmr_client.js"></script>\n`
            : '';
        return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mini Bundler Output</title>
</head>
<body>
  <div id="app"></div>
${hmrScript}${nonDynamicScripts}
</body>
</html>`;
    }
    async stop() {
        this.hmrServer.stop();
        if (this.watcher) {
            await this.watcher.close();
        }
    }
}
exports.Bundler = Bundler;
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=bundler.js.map