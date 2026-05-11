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
});
