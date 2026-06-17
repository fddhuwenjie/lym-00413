export declare class HMRServer {
    private wss;
    private server;
    private clients;
    private port;
    constructor(port?: number);
    start(): Promise<void>;
    broadcastUpdate(modules: string[], hash?: string): void;
    broadcastFullReload(): void;
    getClientInjectionScript(): string;
    getHMRClientCode(): string;
    stop(): void;
}
export declare function injectHMRRuntime(bundleCode: string, hmrPort: number): string;
//# sourceMappingURL=hmr.d.ts.map