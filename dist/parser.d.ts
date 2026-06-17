import { ModuleInfo, ImportInfo, ExportInfo, DynamicImportInfo } from './types';
interface ParseResult {
    imports: ImportInfo[];
    exports: ExportInfo[];
    dynamicImports: DynamicImportInfo[];
    moduleType: 'esm' | 'cjs' | 'mixed';
}
export declare function parseModule(code: string, filePath: string): ParseResult;
export declare function createModuleInfo(filePath: string, code: string, isEntry: boolean, id: string): ModuleInfo;
export declare function resolveModulePath(source: string, fromPath: string): string | null;
export {};
//# sourceMappingURL=parser.d.ts.map