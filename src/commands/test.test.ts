import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('node:child_process', () => ({
  execSync: jest.fn(),
}));

jest.unstable_mockModule('node:fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
}));

const { testCommand } = await import('./test.js');
const { execSync } = await import('node:child_process');

describe('testCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('tests release-shared by default', () => {
    testCommand({ variant: 'release', static: false });
    expect(execSync).toHaveBeenCalledWith(
      'ctest --test-dir build/release-shared --output-on-failure',
      expect.objectContaining({ stdio: 'inherit' }),
    );
  });

  it('tests debug variant', () => {
    testCommand({ variant: 'debug', static: false });
    expect(execSync).toHaveBeenCalledWith(
      'ctest --test-dir build/debug-shared --output-on-failure',
      expect.any(Object),
    );
  });

  it('tests static build', () => {
    testCommand({ variant: 'release', static: true });
    expect(execSync).toHaveBeenCalledWith(
      'ctest --test-dir build/release-static --output-on-failure',
      expect.any(Object),
    );
  });

  it('tests debug static variant', () => {
    testCommand({ variant: 'debug', static: true });
    expect(execSync).toHaveBeenCalledWith(
      'ctest --test-dir build/debug-static --output-on-failure',
      expect.any(Object),
    );
  });

  it('tests relwithdebinfo variant', () => {
    testCommand({ variant: 'relwithdebinfo', static: false });
    expect(execSync).toHaveBeenCalledWith(
      'ctest --test-dir build/relwithdebinfo-shared --output-on-failure',
      expect.any(Object),
    );
  });
});
