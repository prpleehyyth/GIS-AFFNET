// lib/logService.ts
const BASE = '/api';
const OPTS = { credentials: 'include' as RequestCredentials };

export type LogSeverity = 'critical' | 'warning' | 'info';
export type LogSource   = 'ONU' | 'ODP' | 'Infra' | 'System';

export interface LogEntry {
  id: number;
  severity: LogSeverity;
  source: LogSource;
  title: string;
  message: string;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

// ── Tulis log baru ────────────────────────────────────────────
export async function writeLog(
  severity: LogSeverity,
  source: LogSource,
  title: string,
  message: string
): Promise<void> {
  try {
    await fetch(`${BASE}/logs`, {
      ...OPTS,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity, source, title, message }),
    });
  } catch {
    console.warn('[logService] Gagal menulis log:', { severity, source, title });
  }
}

// ── Resolve log berdasarkan title + source ────────────────────
export async function resolveLog(title: string, source: LogSource): Promise<void> {
  try {
    await fetch(`${BASE}/logs/resolve-by-title`, {
      ...OPTS,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, source }),
    });
  } catch {
    console.warn('[logService] Gagal resolve log:', { title, source });
  }
}

// ── Fetch semua log ───────────────────────────────────────────
export async function fetchLogs(params?: {
  severity?: string;
  source?: string;
  resolved?: string;
}): Promise<LogEntry[]> {
  const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : '';
  const res = await fetch(`${BASE}/logs${qs}`, OPTS);
  if (!res.ok) throw new Error('Gagal fetch logs');
  return res.json();
}

// ── Resolve log by ID ─────────────────────────────────────────
export async function resolveLogById(id: number): Promise<void> {
  await fetch(`${BASE}/logs/${id}/resolve`, { ...OPTS, method: 'PUT' });
}

// ── Hapus log by ID ───────────────────────────────────────────
export async function deleteLog(id: number): Promise<void> {
  await fetch(`${BASE}/logs/${id}`, { ...OPTS, method: 'DELETE' });
}

// ── Hapus semua log resolved ──────────────────────────────────
export async function clearResolvedLogs(): Promise<void> {
  await fetch(`${BASE}/logs/resolved`, { ...OPTS, method: 'DELETE' });
}