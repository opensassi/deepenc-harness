import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import type { SpecNode } from '../types.js';

const SKIP_DIRS = new Set(['node_modules', 'thirdparty', 'external', '.git', 'build', 'build_debug', 'build_ml', 'build_ml_release', 'build_baseline', 'lib', 'bin', 'install', 'pkgconfig', 'node_modules', '.artifacts', '.github', '.playwright-mcp', '.profiler', 'ml-data', 'ml-models', 'ml-models-v2', 'logs', 'sessions', 'coverage']);

export class TechSpecService {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = resolve(rootDir);
  }

  getTree(): SpecNode {
    return {
      name: 'Technical Specifications',
      path: '',
      isDir: true,
      children: this.scanDir(this.rootDir, 6),
    };
  }

  readSpec(specPath: string): string | null {
    const fullPath = join(this.rootDir, specPath);
    if (!existsSync(fullPath)) return null;
    return readFileSync(fullPath, 'utf-8');
  }

  private scanDir(dir: string, maxDepth: number): SpecNode[] {
    if (maxDepth <= 0) return [];
    const entries: SpecNode[] = [];
    try {
      const items = readdirSync(dir);
      const dirs: string[] = [];
      const specFiles: SpecNode[] = [];

      for (const item of items) {
        if (SKIP_DIRS.has(item)) continue;
        const fullPath = join(dir, item);
        let stat;
        try { stat = statSync(fullPath); } catch { continue; }

        if (stat.isDirectory()) {
          if (this.hasSpecs(fullPath)) {
            dirs.push(fullPath);
          }
        } else if (item.endsWith('.spec.md') || item === 'technical-specification.md') {
          specFiles.push({
            name: item,
            path: relative(this.rootDir, fullPath),
            isDir: false,
          });
        }
      }

      for (const d of dirs.sort()) {
        const relPath = relative(this.rootDir, d);
        entries.push({
          name: relPath,
          path: relPath,
          isDir: true,
          children: this.scanDir(d, maxDepth - 1),
        });
      }

      entries.push(...specFiles);
      entries.sort((a, b) => {
        // Root spec first, then aggregate specs, then dirs, then other files
        if (a.name === 'technical-specification.md') return -1;
        if (b.name === 'technical-specification.md') return 1;
        if (a.isDir && !b.isDir) return 1;
        if (!a.isDir && b.isDir) return -1;
        return a.name.localeCompare(b.name);
      });
    } catch {}
    return entries;
  }

  private hasSpecs(dir: string): boolean {
    try {
      const items = readdirSync(dir);
      for (const item of items) {
        if (SKIP_DIRS.has(item)) continue;
        if (item.endsWith('.spec.md') || item === 'technical-specification.md') return true;
        const fullPath = join(dir, item);
        try {
          if (statSync(fullPath).isDirectory() && !SKIP_DIRS.has(item)) {
            if (this.hasSpecs(fullPath)) return true;
          }
        } catch {}
      }
    } catch {}
    return false;
  }
}
