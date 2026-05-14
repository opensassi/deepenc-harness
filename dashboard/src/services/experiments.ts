import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import type { ExperimentEntry, ExperimentDetail, ExperimentFile, ExperimentSubdir } from '../types.js';

export class ExperimentsService {
  private experimentsDir: string;

  constructor(experimentsDir: string) {
    this.experimentsDir = resolve(experimentsDir);
  }

  listExperiments(): ExperimentEntry[] {
    const indexPath = join(this.experimentsDir, 'README.md');
    if (!existsSync(indexPath)) return [];
    const content = readFileSync(indexPath, 'utf-8');
    return this.parseTable(content);
  }

  getExperiment(directory: string): ExperimentDetail | null {
    const entries = this.listExperiments();
    const entry = entries.find(e => e.directory === directory || e.directory.replace(/\/$/, '') === directory.replace(/\/$/, ''));
    if (!entry) return null;

    const dirPath = join(this.experimentsDir, entry.directory.replace(/\/$/, ''));
    if (!existsSync(dirPath)) return null;

    let readme: string | null = null;
    const readmePath = join(dirPath, 'README.md');
    if (existsSync(readmePath)) {
      readme = readFileSync(readmePath, 'utf-8');
    }

    const subdirs: ExperimentSubdir[] = [];
    const allFiles: ExperimentFile[] = [];
    const expPrefix = entry.directory.replace(/\/$/, '');

    const items = readdirSync(dirPath);
    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);
      if (stat.isDirectory()) {
        const files = this.listFilesRecursive(itemPath, this.experimentsDir);
        subdirs.push({ name: item, files });
        allFiles.push(...files);
      } else {
        const file: ExperimentFile = {
          path: relative(this.experimentsDir, itemPath),
          name: item,
          size: stat.size,
        };
        if (item !== 'README.md') {
          allFiles.push(file);
        }
      }
    }

    return { entry, readme, subdirs, allFiles };
  }

  readFile(filePath: string): string | null {
    const fullPath = join(this.experimentsDir, filePath);
    if (!existsSync(fullPath)) return null;
    return readFileSync(fullPath, 'utf-8');
  }

  readFileRaw(filePath: string): Buffer | null {
    const fullPath = join(this.experimentsDir, filePath);
    if (!existsSync(fullPath)) return null;
    return readFileSync(fullPath);
  }

  private listFilesRecursive(dirPath: string, rootDir: string): ExperimentFile[] {
    const files: ExperimentFile[] = [];
    const items = readdirSync(dirPath);
    for (const item of items) {
      const itemPath = join(dirPath, item);
      const stat = statSync(itemPath);
      if (stat.isDirectory()) {
        files.push(...this.listFilesRecursive(itemPath, rootDir));
      } else {
        files.push({
          path: relative(rootDir, itemPath),
          name: item,
          size: stat.size,
        });
      }
    }
    return files;
  }

  private parseTable(content: string): ExperimentEntry[] {
    const entries: ExperimentEntry[] = [];
    const lines = content.split('\n');
    let inTable = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.includes('---')) {
        inTable = true;
        continue;
      }
      if (!trimmed.startsWith('|') || !inTable) continue;

      const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
      if (cells.length < 5) continue;

      const date = cells[0].trim();
      const dirCell = cells[1].replace(/^`|`$/g, '').replace(/\/$/, '').trim();
      const desc = cells[2].replace(/^`|`$/g, '').trim();
      const outcome = cells[3].replace(/\*\*/g, '').trim();
      const agent = cells[4].replace(/^`|`$/g, '').trim();

      entries.push({ date, directory: dirCell, description: desc, outcome, agent });
    }
    return entries;
  }
}
