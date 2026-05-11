import { readFileSync } from 'node:fs';

export interface HarnessConfig {
  verbose?: boolean;
  output?: 'text' | 'json' | 'csv';
}

export function loadConfig(configPath?: string): HarnessConfig {
  if (!configPath) {
    return {};
  }
  const content = readFileSync(configPath, { encoding: 'utf-8' });
  return JSON.parse(content) as HarnessConfig;
}
