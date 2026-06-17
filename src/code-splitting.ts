import * as path from 'path';
import { ModuleInfo, ChunkInfo, SplitChunksConfig } from './types';
import { DependencyGraph } from './dependency-graph';
import { createHash } from 'crypto';

interface ChunkCandidate {
  modules: string[];
  refCount: number;
  totalSize: number;
  name: string;
}

export class CodeSplitter {
  private dynamicImportMap: Map<string, string[]> = new Map();
  private chunks: ChunkInfo[] = [];

  constructor(private config: SplitChunksConfig = {}) {}

  split(graph: DependencyGraph): ChunkInfo[] {
    const modules = graph.getModules();
    this.identifyDynamicChunks(graph);
    this.chunks = this.createChunks(graph);

    const splitConfig = {
      minChunks: this.config.minChunks ?? 2,
      minSize: this.config.minSize ?? 0,
      maxSize: this.config.maxSize ?? Infinity,
      name: this.config.name ?? 'vendors',
    };

    this.extractCommonChunks(graph, splitConfig);
    return this.chunks;
  }

  private identifyDynamicChunks(graph: DependencyGraph): void {
    const modules = graph.getModules();

    for (const mod of modules) {
      if (mod.dynamicImports.length > 0) {
        this.dynamicImportMap.set(
          mod.path,
          mod.dynamicImports.map(d => d.source)
        );
      }
    }
  }

  private createChunks(graph: DependencyGraph): ChunkInfo[] {
    const modules = graph.getModules();
    const chunks: ChunkInfo[] = [];
    const entryModules = new Set<string>();
    const dynamicModulePaths = new Set<string>();

    for (const entryId of graph.entryIds) {
      const entryMod = graph.getModule(entryId);
      if (entryMod) entryModules.add(entryMod.path);
    }

    const dynamicEntryModules = new Map<string, string[]>();

    for (const mod of modules) {
      for (const dynImport of mod.dynamicImports) {
        const depPath = this.resolveModulePath(dynImport.source, mod.path, graph);
        if (depPath) {
          dynamicModulePaths.add(depPath);
          if (!dynamicEntryModules.has(depPath)) {
            dynamicEntryModules.set(depPath, []);
          }
          dynamicEntryModules.get(depPath)!.push(mod.path);

          const transitiveDeps = this.getTransitiveDependencies(depPath, graph);
          for (const dep of transitiveDeps) {
            dynamicModulePaths.add(dep);
          }
        }
      }
    }

    const sharedModules = new Set<string>();
    const moduleRefCount = new Map<string, number>();

    for (const mod of modules) {
      const deps = graph.getDependencies(mod.path);
      for (const dep of deps) {
        moduleRefCount.set(dep, (moduleRefCount.get(dep) || 0) + 1);
      }
    }

    for (const [modPath, count] of moduleRefCount) {
      if (count >= 2 && dynamicModulePaths.has(modPath)) {
        sharedModules.add(modPath);
      }
    }

    const mainModules = modules.filter(
      m => !dynamicModulePaths.has(m.path) && !sharedModules.has(m.path)
    );

    if (mainModules.length > 0) {
      const mainCode = this.wrapChunk(
        mainModules,
        'main',
        graph
      );
      chunks.push({
        id: 'main',
        name: 'main',
        modules: mainModules.map(m => m.path),
        code: mainCode,
        hash: this.computeChunkHash(mainCode),
        isEntry: true,
        isDynamic: false,
        dependencies: [],
        size: mainCode.length,
      });
    }

    for (const [dynEntry, importers] of dynamicEntryModules) {
      const dynMod = graph.getModule(dynEntry);
      if (!dynMod) continue;

      const dynChunkModules = [dynEntry];
      const transitiveDeps = this.getTransitiveDependencies(dynEntry, graph);
      for (const dep of transitiveDeps) {
        if (!sharedModules.has(dep) && dynamicModulePaths.has(dep)) {
          dynChunkModules.push(dep);
        }
      }

      const uniqueModules = [...new Set(dynChunkModules)];
      const moduleInfos = uniqueModules
        .map(p => graph.getModule(p))
        .filter((m): m is ModuleInfo => m !== undefined);

      if (moduleInfos.length > 0) {
        const chunkName = `chunk_${path.basename(dynEntry, path.extname(dynEntry))}`;
        const chunkCode = this.wrapChunk(moduleInfos, chunkName, graph);

        chunks.push({
          id: chunkName,
          name: chunkName,
          modules: uniqueModules,
          code: chunkCode,
          hash: this.computeChunkHash(chunkCode),
          isEntry: false,
          isDynamic: true,
          dependencies: [],
          size: chunkCode.length,
        });
      }
    }

    return chunks;
  }

