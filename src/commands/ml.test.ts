import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const ORIGINAL_EXIT = process.exit;

beforeEach(() => {
  jest.spyOn(process, 'exit').mockImplementation((() => {
    throw new Error('process.exit called');
  }) as never);
});

afterEach(() => {
  process.exit = ORIGINAL_EXIT;
});

jest.unstable_mockModule('node:child_process', () => ({
  execSync: jest.fn().mockReturnValue(Buffer.from('')),
}));

jest.unstable_mockModule('node:fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

jest.unstable_mockModule('./build.js', () => ({
  findProjectRoot: jest.fn().mockReturnValue('/tmp/test-root'),
}));

const CSV_HEADER = 'feat1,feat2,feat3,best_split\n';
const CSV_ROW = '0.1,0.2,0.3,QT\n';

describe('dataGenerateCommand', () => {
  let dataGenerateCommand: typeof import('./ml.js').dataGenerateCommand;
  let execSync: jest.Mock;
  let readFileSync: jest.Mock;
  let existsSync: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('./ml.js');
    dataGenerateCommand = mod.dataGenerateCommand;
    execSync = (await import('node:child_process')).execSync as jest.Mock;
    readFileSync = (await import('node:fs')).readFileSync as jest.Mock;
    existsSync = (await import('node:fs')).existsSync as jest.Mock;
    execSync.mockReturnValue(Buffer.from(''));
    readFileSync.mockReturnValue(CSV_HEADER + CSV_ROW + CSV_ROW);
    existsSync.mockReturnValue(true);
  });

  it('runs vvencapp for each clip and QP combination', () => {
    dataGenerateCommand({
      clips: [{ path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 }],
      qps: [22, 27],
      dataDir: '/tmp/ml-data',
    });
    const calls = execSync.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0][0]).toMatch(/vvencapp/);
    expect(calls[0][0]).toMatch(/-q 22/);
    expect(calls[1][0]).toMatch(/-q 27/);
    expect(calls[0][1].env.VVENC_TRAINING_OUT).toMatch(/test_qp22\.csv$/);
    expect(calls[1][1].env.VVENC_TRAINING_OUT).toMatch(/test_qp27\.csv$/);
  });

  it('returns report with row counts', () => {
    const report = dataGenerateCommand({
      clips: [{ path: '/vids/a.yuv', name: 'a', width: 1920, height: 1080, fps: 50 }],
      qps: [22],
      dataDir: '/tmp/ml-data',
    });
    expect(report.totalRows).toBe(2);
    expect(report.clipResults.a).toBeDefined();
    expect(report.clipResults.a.rows).toBe(2);
  });

  it('uses provided vvencappPath and root', () => {
    dataGenerateCommand({
      clips: [{ path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 }],
      qps: [22],
      dataDir: '/tmp/ml-data',
      vvencappPath: '/custom/vvencapp',
      root: '/custom-root',
    });
    const cmd = execSync.mock.calls[0][0] as string;
    expect(cmd).toMatch(/^\/custom\/vvencapp/);
  });

  it('falls back to vvencapp when root has no binary', () => {
    existsSync
      .mockReturnValueOnce(false)  // release-shared/bin/vvencapp
      .mockReturnValueOnce(false); // debug-shared/bin/vvencapp
    dataGenerateCommand({
      clips: [{ path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 }],
      qps: [22],
      dataDir: '/tmp/ml-data',
      root: '/nonexistent',
    });
    const cmd = execSync.mock.calls[0][0] as string;
    expect(cmd).toMatch(/^vvencapp /);
  });

  it('finds vvencapp in debug build dir when release not found', () => {
    existsSync
      .mockReturnValueOnce(false)  // release-shared/bin/vvencapp - NOT found
      .mockReturnValueOnce(true);  // debug-shared/bin/vvencapp - FOUND
    dataGenerateCommand({
      clips: [{ path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 }],
      qps: [22],
      dataDir: '/tmp/ml-data',
      root: '/custom-root',
    });
    const cmd = execSync.mock.calls[0][0] as string;
    expect(cmd).toMatch(/\/custom-root\/build\/debug-shared\/bin\/vvencapp/);
  });
});

