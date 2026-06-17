import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { CacheEntry, ModuleInfo, SourceMap } from './types';

export class BuildCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheDir: string;
  private enabled: boolean;

  constructor(cacheDir: string = '.mini-bundler-cache', enabled: boolean = true) {
    this.cacheDir = cacheDir;
    this.enabled = enabled;
  }

  async init(): Promise<void> {
    if (!this.enabled) return;
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    await this.loadFromDisk();
  }

  private async loadFromDisk(): Promise<void> {
    const cacheFile = path.join(this.cacheDir, 'cache.json');
    if (fs.existsSync(cacheFile)) {
      try {
        const data = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        for (const [key, entry] of Object.entries(data)) {
          this.cache.set(key, entry as CacheEntry);
        }
      } catch {
        this.cache.clear();
      }
    }
  }

  private async saveToDisk(): Promise<void> {
    if (!this.enabled) return;
    const cacheFile = path.join(this.cacheDir, 'cache.json');
    const data: Record<string, CacheEntry> = {};
    for (const [key, entry] of this.cache) {
      data[key] = entry;
    }
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2));
  }

  computeHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  computeFileHash(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    const content = fs.readFileSync(filePath, 'utf-8');
    return this.computeHash(content);
  }

  hasChanged(filePath: string): boolean {
    if (!this.enabled) return true;
    const currentHash = this.computeFileHash(filePath);
    const cached = this.cache.get(filePath);
    return !cached || cached.hash !== currentHash;
  }

  getModuleInfo(filePath: string): CacheEntry | null {
    if (!this.enabled) return null;
    return this.cache.get(filePath) || null;
  }

  setModuleInfo(filePath: string, entry: CacheEntry): void {
    if (!this.enabled) return;
    this.cache.set(filePath, entry);
    this.saveToDisk();
  }

  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  invalidateAll(): void {
    this.cache.clear();
    this.saveToDisk();
  }

  getChangedFiles(files: string[]): string[] {
    if (!this.enabled) return files;
    return files.filter(f => this.hasChanged(f));
  }

  getUnchangedModules(allModules: ModuleInfo[]): ModuleInfo[] {
    if (!this.enabled) return [];
    const unchanged: ModuleInfo[] = [];
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

  updateCache(modules: ModuleInfo[]): void {
    if (!this.enabled) return;
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

  getStats(): { total: number; cached: number; size: number } {
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
