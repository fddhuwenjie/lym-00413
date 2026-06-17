export interface ModuleInfo {
    id: string;
    path: string;
    code: string;
    originalCode: string;
    isEntry: boolean;
    moduleType: 'esm' | 'cjs' | 'mixed';
    imports: ImportInfo[];
    exports: ExportInfo[];
    dynamicImports: DynamicImportInfo[];
    sideEffects: boolean;
    hash: string;
    dependencies: string[];
    sourceMap?: string;
}
export interface ImportInfo {
    source: string;
    specifiers: ImportSpecifier[];
    isDynamic: boolean;
    start: number;
    end: number;
}
export interface ImportSpecifier {
    type: 'default' | 'named' | 'namespace' | 'side-effect';
    imported: string;
    local: string;
}
export interface ExportInfo {
    type: 'named' | 'default' | 're-export' | 're-export-all';
    name: string;
    local?: string;
    source?: string;
    imported?: string;
    start: number;
    end: number;
    used: boolean;
}
export interface DynamicImportInfo {
    source: string;
    start: number;
    end: number;
}
export interface ChunkInfo {
    id: string;
    name: string;
    modules: string[];
    code: string;
    sourceMap?: string;
    hash: string;
    isEntry: boolean;
    isDynamic: boolean;
    dependencies: string[];
    size: number;
}
export interface BundlerConfig {
    entry: string | string[];
    output: string;
    format?: 'iife' | 'esm';
    sourceMap?: boolean;
    minify?: boolean;
    treeShaking?: boolean;
    hmr?: boolean;
    hmrPort?: number;
    loaders?: LoaderConfig[];
    splitChunks?: SplitChunksConfig;
    sideEffects?: boolean | string[];
    cache?: boolean;
    cacheDir?: string;
}
export interface LoaderConfig {
    test: RegExp;
    use: string | LoaderFunction[];
    options?: Record<string, any>;
}
export type LoaderFunction = (code: string, map: SourceMap | null, meta: LoaderMeta) => LoaderResult;
export interface LoaderMeta {
    id: string;
    path: string;
    [key: string]: any;
}
export interface LoaderResult {
    code: string;
    map?: SourceMap | null;
    ast?: any;
}
export interface SplitChunksConfig {
    minChunks?: number;
    minSize?: number;
    maxSize?: number;
    name?: string;
}
export interface SourceMap {
    version: number;
    sources: string[];
    sourcesContent?: (string | null)[];
    names: string[];
    mappings: string;
    file?: string;
}
export interface CacheEntry {
    hash: string;
    moduleInfo: ModuleInfo;
    outputCode: string;
    sourceMap?: string;
    timestamp: number;
}
export interface HMRUpdate {
    type: 'update' | 'full-reload' | 'connected';
    modules?: string[];
    hash?: string;
}
//# sourceMappingURL=types.d.ts.map