describe('dataSplitCommand', () => {
  let dataSplitCommand: typeof import('./ml.js').dataSplitCommand;
  let readdirSync: jest.Mock;
  let readFileSync: jest.Mock;
  let writeFileSync: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('./ml.js');
    dataSplitCommand = mod.dataSplitCommand;
    readdirSync = (await import('node:fs')).readdirSync as jest.Mock;
    readFileSync = (await import('node:fs')).readFileSync as jest.Mock;
    writeFileSync = (await import('node:fs')).writeFileSync as jest.Mock;
  });

  it('splits CSV data at 80/20 ratio', () => {
    readdirSync.mockReturnValue(['clip1.csv', 'clip2.csv']);
    const rows = ['0.1,0.2,QT', '0.3,0.4,BH', '0.5,0.6,BV', '0.7,0.8,TH', '0.9,1.0,TV'];
    readFileSync
      .mockReturnValueOnce(`feat1,feat2,best_split\n${rows.slice(0, 3).join('\n')}\n`)
      .mockReturnValueOnce(`feat1,feat2,best_split\n${rows.slice(3).join('\n')}\n`);

    const report = dataSplitCommand({ dataDir: '/tmp/ml-data', trainRatio: 0.8 });

    expect(report.trainRows + report.valRows).toBe(5);
    expect(report.trainRows).toBeGreaterThanOrEqual(3);
    expect(report.valRows).toBeGreaterThanOrEqual(1);
    expect(writeFileSync).toHaveBeenCalledTimes(2);
  });

  it('handles empty data directory', () => {
    readdirSync.mockReturnValue([]);
    const report = dataSplitCommand({ dataDir: '/tmp/ml-data', trainRatio: 0.8 });
    expect(report.trainRows).toBe(0);
    expect(report.valRows).toBe(0);
  });

  it('handles single CSV file', () => {
    readdirSync.mockReturnValue(['all.csv']);
    readFileSync.mockReturnValue('feat1,feat2,best_split\n0.1,0.2,QT\n0.3,0.4,BH\n');
    const report = dataSplitCommand({ dataDir: '/tmp/ml-data', trainRatio: 0.5 });
    expect(report.trainRows + report.valRows).toBe(2);
  });

  it('skips files with only header (1 line)', () => {
    readdirSync.mockReturnValue(['empty.csv']);
    readFileSync.mockReturnValue('feat1,feat2,best_split\n');
    const report = dataSplitCommand({ dataDir: '/tmp/ml-data', trainRatio: 0.8 });
    expect(report.trainRows).toBe(0);
    expect(report.valRows).toBe(0);
  });
});

describe('trainCommand', () => {
  let trainCommand: typeof import('./ml.js').trainCommand;
  let execSync: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('./ml.js');
    trainCommand = mod.trainCommand;
    execSync = (await import('node:child_process')).execSync as jest.Mock;
    execSync.mockReturnValue(Buffer.from('QT AUC: 0.85\nBH AUC: 0.82\nBV AUC: 0.79\nTH AUC: 0.81\nTV AUC: 0.83\n'));
  });

  it('invokes python training script', () => {
    const report = trainCommand({
      trainPath: '/tmp/ml-data/train.csv',
      valPath: '/tmp/ml-data/val.csv',
      outputDir: '/tmp/models',
      featureCount: 10,
      numLeaves: 128,
    });
    expect(execSync).toHaveBeenCalled();
    const cmd = execSync.mock.calls[0][0] as string;
    expect(cmd).toMatch(/python3.*train_lightgbm\.py/);
    expect(cmd).toMatch(/--train.*train\.csv/);
    expect(report.models.length).toBe(5);
  });

  it('uses explicit scriptPath when provided', () => {
    trainCommand({
      trainPath: '/tmp/ml-data/train.csv',
      valPath: '/tmp/ml-data/val.csv',
      outputDir: '/tmp/models',
      featureCount: 10,
      numLeaves: 128,
      scriptPath: '/opt/scripts/train.py',
    });
    const cmd = execSync.mock.calls[0][0] as string;
    expect(cmd).toMatch(/python3.*\/opt\/scripts\/train\.py/);
  });

  it('exits when train_lightgbm.py not found', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit called');
    }) as never);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const fsMod = await import('node:fs');
    (fsMod.existsSync as jest.Mock).mockReturnValue(false);

    expect(() => trainCommand({
      trainPath: '/tmp/ml-data/train.csv',
      valPath: '/tmp/ml-data/val.csv',
      outputDir: '/tmp/models',
      featureCount: 10,
      numLeaves: 128,
    })).toThrow('exit called');

    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe('encodeCommand', () => {
  let encodeCommand: typeof import('./ml.js').encodeCommand;
  let execSync: jest.Mock;
  let findProjectRoot: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('./ml.js');
    encodeCommand = mod.encodeCommand;
    execSync = (await import('node:child_process')).execSync as jest.Mock;
    findProjectRoot = (await import('./build.js')).findProjectRoot as jest.Mock;
    findProjectRoot.mockReturnValue('/tmp/test-root');
    execSync.mockReturnValue(
      'vvencapp [info]: Total Time: 1.234 sec. Fps(avg): 2.0 encoded Frames 50\nvvenc [info]:\tTotal Frames |   Bitrate     Y-PSNR\nvvenc [info]:\t       50    a    4521.3   38.7\n',
    );
  });

  it('runs vvencapp with ML flags', () => {
    const report = encodeCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qp: 32,
      modelDir: '/tmp/models',
      confidence: 0.5,
    });
    const cmd = execSync.mock.calls[0][0] as string;
    expect(cmd).toMatch(/vvencapp/);
    expect(cmd).toMatch(/--ml-model-dir/);
    expect(cmd).toMatch(/--ml-confidence 0.5/);
    expect(report.encodingTimeMs).toBe(1234);
    expect(report.mlSkipRate).toBe(0);
    expect(report.avgConfidence).toBe(0);
    expect(report.bitrate).toBe(4521.3);
    expect(report.psnr).toBe(38.7);
  });

  it('uses provided vvencappPath', () => {
    encodeCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qp: 32,
      modelDir: '/tmp/models',
      confidence: 0.5,
      vvencappPath: '/opt/bin/vvencapp',
    });
    const cmd = execSync.mock.calls[0][0] as string;
    expect(cmd).toMatch(/^\/opt\/bin\/vvencapp/);
  });

  it('parses baseline encode output (isMl=false)', () => {
    execSync.mockReturnValue('Total Time: 500.0 sec\nTotal Frames |   Bitrate     Y-PSNR\n         50    a    4500   39.0\n');
    const args: any = {
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qp: 32,
    };
    const report = encodeCommand(args);
    expect(report.mlSkipRate).toBe(0);
    expect(report.avgConfidence).toBe(0);
  });
});

