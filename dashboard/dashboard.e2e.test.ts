import { test, expect } from '@playwright/test';
import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';

const HARNESS_DIR = resolve(import.meta.dirname ?? '.', '..');
let server: ChildProcess;
const PORT = 3099;

test.beforeAll(() => {
  server = spawn('node', ['lib/index.js', 'dashboard', '--port', String(PORT)], {
    cwd: HARNESS_DIR,
    stdio: 'pipe',
  });
  // Wait for server to start
  const maxWait = 10000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      execSync(`curl -sf http://127.0.0.1:${PORT}/api/health`, { stdio: 'ignore' });
      break;
    } catch {
      execSync('sleep 0.3');
    }
  }
});

test.afterAll(() => {
  if (server) {
    server.kill();
  }
});

test.describe('API endpoints', () => {

  test('GET /api/health returns ok', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.days_count).toBeGreaterThan(0);
    expect(body.sessions_count).toBeGreaterThan(0);
  });

  test('GET /api/days returns day list', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/days`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.days).toBeInstanceOf(Array);
    expect(body.days.length).toBeGreaterThanOrEqual(2);
    expect(body.days).toContain('2026-05-11');
  });

  test('GET /api/days/latest returns latest day', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/days/latest`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.date).toBe('2026-05-12');
    expect(body.total_sessions).toBeGreaterThan(0);
    expect(body.session_breakdown).toBeInstanceOf(Array);
  });

  test('GET /api/days/:date returns specific day', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/days/2026-05-11`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.date).toBe('2026-05-11');
    expect(body.total_sessions).toBe(10);
    expect(body.total_prompter_time_hours).toBe(18.8);
    expect(body.total_sme_time_hours).toBe(287.5);
    expect(body.ai_multiplier).toBe(15.3);
    expect(body.top_subject_areas.length).toBeGreaterThan(0);
    expect(body.session_breakdown.length).toBe(10);
  });

  test('GET /api/days/:date 404 on missing date', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/days/2099-01-01`);
    expect(res.status).toBe(404);
  });

  test('GET /api/sessions returns paginated sessions', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/sessions`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.total).toBeGreaterThan(0);
    expect(body.sessions).toBeInstanceOf(Array);
    expect(body.sessions.length).toBeGreaterThan(0);
    expect(body.sessions[0]).toHaveProperty('date');
    expect(body.sessions[0]).toHaveProperty('entry');
    expect(body.sessions[0].entry).toHaveProperty('session_id');
    expect(body.sessions[0].entry).toHaveProperty('duration_minutes');
    expect(body.sessions[0].entry).toHaveProperty('tags');
  });

  test('GET /api/sessions/:id returns session with detail', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/sessions/2026-05-12-asm-optimizer-dq-implementation`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.summary).toBeTruthy();
    expect(body.summary.entry.session_id).toContain('2026-05-12-asm-optimizer');
    expect(body.detail).toBeTruthy();
    expect(body.detail.info).toHaveProperty('title');
    expect(body.detail.messages).toBeInstanceOf(Array);
  });

  test('GET /api/sessions/:id 404 on missing session', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/sessions/nonexistent-session`);
    expect(res.status).toBe(404);
  });

  test('GET /api/stats returns cross-day aggregates', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/stats`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.total_days).toBe(2);
    expect(body.total_sessions).toBe(18);
    expect(body.total_prompter_time_hours).toBeGreaterThan(0);
    expect(body.total_sme_time_hours).toBeGreaterThan(0);
    expect(body.avg_multiplier).toBeGreaterThan(0);
    expect(body.per_day).toBeInstanceOf(Array);
    expect(body.per_day.length).toBe(2);
  });

  test('GET /api/search returns results', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/search?q=SIMD`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0]).toHaveProperty('session_id');
    expect(body.results[0]).toHaveProperty('match_type');
  });

  test('GET /api/search returns empty for no match', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/search?q=zzz_nonexistent_zzz`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.results).toBeInstanceOf(Array);
    expect(body.results.length).toBe(0);
  });

  test('GET /api/git/log returns commits', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/git/log`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.commits).toBeInstanceOf(Array);
    expect(body.commits.length).toBeGreaterThan(0);
    expect(body.commits[0]).toHaveProperty('commit');
    expect(body.commits[0]).toHaveProperty('message');
  });

  test('GET /api/git/stats returns stats', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/git/stats`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.total_commits).toBeGreaterThan(0);
    expect(body).toHaveProperty('per_date');
  });

  test('GET /api/git/commit/:hash returns diff', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/git/commit/HEAD`);
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(body.diff).toBeTruthy();
    expect(body.diff.length).toBeGreaterThan(100);
  });

  test('GET /api/git/commit/:hash 404 on missing', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/git/commit/0000000000000000000000000000000000000000`);
    expect(res.status).toBe(404);
  });
});

