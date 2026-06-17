import * as path from 'path';
import * as fs from 'fs';
import { ModuleInfo, BundlerConfig } from './types';
import { DependencyGraph } from './dependency-graph';
import { resolveModulePath } from './parser';

interface SideEffectsConfig {
  [pkgPath: string]: boolean | string[];
}

export class TreeShaker {
  private usedExports: Map<string, Set<string>> = new Map();
  private sideEffectsCache: Map<string, boolean> = new Map();

  constructor(private config: BundlerConfig) {}

  shake(graph: DependencyGraph): void {
    this.markUsedExports(graph);
    this.markSideEffectFreeModules(graph);
    this.eliminateDeadCode(graph);
  }

  private markUsedExports(graph: DependencyGraph): void {
    for (const entryId of graph.entryIds) {
      const entryMod = graph.getModule(entryId);
      if (entryMod) {
        for (const exp of entryMod.exports) {
          this.markUsed(entryMod.path, exp.name);
        }
      }
    }

    const modules = graph.getModules();
    let changed = true;
    let iterations = 0;
    const maxIterations = modules.length * 2;

    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;

      for (const mod of modules) {
        for (const imp of mod.imports) {
          const depPath = this.resolvePath(imp.source, mod.path, graph);
          if (!depPath) continue;

          for (const spec of imp.specifiers) {
            if (spec.type === 'namespace') {
              const depMod = graph.getModule(depPath);
              if (depMod) {
                for (const exp of depMod.exports) {
                  if (this.markUsed(depPath, exp.name)) changed = true;
                }
              }
            } else if (spec.type === 'named') {
              if (this.markUsed(depPath, spec.imported)) changed = true;
            } else if (spec.type === 'default') {
              if (this.markUsed(depPath, 'default')) changed = true;
            } else if (spec.type === 'side-effect') {
              const depMod = graph.getModule(depPath);
              if (depMod) {
                for (const exp of depMod.exports) {
                  if (this.markUsed(depPath, exp.name)) changed = true;
                }
              }
            }
          }
        }

        for (const dynImp of mod.dynamicImports) {
          const depPath = this.resolvePath(dynImp.source, mod.path, graph);
          if (depPath) {
            const depMod = graph.getModule(depPath);
            if (depMod) {
              for (const exp of depMod.exports) {
                if (this.markUsed(depPath, exp.name)) changed = true;
              }
            }
          }
        }
      }
    }

