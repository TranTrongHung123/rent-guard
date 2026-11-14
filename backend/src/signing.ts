import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AnalysisReport } from '../../shared/contracts.js';

/** Stable serialization survives JSON persistence and property reordering. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function signReport(report: AnalysisReport, secret: string): string { return `v1.${createHmac('sha256', secret).update(`rentguard-report:v1:${stable(report)}`).digest('base64url')}`; }
export function verifyReport(report: AnalysisReport, token: string, secret: string): boolean {
  // Bare tokens were emitted by the initial local implementation; accept them for migration.
  // Unknown versioned formats fail closed. No TTL: phone history should survive a restart.
  const legacy = /^[A-Za-z0-9_-]{43}$/.test(token);
  const expected = Buffer.from(legacy ? createHmac('sha256', secret).update(stable(report)).digest('base64url') : signReport(report, secret));
  const actual = Buffer.from(token);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
