import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, appendFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { findProjectRoot } from './build.js';
import type {
  ClipSpec,
  DataGenerateReport,
  DataSplitReport,
  TrainReport,
  EncodeReport,
  BenchReport,
  SweepReport,
  FeedbackReport,
} from '../types.js';

export interface DataGenerateOpts {
  clips: ClipSpec[];
  qps: number[];
  dataDir: string;
  vvencappPath?: string;
  root?: string;
}

export interface DataSplitOpts {
  dataDir: string;
  trainRatio: number;
}

export interface TrainOpts {
  trainPath: string;
  valPath: string;
  outputDir: string;
  scriptPath?: string;
}

export interface EncodeOpts {
  clip: ClipSpec;
  qp: number;
  modelDir: string;
  confidence: number;
  thns: number;
  topk: number;
  vvencappPath?: string;
  root?: string;
}

export interface BenchOpts {
  clip: ClipSpec;
  qps: number[];
  modelDir: string;
  confidence: number;
  thns: number;
  topk: number;
  vvencappPath?: string;
  root?: string;
}

export interface SweepOpts {
  clip: ClipSpec;
  qps: number[];
  modelDir: string;
  thresholds: number[];
  thns: number;
  topk: number;
  vvencappPath?: string;
  root?: string;
}

export interface FeedbackOpts {
  clip: ClipSpec;
  qp: number;
  modelDir: string;
  confidence: number;
  thns: number;
  topk: number;
  dataDir: string;
  vvencappPath?: string;
  scriptPath?: string;
  root?: string;
}

function xResolveScriptPath(scriptPath?: string): string {
  if (scriptPath) return resolve(scriptPath);
  const root = findProjectRoot();
  const candidate = resolve(root, 'scripts', 'train_lightgbm.py');
  if (existsSync(candidate)) return candidate;
  console.error('Error: train_lightgbm.py not found. Use --script-path to specify location.');
  process.exit(1);
}

function xResolveVvencapp(vvencappPath?: string, root?: string): string {
  if (vvencappPath) return vvencappPath;
  if (root) {
    const candidate = resolve(root, 'build/release-shared/bin/vvencapp');
    if (existsSync(candidate)) return candidate;
    const debugCandidate = resolve(root, 'build/debug-shared/bin/vvencapp');
    if (existsSync(debugCandidate)) return debugCandidate;
  }
  return 'vvencapp';
}

function xRunEncode(
  clip: ClipSpec,
  qp: number,
  modelDir: string | undefined,
  confidence: number | undefined,
  thns: number | undefined,
  topk: number | undefined,
  vvencappPath: string,
): EncodeReport {
  const args = [
    `-i "${clip.path}"`,
    `-q ${qp}`,
    `-s ${clip.width}x${clip.height}`,
    `-r ${clip.fps}`,
    '-o', '/dev/null',
  ];
  if (clip.frames) {
    args.push(`--frames ${clip.frames}`);
  }
  if (clip.preset) {
    args.push(`--preset ${clip.preset}`);
  }
  if (modelDir) {
    args.push('--ml-enable 1', `--ml-model-dir "${modelDir}"`, `--ml-thns ${thns ?? 0.25}`, `--ml-topk ${topk ?? 3}`);
  }
  const cmd = `${vvencappPath} ${args.join(' ')} 2>&1`;
  const output = execSync(cmd, { encoding: 'utf-8' });
  return xParseEncodeOutput(output, modelDir !== undefined);
}

function xParseEncodeOutput(stdout: string, isMl: boolean): EncodeReport {
  const encodingTimeSec = xExtractValue(stdout, /Total Time[:\s]+(\d+\.?\d*) sec/) ?? 0;
  const encodingTimeMs = encodingTimeSec * 1000;
  const mlSkipRate = isMl
    ? (xExtractValue(stdout, /ML skip rate[:\s]+(\d+\.?\d*)/) ?? 0)
    : 0;
  const avgConfidence = isMl
    ? (xExtractValue(stdout, /Avg confidence[:\s]+(\d+\.?\d*)/) ?? 0)
    : 0;
  const bitrate = xExtractValue(stdout, /Total Frames[\s\S]*?a\s+(\d+\.?\d*)/) ?? 0;
  const psnr = xExtractValue(stdout, /Total Frames[\s\S]*?a\s+\d+\.?\d*\s+(\d+\.?\d*)/) ?? 0;
  return { encodingTimeMs, mlSkipRate, avgConfidence, bitrate, psnr };
}

