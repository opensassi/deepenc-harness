import { Router, type Request, type Response } from 'express';
import { extname } from 'node:path';
import { SessionsService } from '../services/sessions.js';
import { GitService } from '../services/git.js';
import { ExperimentsService } from '../services/experiments.js';
import { TechSpecService } from '../services/specs.js';
import type { CrossDayStats, HealthStatus } from '../types.js';

function qs(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && v.length > 0) return String(v[0]);
  return undefined;
}

export function createApiRouter(sessionsDir: string, repoDir: string, experimentsDir?: string, gitSince?: string, specsRoot?: string): Router {
  const router = Router();
  const sessions = new SessionsService(sessionsDir);
  const git = new GitService(repoDir, gitSince);
  const experiments = experimentsDir ? new ExperimentsService(experimentsDir) : null;
  const specs = specsRoot ? new TechSpecService(specsRoot) : null;

  router.get('/health', (_req: Request, res: Response) => {
    const days = sessions.listDays();
    const flat = sessions.getAllSessionsFlat();
    const health: HealthStatus = {
      status: days.length > 0 ? 'ok' : 'error',
      days_count: days.length,
      sessions_count: flat.length,
      sessions_path: sessionsDir,
    };
    res.json(health);
  });

  router.get('/days', (_req: Request, res: Response) => {
    const days = sessions.listDays();
    res.json({ days });
  });

  router.get('/days/latest', (_req: Request, res: Response) => {
    const days = sessions.listDays();
    if (days.length === 0) {
      res.status(404).json({ error: 'No daily data found' });
      return;
    }
    const day = sessions.getDay(days[days.length - 1]);
    res.json(day);
  });

  router.get('/days/:date', (req: Request, res: Response) => {
    const date = String(req.params.date);
    const day = sessions.getDay(date);
    if (day.total_sessions === 0 && day.top_subject_areas.length === 0) {
      res.status(404).json({ error: `No data for date: ${date}` });
      return;
    }
    res.json(day);
  });

  router.get('/sessions', (req: Request, res: Response) => {
    const flat = sessions.getAllSessionsFlat();
    const page = parseInt(qs(req.query.page) ?? '') || 1;
    const limit = parseInt(qs(req.query.limit) ?? '') || 50;
    const start = (page - 1) * limit;
    const paginated = flat.slice(start, start + limit);
    res.json({ sessions: paginated, total: flat.length, page, limit });
  });

  router.get('/sessions/:sessionId/summary', (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const flat = sessions.getAllSessionsFlat();
    const summary = flat.find(s => s.entry.session_id === sessionId);
    if (!summary) {
      res.status(404).json({ error: `Session not found: ${sessionId}` });
      return;
    }
    const md = sessions.getSessionSummary(sessionId);
    if (!md) {
      res.status(404).json({ error: 'No summary file found for this session' });
      return;
    }
    res.json({ summary, markdown: md });
  });

  router.get('/sessions/:sessionId', (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    const flat = sessions.getAllSessionsFlat();
    const summary = flat.find(s => s.entry.session_id === sessionId);
    if (!summary) {
      res.status(404).json({ error: `Session not found: ${sessionId}` });
      return;
    }
    const detail = sessions.getSessionDetail(sessionId);
    res.json({ summary, detail });
  });

  router.get('/stats', (_req: Request, res: Response) => {
    const days = sessions.listDays();
    const normalizedDays = days.map(d => sessions.getDay(d));
    let totalSessions = 0;
    let totalPrompter = 0;
    let totalSme = 0;
    let multiplierSum = 0;
    let multiplierCount = 0;
    for (const day of normalizedDays) {
      totalSessions += day.total_sessions;
      totalPrompter += day.total_prompter_time_hours;
      totalSme += day.total_sme_time_hours;
      if (day.ai_multiplier > 0) {
        multiplierSum += day.ai_multiplier;
        multiplierCount++;
      }
    }
    const stats: CrossDayStats = {
      total_days: days.length,
      total_sessions: totalSessions,
      total_prompter_time_hours: Math.round(totalPrompter * 10) / 10,
      total_sme_time_hours: Math.round(totalSme * 10) / 10,
      avg_multiplier: multiplierCount > 0 ? Math.round((multiplierSum / multiplierCount) * 10) / 10 : 0,
      per_day: normalizedDays,
    };
    res.json(stats);
  });

  router.get('/search', (req: Request, res: Response) => {
    const query = qs(req.query.q) ?? '';
    if (!query.trim()) {
      res.json({ results: [] });
      return;
    }
    const results = sessions.search(query.trim());
    res.json({ results });
  });

  router.get('/refresh', (_req: Request, res: Response) => {
    sessions.refresh();
    res.json({ status: 'refreshed' });
  });

  router.get('/git/log', (req: Request, res: Response) => {
    const since = qs(req.query.since);
    const until = qs(req.query.until);
    const forkRange = git.detectForkPoint();
    const range = since ? undefined : git.getRange(forkRange);
    const commits = git.getLog(since, until, range);
    res.json({ commits, forkRange });
  });

  router.get('/git/stats', (_req: Request, res: Response) => {
    const forkRange = git.detectForkPoint();
    const range = git.getRange(forkRange);
    const stats = git.getStats(range);
    res.json(stats);
  });

  router.get('/git/commit/:hash', (req: Request, res: Response) => {
    const diff = git.getCommitDiff(String(req.params.hash));
    if (!diff) {
      res.status(404).json({ error: 'Commit not found' });
      return;
    }
    res.json({ diff });
  });

  if (specs) {
    router.get('/specs', (_req: Request, res: Response) => {
      const tree = specs.getTree();
      res.json(tree);
    });

    router.get('/specs/read', (req: Request, res: Response) => {
      const specPath = qs(req.query.path);
      if (!specPath) {
        res.status(400).json({ error: 'path query parameter required' });
        return;
      }
      const content = specs.readSpec(specPath);
      if (content === null) {
        res.status(404).json({ error: 'Spec not found' });
        return;
      }
      res.json({ path: specPath, content });
    });
  }

  if (experiments) {
    router.get('/experiments', (_req: Request, res: Response) => {
      const entries = experiments.listExperiments();
      res.json({ experiments: entries });
    });

    router.get('/experiments/:name', (req: Request, res: Response) => {
      const detail = experiments.getExperiment(String(req.params.name));
      if (!detail) {
        res.status(404).json({ error: 'Experiment not found' });
        return;
      }
      res.json(detail);
    });

    router.get('/experiments/:name/read', (req: Request, res: Response) => {
      const filePath = qs(req.query.path);
      const raw = qs(req.query.raw);
      if (!filePath) {
        res.status(400).json({ error: 'path query parameter required' });
        return;
      }
      if (raw === 'true') {
        const buf = experiments.readFileRaw(filePath);
        if (!buf) {
          res.status(404).json({ error: 'File not found' });
          return;
        }
        const ext = extname(filePath).toLowerCase();
        const mime: Record<string, string> = {
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.svg': 'image/svg+xml',
          '.html': 'text/html; charset=utf-8',
        };
        res.type(mime[ext] ?? 'application/octet-stream').send(buf);
        return;
      }
      const content = experiments.readFile(filePath);
      if (content === null) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      res.json({ path: filePath, content });
    });
  }

  return router;
}
