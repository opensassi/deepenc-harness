import { execFileSync } from 'node:child_process';
import type { GitLogEntry, GitStats } from '../types.js';

export class GitService {
  private repoDir: string;
  private defaultSince: string | null;

  constructor(repoDir: string, defaultSince?: string | null) {
    this.repoDir = repoDir;
    this.defaultSince = defaultSince ?? null;
  }

  detectForkPoint(): string | null {
    const makeOpts = (mb: number) => ({
      cwd: this.repoDir, encoding: 'utf-8' as const, maxBuffer: mb,
      stdio: ['pipe', 'pipe', 'ignore'] as ['pipe', 'pipe', 'ignore'],
    });
    try {
      const base = execFileSync('git', ['merge-base', 'HEAD', 'upstream/main'], makeOpts(1024 * 1024)).trim();
      if (base) return base;
    } catch {}
    try {
      const allFork = execFileSync('git', ['rev-list', '--reverse', '--author=opensassi', 'HEAD'], makeOpts(10 * 1024 * 1024)).trim().split('\n').filter(Boolean);
      if (allFork.length > 0) {
        const parent = execFileSync('git', ['rev-parse', allFork[0] + '^'], makeOpts(1024 * 1024)).trim();
        if (parent) return parent;
      }
    } catch {}
    try {
      const allFork = execFileSync('git', ['rev-list', '--reverse', '--author=Ersun', 'HEAD'], makeOpts(10 * 1024 * 1024)).trim().split('\n').filter(Boolean);
      if (allFork.length > 0) {
        const parent = execFileSync('git', ['rev-parse', allFork[0] + '^'], makeOpts(1024 * 1024)).trim();
        if (parent) return parent;
      }
    } catch {}
    return null;
  }

  getRange(rangeBase: string | null): string | undefined {
    if (!rangeBase) return undefined;
    return rangeBase + '..HEAD';
  }

  getLog(since?: string, until?: string, forkRange?: string | null): GitLogEntry[] {
    const args = ['log', '--oneline', '--stat', '--no-merges', '--format=COMMIT%x1e%H%x1f%an%x1f%ai%x1f%s'];
    if (forkRange) {
      args.push(forkRange);
    } else {
      const s = since ?? this.defaultSince;
      if (s) args.push('--after', s);
      if (until) args.push('--before', until);
    }
    try {
      const output = execFileSync('git', args, { cwd: this.repoDir, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, stdio: ['pipe', 'pipe', 'ignore'] as ['pipe', 'pipe', 'ignore'] });
      return this.parseLogOutput(output);
    } catch {
      return [];
    }
  }

  private parseLogOutput(output: string): GitLogEntry[] {
    const entries: GitLogEntry[] = [];
    const blocks = output.split('\x1e').filter(b => b.trim());
    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi];
      const lines = block.trim().split('\n');
      if (lines.length === 0) continue;
      const header = lines[0];
      const parts = header.split('\x1f');
      // First block is just "COMMIT" (before first \x1e), skip it
      if (bi === 0 && parts.length === 1 && parts[0] === 'COMMIT') continue;
      // Subsequent blocks: hash\x1fauthor\x1fdate\x1fsubject
      if (parts.length < 3) continue;
      const commit = parts[0];
      const author = parts[1];
      const date = parts[2];
      const message = parts.slice(3).join('\x1f');
      let filesChanged = 0;
      let insertions = 0;
      let deletions = 0;
      for (let i = 1; i < lines.length; i++) {
        const statMatch = lines[i].match(/(\d+) file[s]? changed/);
        if (statMatch) filesChanged = parseInt(statMatch[1], 10);
        const insMatch = lines[i].match(/(\d+) insertion[s]?/);
        if (insMatch) insertions = parseInt(insMatch[1], 10);
        const delMatch = lines[i].match(/(\d+) deletion[s]?/);
        if (delMatch) deletions = parseInt(delMatch[1], 10);
      }
      entries.push({
        commit: commit ?? '',
        author: author ?? '',
        date: date ?? '',
        message: message ?? '',
        files_changed: filesChanged,
        insertions,
        deletions,
      });
    }
    return entries;
  }

  getStats(forkRange?: string | null): GitStats {
    const allLog = this.getLog(undefined, undefined, forkRange);
    const perDate: Record<string, { commits: number; insertions: number; deletions: number }> = {};
    let totalFilesChanged = 0;
    let totalInsertions = 0;
    let totalDeletions = 0;
    for (const entry of allLog) {
      const day = entry.date.slice(0, 10);
      if (!perDate[day]) perDate[day] = { commits: 0, insertions: 0, deletions: 0 };
      perDate[day].commits++;
      perDate[day].insertions += entry.insertions;
      perDate[day].deletions += entry.deletions;
      totalFilesChanged += entry.files_changed;
      totalInsertions += entry.insertions;
      totalDeletions += entry.deletions;
    }
    return {
      total_commits: allLog.length,
      total_files_changed: totalFilesChanged,
      total_insertions: totalInsertions,
      total_deletions: totalDeletions,
      per_date: perDate,
    };
  }

  getCommitDiff(hash: string): string {
    try {
      return execFileSync('git', ['show', hash, '--no-color'], {
        cwd: this.repoDir,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'ignore'] as ['pipe', 'pipe', 'ignore'],
      });
    } catch {
      return '';
    }
  }
}
