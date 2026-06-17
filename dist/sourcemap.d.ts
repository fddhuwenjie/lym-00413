export declare function encodeVLQ(value: number): string;
export declare function decodeVLQ(str: string, offset: number): [number, number];
export interface SourceMapSegment {
    generatedLine: number;
    generatedColumn: number;
    sourceIndex: number;
    originalLine: number;
    originalColumn: number;
    namesIndex?: number;
}
export declare function decodeSourceMapMappings(mappings: string): SourceMapSegment[];
export declare function encodeSourceMapMappings(segments: SourceMapSegment[]): string;
export declare function mergeSourceMaps(parent: import('./types').SourceMap, child: import('./types').SourceMap): import('./types').SourceMap;
export declare function generateSourceMap(generatedCode: string, originalCode: string, originalFile: string, generatedFile?: string): import('./types').SourceMap;
export declare function appendSourceMapUrl(code: string, mapFileName: string): string;
//# sourceMappingURL=sourcemap.d.ts.map