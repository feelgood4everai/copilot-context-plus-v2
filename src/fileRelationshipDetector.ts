import * as path from 'path';

export interface Relationship {
    from: string;
    to: string;
    type: 'import' | 'export' | 'related';
    strength: number;
}

interface FileInfo {
    path: string;
    content: string;
    imports: string[];
    exports: string[];
}

export class FileRelationshipDetector {
    private fileCache: Map<string, FileInfo> = new Map();

    detectRelationships(files: { path: string; content: string }[]): Relationship[] {
        // Clear and rebuild cache
        this.fileCache.clear();

        // Parse all files
        for (const file of files) {
            const info = this.parseFile(file.path, file.content);
            this.fileCache.set(file.path, info);
        }

        // Detect relationships
        const relationships: Relationship[] = [];

        for (const [filePath, fileInfo] of this.fileCache) {
            // Check imports
            for (const importPath of fileInfo.imports) {
                const resolvedPath = this.resolveImportPath(filePath, importPath);
                const targetFile = this.findMatchingFile(resolvedPath);

                if (targetFile) {
                    relationships.push({
                        from: filePath,
                        to: targetFile,
                        type: 'import',
                        strength: 1.0
                    });
                }
            }

            // Check exports (find files that import this one)
            for (const exportName of fileInfo.exports) {
                for (const [otherPath, otherInfo] of this.fileCache) {
                    if (otherPath === filePath) continue;

                    if (otherInfo.imports.some(imp => 
                        imp.includes(exportName) || 
                        this.getFileNameWithoutExt(otherPath) === exportName
                    )) {
                        relationships.push({
                            from: filePath,
                            to: otherPath,
                            type: 'export',
                            strength: 0.8
                        });
                    }
                }
            }

            // Check for related files (same directory, similar names)
            for (const [otherPath, otherInfo] of this.fileCache) {
                if (otherPath === filePath) continue;

                const relationStrength = this.calculateRelatedStrength(filePath, otherPath);
                if (relationStrength > 0.3) {
                    // Check if not already added as import/export
                    const exists = relationships.some(r => 
                        (r.from === filePath && r.to === otherPath) ||
                        (r.from === otherPath && r.to === filePath)
                    );

                    if (!exists) {
                        relationships.push({
                            from: filePath,
                            to: otherPath,
                            type: 'related',
                            strength: relationStrength
                        });
                    }
                }
            }
        }

        // Sort by strength and deduplicate
        relationships.sort((a, b) => b.strength - a.strength);
        return this.deduplicateRelationships(relationships);
    }

    private parseFile(filePath: string, content: string): FileInfo {
        const ext = path.extname(filePath).toLowerCase();

        switch (ext) {
            case '.ts':
            case '.tsx':
            case '.js':
            case '.jsx':
                return this.parseJavaScriptFile(filePath, content);
            case '.py':
                return this.parsePythonFile(filePath, content);
            case '.go':
                return this.parseGoFile(filePath, content);
            case '.java':
                return this.parseJavaFile(filePath, content);
            default:
                return { path: filePath, content, imports: [], exports: [] };
        }
    }

