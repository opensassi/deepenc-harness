import express from 'express';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { createApiRouter } from './routes/api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DashboardOptions {
  port: number;
  sessionsDir: string;
  repoDir: string;
  experimentsDir?: string;
  host: string;
  gitSince?: string;
}

export function startDashboard(opts: Partial<DashboardOptions> = {}): void {
  const port = opts.port ?? (parseInt(process.env.DEEPENC_DASHBOARD_PORT ?? '') || 3000);
  const host = opts.host ?? '127.0.0.1';
  const repoDir = opts.repoDir ?? resolve(process.cwd(), '..');
  const sessionsDir = opts.sessionsDir ?? resolve(repoDir, 'sessions');
  const experimentsDir = opts.experimentsDir ?? resolve(repoDir, 'perf', 'experiments');
  const specsDir = resolve(repoDir);
  const gitSince = opts.gitSince;

  const app = express();

  const publicDir = join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  app.use('/api', createApiRouter(sessionsDir, repoDir, experimentsDir, gitSince, specsDir));

  app.get('/{*path}', (_req, res) => {
    res.sendFile(join(publicDir, 'index.html'));
  });

  const server = app.listen(port, host, () => {
    console.log(`deepenc-harness dashboard running at http://${host}:${port}`);
    const hasData = existsSync(join(sessionsDir, 'daily'));
    if (!hasData) {
      console.log(`  (sessions directory not found at ${sessionsDir})`);
    }
  });

  const shutdown = () => {
    console.log('\nShutting down dashboard...');
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
