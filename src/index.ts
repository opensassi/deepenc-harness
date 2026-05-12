#!/usr/bin/env node

import { loadConfig } from './config.js';
import type { GlobalOptions, BuildOptions, TestOptions, MlSubcommand, MlOptions } from './types.js';
import { buildCommand } from './commands/build.js';
import { testCommand } from './commands/test.js';
import {
  dataGenerateCommand,
  dataSplitCommand,
  trainCommand,
  encodeCommand,
  benchCommand,
  sweepCommand,
  feedbackCommand,
} from './commands/ml.js';
import type { DataGenerateOpts, DataSplitOpts, TrainOpts, EncodeOpts, BenchOpts, SweepOpts, FeedbackOpts } from './commands/ml.js';
import { fileURLToPath } from 'node:url';
import { basename, resolve } from 'node:path';
import { realpathSync, readFileSync } from 'node:fs';

const ML_SUBCOMMANDS: MlSubcommand[] = [
  'data-generate', 'data-split', 'train', 'encode', 'bench', 'sweep', 'feedback',
];

export function usage(): never {
  console.log(`
deepenc-harness - Build and test tooling for the deepenc encoder

Usage:
  deepenc-harness build [options]
  deepenc-harness test  [options]
  deepenc-harness build --test [options]
  deepenc-harness ml <subcommand> [options]
  deepenc-harness --help

Commands:
  build                 Build the parent encoder library
  test                  Run the parent test suite
  ml                    ML workflow commands (see below)

Build Options:
  -v, --variant <type>  Build variant: release, debug, relwithdebinfo (default: release)
  --static              Build/test static libraries (default: shared)
  -c, --clean           Clean before building
  -j, --jobs <N>        Number of parallel jobs
  -t, --test            Run tests after building
  --ml                  Configure with ML LightGBM support

Test Options:
  -v, --variant <type>  Test variant: release, debug, relwithdebinfo (default: release)
  --static              Test static libraries (default: shared)

ML Subcommands:
  data-generate         Run instrumented encodes and collect CSV features
  data-split            Merge + shuffle + split CSVs into train/val
  train                 Train 5 binary LightGBM classifiers
  encode                Encode with ML models
  bench                 Baseline vs ML comparison (BDBR)
  sweep                 Sweep confidence thresholds
  feedback              Collect mispredictions, augment dataset, retrain

ML Options:
  --clips <path>        Single YUV clip path (requires --width/--height/--fps or defaults)
  --clips-config <path> JSON file with per-clip path/name/width/height/fps
  --width <n>           Clip width in pixels (default: 1920)
  --height <n>          Clip height in pixels (default: 1080)
  --fps <n>             Clip framerate (default: 50)
  --qps <list>          Comma-separated QP values (e.g. 22,27,32,37)
  --train-ratio <n>     Train/val split ratio (default: 0.8)
  --confidence <n>      ML confidence threshold (default: 0.80)
  --thresholds <list>   Comma-separated confidence thresholds for sweep
  --model-dir <path>    ML model directory
  --data-dir <path>     Data directory for CSVs
  --script-path <path>  Path to train_lightgbm.py (auto-resolved if omitted)
  --vvencapp-path <path> Path to vvencapp binary (auto-resolved if omitted)

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
  opts: BuildOptions | TestOptions | MlOptions;
  mlSubcommand?: MlSubcommand;
}

export function parseArgs(argv: string[]): ParsedArgs {
  let command = '';
  let mlSubcommand: MlSubcommand | undefined;
  const globals: GlobalOptions = { verbose: false, output: 'text' };
  const bldDefaults: BuildOptions = {
    variant: 'release',
    static: false,
    clean: false,
    test: false,
    ml: false,
  };
  const mlOptions: MlOptions = {
    subcommand: 'data-generate',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if ((arg === 'build' || arg === 'test') && !command) {
      command = arg;
      continue;
    }
    if (arg === 'ml' && !command) {
      command = 'ml';
      const next = argv[i + 1];
      if (next && (ML_SUBCOMMANDS as readonly string[]).includes(next)) {
        mlSubcommand = next as MlSubcommand;
        mlOptions.subcommand = mlSubcommand;
        i++;
      }
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
      bldDefaults.variant = argv[++i];
      continue;
    }
    if (arg === '--static') {
      bldDefaults.static = true;
      continue;
    }
    if (arg === '--clean' || arg === '-c') {
      bldDefaults.clean = true;
      continue;
    }
    if (arg === '--jobs' || arg === '-j') {
      bldDefaults.jobs = parseInt(argv[++i], 10);
      continue;
    }
    if (arg === '--test' || arg === '-t') {
      bldDefaults.test = true;
      continue;
    }
    if (arg === '--ml') {
      bldDefaults.ml = true;
      continue;
    }
    if (arg === '--clips') {
      const clipPath = argv[++i];
      mlOptions.clips = [{ path: resolve(clipPath), name: basename(clipPath).replace(/\.\w+$/, ''), width: 1920, height: 1080, fps: 50 }];
      continue;
    }
    if (arg === '--clips-config') {
      const configPath = resolve(argv[++i]);
      const raw = readFileSync(configPath, 'utf-8');
      mlOptions.clips = JSON.parse(raw) as import('./types.js').ClipSpec[];
      continue;
    }
    if (arg === '--qps') {
      mlOptions.qps = argv[++i].split(',').map(Number);
      continue;
    }
    if (arg === '--train-ratio') {
      mlOptions.trainRatio = parseFloat(argv[++i]);
      continue;
    }
    if (arg === '--confidence') {
      mlOptions.confidence = parseFloat(argv[++i]);
      continue;
    }
    if (arg === '--thresholds') {
      mlOptions.thresholds = argv[++i].split(',').map(Number);
      continue;
    }
    if (arg === '--model-dir') {
      mlOptions.modelDir = resolve(argv[++i]);
      continue;
    }
    if (arg === '--data-dir') {
      mlOptions.dataDir = resolve(argv[++i]);
      continue;
    }
    if (arg === '--script-path') {
      mlOptions.scriptPath = resolve(argv[++i]);
      continue;
    }
    if (arg === '--vvencapp-path') {
      mlOptions.vvencappPath = resolve(argv[++i]);
      continue;
    }
    if (arg === '--clip') {
      mlOptions.clipPath = resolve(argv[++i]);
      continue;
    }
    if (arg === '--width') {
      mlOptions.clipWidth = parseInt(argv[++i], 10);
      continue;
    }
    if (arg === '--height') {
      mlOptions.clipHeight = parseInt(argv[++i], 10);
      continue;
    }
    if (arg === '--fps') {
      mlOptions.clipFps = parseInt(argv[++i], 10);
      continue;
    }
    if (arg === '--qp') {
      mlOptions.qp = parseInt(argv[++i], 10);
      continue;
    }
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }

  if (!command) {
    console.error('Missing command. Use --help for usage.');
    process.exit(1);
  }

  if (command === 'ml' && !mlSubcommand) {
    console.error('Missing ML subcommand. Use --help for usage.');
    process.exit(1);
  }

  return {
    command,
    globals,
    opts: command === 'ml' ? mlOptions : { ...bldDefaults },
    mlSubcommand,
  };
}

export function main(): void {
  loadConfig();
  const { command, opts, mlSubcommand } = parseArgs(process.argv.slice(2));

  if (command === 'build') {
    const bopts = opts as BuildOptions;
    console.log(`=> Building deepenc library (${bopts.variant}${bopts.static ? '' : '-shared'})...`);
    buildCommand({
      variant: bopts.variant,
      static: bopts.static,
      clean: bopts.clean,
      jobs: bopts.jobs,
      ml: bopts.ml,
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
  } else if (command === 'ml') {
    const mlOpts = opts as MlOptions;
    xDispatchMl(mlSubcommand!, mlOpts);
  }
}

function xMakeClip(path: string, mlOpts: MlOptions): import('./types.js').ClipSpec {
  return {
    path,
    name: basename(path).replace(/\.\w+$/, ''),
    width: mlOpts.clipWidth ?? 1920,
    height: mlOpts.clipHeight ?? 1080,
    fps: mlOpts.clipFps ?? 50,
  };
}

function xDispatchMl(subcommand: MlSubcommand, mlOpts: MlOptions): void {
  switch (subcommand) {
    case 'data-generate': {
      if (!mlOpts.clips || mlOpts.clips.length === 0) {
        console.error('Error: --clips is required for data-generate');
        process.exit(1);
      }
      const report = dataGenerateCommand({
        clips: mlOpts.clips,
        qps: mlOpts.qps ?? [22, 27, 32, 37],
        dataDir: mlOpts.dataDir ?? './ml-data',
        vvencappPath: mlOpts.vvencappPath,
      });
      console.log(`Generated ${report.totalRows} feature rows across ${Object.keys(report.clipResults).length} clips`);
      break;
    }
    case 'data-split': {
      const report = dataSplitCommand({
        dataDir: mlOpts.dataDir ?? './ml-data',
        trainRatio: mlOpts.trainRatio ?? 0.8,
      });
      console.log(`Split: ${report.trainRows} train / ${report.valRows} val`);
      break;
    }
    case 'train': {
      const report = trainCommand({
        trainPath: resolve(mlOpts.dataDir ?? './ml-data', 'train.csv'),
        valPath: resolve(mlOpts.dataDir ?? './ml-data', 'val.csv'),
        outputDir: mlOpts.modelDir ?? './ml-models',
        scriptPath: mlOpts.scriptPath,
      });
      console.log(`Trained ${report.models.length} models`);
      break;
    }
    case 'encode': {
      if (!mlOpts.clipPath) {
        console.error('Error: --clip is required for encode');
        process.exit(1);
      }
      const clip = xMakeClip(mlOpts.clipPath, mlOpts);
      const report = encodeCommand({
        clip,
        qp: mlOpts.qp ?? 32,
        modelDir: mlOpts.modelDir ?? './ml-models',
        confidence: mlOpts.confidence ?? 0.80,
        vvencappPath: mlOpts.vvencappPath,
      });
      console.log(`Encode: ${report.encodingTimeMs}ms, bitrate=${report.bitrate}, PSNR=${report.psnr}`);
      break;
    }
    case 'bench': {
      if (!mlOpts.clipPath) {
        console.error('Error: --clip is required for bench');
        process.exit(1);
      }
      const clip = xMakeClip(mlOpts.clipPath, mlOpts);
      const report = benchCommand({
        clip,
        qps: mlOpts.qps ?? [22, 27, 32, 37],
        modelDir: mlOpts.modelDir ?? './ml-models',
        confidence: mlOpts.confidence ?? 0.80,
        vvencappPath: mlOpts.vvencappPath,
      });
      console.log(`Bench: speedup=${report.speedupPercent.toFixed(1)}%, BDBR=${report.bdRate.toFixed(2)}%`);
      break;
    }
    case 'sweep': {
      if (!mlOpts.clipPath) {
        console.error('Error: --clip is required for sweep');
        process.exit(1);
      }
      const clip = xMakeClip(mlOpts.clipPath, mlOpts);
      const report = sweepCommand({
        clip,
        qps: mlOpts.qps ?? [22, 27, 32, 37],
        modelDir: mlOpts.modelDir ?? './ml-models',
        thresholds: mlOpts.thresholds ?? [0.3, 0.5, 0.7],
        vvencappPath: mlOpts.vvencappPath,
      });
      console.log(`Sweep: ${Object.keys(report.results).length} thresholds`);
      break;
    }
    case 'feedback': {
      if (!mlOpts.clipPath) {
        console.error('Error: --clip is required for feedback');
        process.exit(1);
      }
      const clip = xMakeClip(mlOpts.clipPath, mlOpts);
      const report = feedbackCommand({
        clip,
        qp: mlOpts.qp ?? 32,
        modelDir: mlOpts.modelDir ?? './ml-models',
        confidence: mlOpts.confidence ?? 0.80,
        dataDir: mlOpts.dataDir ?? './ml-data',
        vvencappPath: mlOpts.vvencappPath,
        scriptPath: mlOpts.scriptPath,
      });
      console.log(`Feedback: ${report.mispredictions} mispredictions, augmented ${report.augmentedRows} rows, retrained`);
      break;
    }
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
export {
  dataGenerateCommand,
  dataSplitCommand,
  trainCommand,
  encodeCommand,
  benchCommand,
  sweepCommand,
  feedbackCommand,
} from './commands/ml.js';
export type { GlobalOptions, BuildOptions, TestOptions, MlSubcommand, MlOptions } from './types.js';
export type { HarnessConfig } from './config.js';
export type { BuildOpts } from './commands/build.js';
export type { TestOpts } from './commands/test.js';
export type { DataGenerateOpts, DataSplitOpts, TrainOpts, EncodeOpts, BenchOpts, SweepOpts, FeedbackOpts } from './commands/ml.js';
