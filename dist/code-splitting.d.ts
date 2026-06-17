import { ChunkInfo, SplitChunksConfig } from './types';
import { DependencyGraph } from './dependency-graph';
export declare class CodeSplitter {
    private config;
    private dynamicImportMap;
    private chunks;
    constructor(config?: SplitChunksConfig);
    split(graph: DependencyGraph): ChunkInfo[];
    private identifyDynamicChunks;
    private createChunks;
    private extractCommonChunks;
    private getTransitiveDependencies;
    private wrapChunk;
    private wrapCjsModule;
    private wrapEsmModule;
    private getModuleIdForChunk;
    private resolveModulePath;
    private computeChunkHash;
}
//# sourceMappingURL=code-splitting.d.ts.map