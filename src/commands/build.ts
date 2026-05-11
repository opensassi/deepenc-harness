import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export function findProjectRoot(startDir = process.cwd()): string {
  let dir = startDir;
  while (dir !== '/') {
    if (existsSync(resolve(dir, 'Makefile'))) return dir;
    dir = resolve(dir, '..');
  }
  console.error('Error: could not find project root (Makefile)');
  process.exit(1);
}

export interface BuildOpts {
  variant: string;
  static: boolean;
  clean: boolean;
  jobs?: number;
}

export function buildCommand(opts: BuildOpts): void {
  const root = findProjectRoot();
  const suffix = opts.static ? '' : '-shared';
  const target = `install-${opts.variant}${suffix}`;
  const jobArg = opts.jobs ? `j=${opts.jobs}` : '';
  if (opts.clean) {
    execSync(`make clean-${opts.variant}${suffix} ${jobArg}`.trim(), {
      cwd: root,
      stdio: 'inherit',
    });
  }
  const cmd = [`make ${target}`, jobArg].filter(Boolean).join(' ');
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
  });
}
