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
exports.BuildCache = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
class BuildCache {
    constructor(cacheDir = '.mini-bundler-cache', enabled = true) {
        this.cache = new Map();
        this.cacheDir = cacheDir;
        this.enabled = enabled;
    }
    async init() {
        if (!this.enabled)
            return;
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
        await this.loadFromDisk();
    }
    async loadFromDisk() {
        const cacheFile = path.join(this.cacheDir, 'cache.json');
        if (fs.existsSync(cacheFile)) {
            try {
                const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
                for (const [key, entry] of Object.entries(data)) {
                    this.cache.set(key, entry);
                }
            }
            catch {
                this.cache.clear();
            }
        }
    }
    async saveToDisk() {
        if (!this.enabled)
            return;
        const cacheFile = path.join(this.cacheDir, 'cache.json');
        const data = {};
        for (const [key, entry] of this.cache) {
            data[key] = entry;
        }
        fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
    }
    computeHash(content) {
        return (0, crypto_1.createHash)('md5').update(content).digest('hex');
    }
    computeFileHash(filePath) {
        if (!fs.existsSync(filePath))
            return '';
        const content = fs.readFileSync(filePath, 'utf-8');
        return this.computeHash(content);
    }
    hasChanged(filePath) {
        if (!this.enabled)
            return true;
        const currentHash = this.computeFileHash(filePath);
        const cached = this.cache.get(filePath);
        return !cached || cached.hash !== currentHash;
    }
    getModuleInfo(filePath) {
        if (!this.enabled)
            return null;
        return this.cache.get(filePath) || null;
    }
    setModuleInfo(filePath, entry) {
        if (!this.enabled)
            return;
        this.cache.set(filePath, entry);
        this.saveToDisk();
    }
    invalidate(filePath) {
        this.cache.delete(filePath);
    }
    invalidateAll() {
        this.cache.clear();
        this.saveToDisk();
    }
    getChangedFiles(files) {
        if (!this.enabled)
            return files;
        return files.filter(f => this.hasChanged(f));
    }
    getUnchangedModules(allModules) {
        if (!this.enabled)
            return [];
        const unchanged = [];
        for (const mod of allModules) {
            if (!this.hasChanged(mod.path)) {
                const cached = this.cache.get(mod.path);
                if (cached) {
                    unchanged.push(cached.moduleInfo);
                }
            }
        }
        return unchanged;
    }
    updateCache(modules) {
        if (!this.enabled)
            return;
        for (const mod of modules) {
            const hash = this.computeFileHash(mod.path);
            this.cache.set(mod.path, {
                hash,
                moduleInfo: mod,
                outputCode: mod.code,
                sourceMap: mod.sourceMap,
                timestamp: Date.now(),
            });
        }
        this.saveToDisk();
    }
    getStats() {
        let totalSize = 0;
        for (const [, entry] of this.cache) {
            totalSize += (entry.outputCode?.length || 0) + (entry.sourceMap?.length || 0);
        }
        return {
            total: this.cache.size,
            cached: this.cache.size,
            size: totalSize,
        };
    }
}
exports.BuildCache = BuildCache;
//# sourceMappingURL=cache.js.map