import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

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
});