  private extractCommonChunks(
    graph: DependencyGraph,
    config: { minChunks: number; minSize: number; maxSize: number; name: string }
  ): void {
    const modules = graph.getModules();
    const moduleRefCount = new Map<string, number>();

    for (const mod of modules) {
      const deps = graph.getDependencies(mod.path);
      for (const dep of deps) {
        moduleRefCount.set(dep, (moduleRefCount.get(dep) || 0) + 1);
      }
    }

    const candidates: ChunkCandidate[] = [];
    for (const [modPath, count] of moduleRefCount) {
      if (count >= config.minChunks) {
        const mod = graph.getModule(modPath);
        if (mod && mod.code.length >= config.minSize) {
          candidates.push({
            modules: [modPath],
            refCount: count,
            totalSize: mod.code.length,
            name: config.name,
          });
        }
      }
    }

    if (candidates.length > 0) {
      const commonModulePaths = candidates.map(c => c.modules).flat();
      const commonModules = commonModulePaths
        .map(p => graph.getModule(p))
        .filter((m): m is ModuleInfo => m !== undefined);

      if (commonModules.length > 0) {
        const chunkCode = this.wrapChunk(commonModules, config.name, graph);
        this.chunks.push({
          id: config.name,
          name: config.name,
          modules: commonModulePaths,
          code: chunkCode,
          hash: this.computeChunkHash(chunkCode),
          isEntry: false,
          isDynamic: false,
          dependencies: [],
          size: chunkCode.length,
        });

        for (const chunk of this.chunks) {
          if (!chunk.isDynamic && chunk.name !== config.name) {
            const hasCommon = chunk.modules.some(m => commonModulePaths.includes(m));
            if (hasCommon) {
              chunk.modules = chunk.modules.filter(m => !commonModulePaths.includes(m));
              if (!chunk.dependencies.includes(config.name)) {
                chunk.dependencies.push(config.name);
              }
            }
          }
        }
      }
    }
  }

  private getTransitiveDependencies(modulePath: string, graph: DependencyGraph): string[] {
    const visited = new Set<string>();
    const result: string[] = [];

    const visit = (p: string) => {
      if (visited.has(p)) return;
      visited.add(p);
      const deps = graph.getDependencies(p);
      for (const dep of deps) {
        result.push(dep);
        visit(dep);
      }
    };

    visit(modulePath);
    return result;
  }

  private wrapChunk(modules: ModuleInfo[], chunkName: string, graph: DependencyGraph): string {
    const lines: string[] = [];
    lines.push(`// Chunk: ${chunkName}`);

    const moduleWrappers: string[] = [];

    for (const mod of modules) {
      let moduleCode = mod.code;

      if (mod.moduleType === 'cjs' || mod.moduleType === 'mixed') {
        moduleCode = this.wrapCjsModule(mod, graph);
      } else {
        moduleCode = this.wrapEsmModule(mod, graph);
      }

      const moduleId = this.getModuleIdForChunk(mod.path, graph);
      moduleWrappers.push(
        `${moduleId}: function(module, exports, __mini_require__) {\n${moduleCode}\n}`
      );
    }

    lines.push(`(function(__mini_modules__) {`);
    lines.push(`  var installedModules = {};`);
    lines.push(`  function __mini_require__(moduleId) {`);
    lines.push(`    if (installedModules[moduleId]) return installedModules[moduleId].exports;`);
    lines.push(`    var module = installedModules[moduleId] = { exports: {}, id: moduleId, loaded: false };`);
    lines.push(`    __mini_modules__[moduleId].call(module.exports, module, module.exports, __mini_require__);`);
    lines.push(`    module.loaded = true;`);
    lines.push(`    return module.exports;`);
    lines.push(`  }`);

    if (modules.some(m => m.isEntry)) {
      const entryMod = modules.find(m => m.isEntry);
      if (entryMod) {
        const entryId = this.getModuleIdForChunk(entryMod.path, graph);
        lines.push(`  __mini_require__(${entryId});`);
      }
    }

    lines.push(`  if (typeof window !== 'undefined') {`);
    lines.push(`    window.__mini_require__ = __mini_require__;`);
    lines.push(`  }`);
    lines.push(`})({`);
    lines.push(moduleWrappers.join(',\n'));
    lines.push(`});`);

    return lines.join('\n');
  }

  private wrapCjsModule(mod: ModuleInfo, graph: DependencyGraph): string {
    let code = mod.code;

    for (const imp of mod.imports) {
      const depPath = this.resolveModulePath(imp.source, mod.path, graph);
      if (depPath) {
        const depId = this.getModuleIdForChunk(depPath, graph);
        code = code.replace(
          new RegExp(`require\\(\\s*['"]${escapeRegex(imp.source)}['"]\\s*\\)`, 'g'),
          `__mini_require__(${depId})`
        );
      }
    }

    return code;
  }