describe('benchCommand', () => {
  let benchCommand: typeof import('./ml.js').benchCommand;
  let execSync: jest.Mock;
  let findProjectRoot: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('./ml.js');
    benchCommand = mod.benchCommand;
    execSync = (await import('node:child_process')).execSync as jest.Mock;
    findProjectRoot = (await import('./build.js')).findProjectRoot as jest.Mock;
    findProjectRoot.mockReturnValue('/tmp/test-root');

    let callCount = 0;
    execSync.mockImplementation(() => {
      callCount++;
      const qpIdx = Math.floor((callCount - 1) / 2) % 4;
      const isMl = (callCount - 1) % 2 === 1;
      const baseBrs = [12000, 6000, 3000, 1500];
      const basePsnrs = [36.0, 38.5, 41.0, 43.5];
      const factor = isMl ? 0.95 : 1.0;
      return `Encoding time: ${callCount * 100} ms\nbitrate: ${baseBrs[qpIdx] * factor}\nPSNR: ${basePsnrs[qpIdx] + (isMl ? 0.1 : 0)}\n`;
    });
  });

  it('returns speedup and BDBR values', () => {
    const report = benchCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qps: [22, 27, 32, 37],
      modelDir: '/tmp/models',
      confidence: 0.5,
    });
    expect(typeof report.speedupPercent).toBe('number');
    expect(typeof report.bdRate).toBe('number');
    expect(report.baseline).toBeDefined();
    expect(report.ml).toBeDefined();
  });

  it('handles BDBR with less than 4 points (returns 0)', () => {
    let callCount = 0;
    execSync.mockImplementation(() => {
      callCount++;
      return `Encoding time: ${callCount * 100} ms\nTotal Frames |   Bitrate     Y-PSNR\n         50    a    5000   38.0\n`;
    });

    const report = benchCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qps: [22],
      modelDir: '/tmp/models',
      confidence: 0.5,
    });
    expect(report.bdRate).toBe(0);
  });

  it('handles BDBR with non-overlapping PSNR ranges', () => {
    let callCount = 0;
    execSync.mockImplementation(() => {
      callCount++;
      const isMl = callCount % 2 === 0;
      if (isMl) {
        return `Total Time: 500.0 sec\nTotal Frames |   Bitrate     Y-PSNR\n         50    a    4000   30.0\n`;
      }
      return `Total Time: 500.0 sec\nTotal Frames |   Bitrate     Y-PSNR\n         50    a    5000   40.0\n`;
    });
    const report = benchCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qps: [22, 27, 32, 37],
      modelDir: '/tmp/models',
      confidence: 0.5,
    });
    expect(report.bdRate).toBe(0);
  });
});

