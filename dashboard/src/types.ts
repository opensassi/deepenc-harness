export interface SubjectArea {
  name: string;
  prompter_time_hours: number;
  sme_time_hours: number;
  ai_multiplier: number;
}

export interface SessionEntry {
  session_id: string;
  duration_minutes: number;
  prompter_time_minutes: number;
  sme_time_minutes: number;
  top_component_summary: string;
  tags: string[];
  human_confidence: 'high' | 'medium' | 'low';
}

export interface DailyMetadata {
  generated_at: string;
  audited: boolean;
  audit_note: string;
}

export interface NormalizedDay {
  date: string;
  metadata?: DailyMetadata;
  total_prompter_time_hours: number;
  total_sme_time_hours: number;
  ai_multiplier: number;
  total_sessions: number;
  top_subject_areas: SubjectArea[];
  session_breakdown: SessionEntry[];
}

export interface FormatA {
  dashboard: {
    metadata: DailyMetadata;
    daily_summary: {
      date: string;
      total_prompter_time_hours: number;
      total_sme_time_hours: number;
      ai_multiplier: number;
      total_sessions: number;
      top_subject_areas: SubjectArea[];
    };
    session_breakdown: SessionEntry[];
  };
}

export interface FormatB {
  date: string;
  total_prompter_time_hours: number;
  total_sme_time_hours: number;
  ai_multiplier: number;
  total_sessions: number;
  top_subject_areas: SubjectArea[];
  session_breakdown: SessionEntry[];
}

export interface SessionInfo {
  id: string;
  slug: string;
  title: string;
  agent: string;
  model: { id: string; providerID: string };
  summary: { additions: number; deletions: number; files: number };
  time: { created: number; updated: number };
}

export interface MessageInfo {
  role: string;
  time: { created: number };
  agent: string;
  model: { providerID: string; modelID: string };
  summary: { diffs: Array<{ path: string; type: string; lines: Record<string, number> }> };
  id: string;
}

export interface MessagePart {
  type: string;
  text?: string;
}

export interface SessionMessage {
  info: MessageInfo;
  parts: MessagePart[];
}

export interface SessionDetail {
  info: SessionInfo;
  messages: SessionMessage[];
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

export interface SearchResult {
  session_id: string;
  date: string;
  summary: string;
  tags: string[];
  match_type: 'summary' | 'tag' | 'transcript';
  match_snippet: string;
}

export interface CrossDayStats {
  total_days: number;
  total_sessions: number;
  total_prompter_time_hours: number;
  total_sme_time_hours: number;
  avg_multiplier: number;
  per_day: NormalizedDay[];
}

export interface SpecNode {
  name: string;
  path: string;
  isDir: boolean;
  children?: SpecNode[];
}

export interface HealthStatus {
  status: 'ok' | 'error';
  days_count: number;
  sessions_count: number;
  sessions_path: string;
}

export interface ExperimentEntry {
  date: string;
  directory: string;
  description: string;
  outcome: string;
  agent: string;
}

export interface ExperimentFile {
  path: string;
  name: string;
  size: number;
}

export interface ExperimentSubdir {
  name: string;
  files: ExperimentFile[];
}

export interface ExperimentDetail {
  entry: ExperimentEntry;
  readme: string | null;
  subdirs: ExperimentSubdir[];
  allFiles: ExperimentFile[];
}
