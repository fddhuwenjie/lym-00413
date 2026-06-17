import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
import * as path from 'path';
import * as fs from 'fs';
import {
  ModuleInfo,
  ImportInfo,
  ExportInfo,
  DynamicImportInfo,
  ImportSpecifier,
} from './types';

interface ParseResult {
  imports: ImportInfo[];
  exports: ExportInfo[];
  dynamicImports: DynamicImportInfo[];
  moduleType: 'esm' | 'cjs' | 'mixed';
}

export function parseModule(code: string, filePath: string): ParseResult {
  const imports: ImportInfo[] = [];
  const exports: ExportInfo[] = [];
  const dynamicImports: DynamicImportInfo[] = [];
  let hasEsm = false;
  let hasCjs = false;

  try {
    const ast = acorn.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      locations: true,
      allowAwaitOutsideFunction: true,
      allowImportExportEverywhere: true,
    }) as any;

    walk.simple(ast, {
      ImportDeclaration(node: any) {
        hasEsm = true;
        const source = node.source.value;
        const specifiers: ImportSpecifier[] = [];

        if (node.specifiers && node.specifiers.length > 0) {
          for (const spec of node.specifiers) {
            if (spec.type === 'ImportDefaultSpecifier') {
              specifiers.push({
                type: 'default',
                imported: 'default',
                local: spec.local.name,
              });
            } else if (spec.type === 'ImportNamespaceSpecifier') {
              specifiers.push({
                type: 'namespace',
                imported: '*',
                local: spec.local.name,
              });
            } else if (spec.type === 'ImportSpecifier') {
              specifiers.push({
                type: 'named',
                imported: spec.imported.name || spec.imported.value,
                local: spec.local.name,
              });
            }
          }
        } else {
          specifiers.push({ type: 'side-effect', imported: '*', local: '' });
        }

        imports.push({
          source,
          specifiers,
          isDynamic: false,
          start: node.start,
          end: node.end,
        });
      },

      ExportNamedDeclaration(node: any) {
        hasEsm = true;
        if (node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration') {
            exports.push({
              type: 'named',
              name: node.declaration.id?.name || '',
              local: node.declaration.id?.name || '',
              start: node.start,
              end: node.end,
              used: false,
            });
          } else if (node.declaration.type === 'VariableDeclaration') {
            for (const decl of node.declaration.declarations) {
              if (decl.id.type === 'Identifier') {
                exports.push({
                  type: 'named',
                  name: decl.id.name,
                  local: decl.id.name,
                  start: node.start,
                  end: node.end,
                  used: false,
                });
              } else if (decl.id.type === 'ObjectPattern') {
                for (const prop of decl.id.properties) {
                  if (prop.type === 'Property' && prop.value.type === 'Identifier') {
                    exports.push({
                      type: 'named',
                      name: prop.value.name,
                      local: prop.value.name,
                      start: node.start,
                      end: node.end,
                      used: false,
                    });
                  }
                }
              }
            }
          }
        } else if (node.source) {
          if (node.specifiers && node.specifiers.length > 0) {
            for (const spec of node.specifiers) {
              if (spec.type === 'ExportSpecifier') {
                exports.push({
                  type: 're-export',
                  name: spec.exported.name || spec.exported.value,
                  source: node.source.value,
                  imported: spec.local.name || spec.local.value,
                  start: node.start,
                  end: node.end,
                  used: false,
                });
              }
            }
          } else {
            exports.push({
              type: 're-export-all',
              name: '*',
              source: node.source.value,
              start: node.start,
              end: node.end,
              used: false,
            });
          }
        } else if (node.specifiers) {
          for (const spec of node.specifiers) {
            if (spec.type === 'ExportSpecifier') {
              exports.push({
                type: 'named',
                name: spec.exported.name || spec.exported.value,
                local: spec.local.name || spec.local.value,
                start: node.start,
                end: node.end,
                used: false,
              });
            }
          }
        }
      },

      ExportDefaultDeclaration(node: any) {
        hasEsm = true;
        exports.push({
          type: 'default',
          name: 'default',
          start: node.start,
          end: node.end,
          used: false,
        });
      },

      ExportAllDeclaration(node: any) {
        hasEsm = true;
        exports.push({
          type: 're-export-all',
          name: '*',
          source: node.source.value,
          start: node.start,
          end: node.end,
          used: false,
        });
      },

      CallExpression(node: any) {
        if (
          node.callee.type === 'Identifier' &&
          node.callee.name === 'require'
        ) {
          hasCjs = true;
          if (node.arguments[0]?.type === 'Literal') {
            const source = node.arguments[0].value;
            imports.push({
              source,
              specifiers: [{ type: 'namespace', imported: '*', local: `__cjs_${source}__` }],
              isDynamic: false,
              start: node.start,
              end: node.end,
            });
          }
        }
      },

      MemberExpression(node: any) {
        if (
          node.object?.type === 'Identifier' &&
          node.object.name === 'exports' &&
          node.property?.type === 'Identifier'
        ) {
          hasCjs = true;
          exports.push({
            type: 'named',
            name: node.property.name,
            local: node.property.name,
            start: node.start,
            end: node.end,
            used: false,
          });
        }
      },

      AssignmentExpression(node: any) {
        if (
          node.left.type === 'MemberExpression' &&
          node.left.object?.type === 'Identifier' &&
          node.left.object.name === 'module' &&
          node.left.property?.type === 'Identifier' &&
          node.left.property.name === 'exports'
        ) {
          hasCjs = true;
          exports.push({
            type: 'default',
            name: 'default',
            start: node.start,
            end: node.end,
            used: false,
          });
        } else if (
          node.left.type === 'MemberExpression' &&
          node.left.object?.type === 'Identifier' &&
          node.left.object.name === 'exports'
        ) {
          hasCjs = true;
          const prop = node.left.property;
          const name = prop.type === 'Identifier' ? prop.name : prop.value;
          exports.push({
            type: 'named',
            name: name || 'default',
            local: name || 'default',
            start: node.start,
            end: node.end,
            used: false,
          });
        }
      },

      ImportExpression(node: any) {
        hasEsm = true;
        if (node.source?.type === 'Literal') {
          dynamicImports.push({
            source: node.source.value,
            start: node.start,
            end: node.end,
          });
        }
      },
    });
  } catch (e: any) {
    try {
      const cjsAst = acorn.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'script',
        locations: true,
        allowAwaitOutsideFunction: true,
      }) as any;

      hasCjs = true;
      hasEsm = false;

      walk.simple(cjsAst, {
        CallExpression(node: any) {
          if (
            node.callee.type === 'Identifier' &&
            node.callee.name === 'require' &&
            node.arguments[0]?.type === 'Literal'
          ) {
            const source = node.arguments[0].value;
            imports.push({
              source,
              specifiers: [{ type: 'namespace', imported: '*', local: `__cjs_${source}__` }],
              isDynamic: false,
              start: node.start,
              end: node.end,
            });
          }
        },
        AssignmentExpression(node: any) {
          if (
            node.left.type === 'MemberExpression' &&
            node.left.object?.type === 'Identifier'
          ) {
            if (node.left.object.name === 'module' && node.left.property?.name === 'exports') {
              exports.push({
                type: 'default',
                name: 'default',
                start: node.start,
                end: node.end,
                used: false,
              });
            } else if (node.left.object.name === 'exports') {
              const prop = node.left.property;
              const name = prop.type === 'Identifier' ? prop.name : prop.value;
              exports.push({
                type: 'named',
                name: name || 'default',
                local: name || 'default',
                start: node.start,
                end: node.end,
                used: false,
              });
            }
          }
        },
      });
    } catch {
      return { imports: [], exports: [], dynamicImports: [], moduleType: 'esm' as const };
    }
  }

  let moduleType: 'esm' | 'cjs' | 'mixed' = 'esm';
  if (hasEsm && hasCjs) moduleType = 'mixed';
  else if (hasCjs) moduleType = 'cjs';

  return { imports, exports, dynamicImports, moduleType };
}