function xExtractValue(text: string, pattern: RegExp): number | null {
  const match = text.match(pattern);
  return match ? parseFloat(match[1]) : null;
}

function xBdRate(
  baselinePoints: Array<{ bitrate: number; psnr: number }>,
  mlPoints: Array<{ bitrate: number; psnr: number }>,
): number {
  if (baselinePoints.length < 4 || mlPoints.length < 4) return 0;
  const sortedBase = [...baselinePoints].sort((a, b) => a.psnr - b.psnr);
  const sortedMl = [...mlPoints].sort((a, b) => a.psnr - b.psnr);

  const logBrBase = sortedBase.map(p => [p.psnr, Math.log(p.bitrate)] as const);
  const logBrMl = sortedMl.map(p => [p.psnr, Math.log(p.bitrate)] as const);

  const psnrMin = Math.max(sortedBase[0].psnr, sortedMl[0].psnr);
  const psnrMax = Math.min(sortedBase[sortedBase.length - 1].psnr, sortedMl[sortedMl.length - 1].psnr);
  if (psnrMin >= psnrMax) return 0;

  function xCubicInterpolate(points: Array<readonly [number, number]>, x: number): number {
    const n = points.length;
    for (let i = 0; i < n - 1; i++) {
      if (x >= points[i][0] && x <= points[i + 1][0]) {
        const t = (x - points[i][0]) / (points[i + 1][0] - points[i][0]);
        return points[i][1] + t * (points[i + 1][1] - points[i][1]);
      }
    }
    return x < points[0][0] ? points[0][1] : points[n - 1][1];
  }

  const samples = 100;
  let integral = 0;
  const step = (psnrMax - psnrMin) / samples;
  for (let i = 0; i < samples; i++) {
    const psnr = psnrMin + (i + 0.5) * step;
    const rateBase = xCubicInterpolate(logBrBase, psnr);
    const rateMl = xCubicInterpolate(logBrMl, psnr);
    integral += rateBase - rateMl;
  }
  integral *= step;

  return (Math.exp(integral) - 1) * 100;
}

export function dataGenerateCommand(opts: DataGenerateOpts): DataGenerateReport {
  const root = opts.root ?? findProjectRoot();
  const vvencapp = xResolveVvencapp(opts.vvencappPath, root);
  mkdirSync(opts.dataDir, { recursive: true });
  const clipResults: Record<string, { csvPath: string; rows: number }> = {};
  let totalRows = 0;

  for (const clip of opts.clips) {
    for (const qp of opts.qps) {
      const csvPath = resolve(opts.dataDir, `${clip.name}_qp${qp}.csv`);
      const framesArg = clip.frames ? ` --frames ${clip.frames}` : '';
      const presetArg = clip.preset ? ` --preset ${clip.preset}` : '';
      execSync(
        `${vvencapp} -i "${clip.path}" -q ${qp} -s ${clip.width}x${clip.height} -r ${clip.fps}${framesArg}${presetArg} -o /dev/null`,
        { stdio: 'inherit', cwd: root, env: { ...process.env, VVENC_TRAINING_OUT: csvPath } },
      );
      const rows = existsSync(csvPath)
        ? parseInt(execSync(`wc -l < "${csvPath}"`, { encoding: 'utf-8' }).trim(), 10) - 1
        : 0;
      if (!clipResults[clip.name]) {
        clipResults[clip.name] = { csvPath, rows: 0 };
      }
      clipResults[clip.name].csvPath = csvPath;
      clipResults[clip.name].rows += rows;
      totalRows += rows;
    }
  }

  return { clipResults, totalRows };
}

