# Technical Specification: deepenc-harness Dashboard

## 1. Overview

The dashboard is a localhost-only HTTP web application that visualizes session data from `../sessions/daily/`, provides drill-down into individual session transcripts (`.json.bz2`), and overlays Git history for context. It runs as a subcommand of `deepenc-harness` and is isolated from the core harness code.

**Key design constraints:**
- Localhost only — zero security considerations, no auth, no CORS
- No bundler — vanilla HTML/CSS/JS served directly by Express
- CDN-loaded libraries only (Chart.js)
- Zero coupling to the core harness — `dashboard/` is a self-contained module

---

## 2. Directory Structure

```
deepenc-harness/
  dashboard/
    technical-specification.md
    src/
      index.ts              # Server entry point (Express setup, listen)
      routes/
        api.ts              # All REST API route handlers
      services/
        sessions.ts         # Daily file reader, session detail (.bz2) reader
        git.ts              # Git log/diff/stats via child_process
      types.ts              # Dashboard-specific type definitions
    public/
      index.html            # SPA shell
      style.css             # All dashboard styles
      app.js                # Client-side router, chart rendering, fetch
```

---

## 3. CLI Integration

Add `dashboard` as a new top-level command alongside `build`, `test`, and `ml`:

```
deepenc-harness dashboard [options]

Options:
  --port <n>       HTTP server port (default: 3000)
  --sessions <path> Path to sessions directory (default: ../sessions)
  --host <addr>    Bind address (default: 127.0.0.1)
```

### Implementation approach in `src/index.ts`

The existing CLI parser (`parseArgs`) handles `build`, `test`, and `ml`. A new branch for `dashboard` imports and starts the Express server:

```typescript
// In src/index.ts parseArgs()
if (arg === 'dashboard' && !command) {
  command = 'dashboard';
  continue;
}

// In main():
} else if (command === 'dashboard') {
  const { startDashboard } = await import('../dashboard/src/index.js');
  startDashboard(port, sessionsPath, host);
}
```

The dashboard module is imported lazily (dynamic `import()`) so its dependencies (express, etc.) are only loaded when the dashboard command is used. This keeps the core CLI fast.

Alternatively, to keep the dashboard fully isolated, the dashboard can be a separate npm workspace or even a standalone script. But for simplicity, lazy dynamic import from the core harness is sufficient.

---

## 4. HTTP Server (Express)

### Dependencies

```json
{
  "dependencies": {
    "express": "^5.1.0"
  },
  "devDependencies": {
    "@types/express": "^5.0.0"
  }
}
```

Using Express 5.x (latest for Node 18+ ESM support). Only `express` is needed as a runtime dependency — `@types/express` is a dev dependency.

### Server Setup (`dashboard/src/index.ts`)

```
Express static middleware → dashboard/public/
REST API routes           → /api/*
SPA catch-all             → index.html for unknown routes (hash-based routing)
```

Key server configuration:
- Static files from `dashboard/public/` served at `/`
- JSON response compression via Express built-in compression (or `compression` middleware)
- No CORS headers needed (localhost only)
- Error middleware returning JSON for API, HTML for static (or just JSON everywhere since SPA)
- Graceful shutdown on SIGINT/SIGTERM

### Port resolution

1. Check `--port` CLI arg
2. Fallback to `DEEPENC_DASHBOARD_PORT` env var
3. Default to `3000`

Print the URL on startup:
```
=> deepenc-harness dashboard running at http://127.0.0.1:3000
```

---

## 5. Data Layer

### 5.1 Sessions Directory Layout

```
../sessions/
  daily/
    YYYY-MM-DD.json              # Daily summary + session breakdown
  YYYY-MM-DD-<slug>-<id>.json.bz2  # Full session transcript (bzip2)
  YYYY-MM-DD-<slug>-<id>.md        # Human-readable session summary
  YYYY-MM-DD-<slug>-<id>.sha256    # Integrity hash
```

### 5.2 Daily File Schema (two formats exist)

Format A (wrapped in `dashboard` key):
```typescript
interface DailyFileFormatA {
  dashboard: {
    metadata: { generated_at: string; audited: boolean; audit_note: string };
    daily_summary: DailySummary;
    session_breakdown: SessionBreakdownEntry[];
  };
}
```

Format B (flat):
```typescript
interface DailyFileFormatB {
  date: string;
  total_prompter_time_hours: number;
  total_sme_time_hours: number;
  ai_multiplier: number;
  total_sessions: number;
  top_subject_areas: SubjectArea[];
  session_breakdown: SessionBreakdownEntry[];
}
```

