"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoaderRunner = void 0;
exports.createBabelLoader = createBabelLoader;
exports.createCssLoader = createCssLoader;
exports.createLoaderPipeline = createLoaderPipeline;
class LoaderRunner {
    constructor(loaderConfigs) {
        this.loaders = new Map();
        this.loaderConfigs = loaderConfigs;
        for (const config of loaderConfigs) {
            if (typeof config.use === 'string') {
                const loaderFn = this.resolveLoader(config.use, config.options);
                if (loaderFn) {
                    this.loaders.set(config.use, loaderFn);
                }
            }
            else if (Array.isArray(config.use)) {
                for (const fn of config.use) {
                    this.loaders.set(fn.name || 'anonymous', fn);
                }
            }
        }
    }
    async process(code, filePath, meta) {
        const applicableLoaders = this.getApplicableLoaders(filePath);
        let result = { code, map: null };
        let currentCode = code;
        let currentMap = null;
        for (const loader of applicableLoaders) {
            try {
                result = await Promise.resolve(loader(currentCode, currentMap, { ...meta, path: filePath }));
                currentCode = result.code;
                if (result.map)
                    currentMap = result.map;
            }
            catch (error) {
                console.error(`Loader error for ${filePath}: ${error.message}`);
            }
        }
        return { code: currentCode, map: currentMap };
    }
    getApplicableLoaders(filePath) {
        const loaders = [];
        for (const config of this.loaderConfigs) {
            if (config.test.test(filePath)) {
                if (typeof config.use === 'string') {
                    const fn = this.loaders.get(config.use);
                    if (fn)
                        loaders.push(fn);
                }
                else if (Array.isArray(config.use)) {
                    loaders.push(...config.use);
                }
            }
        }
        return loaders;
    }
    resolveLoader(name, options) {
        switch (name) {
            case 'babel-loader':
                return createBabelLoader(options);
            case 'css-loader':
                return createCssLoader(options);
            default:
                return null;
        }
    }
}
exports.LoaderRunner = LoaderRunner;
function createBabelLoader(options) {
    const loader = (code, _map, meta) => {
        let result = code;
        result = result.replace(/\bconst\s+(\w[\w$]*)\s*=\s*/g, 'var $1 = ');
        result = result.replace(/\blet\s+(\w[\w$]*)\s*=\s*/g, 'var $1 = ');
        result = result.replace(/\blet\s+(\w[\w$]*);/g, 'var $1;');
        result = result.replace(/\bfor\s*\(\s*const\s+(\w[\w$]*)\s+of\s+/g, 'for (var $1 of ');
        result = result.replace(/\bfor\s*\(\s*let\s+(\w[\w$]*)\s+of\s+/g, 'for (var $1 of ');
        result = result.replace(/(\w[\w$]*)\?\.\s*(\w[\w$]*)/g, '($1 != null ? $1.$2 : undefined)');
        return { code: result, map: null };
    };
    Object.defineProperty(loader, 'name', { value: 'babel-loader' });
    return loader;
}
function createCssLoader(options) {
    const cssOutputMode = options?.outputMode || 'extract';
    const loader = (code, _map, meta) => {
        const cssFileName = meta.path.replace(/\.\w+$/, '.css');
        if (cssOutputMode === 'inject') {
            const escapedCss = code
                .replace(/\\/g, '\\\\')
                .replace(/`/g, '\\`')
                .replace(/\$/g, '\\$');
            const injectedCode = `
(function() {
  var style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = \`${escapedCss}\`;
  document.head.appendChild(style);
})();
`;
            return { code: injectedCode, map: null };
        }
        const moduleExports = `
var css = ${JSON.stringify(code)};
if (typeof document !== 'undefined') {
  var style = document.createElement('style');
  style.type = 'text/css';
  style.textContent = css;
  document.head.appendChild(style);
}
module.exports = css;
`;
        return { code: moduleExports, map: null };
    };
    Object.defineProperty(loader, 'name', { value: 'css-loader' });
    return loader;
}
function createLoaderPipeline(loaderConfigs) {
    return new LoaderRunner(loaderConfigs);
}
//# sourceMappingURL=loader.js.map