    for (const mod of modules) {
      const used = this.usedExports.get(mod.path) || new Set();
      for (const exp of mod.exports) {
        if (used.has(exp.name) || exp.type === 're-export' || exp.type === 're-export-all') {
          exp.used = true;
        }
      }
    }
  }

  private markUsed(modulePath: string, name: string): boolean {
    if (!this.usedExports.has(modulePath)) {
      this.usedExports.set(modulePath, new Set());
    }
    const used = this.usedExports.get(modulePath)!;
    if (!used.has(name)) {
      used.add(name);
      return true;
    }
    return false;
  }

  private markSideEffectFreeModules(graph: DependencyGraph): void {
    const modules = graph.getModules();

    for (const mod of modules) {
      if (this.isSideEffectFree(mod, graph)) {
        mod.sideEffects = false;
      }
    }
  }

  private isSideEffectFree(mod: ModuleInfo, graph: DependencyGraph): boolean {
    if (this.config.sideEffects === false) return true;
    if (Array.isArray(this.config.sideEffects)) {
      const relPath = path.relative(process.cwd(), mod.path);
      const matches = this.config.sideEffects.some(pattern => {
        if (typeof pattern === 'string') {
          const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
          return regex.test(relPath);
        }
        return false;
      });
      if (matches) return true;
    }

    const pkgSideEffects = this.checkPackageJsonSideEffects(mod.path);
    if (pkgSideEffects === false) return true;
    if (Array.isArray(pkgSideEffects)) {
      const relPath = path.relative(this.getPackageRoot(mod.path), mod.path);
      const matches = (pkgSideEffects as string[]).some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(relPath);
      });
      if (matches) return true;
    }

    return false;
  }

  private checkPackageJsonSideEffects(filePath: string): boolean | string[] | null {
    const dir = path.dirname(filePath);
    const pkgPath = path.join(dir, 'package.json');

    if (this.sideEffectsCache.has(pkgPath)) {
      return this.sideEffectsCache.get(pkgPath)! ? true : false;
    }

    let currentDir = dir;
    const root = path.parse(dir).root;

    while (currentDir !== root) {
      const pkgJsonPath = path.join(currentDir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
          if ('sideEffects' in pkg) {
            const val = pkg.sideEffects;
            this.sideEffectsCache.set(pkgJsonPath, val !== false);
            return val;
          }
        } catch {}
      }
      currentDir = path.dirname(currentDir);
    }

    return null;
  }

  private getPackageRoot(filePath: string): string {
    let dir = path.dirname(filePath);
    const root = path.parse(dir).root;
    while (dir !== root) {
      if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
      dir = path.dirname(dir);
    }
    return process.cwd();
  }

  private eliminateDeadCode(graph: DependencyGraph): void {
    const modules = graph.getModules();

    for (const mod of modules) {
      const used = this.usedExports.get(mod.path) || new Set();

      if (!mod.sideEffects && used.size === 0 && !mod.isEntry) {
        mod.code = this.generateEmptyModule(mod);
        continue;
      }

      if (mod.moduleType === 'esm' || mod.moduleType === 'mixed') {
        mod.code = this.removeUnusedExports(mod, used);
        mod.code = this.removeUnusedDeclarations(mod, used);
      }
    }
  }

  private removeUnusedDeclarations(mod: ModuleInfo, usedExports: Set<string>): string {
    if (mod.sideEffects) return mod.code;

    let result = mod.code;
    const unusedNames = new Set<string>();

    for (const exp of mod.exports) {
      if (!exp.used && exp.type === 'named' && exp.local) {
        unusedNames.add(exp.local);
      }
    }

    if (unusedNames.size === 0) return result;

    for (const name of unusedNames) {
      const exportFuncPattern = new RegExp(
        `export\\s+function\\s+${escapeRegExp(name)}\\s*\\([^)]*\\)\\s*\\{`,
        'g'
      );
      let match;
      while ((match = exportFuncPattern.exec(result)) !== null) {
        const start = match.index;
        const bodyStart = result.indexOf('{', start);
        const bodyEnd = this.findMatchingBrace(result, bodyStart);
        if (bodyEnd !== -1) {
          const endOfLine = result.indexOf('\n', bodyEnd + 1);
          const cutEnd = endOfLine !== -1 ? endOfLine + 1 : bodyEnd + 1;
          result = result.slice(0, start) + result.slice(cutEnd);
          exportFuncPattern.lastIndex = 0;
        }
      }

      const funcPattern = new RegExp(
        `function\\s+${escapeRegExp(name)}\\s*\\([^)]*\\)\\s*\\{`,
        'g'
      );
      while ((match = funcPattern.exec(result)) !== null) {
        const start = match.index;
        const bodyStart = result.indexOf('{', start);
        const bodyEnd = this.findMatchingBrace(result, bodyStart);
        if (bodyEnd !== -1) {
          const endOfLine = result.indexOf('\n', bodyEnd + 1);
          const cutEnd = endOfLine !== -1 ? endOfLine + 1 : bodyEnd + 1;
          result = result.slice(0, start) + result.slice(cutEnd);
          funcPattern.lastIndex = 0;
        }
      }

      const constPattern = new RegExp(
        `export\\s+(const|let|var)\\s+${escapeRegExp(name)}\\s*=[^;]*;\\s*`,
        'g'
      );
      result = result.replace(constPattern, '');

      const constPattern2 = new RegExp(
        `(const|let|var)\\s+${escapeRegExp(name)}\\s*=[^;]*;\\s*`,
        'g'
      );
      result = result.replace(constPattern2, '');

      const classPattern = new RegExp(
        `export\\s+class\\s+${escapeRegExp(name)}\\s*\\{`,
        'g'
      );
      while ((match = classPattern.exec(result)) !== null) {
        const start = match.index;
        const bodyStart = result.indexOf('{', start);
        const bodyEnd = this.findMatchingBrace(result, bodyStart);
        if (bodyEnd !== -1) {
          const endOfLine = result.indexOf('\n', bodyEnd + 1);
          const cutEnd = endOfLine !== -1 ? endOfLine + 1 : bodyEnd + 1;
          result = result.slice(0, start) + result.slice(cutEnd);
          classPattern.lastIndex = 0;
        }
      }

      const classPattern2 = new RegExp(
        `class\\s+${escapeRegExp(name)}\\s*\\{`,
        'g'
      );
      while ((match = classPattern2.exec(result)) !== null) {
        const start = match.index;
        const bodyStart = result.indexOf('{', start);
        const bodyEnd = this.findMatchingBrace(result, bodyStart);
        if (bodyEnd !== -1) {
          const endOfLine = result.indexOf('\n', bodyEnd + 1);
          const cutEnd = endOfLine !== -1 ? endOfLine + 1 : bodyEnd + 1;
          result = result.slice(0, start) + result.slice(cutEnd);
          classPattern2.lastIndex = 0;
        }
      }
    }

    return result;
  }

  private findMatchingBrace(code: string, openBraceIndex: number): number {
    let depth = 0;
    let inString: string | null = null;
    let escape = false;

    for (let i = openBraceIndex; i < code.length; i++) {
      const ch = code[i];

      if (escape) {
        escape = false;
        continue;
      }

      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }

      if (inString) {
        if (ch === inString) inString = null;
        continue;
      }

      if (ch === '"' || ch === "'" || ch === '`') {
        inString = ch;
        continue;
      }

      if (ch === '{') depth++;
      if (ch === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }

    return -1;
  }

  private removeUnusedExports(mod: ModuleInfo, usedExports: Set<string>): string {
    let code = mod.code;

    for (const exp of mod.exports) {
      if (exp.used || exp.type === 're-export' || exp.type === 're-export-all') continue;

      if (exp.type === 'named' && exp.start !== undefined && exp.end !== undefined) {
        const snippet = code.slice(exp.start, Math.min(exp.end, code.length));
        if (snippet.trim().startsWith('export {')) {
          code = code.slice(0, exp.start) + code.slice(Math.min(exp.end, code.length));
        }
      }
    }

    return code;
  }

  private generateEmptyModule(mod: ModuleInfo): string {
    if (mod.moduleType === 'cjs') {
      return 'module.exports = {};';
    }
    return '';
  }

  private resolvePath(source: string, fromPath: string, graph: DependencyGraph): string | null {
    return resolveModulePath(source, fromPath);
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