Both are normalized into a single `NormalizedDay` type on read.

### 5.3 Types (`dashboard/src/types.ts`)

```typescript
export interface NormalizedDay {
  date: string;
  metadata?: { generated_at: string; audited: boolean; audit_note: string };
  total_prompter_time_hours: number;
  total_sme_time_hours: number;
  ai_multiplier: number;
  total_sessions: number;
  top_subject_areas: SubjectArea[];
  session_breakdown: SessionBreakdownEntry[];
}

export interface SubjectArea {
  name: string;
  prompter_time_hours: number;
  sme_time_hours: number;
  ai_multiplier: number;
}

export interface SessionBreakdownEntry {
  session_id: string;
  duration_minutes: number;
  prompter_time_minutes: number;
  sme_time_minutes: number;
  top_component_summary: string;
  tags: string[];
  human_confidence: "high" | "medium" | "low";
}

export interface SessionDetail {
  info: {
    id: string;
    slug: string;
    title: string;
    agent: string;
    model: { id: string; providerID: string };
    summary: { additions: number; deletions: number; files: number };
    time: { created: number; updated: number };
  };
  messages: SessionMessage[];
}

export interface SessionMessage {
  info: {
    role: string;
    time: { created: number };
    agent: string;
    model: { providerID: string; modelID: string };
    summary: { diffs: Array<{ path: string; type: string; lines: Record<string, number> }> };
    id: string;
  };
  parts: Array<{ type: string; text?: string }>;
}

export interface GitLogEntry {
  commit: string;
  author: string;
  date: string;
  message: string;
  files_changed: number;
  insertions: number;
  deletions: number;
}

export interface GitStats {
  total_commits: number;
  total_files_changed: number;
  total_insertions: number;
  total_deletions: number;
  per_date: Record<string, { commits: number; insertions: number; deletions: number }>;
}
```

### 5.4 Session Data Service (`dashboard/src/services/sessions.ts`)

**Reading daily files:**
- `listDays(): Promise<string[]>` — readdir on `../sessions/daily/`, filter `*.json`, extract `YYYY-MM-DD`
- `getDay(date: string): Promise<NormalizedDay>` — read JSON, normalize from either Format A or Format B, cache result

**Reading session detail:**
- `getSession(sessionId: string): Promise<SessionDetail>` — find `{sessionId}.json.bz2` in `../sessions/`, decompress with `brotli`/`bzip2` via `child_process` or a pure-JS bzip2 library, parse JSON

**Search:**
- `search(query: string): Promise<SearchResult[]>` — iterate across all daily files and session details, match against `top_component_summary`, `tags`, and message text

### 5.5 Git Service (`dashboard/src/services/git.ts`)

All Git operations shell out via `child_process.execFile` to `git` in the project root (`../` or `process.cwd()`):

- `getGitLog(since?: string, until?: string): Promise<GitLogEntry[]>` — `git log --oneline --stat --since=... --until=...`
- `getGitStats(): Promise<GitStats>` — `git shortlog -sn` and `git diff --stat` aggregated by day
- `getCommitDiff(commit: string): Promise<string>` — `git show <commit>` for full diff

### 5.6 Caching

Simple in-memory Map-based cache in `dashboard/src/services/cache.ts`:
- TTL-based expiry (default 60s for daily files, 300s for session details, no cache for git to keep it live)
- Manual invalidation when a new daily file appears (detected via fs.watch on `../sessions/daily/`)

---

## 6. REST API Endpoints

### 6.1 Sessions & Daily

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/days` | List available daily dates | `{ days: string[] }` |
| GET | `/api/days/:date` | Full normalized day payload | `NormalizedDay` |
| GET | `/api/days/latest` | Most recent day | `NormalizedDay` |
| GET | `/api/sessions` | All sessions across all days (flat, paginated) | `{ sessions: SessionBreakdownEntry[], total: number }` |
| GET | `/api/sessions/:sessionId` | Session detail + transcript | `{ summary: SessionBreakdownEntry, detail: SessionDetail }` |
| GET | `/api/stats` | Cross-day aggregate statistics | `{ total_days, total_sessions, total_prompter_time, total_sme_time, avg_multiplier, per_day: NormalizedDay[] }` |
| GET | `/api/search?q=string` | Full-text search | `{ results: SearchResult[] }` |

### 6.2 Git

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/git/log?since=YYYY-MM-DD&until=YYYY-MM-DD` | Git commit log | `{ commits: GitLogEntry[] }` |
| GET | `/api/git/stats` | Aggregated git contribution stats | `GitStats` |
| GET | `/api/git/commit/:hash` | Single commit diff | `{ diff: string }` |

