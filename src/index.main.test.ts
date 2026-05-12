import { jest, describe, it, expect, beforeEach } from '@jest/globals';

describe('main function', () => {
  const originalArgv = process.argv;
  const originalExit = process.exit;

  beforeEach(() => {
    jest.resetModules();
    jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit called');
    }) as never);
  });

  afterEach(() => {
    process.exit = originalExit;
  });

  it('dispatches build command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'build'];
    const { main, buildCommand, testCommand } = await import('./index.js');
    main();
    expect(buildCommand).toHaveBeenCalled();
    expect(testCommand).not.toHaveBeenCalled();
  });

  it('dispatches test command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'test'];
    const { main, buildCommand, testCommand } = await import('./index.js');
    main();
    expect(testCommand).toHaveBeenCalled();
    expect(buildCommand).not.toHaveBeenCalled();
  });

  it('dispatches build with --test flag', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'build', '--test'];
    const { main, buildCommand, testCommand } = await import('./index.js');
    main();
    expect(buildCommand).toHaveBeenCalled();
    expect(testCommand).toHaveBeenCalled();
  });

  it('dispatches ml data-generate command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn().mockReturnValue({ totalRows: 42, clipResults: {} }),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'data-generate', '--clips', '/vids', '--qps', '22,27'];
    const { main, dataGenerateCommand } = await import('./index.js');
    main();
    expect(dataGenerateCommand).toHaveBeenCalled();
  });

  it('dispatches ml data-generate with --clips-config', async () => {
    jest.unstable_mockModule('node:fs', () => ({
      readFileSync: jest.fn().mockReturnValue(JSON.stringify([
        { path: '/vids/a.yuv', name: 'a', width: 1920, height: 1080, fps: 50 },
        { path: '/vids/b.yuv', name: 'b', width: 832, height: 480, fps: 30 },
      ])),
      realpathSync: jest.fn(),
      existsSync: jest.fn().mockReturnValue(true),
    }));
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn().mockReturnValue({ totalRows: 42, clipResults: {} }),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'data-generate', '--clips-config', '/cfg/clips.json'];
    const { main, dataGenerateCommand } = await import('./index.js');
    main();
    expect(dataGenerateCommand).toHaveBeenCalled();
  });

  it('dispatches ml data-split command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn().mockReturnValue({ trainPath: '', valPath: '', trainRows: 0, valRows: 0 }),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'data-split', '--data-dir', '/data', '--train-ratio', '0.7'];
    const { main, dataSplitCommand } = await import('./index.js');
    main();
    expect(dataSplitCommand).toHaveBeenCalled();
  });

  it('dispatches ml train command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn().mockReturnValue({ models: [], perSplitAuc: {} }),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'train', '--data-dir', '/data', '--model-dir', '/models'];
    const { main, trainCommand } = await import('./index.js');
    main();
    expect(trainCommand).toHaveBeenCalled();
  });

  it('dispatches ml encode command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn().mockReturnValue({ encodingTimeMs: 0, mlSkipRate: 0, avgConfidence: 0, bitrate: 0, psnr: 0 }),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'encode', '--clip', '/vids/test.yuv', '--qp', '27'];
    const { main, encodeCommand } = await import('./index.js');
    main();
    expect(encodeCommand).toHaveBeenCalled();
  });

  it('dispatches ml bench command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn().mockReturnValue({
        baseline: {} as any, ml: {} as any, speedupPercent: 5, bdRate: -2,
      }),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'bench', '--clip', '/vids/test.yuv', '--qps', '22,27,32,37'];
    const { main, benchCommand } = await import('./index.js');
    main();
    expect(benchCommand).toHaveBeenCalled();
  });

  it('dispatches ml sweep command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn().mockReturnValue({ results: {} }),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'sweep', '--clip', '/vids/test.yuv', '--thresholds', '0.3,0.5,0.7'];
    const { main, sweepCommand } = await import('./index.js');
    main();
    expect(sweepCommand).toHaveBeenCalled();
  });

  it('dispatches ml feedback command', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn().mockReturnValue({ mispredictions: 1, augmentedRows: 1, trainReport: { models: [], perSplitAuc: {} } }),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'feedback', '--clip', '/vids/test.yuv', '--confidence', '0.6'];
    const { main, feedbackCommand } = await import('./index.js');
    main();
    expect(feedbackCommand).toHaveBeenCalled();
  });

  it('exits on ml encode without --clip', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'encode'];
    const { main } = await import('./index.js');
    expect(() => main()).toThrow('process.exit called');
  });

  it('exits on ml bench without --clip', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'bench'];
    const { main } = await import('./index.js');
    expect(() => main()).toThrow('process.exit called');
  });

  it('exits on ml sweep without --clip', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'sweep'];
    const { main } = await import('./index.js');
    expect(() => main()).toThrow('process.exit called');
  });

  it('exits on ml feedback without --clip', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'feedback'];
    const { main } = await import('./index.js');
    expect(() => main()).toThrow('process.exit called');
  });

  it('exits on ml data-generate without --clips', async () => {
    jest.unstable_mockModule('./commands/build.js', () => ({
      buildCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/test.js', () => ({
      testCommand: jest.fn(),
      findProjectRoot: jest.fn(),
    }));
    jest.unstable_mockModule('./commands/ml.js', () => ({
      dataGenerateCommand: jest.fn(),
      dataSplitCommand: jest.fn(),
      trainCommand: jest.fn(),
      encodeCommand: jest.fn(),
      benchCommand: jest.fn(),
      sweepCommand: jest.fn(),
      feedbackCommand: jest.fn(),
    }));
    jest.unstable_mockModule('./config.js', () => ({
      loadConfig: jest.fn().mockReturnValue({}),
    }));

    process.argv = ['node', 'lib/index.js', 'ml', 'data-generate'];
    const { main } = await import('./index.js');
    expect(() => main()).toThrow('process.exit called');
  });
});