describe('sweepCommand', () => {
  let sweepCommand: typeof import('./ml.js').sweepCommand;
  let execSync: jest.Mock;
  let findProjectRoot: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('./ml.js');
    sweepCommand = mod.sweepCommand;
    execSync = (await import('node:child_process')).execSync as jest.Mock;
    findProjectRoot = (await import('./build.js')).findProjectRoot as jest.Mock;
    findProjectRoot.mockReturnValue('/tmp/test-root');
    execSync.mockReturnValue('Total Time: 500.0 sec\nTotal Frames |   Bitrate     Y-PSNR\n         50    a    4500   39.0\n');
  });

  it('runs bench for each threshold', () => {
    const report = sweepCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qps: [22, 27, 32, 37],
      modelDir: '/tmp/models',
      thresholds: [0.3, 0.5, 0.7],
    });
    expect(Object.keys(report.results).length).toBe(3);
    expect(report.results[0.3]).toBeDefined();
    expect(report.results[0.5]).toBeDefined();
    expect(report.results[0.7]).toBeDefined();
  });
});

describe('feedbackCommand', () => {
  let feedbackCommand: typeof import('./ml.js').feedbackCommand;
  let execSync: jest.Mock;
  let existsSync: jest.Mock;
  let readFileSync: jest.Mock;
  let mkdirSync: jest.Mock;

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await import('./ml.js');
    feedbackCommand = mod.feedbackCommand;
    execSync = (await import('node:child_process')).execSync as jest.Mock;
    existsSync = (await import('node:fs')).existsSync as jest.Mock;
    readFileSync = (await import('node:fs')).readFileSync as jest.Mock;
    mkdirSync = (await import('node:fs')).mkdirSync as jest.Mock;
  });

  it('augments dataset when feedback CSV has mispredictions', () => {
    // execSync first call = ML encode (stdout ignored), rest = trainCommand
    execSync.mockReturnValue('QT AUC: 0.85\nBH AUC: 0.82\nBV AUC: 0.79\nTH AUC: 0.81\nTV AUC: 0.83\n');
    readFileSync.mockReturnValue(CSV_HEADER + '0.1,0.2,QT\n0.3,0.4,BH\n');
    // existsSync: xResolveVvencapp checks release+debug, then feedback CSV, then train.csv, then scriptPath
    existsSync
      .mockReturnValueOnce(false)  // build/release-shared/bin/vvencapp
      .mockReturnValueOnce(false)  // build/debug-shared/bin/vvencapp
      .mockReturnValueOnce(true)   // feedback CSV exists
      .mockReturnValueOnce(true)   // train.csv exists
      .mockReturnValueOnce(true);  // scripts/train_lightgbm.py exists

    const report = feedbackCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qp: 32,
      modelDir: '/tmp/models',
      confidence: 0.5,
      dataDir: '/tmp/ml-data',
      scriptPath: '/opt/scripts/train.py',
    });
    expect(execSync).toHaveBeenCalled();
    expect(execSync.mock.calls[0][1].env.VVENC_ML_FEEDBACK).toBeDefined();
    expect(report.mispredictions).toBe(2);
    expect(report.augmentedRows).toBe(2);
    expect(typeof report.trainReport).toBe('object');
  });

  it('handles feedback without mispredictions (no feedback CSV)', () => {
    execSync.mockImplementation(() => 'QT AUC: 0.85\nBH AUC: 0.82\nBV AUC: 0.79\nTH AUC: 0.81\nTV AUC: 0.83\n');
    existsSync.mockReturnValue(false);

    const report = feedbackCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qp: 32,
      modelDir: '/tmp/models',
      confidence: 0.5,
      dataDir: '/tmp/ml-data',
      scriptPath: '/opt/scripts/train.py',
    });
    expect(report.mispredictions).toBe(0);
    expect(report.augmentedRows).toBe(0);
    expect(typeof report.trainReport).toBe('object');
  });

  it('handles feedback CSV not found (no augmentation)', () => {
    execSync.mockImplementation(() => 'QT AUC: 0.85\nBH AUC: 0.82\nBV AUC: 0.79\nTH AUC: 0.81\nTV AUC: 0.83\n');
    readFileSync.mockReturnValue(CSV_HEADER + CSV_ROW);
    existsSync
      .mockReturnValueOnce(false)  // build/release-shared/bin/vvencapp
      .mockReturnValueOnce(false)  // build/debug-shared/bin/vvencapp
      .mockReturnValueOnce(false)  // feedback CSV does NOT exist
      .mockReturnValueOnce(true)   // train.csv exists (for trainCommand)
      .mockReturnValueOnce(true);  // scripts/train_lightgbm.py exists

    const report = feedbackCommand({
      clip: { path: '/vids/test.yuv', name: 'test', width: 1920, height: 1080, fps: 50 },
      qp: 32,
      modelDir: '/tmp/models',
      confidence: 0.5,
      dataDir: '/tmp/ml-data',
      scriptPath: '/opt/scripts/train.py',
    });
    expect(report.mispredictions).toBe(0);
    expect(report.augmentedRows).toBe(0);
    expect(typeof report.trainReport).toBe('object');
  });
});