export function dataSplitCommand(opts: DataSplitOpts): DataSplitReport {
  const csvFiles = readdirSync(opts.dataDir).filter(f => f.endsWith('.csv'));
  if (csvFiles.length === 0) {
    console.error('Error: no CSV files found in', opts.dataDir);
    process.exit(1);
  }

  const header = execSync(`head -1 "${resolve(opts.dataDir, csvFiles[0])}"`, { encoding: 'utf-8' }).trim();

  const merged = resolve(opts.dataDir, '_merged.csv');
  const trainPath = resolve(opts.dataDir, 'train.csv');
  const valPath = resolve(opts.dataDir, 'val.csv');

  const files = csvFiles.map(f => resolve(opts.dataDir, f)).join(' ');
  execSync(`tail -q -n +2 ${files} > "${merged}"`, { stdio: 'pipe' });

  const totalLines = parseInt(execSync(`wc -l < "${merged}"`, { encoding: 'utf-8' }).trim(), 10);
  const trainLines = Math.floor(totalLines * opts.trainRatio);
  const valRows = totalLines - trainLines;

  const shuffled = resolve(opts.dataDir, '_shuffled.csv');
  execSync(`shuf "${merged}" > "${shuffled}"`, { stdio: 'pipe' });

  execSync(`head -${trainLines} "${shuffled}" > "${trainPath}"`, { stdio: 'pipe' });
  execSync(`tail -${valRows} "${shuffled}" > "${valPath}"`, { stdio: 'pipe' });

  execSync(`echo "${header}" | cat - "${trainPath}" > /tmp/_train_tmp && mv /tmp/_train_tmp "${trainPath}"`, { stdio: 'pipe' });
  execSync(`echo "${header}" | cat - "${valPath}" > /tmp/_val_tmp && mv /tmp/_val_tmp "${valPath}"`, { stdio: 'pipe' });

  execSync(`rm -f "${merged}" "${shuffled}"`, { stdio: 'pipe' });

  return { trainPath, valPath, trainRows: trainLines, valRows };
}

export function trainCommand(opts: TrainOpts): TrainReport {
  const script = xResolveScriptPath(opts.scriptPath);
  const cmd = [
    `python3 "${script}"`,
    `--train "${opts.trainPath}"`,
    `--val "${opts.valPath}"`,
    `--output-dir "${opts.outputDir}"`,
  ].join(' ');
  mkdirSync(opts.outputDir, { recursive: true });
  const stdout = execSync(cmd, { encoding: 'utf-8' });

  const models = ['qt', 'bh', 'bv', 'th', 'tv'].map(
    name => resolve(opts.outputDir, `${name}_split_model.txt`),
  );
  const perSplitAuc: Record<string, number> = {};
  const aucPattern = /(\w+)\s+AUC[:\s]+(\d+\.?\d*)/g;
  let match: RegExpExecArray | null;
  while ((match = aucPattern.exec(stdout)) !== null) {
    perSplitAuc[match[1]] = parseFloat(match[2]);
  }

  return { models, perSplitAuc };
}

export function encodeCommand(opts: EncodeOpts): EncodeReport {
  const root = opts.root ?? findProjectRoot();
  const vvencapp = xResolveVvencapp(opts.vvencappPath, root);
  return xRunEncode(opts.clip, opts.qp, opts.modelDir, opts.confidence, opts.thns, opts.topk, vvencapp);
}