### 6.3 Health

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| GET | `/api/health` | Liveness check | `{ status: "ok", days_count: number, sessions_count: number }` |

---

## 7. Frontend (Vanilla HTML/CSS/JS)

### 7.1 Architecture

Single-page application using hash-based routing:

```
#/                    → Overview dashboard
#/daily/2026-05-11    → Single day detail
#/session/<id>        → Session transcript reader
#/git                 → Git timeline overlay
#/search?q=...        → Search results
```

Routing implemented in `app.js` via `hashchange` event. No framework — pure DOM manipulation.

### 7.2 Pages

**Overview Dashboard (`#/`):**
- Summary cards: total sessions, total prompter hours, total SME hours, avg AI multiplier
- AI multiplier trend chart (line chart, Chart.js)
- Top subject areas bar chart (top 15 by SME hours)
- Session count per day bar chart
- Latest sessions table (10 most recent)

**Daily Detail (`#/daily/:date`):**
- Date header with aggregate numbers
- Session breakdown table (sortable by duration, prompter time, SME time)
- Pie chart of session time distribution
- Tag cloud (top tags by frequency)
- Subject area breakdown bar chart

**Session Detail (`#/session/:id`):**
- Session metadata card (title, agent, model, duration, file stats)
- Tag badges
- Summary description
- Expandable message transcript
- File diff list (from `messages[].info.summary.diffs`)
- Link to git commit if applicable

**Git Timeline (`#/git`):**
- Commits per day bar chart overlaid on session time
- Commit list with expandable diffs

**Search (`#/search?q=...`):**
- Results grouped by session
- Highlighted matching text in summaries

### 7.3 Chart.js Integration

Loaded from CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
```

Charts used:
- **Line chart** — AI multiplier trend, SME time trend
- **Bar chart** — top subject areas, session count per day, daily prompter/SME comparison
- **Pie/doughnut** — session time distribution, tag composition
- **Stacked bar** — prompter vs SME time per session

Chart instances are destroyed and recreated on page navigation to avoid canvas conflicts.

### 7.4 Styling

- Dark theme (matching a development tool aesthetic)
- CSS custom properties for theming
- Grid/flexbox layout
- Responsive within reason (desktop-first, localhost)
- No CSS framework — lightweight, minimal styles

### 7.5 Client-Side Data Fetching

All API calls via `fetch()`. Helper function:
```javascript
async function api(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

---

## 8. Implementation Plan

### Phase 1: Scaffolding
1. Create `dashboard/` directory structure
2. Add `express` and `@types/express` to root `package.json` (or workspace)
3. Implement `dashboard/src/index.ts` — Express server with static + route registration
4. Integrate `dashboard` command into `src/index.ts` CLI parser

### Phase 2: Data Layer
5. Implement `dashboard/src/types.ts`
6. Implement `dashboard/src/services/sessions.ts` — daily file reader + normalizer + bz2 reader
7. Implement `dashboard/src/services/git.ts` — git log/stats via child_process
8. Implement `dashboard/src/services/cache.ts` — in-memory TTL cache

### Phase 3: API
9. Implement `dashboard/src/routes/api.ts` — all endpoints

### Phase 4: Frontend
10. Create `dashboard/public/index.html` — SPA shell, hash router, page container
11. Create `dashboard/public/style.css` — dark theme, layout, components
12. Create `dashboard/public/app.js` — routing, API client, Chart.js rendering, all pages

### Phase 5: Polish
13. Start-up banner with URL
14. Graceful shutdown
15. Error handling for missing sessions directory, malformed JSON, bz2 read failures
16. `fs.watch` on sessions directory for auto-refresh (optional — SSE push to client)

---

## 9. Non-Goals / Future Considerations

- **Authentication**: Not needed — localhost only.
- **Bundling**: Not needed — vanilla JS with CDN Chart.js is sufficient.
- **WebSockets**: Nice-to-have for live reload when new session data appears. Initial implementation uses manual refresh. SSE could be added later.
- **CSS framework**: Not needed — custom styles are minimal and keep zero dependencies.
- **Testing**: The dashboard is a read-only visualization tool. Manual testing is sufficient for initial release. If automated tests are desired, use supertest for API + Playwright for E2E.
- **npm workspace**: Not needed initially. Dashboard lives in `dashboard/` and is imported lazily. If the dependency graph becomes complex, it can be promoted to a workspace.
