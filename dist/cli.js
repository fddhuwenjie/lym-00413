#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const bundler_1 = require("./bundler");
function parseArgs(args) {
    const parsed = {
        entry: null,
        output: './dist',
        format: 'iife',
        sourceMap: true,
        treeShaking: true,
        hmr: false,
        hmrPort: 8081,
        watch: false,
        cache: true,
        minify: false,
    };
    for (let i = 2; i < args.length; i++) {
        const arg = args[i];
        switch (arg) {
            case '--entry':
            case '-e':
                parsed.entry = args[++i];
                break;
            case '--output':
            case '-o':
                parsed.output = args[++i];
                break;
            case '--format':
            case '-f':
                parsed.format = args[++i];
                break;
            case '--no-sourcemap':
                parsed.sourceMap = false;
                break;
            case '--no-tree-shaking':
                parsed.treeShaking = false;
                break;
            case '--hmr':
                parsed.hmr = true;
                break;
            case '--hmr-port':
                parsed.hmrPort = parseInt(args[++i], 10);
                break;
            case '--watch':
            case '-w':
                parsed.watch = true;
                parsed.hmr = true;
                break;
            case '--no-cache':
                parsed.cache = false;
                break;
            case '--minify':
            case '-m':
                parsed.minify = true;
                break;
            case '--config':
                const configPath = args[++i];
                if (fs.existsSync(configPath)) {
                    const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    Object.assign(parsed, configData);
                }
                break;
            case '--help':
            case '-h':
                printHelp();
                process.exit(0);
            default:
                if (!arg.startsWith('-') && !parsed.entry) {
                    parsed.entry = arg;
                }
        }
    }
    return parsed;
}
function printHelp() {
    console.log(`
mini-bundler - A JS/TS module bundler

Usage:
  mini-bundler <entry> [options]

Options:
  --entry, -e <path>       Entry file path
  --output, -o <path>      Output directory (default: ./dist)
  --format, -f <format>    Output format: iife | esm (default: iife)
  --no-sourcemap           Disable source map generation
  --no-tree-shaking        Disable tree shaking
  --hmr                    Enable HMR
  --hmr-port <port>        HMR WebSocket port (default: 8081)
  --watch, -w              Watch mode (enables HMR)
  --no-cache               Disable build cache
  --minify, -m             Enable minification
  --config <path>          Path to config file
  --help, -h               Show this help
`);
}
async function main() {
    const args = parseArgs(process.argv);
    if (!args.entry) {
        console.error('Error: Entry file is required. Use --entry <path>');
        process.exit(1);
    }
    const entryPath = path.resolve(args.entry);
    if (!fs.existsSync(entryPath)) {
        console.error(`Error: Entry file not found: ${entryPath}`);
        process.exit(1);
    }
    const loaders = [];
    if (args.entry.endsWith('.js') || args.entry.endsWith('.ts')) {
        loaders.push({
            test: /\.(js|ts|jsx|tsx)$/,
            use: 'babel-loader',
        });
    }
    loaders.push({
        test: /\.css$/,
        use: 'css-loader',
    });
    const config = {
        entry: entryPath,
        output: path.resolve(args.output),
        format: args.format,
        sourceMap: args.sourceMap,
        minify: args.minify,
        treeShaking: args.treeShaking,
        hmr: args.hmr,
        hmrPort: args.hmrPort,
        cache: args.cache,
        loaders,
        splitChunks: {
            minChunks: 2,
            minSize: 0,
            name: 'vendors',
        },
    };
    const bundler = new bundler_1.Bundler(config);
    if (args.watch) {
        console.log('Starting in watch mode with HMR...');
        await bundler.watch();
        process.on('SIGINT', async () => {
            console.log('\nShutting down...');
            await bundler.stop();
            process.exit(0);
        });
    }
    else {
        console.log('Building...');
        const result = await bundler.build();
        printBuildResult(result);
    }
}
function printBuildResult(result) {
    console.log('\n===== Build Result =====');
    console.log(`Duration: ${result.duration}ms`);
    console.log(`Modules: ${result.modulesCount}`);
    console.log(`Chunks: ${result.chunks.length}`);
    console.log(`Tree-shaken exports: ${result.treeShakenExports}`);
    console.log(`Cache hits: ${result.cacheHits}`);
    console.log('\nChunks:');
    for (const chunk of result.chunks) {
        console.log(`  - ${chunk.name} (${chunk.isEntry ? 'entry' : chunk.isDynamic ? 'dynamic' : 'common'}): ${chunk.size} bytes, ${chunk.modules.length} modules`);
    }
    console.log('========================\n');
}
main().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map