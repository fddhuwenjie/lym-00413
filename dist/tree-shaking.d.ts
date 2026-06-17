import { BundlerConfig } from './types';
import { DependencyGraph } from './dependency-graph';
export declare class TreeShaker {
    private config;
    private usedExports;
    private sideEffectsCache;
    constructor(config: BundlerConfig);
    shake(graph: DependencyGraph): void;
    private markUsedExports;
    private markUsed;
    private markSideEffectFreeModules;
    private isSideEffectFree;
    private checkPackageJsonSideEffects;
    private getPackageRoot;
    private eliminateDeadCode;
    private removeUnusedDeclarations;
    private findMatchingBrace;
    private removeUnusedExports;
    private generateEmptyModule;
    private resolvePath;
}
//# sourceMappingURL=tree-shaking.d.ts.map