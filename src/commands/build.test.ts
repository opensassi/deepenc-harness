import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('node:child_process', () => ({
  execSync: jest.fn(),
}));

jest.unstable_mockModule('node:fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

const { buildCommand } = await import('./build.js');
const { execSync } = await import('node:child_process');

describe('buildCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds release-shared by default', () => {
    buildCommand({ variant: 'release', static: false, clean: false });
    expect(execSync).toHaveBeenCalledWith(
      'make install-release-shared',
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('builds debug variant', () => {
    buildCommand({ variant: 'debug', static: false, clean: false });
    expect(execSync).toHaveBeenCalledWith(
      'make install-debug-shared',
      expect.any(Object),
    );
  });

  it('builds static libraries', () => {
    buildCommand({ variant: 'release', static: true, clean: false });
    expect(execSync).toHaveBeenCalledWith(
      'make install-release',
      expect.any(Object),
    );
  });

  it('builds with clean first', () => {
    buildCommand({ variant: 'release', static: false, clean: true });
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(execSync).toHaveBeenNthCalledWith(
      1,
      'make clean-release-shared',
      expect.any(Object),
    );
    expect(execSync).toHaveBeenNthCalledWith(
      2,
      'make install-release-shared',
      expect.any(Object),
    );
  });

  it('passes jobs parameter', () => {
    buildCommand({ variant: 'release', static: false, clean: false, jobs: 8 });
    expect(execSync).toHaveBeenCalledWith(
      'make install-release-shared j=8',
      expect.any(Object),
    );
  });

  it('handles clean with jobs parameter', () => {
    buildCommand({ variant: 'debug', static: false, clean: true, jobs: 4 });
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(execSync).toHaveBeenNthCalledWith(
      1,
      'make clean-debug-shared j=4',
      expect.any(Object),
    );
    expect(execSync).toHaveBeenNthCalledWith(
      2,
      'make install-debug-shared j=4',
      expect.any(Object),
    );
  });

  it('builds debug static with clean', () => {
    buildCommand({ variant: 'debug', static: true, clean: true });
    expect(execSync).toHaveBeenNthCalledWith(
      1,
      'make clean-debug',
      expect.any(Object),
    );
    expect(execSync).toHaveBeenNthCalledWith(
      2,
      'make install-debug',
      expect.any(Object),
    );
  });

  it('runs cmake configure before build with --ml flag', () => {
    buildCommand({ variant: 'release', static: false, clean: false, ml: true });
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(execSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('cmake -S . -B build/release-shared'),
      expect.any(Object),
    );
    expect(execSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('-DVVENC_ENABLE_ML_LIGHTGBM=ON'),
      expect.any(Object),
    );
    expect(execSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('-DVVENC_ENABLE_AI_TRAINING=ON'),
      expect.any(Object),
    );
    expect(execSync).toHaveBeenNthCalledWith(
      2,
      'make install-release-shared',
      expect.any(Object),
    );
  });

  it('runs cmake configure for static build with --ml flag', () => {
    buildCommand({ variant: 'debug', static: true, clean: false, ml: true });
    expect(execSync).toHaveBeenCalledTimes(2);
    expect(execSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('cmake -S . -B build/debug'),
      expect.any(Object),
    );
    expect(execSync).toHaveBeenNthCalledWith(
      2,
      'make install-debug',
      expect.any(Object),
    );
  });

  it('exits when project root not found', async () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('exit called');
    }) as never);
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const mod = await import('node:fs');
    const origExists = mod.existsSync as jest.Mock;
    origExists.mockReturnValue(false);

    expect(() => buildCommand({ variant: 'release', static: false, clean: false })).toThrow('exit called');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('could not find project root'),
    );

    exitSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
