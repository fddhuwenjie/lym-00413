import { CacheEntry, ModuleInfo } from './types';
export declare class BuildCache {
    private cache;
    private cacheDir;
    private enabled;
    constructor(cacheDir?: string, enabled?: boolean);
    init(): Promise<void>;
    private loadFromDisk;
    private saveToDisk;
    computeHash(content: string): string;
    computeFileHash(filePath: string): string;
    hasChanged(filePath: string): boolean;
    getModuleInfo(filePath: string): CacheEntry | null;
    setModuleInfo(filePath: string, entry: CacheEntry): void;
    invalidate(filePath: string): void;
    invalidateAll(): void;
    getChangedFiles(files: string[]): string[];
    getUnchangedModules(allModules: ModuleInfo[]): ModuleInfo[];
    updateCache(modules: ModuleInfo[]): void;
    getStats(): {
        total: number;
        cached: number;
        size: number;
    };
}
//# sourceMappingURL=cache.d.ts.map