test.describe('Frontend pages', () => {

  test('serves index.html at /', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await expect(page.locator('nav')).toBeVisible();
    await expect(page.locator('.nav-brand')).toHaveText('deepenc-harness');
  });

  test('hash routing renders overview page', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/`);
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('navigates to Daily tab', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/`);
    await page.click('a[href="#/daily"]');
    await page.waitForSelector('.page-title');
    await expect(page.locator('.page-title')).toHaveText('Daily Reports');
  });

  test('opens a daily detail page', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/daily/2026-05-11`);
    await page.waitForSelector('.page-title');
    await expect(page.locator('.page-title')).toHaveText('2026-05-11');
    await expect(page.locator('.stats-grid .card-value').first()).toBeVisible();
  });

  test('opens a session page from daily', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/daily/2026-05-12`);
    await page.waitForSelector('.session-card');
    await page.click('.session-card');
    await page.waitForSelector('.page-title');
    const title = await page.locator('.page-title').textContent();
    expect(title).toContain('2026-05-12');
  });

  test('search page works', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/search?q=SIMD`);
    await page.waitForSelector('.page-title');
    await expect(page.locator('.page-title')).toHaveText('Search');
    await page.waitForSelector('.session-card');
    const cards = await page.locator('.session-card').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('git page renders commits', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/git`);
    await page.waitForSelector('.page-title');
    await expect(page.locator('.page-title')).toHaveText('Git Activity');
    await page.waitForSelector('.session-card');
    const commits = await page.locator('.session-card').count();
    expect(commits).toBeGreaterThan(0);
  });

  test('experiments list page renders experiments', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/experiments`);
    await page.waitForSelector('.page-title');
    await expect(page.locator('.page-title')).toHaveText('Experiments');
    await page.waitForSelector('.session-card');
    const cards = await page.locator('.session-card').count();
    expect(cards).toBeGreaterThan(0);
  });

  test('experiment detail page loads with readme and files', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/experiments`);
    await page.waitForSelector('.session-card');
    await page.click('.session-card');
    await page.waitForSelector('.page-title');
    const title = await page.locator('.page-title').textContent();
    expect(title.length).toBeGreaterThan(0);
    const fileLinks = await page.locator('.exp-file-link').count();
    expect(fileLinks).toBeGreaterThan(0);
  });

  test('experiment file viewer loads file content', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/experiments`);
    await page.waitForSelector('.session-card');
    await page.click('.session-card');
    await page.waitForSelector('.exp-file-link');
    await page.click('.exp-file-link');
    await page.waitForSelector('#exp-file-viewer pre', { timeout: 10000 });
    const text = await page.locator('#exp-file-viewer pre').textContent();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('specs tree renders technical-specification.md first', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/specs`);
    await page.waitForSelector('.page-title');
    await expect(page.locator('.page-title')).toHaveText('Technical Specifications');
    // The first link should be technical-specification.md
    const firstLink = page.locator('a[href*="spec/"]').first();
    await expect(firstLink).toBeVisible();
    const text = await firstLink.textContent();
    expect(text).toBe('technical-specification.md');
  });

  test('specs tree loads a spec file', async ({ page }) => {
    await page.goto(`http://127.0.0.1:${PORT}/#/specs`);
    await page.waitForSelector('.page-title');
    // Click first file link (technical-specification.md)
    const firstLink = page.locator('a[href*="spec/"]').first();
    await firstLink.click();
    await page.waitForSelector('.page-title');
    const title = await page.locator('.page-title').textContent();
    expect(title).toContain('technical-specification.md');
  });
});