export function createModuleInfo(
  filePath: string,
  code: string,
  isEntry: boolean,
  id: string
): ModuleInfo {
  const { imports, exports, dynamicImports, moduleType } = parseModule(code, filePath);

  const cjsWrap = moduleType === 'cjs' || moduleType === 'mixed';

  return {
    id,
    path: filePath,
    code,
    originalCode: code,
    isEntry,
    moduleType,
    imports,
    exports,
    dynamicImports,
    sideEffects: true,
    hash: computeHash(code),
    dependencies: [
      ...imports.map(i => i.source),
      ...dynamicImports.map(d => d.source),
    ],
    sourceMap: undefined,
  };
}

function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const chr = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

export function resolveModulePath(source: string, fromPath: string): string | null {
  const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '/index.js', '/index.ts'];
  const dir = path.dirname(fromPath);

  if (path.isAbsolute(source)) {
    if (fs.existsSync(source)) return path.resolve(source);
    for (const ext of extensions) {
      const p = source + ext;
      if (fs.existsSync(p)) return path.resolve(p);
    }
    return null;
  }

  if (source.startsWith('.')) {
    const fullPath = path.resolve(dir, source);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) return fullPath;
    for (const ext of extensions) {
      const p = fullPath + ext;
      if (fs.existsSync(p)) return p;
      if (ext.startsWith('/')) {
        const indexPath = fullPath + ext;
        if (fs.existsSync(indexPath)) return indexPath;
      }
    }
    return null;
  }

  try {
    const modPath = require.resolve(source, { paths: [dir] });
    return modPath;
  } catch {
    return null;
  }
}
