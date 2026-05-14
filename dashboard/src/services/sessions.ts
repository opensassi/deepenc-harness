import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { TTLCache } from './cache.js';
import type {
  NormalizedDay, FormatA, FormatB,
  SessionDetail, SessionEntry, SearchResult,
} from '../types.js';

function normalizeDay(raw: unknown, date: string): NormalizedDay {
  const a = raw as FormatA;
  if (a && typeof a === 'object' && 'dashboard' in a && a.dashboard) {
    const ds = a.dashboard.daily_summary;
    return {
      date: ds.date,
      metadata: a.dashboard.metadata,
      total_prompter_time_hours: ds.total_prompter_time_hours,
      total_sme_time_hours: ds.total_sme_time_hours,
      ai_multiplier: ds.ai_multiplier,
      total_sessions: ds.total_sessions,
      top_subject_areas: ds.top_subject_areas,
      session_breakdown: a.dashboard.session_breakdown,
    };
  }
  const b = raw as FormatB;
  if (b && typeof b === 'object' && 'date' in b && b.date) {
    return {
      date: b.date,
      total_prompter_time_hours: b.total_prompter_time_hours,
      total_sme_time_hours: b.total_sme_time_hours,
      ai_multiplier: b.ai_multiplier,
      total_sessions: b.total_sessions,
      top_subject_areas: b.top_subject_areas,
      session_breakdown: b.session_breakdown,
    };
  }
  return {
    date,
    total_prompter_time_hours: 0,
    total_sme_time_hours: 0,
    ai_multiplier: 0,
    total_sessions: 0,
    top_subject_areas: [],
    session_breakdown: [],
  };
}

export interface SessionsConfig {
  sessionsDir: string;
}

export class SessionsService {
  private dailyCache = new TTLCache<NormalizedDay>(60_000);
  private detailCache = new TTLCache<SessionDetail>(300_000);
  private daysListCache = new TTLCache<string[]>(30_000);
  private sessionsDir: string;

  constructor(sessionsDir: string) {
    this.sessionsDir = resolve(sessionsDir);
  }

  get dailyDir(): string {
    return join(this.sessionsDir, 'daily');
  }

  listDays(): string[] {
    const cached = this.daysListCache.get('list');
    if (cached) return cached;
    const dir = this.dailyDir;
    if (!existsSync(dir)) return [];
    const files = readdirSync(dir).filter(f => f.endsWith('.json')).map(f => f.replace(/\.json$/, '')).sort();
    this.daysListCache.set('list', files);
    return files;
  }

  listSessionsDirFiles(): string[] {
    if (!existsSync(this.sessionsDir)) return [];
    return readdirSync(this.sessionsDir).filter(f => f.endsWith('.json.bz2'));
  }

  getDay(date: string): NormalizedDay {
    const cached = this.dailyCache.get(date);
    if (cached) return cached;
    const path = join(this.dailyDir, `${date}.json`);
    if (!existsSync(path)) {
      const day: NormalizedDay = {
        date,
        total_prompter_time_hours: 0,
        total_sme_time_hours: 0,
        ai_multiplier: 0,
        total_sessions: 0,
        top_subject_areas: [],
        session_breakdown: [],
      };
      this.dailyCache.set(date, day);
      return day;
    }
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    const day = normalizeDay(raw, date);
    this.dailyCache.set(date, day);
    return day;
  }

  getAllSessionsFlat(): Array<{ date: string; entry: SessionEntry }> {
    const days = this.listDays();
    const result: Array<{ date: string; entry: SessionEntry }> = [];
    for (const day of days) {
      const normalized = this.getDay(day);
      for (const entry of normalized.session_breakdown) {
        result.push({ date: day, entry });
      }
    }
    return result;
  }

  getSessionDetail(sessionId: string): SessionDetail | null {
    const cached = this.detailCache.get(sessionId);
    if (cached) return cached;
    const bz2File = this.resolveBz2File(sessionId);
    if (!bz2File) return null;
    const json = execFileSync('bzcat', [bz2File], { encoding: 'utf-8', maxBuffer: 100 * 1024 * 1024 });
    const detail = JSON.parse(json) as SessionDetail;
    this.detailCache.set(sessionId, detail);
    return detail;
  }

  getSessionSummary(sessionId: string): string | null {
    const mdFile = this.resolveMdFile(sessionId);
    if (!mdFile) return null;
    return readFileSync(mdFile, 'utf-8');
  }

  private resolveBz2File(sessionId: string): string | null {
    const exact = join(this.sessionsDir, `${sessionId}.json.bz2`);
    if (existsSync(exact)) return exact;
    const files = this.listSessionsDirFiles();
    const match = files.find(f => f.startsWith(sessionId) && f.endsWith('.json.bz2'));
    if (match) return join(this.sessionsDir, match);
    return null;
  }

  private resolveMdFile(sessionId: string): string | null {
    const exact = join(this.sessionsDir, `${sessionId}.md`);
    if (existsSync(exact)) return exact;
    if (!existsSync(this.sessionsDir)) return null;
    const files = readdirSync(this.sessionsDir).filter(f => f.endsWith('.md'));
    const match = files.find(f => f.startsWith(sessionId));
    if (match) return join(this.sessionsDir, match);
    return null;
  }

  search(query: string): SearchResult[] {
    const q = query.toLowerCase();
    const results: SearchResult[] = [];
    const days = this.listDays();
    for (const day of days) {
      const normalized = this.getDay(day);
      for (const entry of normalized.session_breakdown) {
        if (entry.top_component_summary.toLowerCase().includes(q)) {
          results.push({
            session_id: entry.session_id,
            date: day,
            summary: entry.top_component_summary,
            tags: entry.tags,
            match_type: 'summary',
            match_snippet: entry.top_component_summary,
          });
          continue;
        }
        const matchedTag = entry.tags.find(t => t.toLowerCase().includes(q));
        if (matchedTag) {
          results.push({
            session_id: entry.session_id,
            date: day,
            summary: entry.top_component_summary,
            tags: entry.tags,
            match_type: 'tag',
            match_snippet: matchedTag,
          });
          continue;
        }
        const detail = this.getSessionDetail(entry.session_id);
        if (detail) {
          for (const msg of detail.messages) {
            for (const part of msg.parts) {
              if (part.text && part.text.toLowerCase().includes(q)) {
                const snippet = part.text.slice(Math.max(0, part.text.toLowerCase().indexOf(q) - 40), part.text.toLowerCase().indexOf(q) + 80);
                results.push({
                  session_id: entry.session_id,
                  date: day,
                  summary: entry.top_component_summary,
                  tags: entry.tags,
                  match_type: 'transcript',
                  match_snippet: snippet,
                });
                break;
              }
            }
            if (results.length > 0 && results[results.length - 1].session_id === entry.session_id && results[results.length - 1].match_type === 'transcript') break;
          }
        }
      }
    }
    return results;
  }

  refresh(): void {
    this.dailyCache.invalidateAll();
    this.daysListCache.invalidateAll();
    this.detailCache.invalidateAll();
  }
}
