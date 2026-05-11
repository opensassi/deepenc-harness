import { jest, describe, it, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('node:fs', () => ({
  readFileSync: jest.fn(),
}));

const { loadConfig } = await import('./config.js');
const readFileSync = (await import('node:fs')).readFileSync as jest.Mock;

describe('loadConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns empty object when no path is given', () => {
    const result = loadConfig();
    expect(result).toEqual({});
  });

  it('parses a valid config file', () => {
    readFileSync.mockReturnValue(
      JSON.stringify({ verbose: true, output: 'json' }),
    );
    const result = loadConfig('/path/to/config.json');
    expect(result).toEqual({ verbose: true, output: 'json' });
    expect(readFileSync).toHaveBeenCalledWith('/path/to/config.json', {
      encoding: 'utf-8',
    });
  });

  it('throws when file content is invalid JSON', () => {
    readFileSync.mockReturnValue('not json');
    expect(() => loadConfig('/bad.json')).toThrow();
  });

  it('throws when file does not exist', () => {
    readFileSync.mockImplementation(() => {
      throw new Error('ENOENT: no such file');
    });
    expect(() => loadConfig('/missing.json')).toThrow();
  });
});
