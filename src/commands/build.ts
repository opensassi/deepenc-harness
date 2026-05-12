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
  ml?: boolean;
}

function xCmakeConfigure(root: string, variant: string, isStatic: boolean, ml: boolean): void {
  const suffix = isStatic ? '' : '-shared';
  const buildDir = `build/${variant}${suffix}`;
  const cmakeArgs = [
    `-DCMAKE_BUILD_TYPE=${variant[0].toUpperCase() + variant.slice(1)}`,
    isStatic ? '-DBUILD_SHARED_LIBS=0' : '-DBUILD_SHARED_LIBS=1',
  ];
  if (ml) {
    cmakeArgs.push('-DVVENC_ENABLE_ML_LIGHTGBM=ON', '-DVVENC_ENABLE_AI_TRAINING=ON');
  }
  execSync(`cmake -S . -B ${buildDir} ${cmakeArgs.join(' ')}`, {
    cwd: root,
    stdio: 'inherit',
  });
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
  if (opts.ml) {
    xCmakeConfigure(root, opts.variant, !!opts.static, true);
  }
  const cmd = [`make ${target}`, jobArg].filter(Boolean).join(' ');
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
  });
}
