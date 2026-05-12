import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

jest.unstable_mockModule('node:fs', () => ({
  readFileSync: jest.fn(),
  realpathSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(),
  appendFileSync: jest.fn(),
}));

describe('parseArgs', () => {
  const originalExit = process.exit;
  const originalConsoleError = console.error;
  const originalConsoleLog = console.log;

  let exitMock: jest.SpiedFunction<typeof process.exit>;
  let consoleErrorMock: jest.SpiedFunction<typeof console.error>;
  let consoleLogMock: jest.SpiedFunction<typeof console.log>;

  beforeEach(() => {
    jest.resetModules();
    exitMock = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => {
        throw new Error('process.exit called');
      }) as never);
    consoleErrorMock = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    consoleLogMock = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    process.exit = originalExit;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
  });

  it('parses build command', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build']);
    expect(result.command).toBe('build');
    expect(result.opts).toMatchObject({
      variant: 'release',
      static: false,
      clean: false,
      test: false,
    });
  });

  it('parses test command', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['test']);
    expect(result.command).toBe('test');
  });

  it('parses build with all options', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs([
      'build',
      '--variant', 'debug',
      '--static',
      '--clean',
      '--jobs', '6',
      '--test',
    ]);
    expect(result.command).toBe('build');
    expect(result.opts).toMatchObject({
      variant: 'debug',
      static: true,
      clean: true,
      jobs: 6,
      test: true,
    });
  });

  it('parses test with variant and static', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['test', '-v', 'debug', '--static']);
    expect(result.command).toBe('test');
    expect(result.opts).toMatchObject({
      variant: 'debug',
      static: true,
    });
  });

  it('parses global --config option', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '--config', '/path/to/config.json']);
    expect(result.globals.config).toBe('/path/to/config.json');
  });

  it('parses global --verbose option', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '--verbose']);
    expect(result.globals.verbose).toBe(true);
  });

  it('parses global --output option', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '--output', 'json']);
    expect(result.globals.output).toBe('json');
  });

  it('exits on --help', async () => {
    const { parseArgs } = await import('./index.js');
    expect(() => parseArgs(['--help'])).toThrow('process.exit called');
    expect(consoleLogMock).toHaveBeenCalled();
  });

  it('exits on short -h', async () => {
    const { parseArgs } = await import('./index.js');
    expect(() => parseArgs(['build', '-h'])).toThrow('process.exit called');
    expect(consoleLogMock).toHaveBeenCalled();
  });

  it('exits on unknown argument', async () => {
    const { parseArgs } = await import('./index.js');
    expect(() => parseArgs(['build', '--bogus'])).toThrow('process.exit called');
    expect(consoleErrorMock).toHaveBeenCalledWith('Unknown argument: --bogus');
  });

  it('exits on missing command', async () => {
    const { parseArgs } = await import('./index.js');
    expect(() => parseArgs([])).toThrow('process.exit called');
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Missing command. Use --help for usage.',
    );
  });

  it('exits on invalid --output value', async () => {
    const { parseArgs } = await import('./index.js');
    expect(() => parseArgs(['build', '--output', 'bad'])).toThrow(
      'process.exit called',
    );
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Invalid output format: bad',
    );
  });

  it('uses short option -c for clean', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '-c']);
    expect(result.opts).toMatchObject({ clean: true });
  });

  it('uses short option -j for jobs', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '-j', '2']);
    expect(result.opts).toMatchObject({ jobs: 2 });
  });

  it('uses short option -t for test', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '-t']);
    expect(result.opts).toMatchObject({ test: true });
  });

  it('parses build --ml flag', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '--ml']);
    expect(result.command).toBe('build');
    expect((result.opts as any).ml).toBe(true);
  });

  it('parses ml command with subcommand', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['ml', 'train', '--model-dir', '/tmp/models']);
    expect(result.command).toBe('ml');
    expect(result.mlSubcommand).toBe('train');
  });

  it('parses ml data-generate subcommand', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['ml', 'data-generate', '--clips', '/vids', '--qps', '22,27,32,37']);
    expect(result.command).toBe('ml');
    expect(result.mlSubcommand).toBe('data-generate');
  });

  it('parses ml data-split with --train-ratio', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['ml', 'data-split', '--train-ratio', '0.9']);
    expect(result.command).toBe('ml');
    expect(result.mlSubcommand).toBe('data-split');
    expect((result.opts as any).trainRatio).toBe(0.9);
  });

  it('exits on ml without subcommand', async () => {
    const { parseArgs } = await import('./index.js');
    expect(() => parseArgs(['ml'])).toThrow('process.exit called');
    expect(consoleErrorMock).toHaveBeenCalledWith(
      'Missing ML subcommand. Use --help for usage.',
    );
  });

  it('exits on ml with invalid subcommand', async () => {
    const { parseArgs } = await import('./index.js');
    expect(() => parseArgs(['ml', 'bogus'])).toThrow('process.exit called');
    expect(consoleErrorMock).toHaveBeenCalledWith('Unknown argument: bogus');
  });

  it('parses all ml subcommands', async () => {
    const { parseArgs } = await import('./index.js');
    for (const sub of ['data-generate', 'data-split', 'train', 'encode', 'bench', 'sweep', 'feedback']) {
      jest.resetModules();
      const result = parseArgs(['ml', sub]);
      expect(result.mlSubcommand).toBe(sub);
    }
  });

  it('parses ml --script-path and --vvencapp-path', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs([
      'ml', 'train',
      '--script-path', '/opt/scripts/train.py',
      '--vvencapp-path', '/opt/bin/vvencapp',
    ]);
    expect((result.opts as any).scriptPath).toBe('/opt/scripts/train.py');
    expect((result.opts as any).vvencappPath).toBe('/opt/bin/vvencapp');
  });

  it('parses ml options: --model-dir, --data-dir', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs([
      'ml', 'train',
      '--model-dir', '/tmp/models',
      '--data-dir', '/tmp/data',
    ]);
    const opts = result.opts as any;
    expect(opts.modelDir).toBe('/tmp/models');
    expect(opts.dataDir).toBe('/tmp/data');
  });

  it('parses ml options: --qps, --thresholds, --confidence', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs([
      'ml', 'bench',
      '--qps', '22,27,32,37',
      '--confidence', '0.5',
    ]);
    const opts = result.opts as any;
    expect(opts.qps).toEqual([22, 27, 32, 37]);
    expect(opts.confidence).toBe(0.5);
  });

  it('parses ml --clip and --qp for encode', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs([
      'ml', 'encode',
      '--clip', '/vids/test.yuv',
      '--qp', '32',
    ]);
    const opts = result.opts as any;
    expect(opts.clipPath).toBe('/vids/test.yuv');
    expect(opts.qp).toBe(32);
  });

  it('parses ml --thresholds for sweep', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs([
      'ml', 'sweep',
      '--thresholds', '0.3,0.5,0.7,0.9',
    ]);
    expect((result.opts as any).thresholds).toEqual([0.3, 0.5, 0.7, 0.9]);
  });

  it('parses global --output csv', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '--output', 'csv']);
    expect(result.globals.output).toBe('csv');
  });

  it('parses --static and -c short options', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '--static', '-c']);
    expect((result.opts as any).static).toBe(true);
    expect((result.opts as any).clean).toBe(true);
  });

  it('parses -v short variant and -j short jobs', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '-v', 'debug', '-j', '4']);
    expect((result.opts as any).variant).toBe('debug');
    expect((result.opts as any).jobs).toBe(4);
  });

  it('parses -t short test flag', async () => {
    const { parseArgs } = await import('./index.js');
    const result = parseArgs(['build', '-t']);
    expect((result.opts as any).test).toBe(true);
  });
});
