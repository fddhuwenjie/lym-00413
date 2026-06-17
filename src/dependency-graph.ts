import * as path from 'path';
import * as fs from 'fs';
import { ModuleInfo, BundlerConfig, ExportInfo } from './types';
import { createModuleInfo, resolveModulePath } from './parser';

export class DependencyGraph {
  modules: Map<string, ModuleInfo> = new Map();
  reverseDeps: Map<string, Set<string>> = new Map();
  entryIds: string[] = [];
  private idCounter = 0;

  constructor(private config: BundlerConfig) {}

  buildFromEntry(entryPath: string): void {
    const resolved = path.resolve(entryPath);
    this.entryIds = [this.getModuleId(resolved)];
    this.processModule(resolved, true);
  }

  private processModule(filePath: string, isEntry: boolean): void {
    const resolved = path.resolve(filePath);
    if (this.modules.has(resolved)) return;

    const code = fs.readFileSync(resolved, 'utf-8');
    const id = this.getModuleId(resolved);
    const moduleInfo = createModuleInfo(resolved, code, isEntry, id);
    this.modules.set(resolved, moduleInfo);

    if (!this.reverseDeps.has(resolved)) {
      this.reverseDeps.set(resolved, new Set());
    }

    const allSources = [
      ...moduleInfo.imports.map(i => i.source),
      ...moduleInfo.dynamicImports.map(d => d.source),
    ];

    for (const source of allSources) {
      const depPath = resolveModulePath(source, resolved);
      if (depPath && !this.modules.has(depPath)) {
        if (!this.reverseDeps.has(depPath)) {
          this.reverseDeps.set(depPath, new Set());
        }
        this.reverseDeps.get(depPath)!.add(resolved);
        this.processModule(depPath, false);
      }
    }
  }

  private getModuleId(filePath: string): string {
    const existing = Array.from(this.modules.entries()).find(([, m]) => m.path === filePath);
    if (existing) return existing[1].id;
    return `m${this.idCounter++}`;
  }

  getModules(): ModuleInfo[] {
    return Array.from(this.modules.values());
  }

  getModule(filePath: string): ModuleInfo | undefined {
    return this.modules.get(path.resolve(filePath));
  }

  getDependencies(filePath: string): string[] {
    const mod = this.modules.get(path.resolve(filePath));
    if (!mod) return [];
    return mod.dependencies
      .map(dep => resolveModulePath(dep, mod.path))
      .filter((p): p is string => p !== null);
  }

  getReverseDependencies(filePath: string): string[] {
    const deps = this.reverseDeps.get(path.resolve(filePath));
    return deps ? Array.from(deps) : [];
  }

  resolveReExports(): void {
    for (const [, mod] of this.modules) {
      for (const exp of mod.exports) {
        if ((exp.type === 're-export' || exp.type === 're-export-all') && exp.source) {
          const depPath = resolveModulePath(exp.source, mod.path);
          if (depPath) {
            const depMod = this.modules.get(depPath);
            if (depMod) {
              if (exp.type === 're-export-all') {
                for (const depExp of depMod.exports) {
                  if (depExp.type === 'named' && depExp.name !== 'default') {
                    mod.exports.push({
                      ...depExp,
                      type: 're-export',
                      source: exp.source,
                      imported: depExp.name,
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  getTopologicalOrder(): string[] {
    const visited = new Set<string>();
    const order: string[] = [];
    const visiting = new Set<string>();

    const visit = (filePath: string) => {
      const resolved = path.resolve(filePath);
      if (visited.has(resolved)) return;
      if (visiting.has(resolved)) return;

      visiting.add(resolved);
      const deps = this.getDependencies(resolved);
      for (const dep of deps) {
        visit(dep);
      }
      visiting.delete(resolved);
      visited.add(resolved);
      order.push(resolved);
    };

    for (const entryId of this.entryIds) {
      const entryMod = this.modules.get(entryId) || Array.from(this.modules.values()).find(m => m.isEntry);
      if (entryMod) visit(entryMod.path);
    }

    for (const [, mod] of this.modules) {
      visit(mod.path);
    }

    return order;
  }
}
