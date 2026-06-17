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
exports.parseModule = parseModule;
exports.createModuleInfo = createModuleInfo;
exports.resolveModulePath = resolveModulePath;
const acorn = __importStar(require("acorn"));
const walk = __importStar(require("acorn-walk"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
function parseModule(code, filePath) {
    const imports = [];
    const exports = [];
    const dynamicImports = [];
    let hasEsm = false;
    let hasCjs = false;
    try {
        const ast = acorn.parse(code, {
            ecmaVersion: 'latest',
            sourceType: 'module',
            locations: true,
            allowAwaitOutsideFunction: true,
            allowImportExportEverywhere: true,
        });
        walk.simple(ast, {
            ImportDeclaration(node) {
                hasEsm = true;
                const source = node.source.value;
                const specifiers = [];
                if (node.specifiers && node.specifiers.length > 0) {
                    for (const spec of node.specifiers) {
                        if (spec.type === 'ImportDefaultSpecifier') {
                            specifiers.push({
                                type: 'default',
                                imported: 'default',
                                local: spec.local.name,
                            });
                        }
                        else if (spec.type === 'ImportNamespaceSpecifier') {
                            specifiers.push({
                                type: 'namespace',
                                imported: '*',
                                local: spec.local.name,
                            });
                        }
                        else if (spec.type === 'ImportSpecifier') {
                            specifiers.push({
                                type: 'named',
                                imported: spec.imported.name || spec.imported.value,
                                local: spec.local.name,
                            });
                        }
                    }
                }
                else {
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
            ExportNamedDeclaration(node) {
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
                    }
                    else if (node.declaration.type === 'VariableDeclaration') {
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
                            }
                            else if (decl.id.type === 'ObjectPattern') {
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
                }
                else if (node.source) {
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
                    }
                    else {
                        exports.push({
                            type: 're-export-all',
                            name: '*',
                            source: node.source.value,
                            start: node.start,
                            end: node.end,
                            used: false,
                        });
                    }
                }
                else if (node.specifiers) {
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
            ExportDefaultDeclaration(node) {
                hasEsm = true;
                exports.push({
                    type: 'default',
                    name: 'default',
                    start: node.start,
                    end: node.end,
                    used: false,
                });
            },
            ExportAllDeclaration(node) {
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
            CallExpression(node) {
                if (node.callee.type === 'Identifier' &&
                    node.callee.name === 'require') {
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
            MemberExpression(node) {
                if (node.object?.type === 'Identifier' &&
                    node.object.name === 'exports' &&
                    node.property?.type === 'Identifier') {
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
            AssignmentExpression(node) {
                if (node.left.type === 'MemberExpression' &&
                    node.left.object?.type === 'Identifier' &&
                    node.left.object.name === 'module' &&
                    node.left.property?.type === 'Identifier' &&
                    node.left.property.name === 'exports') {
                    hasCjs = true;
                    exports.push({
                        type: 'default',
                        name: 'default',
                        start: node.start,
                        end: node.end,
                        used: false,
                    });
                }
                else if (node.left.type === 'MemberExpression' &&
                    node.left.object?.type === 'Identifier' &&
                    node.left.object.name === 'exports') {
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
            ImportExpression(node) {
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
    }
    catch (e) {
        try {
            const cjsAst = acorn.parse(code, {
                ecmaVersion: 'latest',
                sourceType: 'script',
                locations: true,
                allowAwaitOutsideFunction: true,
            });
            hasCjs = true;
            hasEsm = false;
            walk.simple(cjsAst, {
                CallExpression(node) {
                    if (node.callee.type === 'Identifier' &&
                        node.callee.name === 'require' &&
                        node.arguments[0]?.type === 'Literal') {
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
                AssignmentExpression(node) {
                    if (node.left.type === 'MemberExpression' &&
                        node.left.object?.type === 'Identifier') {
                        if (node.left.object.name === 'module' && node.left.property?.name === 'exports') {
                            exports.push({
                                type: 'default',
                                name: 'default',
                                start: node.start,
                                end: node.end,
                                used: false,
                            });
                        }
                        else if (node.left.object.name === 'exports') {
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
        }
        catch {
            return { imports: [], exports: [], dynamicImports: [], moduleType: 'esm' };
        }
    }
    let moduleType = 'esm';
    if (hasEsm && hasCjs)
        moduleType = 'mixed';
    else if (hasCjs)
        moduleType = 'cjs';
    return { imports, exports, dynamicImports, moduleType };
}
function createModuleInfo(filePath, code, isEntry, id) {
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
function computeHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const chr = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}
function resolveModulePath(source, fromPath) {
    const extensions = ['.js', '.ts', '.jsx', '.tsx', '.mjs', '.cjs', '/index.js', '/index.ts'];
    const dir = path.dirname(fromPath);
    if (path.isAbsolute(source)) {
        if (fs.existsSync(source))
            return path.resolve(source);
        for (const ext of extensions) {
            const p = source + ext;
            if (fs.existsSync(p))
                return path.resolve(p);
        }
        return null;
    }
    if (source.startsWith('.')) {
        const fullPath = path.resolve(dir, source);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile())
            return fullPath;
        for (const ext of extensions) {
            const p = fullPath + ext;
            if (fs.existsSync(p))
                return p;
            if (ext.startsWith('/')) {
                const indexPath = fullPath + ext;
                if (fs.existsSync(indexPath))
                    return indexPath;
            }
        }
        return null;
    }
    try {
        const modPath = require.resolve(source, { paths: [dir] });
        return modPath;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=parser.js.map