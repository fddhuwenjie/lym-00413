import { LoaderConfig, LoaderFunction, LoaderMeta, LoaderResult } from './types';
export declare class LoaderRunner {
    private loaders;
    constructor(loaderConfigs: LoaderConfig[]);
    process(code: string, filePath: string, meta: LoaderMeta): Promise<LoaderResult>;
    private getApplicableLoaders;
    private resolveLoader;
    private loaderConfigs;
}
export declare function createBabelLoader(options?: Record<string, any>): LoaderFunction;
export declare function createCssLoader(options?: Record<string, any>): LoaderFunction;
export declare function createLoaderPipeline(loaderConfigs: LoaderConfig[]): LoaderRunner;
//# sourceMappingURL=loader.d.ts.map