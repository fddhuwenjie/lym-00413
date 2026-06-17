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
exports.DependencyGraph = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const parser_1 = require("./parser");
class DependencyGraph {
    constructor(config) {
        this.config = config;
        this.modules = new Map();
        this.reverseDeps = new Map();
        this.entryIds = [];
        this.idCounter = 0;
    }
    buildFromEntry(entryPath) {
        const resolved = path.resolve(entryPath);
        this.entryIds = [this.getModuleId(resolved)];
        this.processModule(resolved, true);
    }
    processModule(filePath, isEntry) {
        const resolved = path.resolve(filePath);
        if (this.modules.has(resolved))
            return;
        const code = fs.readFileSync(resolved, 'utf-8');
        const id = this.getModuleId(resolved);
        const moduleInfo = (0, parser_1.createModuleInfo)(resolved, code, isEntry, id);
        this.modules.set(resolved, moduleInfo);
        if (!this.reverseDeps.has(resolved)) {
            this.reverseDeps.set(resolved, new Set());
        }
        const allSources = [
            ...moduleInfo.imports.map(i => i.source),
            ...moduleInfo.dynamicImports.map(d => d.source),
        ];
        for (const source of allSources) {
            const depPath = (0, parser_1.resolveModulePath)(source, resolved);
            if (depPath && !this.modules.has(depPath)) {
                if (!this.reverseDeps.has(depPath)) {
                    this.reverseDeps.set(depPath, new Set());
                }
                this.reverseDeps.get(depPath).add(resolved);
                this.processModule(depPath, false);
            }
        }
    }
    getModuleId(filePath) {
        const existing = Array.from(this.modules.entries()).find(([, m]) => m.path === filePath);
        if (existing)
            return existing[1].id;
        return `m${this.idCounter++}`;
    }
    getModules() {
        return Array.from(this.modules.values());
    }
    getModule(filePath) {
        return this.modules.get(path.resolve(filePath));
    }
    getDependencies(filePath) {
        const mod = this.modules.get(path.resolve(filePath));
        if (!mod)
            return [];
        return mod.dependencies
            .map(dep => (0, parser_1.resolveModulePath)(dep, mod.path))
            .filter((p) => p !== null);
    }
    getReverseDependencies(filePath) {
        const deps = this.reverseDeps.get(path.resolve(filePath));
        return deps ? Array.from(deps) : [];
    }
    resolveReExports() {
        for (const [, mod] of this.modules) {
            for (const exp of mod.exports) {
                if ((exp.type === 're-export' || exp.type === 're-export-all') && exp.source) {
                    const depPath = (0, parser_1.resolveModulePath)(exp.source, mod.path);
                    if (depPath) {
                        const depMod = this.modules.get(depPath);
                        if (depMod) {
                            if (exp.type === 're-export-all') {
                                for (const depExp of depMod.exports) {
                                    if (depExp.type === 'named' && depExp.name !== 'default') {
                                        mod.exports.push({
                                            ...depExp,
                                            type: 're-export',
                                            source: exp.source,
                                            imported: depExp.name,
                                        });
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    getTopologicalOrder() {
        const visited = new Set();
        const order = [];
        const visiting = new Set();
        const visit = (filePath) => {
            const resolved = path.resolve(filePath);
            if (visited.has(resolved))
                return;
            if (visiting.has(resolved))
                return;
            visiting.add(resolved);
            const deps = this.getDependencies(resolved);
            for (const dep of deps) {
                visit(dep);
            }
            visiting.delete(resolved);
            visited.add(resolved);
            order.push(resolved);
        };
        for (const entryId of this.entryIds) {
            const entryMod = this.modules.get(entryId) || Array.from(this.modules.values()).find(m => m.isEntry);
            if (entryMod)
                visit(entryMod.path);
        }
        for (const [, mod] of this.modules) {
            visit(mod.path);
        }
        return order;
    }
}
exports.DependencyGraph = DependencyGraph;
//# sourceMappingURL=dependency-graph.js.map