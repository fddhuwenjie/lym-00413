import { ModuleInfo, BundlerConfig } from './types';
export declare class DependencyGraph {
    private config;
    modules: Map<string, ModuleInfo>;
    reverseDeps: Map<string, Set<string>>;
    entryIds: string[];
    private idCounter;
    constructor(config: BundlerConfig);
    buildFromEntry(entryPath: string): void;
    private processModule;
    private getModuleId;
    getModules(): ModuleInfo[];
    getModule(filePath: string): ModuleInfo | undefined;
    getDependencies(filePath: string): string[];
    getReverseDependencies(filePath: string): string[];
    resolveReExports(): void;
    getTopologicalOrder(): string[];
}
//# sourceMappingURL=dependency-graph.d.ts.map