  private wrapEsmModule(mod: ModuleInfo, graph: DependencyGraph): string {
    let code = mod.code;

    for (const imp of mod.imports) {
      const depPath = this.resolveModulePath(imp.source, mod.path, graph);
      if (depPath) {
        const depId = this.getModuleIdForChunk(depPath, graph);

        for (const spec of imp.specifiers) {
          if (spec.type === 'default') {
            code = code.replace(
              new RegExp(`import\\s+${escapeRegex(spec.local)}\\s+from\\s+['"]${escapeRegex(imp.source)}['"]`, 'g'),
              `var ${spec.local} = __mini_require__(${depId})["default"]`
            );
          } else if (spec.type === 'named') {
            code = code.replace(
              new RegExp(`import\\s+\\{[^}]*${escapeRegex(spec.local)}[^}]*\\}\\s+from\\s+['"]${escapeRegex(imp.source)}['"]`, 'g'),
              (match) => {
                return match.replace(
                  new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${escapeRegex(imp.source)}['"]`),
                  (_, imports) => {
                    const parts = imports.split(',').map((p: string) => p.trim());
                    const vars = parts.map((p: string) => {
                      const [imported, local] = p.split(/\s+as\s+/).map(s => s.trim());
                      return `var ${local || imported} = __mini_require__(${depId})["${imported}"]`;
                    });
                    return vars.join('; ');
                  }
                );
              }
            );
          } else if (spec.type === 'namespace') {
            code = code.replace(
              new RegExp(`import\\s+\\*\\s+as\\s+${escapeRegex(spec.local)}\\s+from\\s+['"]${escapeRegex(imp.source)}['"]`, 'g'),
              `var ${spec.local} = __mini_require__(${depId})`
            );
          }
        }
      }
    }

    const exportLines: string[] = [];
    for (const exp of mod.exports) {
      if (exp.type === 'named' && exp.local) {
        exportLines.push(`Object.defineProperty(exports, "${exp.name}", { enumerable: true, get: function() { return ${exp.local}; } });`);
      } else if (exp.type === 'default') {
        exportLines.push(`Object.defineProperty(exports, "default", { enumerable: true, value: ${exp.name === 'default' ? exp.local || 'undefined' : exp.name} });`);
      } else if (exp.type === 're-export' && exp.source) {
        const depPath = this.resolveModulePath(exp.source, mod.path, graph);
        if (depPath) {
          const depId = this.getModuleIdForChunk(depPath, graph);
          exportLines.push(`Object.defineProperty(exports, "${exp.name}", { enumerable: true, get: function() { return __mini_require__(${depId})["${exp.imported}"]; } });`);
        }
      } else if (exp.type === 're-export-all' && exp.source) {
        const depPath = this.resolveModulePath(exp.source, mod.path, graph);
        if (depPath) {
          const depId = this.getModuleIdForChunk(depPath, graph);
          exportLines.push(`Object.assign(exports, __mini_require__(${depId}));`);
        }
      }
    }

    if (exportLines.length > 0) {
      code += '\n' + exportLines.join('\n');
    }

    code = code.replace(/import\s+.*?from\s+['"].*?['"];?\s*/g, '');
    code = code.replace(/export\s+default\s+/g, '');
    code = code.replace(/export\s+\{[^}]*\}\s*;?\s*/g, '');
    code = code.replace(/export\s+(function|const|let|var|class)\s+/g, '$1 ');
    code = code.replace(/export\s+\*\s+from\s+['"].*?['"];?\s*/g, '');

    return code;
  }

  private getModuleIdForChunk(modulePath: string, graph: DependencyGraph): number {
    const mod = graph.getModule(modulePath);
    if (mod) return parseInt(mod.id.replace('m', ''), 10) || 0;
    return 0;
  }

  private resolveModulePath(source: string, fromPath: string, graph: DependencyGraph): string | null {
    for (const [, mod] of (graph as any).modules as Map<string, ModuleInfo>) {
      if (mod.path === source) return mod.path;
    }
    const deps = graph.getDependencies(fromPath);
    for (const dep of deps) {
      const depMod = graph.getModule(dep);
      if (depMod) {
        const rel = path.relative(path.dirname(fromPath), depMod.path).replace(/\\/g, '/');
        if (rel === source || './' + rel === source) return dep;
      }
    }
    return null;
  }

  private computeChunkHash(code: string): string {
    return createHash('md5').update(code).digest('hex').slice(0, 8);
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
