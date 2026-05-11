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

export interface TestOpts {
  variant: string;
  static: boolean;
}

export function testCommand(opts: TestOpts): void {
  const root = findProjectRoot();
  const suffix = opts.static ? '-static' : '-shared';
  const buildDir = `build/${opts.variant}${suffix}`;
  execSync(`ctest --test-dir ${buildDir} --output-on-failure`, {
    cwd: root,
    stdio: 'inherit',
  });
}
