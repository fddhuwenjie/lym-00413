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
exports.CodeSplitter = void 0;
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
class CodeSplitter {
    constructor(config = {}) {
        this.config = config;
        this.dynamicImportMap = new Map();
        this.chunks = [];
    }
    split(graph) {
        const modules = graph.getModules();
        this.identifyDynamicChunks(graph);
        this.chunks = this.createChunks(graph);
        const splitConfig = {
            minChunks: this.config.minChunks ?? 2,
            minSize: this.config.minSize ?? 0,
            maxSize: this.config.maxSize ?? Infinity,
            name: this.config.name ?? 'vendors',
        };
        this.extractCommonChunks(graph, splitConfig);
        return this.chunks;
    }
    identifyDynamicChunks(graph) {
        const modules = graph.getModules();
        for (const mod of modules) {
            if (mod.dynamicImports.length > 0) {
                this.dynamicImportMap.set(mod.path, mod.dynamicImports.map(d => d.source));
            }
        }
    }
    createChunks(graph) {
        const modules = graph.getModules();
        const chunks = [];
        const entryModules = new Set();
        const dynamicModulePaths = new Set();
        for (const entryId of graph.entryIds) {
            const entryMod = graph.getModule(entryId);
            if (entryMod)
                entryModules.add(entryMod.path);
        }
        const dynamicEntryModules = new Map();
        for (const mod of modules) {
            for (const dynImport of mod.dynamicImports) {
                const depPath = this.resolveModulePath(dynImport.source, mod.path, graph);
                if (depPath) {
                    dynamicModulePaths.add(depPath);
                    if (!dynamicEntryModules.has(depPath)) {
                        dynamicEntryModules.set(depPath, []);
                    }
                    dynamicEntryModules.get(depPath).push(mod.path);
                    const transitiveDeps = this.getTransitiveDependencies(depPath, graph);
                    for (const dep of transitiveDeps) {
                        dynamicModulePaths.add(dep);
                    }
                }
            }
        }
        const sharedModules = new Set();
        const moduleRefCount = new Map();
        for (const mod of modules) {
            const deps = graph.getDependencies(mod.path);
            for (const dep of deps) {
                moduleRefCount.set(dep, (moduleRefCount.get(dep) || 0) + 1);
            }
        }
        for (const [modPath, count] of moduleRefCount) {
            if (count >= 2 && dynamicModulePaths.has(modPath)) {
                sharedModules.add(modPath);
            }
        }
        const mainModules = modules.filter(m => !dynamicModulePaths.has(m.path) && !sharedModules.has(m.path));
        if (mainModules.length > 0) {
            const mainCode = this.wrapChunk(mainModules, 'main', graph);
            chunks.push({
                id: 'main',
                name: 'main',
                modules: mainModules.map(m => m.path),
                code: mainCode,
                hash: this.computeChunkHash(mainCode),
                isEntry: true,
                isDynamic: false,
                dependencies: [],
                size: mainCode.length,
            });
        }
        for (const [dynEntry, importers] of dynamicEntryModules) {
            const dynMod = graph.getModule(dynEntry);
            if (!dynMod)
                continue;
            const dynChunkModules = [dynEntry];
            const transitiveDeps = this.getTransitiveDependencies(dynEntry, graph);
            for (const dep of transitiveDeps) {
                if (!sharedModules.has(dep) && dynamicModulePaths.has(dep)) {
                    dynChunkModules.push(dep);
                }
            }
            const uniqueModules = [...new Set(dynChunkModules)];
            const moduleInfos = uniqueModules
                .map(p => graph.getModule(p))
                .filter((m) => m !== undefined);
            if (moduleInfos.length > 0) {
                const chunkName = `chunk_${path.basename(dynEntry, path.extname(dynEntry))}`;
                const chunkCode = this.wrapChunk(moduleInfos, chunkName, graph);
                chunks.push({
                    id: chunkName,
                    name: chunkName,
                    modules: uniqueModules,
                    code: chunkCode,
                    hash: this.computeChunkHash(chunkCode),
                    isEntry: false,
                    isDynamic: true,
                    dependencies: [],
                    size: chunkCode.length,
                });
            }
        }
        return chunks;
    }
    extractCommonChunks(graph, config) {
        const modules = graph.getModules();
        const moduleRefCount = new Map();
        for (const mod of modules) {
            const deps = graph.getDependencies(mod.path);
            for (const dep of deps) {
                moduleRefCount.set(dep, (moduleRefCount.get(dep) || 0) + 1);
            }
        }
        const candidates = [];
        for (const [modPath, count] of moduleRefCount) {
            if (count >= config.minChunks) {
                const mod = graph.getModule(modPath);
                if (mod && mod.code.length >= config.minSize) {
                    candidates.push({
                        modules: [modPath],
                        refCount: count,
                        totalSize: mod.code.length,
                        name: config.name,
                    });
                }
            }
        }
        if (candidates.length > 0) {
            const commonModulePaths = candidates.map(c => c.modules).flat();
            const commonModules = commonModulePaths
                .map(p => graph.getModule(p))
                .filter((m) => m !== undefined);
            if (commonModules.length > 0) {
                const chunkCode = this.wrapChunk(commonModules, config.name, graph);
                this.chunks.push({
                    id: config.name,
                    name: config.name,
                    modules: commonModulePaths,
                    code: chunkCode,
                    hash: this.computeChunkHash(chunkCode),
                    isEntry: false,
                    isDynamic: false,
                    dependencies: [],
                    size: chunkCode.length,
                });
                for (const chunk of this.chunks) {
                    if (!chunk.isDynamic && chunk.name !== config.name) {
                        const hasCommon = chunk.modules.some(m => commonModulePaths.includes(m));
                        if (hasCommon) {
                            chunk.modules = chunk.modules.filter(m => !commonModulePaths.includes(m));
                            if (!chunk.dependencies.includes(config.name)) {
                                chunk.dependencies.push(config.name);
                            }
                        }
                    }
                }
            }
        }
    }
    getTransitiveDependencies(modulePath, graph) {
        const visited = new Set();
        const result = [];
        const visit = (p) => {
            if (visited.has(p))
                return;
            visited.add(p);
            const deps = graph.getDependencies(p);
            for (const dep of deps) {
                result.push(dep);
                visit(dep);
            }
        };
        visit(modulePath);
        return result;
    }
    wrapChunk(modules, chunkName, graph) {
        const lines = [];
        lines.push(`// Chunk: ${chunkName}`);
        const moduleWrappers = [];
        for (const mod of modules) {
            let moduleCode = mod.code;
            if (mod.moduleType === 'cjs' || mod.moduleType === 'mixed') {
                moduleCode = this.wrapCjsModule(mod, graph);
            }
            else {
                moduleCode = this.wrapEsmModule(mod, graph);
            }
            const moduleId = this.getModuleIdForChunk(mod.path, graph);
            moduleWrappers.push(`${moduleId}: function(module, exports, __mini_require__) {\n${moduleCode}\n}`);
        }
        lines.push(`(function(__mini_modules__) {`);
        lines.push(`  var installedModules = {};`);
        lines.push(`  function __mini_require__(moduleId) {`);
        lines.push(`    if (installedModules[moduleId]) return installedModules[moduleId].exports;`);
        lines.push(`    var module = installedModules[moduleId] = { exports: {}, id: moduleId, loaded: false };`);
        lines.push(`    __mini_modules__[moduleId].call(module.exports, module, module.exports, __mini_require__);`);
        lines.push(`    module.loaded = true;`);
        lines.push(`    return module.exports;`);
        lines.push(`  }`);
        if (modules.some(m => m.isEntry)) {
            const entryMod = modules.find(m => m.isEntry);
            if (entryMod) {
                const entryId = this.getModuleIdForChunk(entryMod.path, graph);
                lines.push(`  __mini_require__(${entryId});`);
            }
        }
        lines.push(`  if (typeof window !== 'undefined') {`);
        lines.push(`    window.__mini_require__ = __mini_require__;`);
        lines.push(`  }`);
        lines.push(`})({`);
        lines.push(moduleWrappers.join(',\n'));
        lines.push(`});`);
        return lines.join('\n');
    }
    wrapCjsModule(mod, graph) {
        let code = mod.code;
        for (const imp of mod.imports) {
            const depPath = this.resolveModulePath(imp.source, mod.path, graph);
            if (depPath) {
                const depId = this.getModuleIdForChunk(depPath, graph);
                code = code.replace(new RegExp(`require\\(\\s*['"]${escapeRegex(imp.source)}['"]\\s*\\)`, 'g'), `__mini_require__(${depId})`);
            }
        }
        return code;
    }
    wrapEsmModule(mod, graph) {
        let code = mod.code;
        for (const imp of mod.imports) {
            const depPath = this.resolveModulePath(imp.source, mod.path, graph);
            if (depPath) {
                const depId = this.getModuleIdForChunk(depPath, graph);
                for (const spec of imp.specifiers) {
                    if (spec.type === 'default') {
                        code = code.replace(new RegExp(`import\\s+${escapeRegex(spec.local)}\\s+from\\s+['"]${escapeRegex(imp.source)}['"]`, 'g'), `var ${spec.local} = __mini_require__(${depId})["default"]`);
                    }
                    else if (spec.type === 'named') {
                        code = code.replace(new RegExp(`import\\s+\\{[^}]*${escapeRegex(spec.local)}[^}]*\\}\\s+from\\s+['"]${escapeRegex(imp.source)}['"]`, 'g'), (match) => {
                            return match.replace(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escapeRegex(imp.source)}['"]`), (_, imports) => {
                                const parts = imports.split(',').map((p) => p.trim());
                                const vars = parts.map((p) => {
                                    const [imported, local] = p.split(/\s+as\s+/).map(s => s.trim());
                                    return `var ${local || imported} = __mini_require__(${depId})["${imported}"]`;
                                });
                                return vars.join('; ');
                            });
                        });
                    }
                    else if (spec.type === 'namespace') {
                        code = code.replace(new RegExp(`import\\s+\\*\\s+as\\s+${escapeRegex(spec.local)}\\s+from\\s+['"]${escapeRegex(imp.source)}['"]`, 'g'), `var ${spec.local} = __mini_require__(${depId})`);
                    }
                }
            }
        }
        const exportLines = [];
        for (const exp of mod.exports) {
            if (exp.type === 'named' && exp.local) {
                exportLines.push(`Object.defineProperty(exports, "${exp.name}", { enumerable: true, get: function() { return ${exp.local}; } });`);
            }
            else if (exp.type === 'default') {
                exportLines.push(`Object.defineProperty(exports, "default", { enumerable: true, value: ${exp.name === 'default' ? exp.local || 'undefined' : exp.name} });`);
            }
            else if (exp.type === 're-export' && exp.source) {
                const depPath = this.resolveModulePath(exp.source, mod.path, graph);
                if (depPath) {
                    const depId = this.getModuleIdForChunk(depPath, graph);
                    exportLines.push(`Object.defineProperty(exports, "${exp.name}", { enumerable: true, get: function() { return __mini_require__(${depId})["${exp.imported}"]; } });`);
                }
            }
            else if (exp.type === 're-export-all' && exp.source) {
                const depPath = this.resolveModulePath(exp.source, mod.path, graph);
                if (depPath) {
                    const depId = this.getModuleIdForChunk(depPath, graph);
                    exportLines.push(`Object.assign(exports, __mini_require__(${depId}));`);
                }
            }
        }
        if (exportLines.length > 0) {
            code += '\n' + exportLines.join('\n');
        }
        code = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');
        code = code.replace(/export\s+default\s+/g, '');
        code = code.replace(/export\s+\{[^}]*\}\s*;?\s*/g, '');
        code = code.replace(/export\s+(function|const|let|var|class)\s+/g, '$1 ');
        code = code.replace(/export\s+\*\s+from\s+['"].*?['"];?\s*/g, '');
        return code;
    }
    getModuleIdForChunk(modulePath, graph) {
        const mod = graph.getModule(modulePath);
        if (mod)
            return parseInt(mod.id.replace('m', ''), 10) || 0;
        return 0;
    }
    resolveModulePath(source, fromPath, graph) {
        for (const [, mod] of graph.modules) {
            if (mod.path === source)
                return mod.path;
        }
        const deps = graph.getDependencies(fromPath);
        for (const dep of deps) {
            const depMod = graph.getModule(dep);
            if (depMod) {
                const rel = path.relative(path.dirname(fromPath), depMod.path).replace(/\\/g, '/');
                if (rel === source || './' + rel === source)
                    return dep;
            }
        }
        return null;
    }
    computeChunkHash(code) {
        return (0, crypto_1.createHash)('md5').update(code).digest('hex').slice(0, 8);
    }
}
exports.CodeSplitter = CodeSplitter;
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
//# sourceMappingURL=code-splitting.js.map