    private parseJavaScriptFile(filePath: string, content: string): FileInfo {
        const imports: string[] = [];
        const exports: string[] = [];

        // ES6 imports: import { foo } from './bar' or import * as foo from './bar'
        const es6ImportRegex = /import\s+(?:(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        while ((match = es6ImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // CommonJS require: const foo = require('./bar')
        const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = requireRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // Dynamic imports: import('./module')
        const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
        while ((match = dynamicImportRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // ES6 exports: export { foo }, export const foo, export default foo
        const exportRegex = /export\s+(?:default\s+)?(?:const|let|var|function|class|interface|type)?\s*(\w+)/g;
        while ((match = exportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }

        // export { foo, bar }
        const exportBlockRegex = /export\s+\{([^}]+)\}/g;
        while ((match = exportBlockRegex.exec(content)) !== null) {
            const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim());
            exports.push(...names);
        }

        return { path: filePath, content, imports, exports };
    }

    private parsePythonFile(filePath: string, content: string): FileInfo {
        const imports: string[] = [];
        const exports: string[] = [];

        // from module import something
        const fromImportRegex = /from\s+([\w.]+)\s+import/g;
        let match;
        while ((match = fromImportRegex.exec(content)) !== null) {
            imports.push(match[1].replace(/\./g, '/'));
        }

        // import module
        const importRegex = /^import\s+([\w.]+)/gm;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1].replace(/\./g, '/'));
        }

        // Python exports are typically what's defined at module level
        // Function definitions
        const defRegex = /^(?:async\s+)?def\s+(\w+)/gm;
        while ((match = defRegex.exec(content)) !== null) {
            if (!match[1].startsWith('_')) {
                exports.push(match[1]);
            }
        }

        // Class definitions
        const classRegex = /^class\s+(\w+)/gm;
        while ((match = classRegex.exec(content)) !== null) {
            if (!match[1].startsWith('_')) {
                exports.push(match[1]);
            }
        }

        return { path: filePath, content, imports, exports };
    }

    private parseGoFile(filePath: string, content: string): FileInfo {
        const imports: string[] = [];
        const exports: string[] = [];

        // import "package/path"
        const importRegex = /import\s+(?:\(\s*)?(?:\w+\s+)?"([^"]+)"/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1]);
        }

        // Exported functions/types (capitalized names)
        const exportRegex = /(?:func|type|var|const)\s+([A-Z]\w*)/g;
        while ((match = exportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }

        return { path: filePath, content, imports, exports };
    }

    private parseJavaFile(filePath: string, content: string): FileInfo {
        const imports: string[] = [];
        const exports: string[] = [];

        // import com.example.Class
        const importRegex = /import\s+([\w.]+)/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            imports.push(match[1].replace(/\./g, '/'));
        }

        // public class/interface/enum
        const exportRegex = /public\s+(?:class|interface|enum)\s+(\w+)/g;
        while ((match = exportRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }

        // public methods
        const methodRegex = /public\s+(?:\w+\s+)?(\w+)\s*\(/g;
        while ((match = methodRegex.exec(content)) !== null) {
            exports.push(match[1]);
        }

        return { path: filePath, content, imports, exports };
    }

    private resolveImportPath(fromFile: string, importPath: string): string {
        // Handle relative imports
        if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const fromDir = path.dirname(fromFile);
            return path.resolve(fromDir, importPath);
        }

        // Handle bare imports (node_modules, etc.)
        return importPath;
    }

    private findMatchingFile(resolvedPath: string): string | null {
        const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.java'];
        const indexFiles = ['/index', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];

        for (const [filePath, _] of this.fileCache) {
            // Direct match
            if (filePath === resolvedPath) {
                return filePath;
            }

            // Match with extension
            for (const ext of extensions) {
                if (filePath === resolvedPath + ext) {
                    return filePath;
                }
            }

            // Match index files
            for (const index of indexFiles) {
                if (filePath === resolvedPath + index || 
                    filePath === resolvedPath + index + '.ts' ||
                    filePath === resolvedPath + index + '.tsx' ||
                    filePath === resolvedPath + index + '.js' ||
                    filePath === resolvedPath + index + '.jsx') {
                    return filePath;
                }
            }
        }

        return null;
    }

    private calculateRelatedStrength(filePath1: string, filePath2: string): number {
        let strength = 0;

        const dir1 = path.dirname(filePath1);
        const dir2 = path.dirname(filePath2);
        const name1 = path.basename(filePath1, path.extname(filePath1));
        const name2 = path.basename(filePath2, path.extname(filePath2));

        // Same directory
        if (dir1 === dir2) {
            strength += 0.3;
        }

        // Similar names (e.g., User.ts and User.test.ts)
        if (name1.includes(name2) || name2.includes(name1)) {
            const commonLength = Math.min(name1.length, name2.length);
            const maxLength = Math.max(name1.length, name2.length);
            strength += 0.4 * (commonLength / maxLength);
        }

        // Same extension
        if (path.extname(filePath1) === path.extname(filePath2)) {
            strength += 0.1;
        }

        return Math.min(strength, 1.0);
    }

    private getFileNameWithoutExt(filePath: string): string {
        return path.basename(filePath, path.extname(filePath));
    }

    private deduplicateRelationships(relationships: Relationship[]): Relationship[] {
        const seen = new Set<string>();
        const result: Relationship[] = [];

        for (const rel of relationships) {
            const key = `${rel.from}|${rel.to}|${rel.type}`;
            const reverseKey = `${rel.to}|${rel.from}|${rel.type}`;

            if (!seen.has(key) && !seen.has(reverseKey)) {
                seen.add(key);
                result.push(rel);
            }
        }

        return result;
    }
}
