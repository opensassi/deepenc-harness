#!/usr/bin/env node

import { loadConfig } from './config.js';
import type { GlobalOptions, BuildOptions, TestOptions } from './types.js';
import { buildCommand } from './commands/build.js';
import { testCommand } from './commands/test.js';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';

export function usage(): never {
  console.log(`
deepenc-harness - Build and test tooling for the deepenc encoder

Usage:
  deepenc-harness build [options]
  deepenc-harness test  [options]
  deepenc-harness build --test [options]
  deepenc-harness --help

Commands:
  build                 Build the parent encoder library
  test                  Run the parent test suite

Build Options:
  -v, --variant <type>  Build variant: release, debug, relwithdebinfo (default: release)
  --static              Build/test static libraries (default: shared)
  -c, --clean           Clean before building
  -j, --jobs <N>        Number of parallel jobs
  -t, --test            Run tests after building

Test Options:
  -v, --variant <type>  Test variant: release, debug, relwithdebinfo (default: release)
  --static              Test static libraries (default: shared)

Global Options:
  --config <path>       Path to configuration file
  --verbose             Enable verbose logging
  --output <format>     Output format: text, json, csv (default: text)
  --help                Show this message
`);
  process.exit(0);
}

export interface ParsedArgs {
  command: string;
  globals: GlobalOptions;
  opts: BuildOptions | TestOptions;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let command = '';
  const globals: GlobalOptions = { verbose: false, output: 'text' };
  const defaults: BuildOptions = {
    variant: 'release',
    static: false,
    clean: false,
    test: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === 'build' || arg === 'test') && !command) {
      command = arg;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      usage();
    }
    if (arg === '--config') {
      globals.config = argv[++i];
      continue;
    }
    if (arg === '--verbose') {
      globals.verbose = true;
      continue;
    }
    if (arg === '--output') {
      const val = argv[++i];
      if (val !== 'text' && val !== 'json' && val !== 'csv') {
        console.error(`Invalid output format: ${val}`);
        process.exit(1);
      }
      globals.output = val;
      continue;
    }
    if (arg === '--variant' || arg === '-v') {
      defaults.variant = argv[++i];
      continue;
    }
    if (arg === '--static') {
      defaults.static = true;
      continue;
    }
    if (arg === '--clean' || arg === '-c') {
      defaults.clean = true;
      continue;
    }
    if (arg === '--jobs' || arg === '-j') {
      defaults.jobs = parseInt(argv[++i], 10);
      continue;
    }
    if (arg === '--test' || arg === '-t') {
      defaults.test = true;
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }

  if (!command) {
    console.error('Missing command. Use --help for usage.');
    process.exit(1);
  }

  return { command, globals, opts: { ...defaults } };
}

export function main(): void {
  loadConfig();
  const { command, opts } = parseArgs(process.argv.slice(2));

  if (command === 'build') {
    const bopts = opts as BuildOptions;
    console.log(`=> Building deepenc library (${bopts.variant}${bopts.static ? '' : '-shared'})...`);
    buildCommand({
      variant: bopts.variant,
      static: bopts.static,
      clean: bopts.clean,
      jobs: bopts.jobs,
    });
    if (bopts.test) {
      console.log('=> Running tests...');
      testCommand({ variant: bopts.variant, static: bopts.static });
    }
    console.log('=> Done');
  } else if (command === 'test') {
    console.log('=> Running tests...');
    const topts = opts as TestOptions;
    testCommand({ variant: topts.variant, static: topts.static });
    console.log('=> Done');
  }
}

const __filename = fileURLToPath(import.meta.url);
const argvPath = process.argv[1] ? resolve(process.argv[1]) : '';
const isMain = argvPath && realpathSync(argvPath) === __filename;
if (isMain) {
  main();
}

export { loadConfig } from './config.js';
export { buildCommand, findProjectRoot } from './commands/build.js';
export { testCommand } from './commands/test.js';
export type { GlobalOptions, BuildOptions, TestOptions } from './types.js';
export type { HarnessConfig } from './config.js';
export type { BuildOpts } from './commands/build.js';
export type { TestOpts } from './commands/test.js';
