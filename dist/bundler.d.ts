import { BundlerConfig, ChunkInfo } from './types';
export interface BuildResult {
    chunks: ChunkInfo[];
    duration: number;
    modulesCount: number;
    treeShakenExports: number;
    cacheHits: number;
    bundleSizeBefore: number;
    bundleSizeAfter: number;
}
export declare class Bundler {
    private config;
    private graph;
    private loaderRunner;
    private hmrServer;
    private cache;
    private watcher;
    private moduleIdMap;
    private idCounter;
    private _lastBuildDuration;
    constructor(config: BundlerConfig);
    build(): Promise<BuildResult>;
    watch(): Promise<void>;
    private assignModuleIds;
    private getModuleId;
    private resolveDepPath;
    private createChunks;
    private createChunk;
    private generateChunkCode;
    private transformCjsModule;
    private transformCjsModulePostEsm;
    private transformEsmModule;
    private indent;
    private attachSourceMaps;
    private computeBundleSize;
    private countUsedExports;
    private computeHash;
    private writeOutput;
    private generateHTML;
    stop(): Promise<void>;
}
//# sourceMappingURL=bundler.d.ts.map