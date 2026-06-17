import { LoaderConfig, LoaderFunction, LoaderMeta, LoaderResult, SourceMap } from './types';

export class LoaderRunner {
  private loaders: Map<string, LoaderFunction> = new Map();

  constructor(loaderConfigs: LoaderConfig[]) {
    for (const config of loaderConfigs) {
      if (typeof config.use === 'string') {
        const loaderFn = this.resolveLoader(config.use, config.options);
        if (loaderFn) {
          this.loaders.set(config.use, loaderFn);
        }
      } else if (Array.isArray(config.use)) {
        for (const fn of config.use) {
          this.loaders.set(fn.name || 'anonymous', fn);
        }
      }
    }
  }

  async process(code: string, filePath: string, meta: LoaderMeta): Promise<LoaderResult> {
    const applicableLoaders = this.getApplicableLoaders(filePath);

    let result: LoaderResult = { code, map: null };
    let currentCode = code;
    let currentMap: SourceMap | null = null;

    for (const loader of applicableLoaders) {
      try {
        result = await Promise.resolve(
          loader(currentCode, currentMap, { ...meta, path: filePath })
        );
        currentCode = result.code;
        if (result.map) currentMap = result.map;
      } catch (error: any) {
        console.error(`Loader error for ${filePath}: ${error.message}`);
      }
    }

    return { code: currentCode, map: currentMap };
  }

  private getApplicableLoaders(filePath: string): LoaderFunction[] {
    const loaders: LoaderFunction[] = [];

    for (const config of this.loaderConfigs) {
      if (config.test.test(filePath)) {
        if (typeof config.use === 'string') {
          const fn = this.loaders.get(config.use);
          if (fn) loaders.push(fn);
        } else if (Array.isArray(config.use)) {
          loaders.push(...config.use);
        }
      }
    }

    return loaders;
  }

  private resolveLoader(name: string, options?: Record<string, any>): LoaderFunction | null {
    switch (name) {
      case 'babel-loader':
        return createBabelLoader(options);
      case 'css-loader':
        return createCssLoader(options);
      default:
        return null;
    }
  }

  private loaderConfigs: LoaderConfig[] = [];
}

export function createBabelLoader(options?: Record<string, any>): LoaderFunction {
  const loader: LoaderFunction = (code: string, _map: SourceMap | null, meta: LoaderMeta) => {
    let result = code;

    result = result.replace(
      /const\s+(\w+)\s*=\s*\(/g,
      'var $1 = ('
    );
    result = result.replace(
      /const\s+(\w+)\s*=\s*([^;]+);/g,
      'var $1 = $2;'
    );
    result = result.replace(
      /let\s+(\w+)\s*=\s*([^;]+);/g,
      'var $1 = $2;'
    );
    result = result.replace(
      /let\s+(\w+);/g,
      'var $1;'
    );

    result = result.replace(
      /\(\s*\)\s*=>\s*\{/g,
      'function() {'
    );
    result = result.replace(
      /\((\w+(?:\s*,\s*\w+)*)\)\s*=>\s*\{/g,
      'function($1) {'
    );
    result = result.replace(
      /\(\s*\)\s*=>\s*([^{\n]+);/g,
      'function() { return $1; }'
    );
    result = result.replace(
      /\((\w+(?:\s*,\s*\w+)*)\)\s*=>\s*([^{\n]+);/g,
      'function($1) { return $2; }'
    );

    result = result.replace(
      /`([^`]*)`/g,
      (_, content) => {
        const escaped = content
          .replace(/\\/g, '\\\\')
          .replace(/'/g, "\\'")
          .replace(/\n/g, '\\n')
          .replace(/\r/g, '\\r')
          .replace(/\t/g, '\\t');
        return `'${escaped}'`;
      }
    );

    result = result.replace(
      /(\w+)\?\.\s*(\w+)/g,
      '($1 != null ? $1.$2 : undefined)'
    );

    result = result.replace(
      /for\s*\(\s*const\s+(\w+)\s+of\s+/g,
      'for (var $1 of '
    );
    result = result.replace(
      /for\s*\(\s*let\s+(\w+)\s+of\s+/g,
      'for (var $1 of '
    );

    result = result.replace(
      /class\s+(\w+)\s+\{[\s\S]*?\}/g,
      (match) => {
        return `/* class converted to function */\n${match}`;
      }
    );

    result = result.replace(
      /(\w+)\s*\?\s*([^:]+)\s*:\s*(.+)/g,
      '(($1) ? $2 : $3)'
    );

    return { code: result, map: null };
  };

  Object.defineProperty(loader, 'name', { value: 'babel-loader' });
  return loader;
}

export function createCssLoader(options?: Record<string, any>): LoaderFunction {
  const cssOutputMode = options?.outputMode || 'extract';

  const loader: LoaderFunction = (code: string, _map: SourceMap | null, meta: LoaderMeta) => {
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

export function createLoaderPipeline(loaderConfigs: LoaderConfig[]): LoaderRunner {
  return new LoaderRunner(loaderConfigs);
}