export function benchCommand(opts: BenchOpts): BenchReport {
  const root = opts.root ?? findProjectRoot();
  const vvencapp = xResolveVvencapp(opts.vvencappPath, root);

  const baselinePoints: Array<{ bitrate: number; psnr: number; timeMs: number }> = [];
  const mlPoints: Array<{ bitrate: number; psnr: number; timeMs: number }> = [];

  for (const qp of opts.qps) {
    const baseResult = xRunEncode(opts.clip, qp, undefined, undefined, undefined, undefined, vvencapp);
    baselinePoints.push({ bitrate: baseResult.bitrate, psnr: baseResult.psnr, timeMs: baseResult.encodingTimeMs });

    const mlResult = xRunEncode(opts.clip, qp, opts.modelDir, opts.confidence, opts.thns, opts.topk, vvencapp);
    mlPoints.push({ bitrate: mlResult.bitrate, psnr: mlResult.psnr, timeMs: mlResult.encodingTimeMs });
  }

  const baseTime = baselinePoints.reduce((s, r) => s + r.timeMs, 0) / baselinePoints.length;
  const mlTime = mlPoints.reduce((s, r) => s + r.timeMs, 0) / mlPoints.length;
  const speedupPercent = baseTime > 0 ? ((baseTime - mlTime) / baseTime) * 100 : 0;

  const bdRate = xBdRate(baselinePoints, mlPoints);

  return {
    baseline: { encodingTimeMs: baselinePoints[0].timeMs, mlSkipRate: 0, avgConfidence: 0, bitrate: baselinePoints[0].bitrate, psnr: baselinePoints[0].psnr },
    ml: { encodingTimeMs: mlPoints[0].timeMs, mlSkipRate: 0, avgConfidence: 0, bitrate: mlPoints[0].bitrate, psnr: mlPoints[0].psnr },
    speedupPercent,
    bdRate,
  };
}

export function sweepCommand(opts: SweepOpts): SweepReport {
  const results: Record<number, BenchReport> = {};
  for (const threshold of opts.thresholds) {
    results[threshold] = benchCommand({
      clip: opts.clip,
      qps: opts.qps,
      modelDir: opts.modelDir,
      confidence: threshold,
      thns: opts.thns,
      topk: opts.topk,
      vvencappPath: opts.vvencappPath,
      root: opts.root,
    });
  }
  return { results };
}

export function feedbackCommand(opts: FeedbackOpts): FeedbackReport {
  const root = opts.root ?? findProjectRoot();
  const vvencapp = xResolveVvencapp(opts.vvencappPath, root);
  const feedbackCsv = resolve(opts.dataDir, `${opts.clip.name}_feedback.csv`);

  const args = [
    `-i "${opts.clip.path}"`,
    `-q ${opts.qp}`,
    `-s ${opts.clip.width}x${opts.clip.height}`,
    `-r ${opts.clip.fps}`,
    `--ml-model-dir "${opts.modelDir}"`,
    '--ml-enable 1',
    `--ml-thns ${opts.thns ?? 0.25}`,
    `--ml-topk ${opts.topk ?? 3}`,
    '-o', '/dev/null',
  ];
  if (opts.clip.frames) {
    args.push(`--frames ${opts.clip.frames}`);
  }
  if (opts.clip.preset) {
    args.push(`--preset ${opts.clip.preset}`);
  }
  execSync(`${vvencapp} ${args.join(' ')} 2>&1`, {
    stdio: 'inherit',
    cwd: root,
    env: { ...process.env, VVENC_ML_FEEDBACK: feedbackCsv },
  });

  let mispredictions = 0;
  let augmentedRows = 0;

  if (existsSync(feedbackCsv)) {
    const content = readFileSync(feedbackCsv, 'utf-8').trim();
    const lines = content.split('\n');
    mispredictions = lines.length > 1 ? lines.length - 1 : 0;
    if (mispredictions > 0) {
      mkdirSync(opts.dataDir, { recursive: true });
      const trainCsv = resolve(opts.dataDir, 'train.csv');
      const valCsv = resolve(opts.dataDir, 'val.csv');
      if (existsSync(trainCsv)) {
        appendFileSync(trainCsv, '\n' + content.split('\n').slice(1).join('\n'));
        augmentedRows = mispredictions;
      }
    }
  }

  const trainReport = trainCommand({
    trainPath: resolve(opts.dataDir, 'train.csv'),
    valPath: resolve(opts.dataDir, 'val.csv'),
    outputDir: opts.modelDir,
    scriptPath: opts.scriptPath,
  });

  return { mispredictions, augmentedRows, trainReport };
}
