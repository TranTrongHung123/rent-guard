import { createHash, createHmac } from 'node:crypto';
import type { AnalyzeRequest, AnalysisReport, ExtractedPage } from '../../shared/contracts.js';
import type { Config } from './config.js';
import { CONTRACT_CHECKS, CONTRACT_RULES, SAFETY_INSTRUCTIONS, SEVERITY_RUBRIC } from './rules.js';
import { AppError } from './errors.js';

/** Bump whenever prompts, schemas or analysis semantics change. */
export const ANALYSIS_VERSION = 'rentguard-v2.0.0';
export const SAMPLING_POLICY = 'temperature-zero-if-supported-v1';
export const sha256 = (value: string) => createHash('sha256').update(value, 'utf8').digest('hex');
export function analysisPolicyId(config: Config): string {
  return createHmac('sha256', config.signingSecret).update(JSON.stringify({ version: ANALYSIS_VERSION, model: config.model, checks: CONTRACT_CHECKS, rules: CONTRACT_RULES, safety: SAFETY_INSTRUCTIONS, rubric: SEVERITY_RUBRIC, sampling: SAMPLING_POLICY })).digest('hex');
}
/** Same UTF-8 JSON array + SHA-256 is used by Expo Crypto; IDs are excluded. */
export function inputFingerprint(pages: AnalyzeRequest['pages']): string { return sha256(JSON.stringify(pages.map(page => page.dataUrl))); }
export function textFingerprint(pages: ExtractedPage[]): string | null {
  if (!pages.length || pages.some(page => page.status !== 'readable')) return null;
  // Keep page boundaries, case, punctuation, accents and every amount. No fuzzy
  // match: a single changed digit or clause must invalidate this identity.
  return sha256(JSON.stringify(pages.map(page => page.text.normalize('NFC').replace(/\s+/gu, ' ').trim())));
}

/** Bounded, expiring RAM only; never writes contract text or images to disk. */
export class ReportCache {
  private entries = new Map<string, { report: AnalysisReport; expires: number; bytes: number }>();
  private bytes = 0;
  constructor(private ttlMs: number, private maxEntries: number, private clock = Date.now, private maxBytes = 8 * 1024 * 1024) {}
  private remove(key: string) { const old = this.entries.get(key); if (old) { this.bytes -= old.bytes; this.entries.delete(key); } }
  get(key: string): AnalysisReport | undefined {
    const value = this.entries.get(key);
    if (!value) return;
    if (value.expires <= this.clock()) { this.remove(key); return; }
    this.entries.delete(key); this.entries.set(key, value);
    return structuredClone(value.report);
  }
  set(key: string, report: AnalysisReport): void {
    if (!this.ttlMs || !this.maxEntries) return;
    const bytes = Buffer.byteLength(JSON.stringify(report), 'utf8');
    if (bytes > this.maxBytes) return;
    for (const [oldKey, value] of this.entries) if (value.expires <= this.clock()) this.remove(oldKey);
    this.remove(key);
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) this.remove(this.entries.keys().next().value!);
    this.entries.set(key, { report: structuredClone(report), expires: this.clock() + this.ttlMs, bytes }); this.bytes += bytes;
  }
}

/** One underlying job for identical work; one phone cancelling cannot cancel
 * another subscriber. All subscribers leaving cancels the OpenAI requests. */
export class SingleFlight<T> {
  private jobs = new Map<string, { controller: AbortController; promise: Promise<T>; subscribers: number }>();
  async run(key: string, work: (signal: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new AppError(499, 'REQUEST_CANCELLED', 'Yêu cầu đã được hủy.');
    let job = this.jobs.get(key);
    if (!job || job.controller.signal.aborted) {
      const controller = new AbortController();
      const next = { controller, subscribers: 0, promise: null as unknown as Promise<T> };
      next.promise = Promise.resolve().then(() => work(controller.signal)).finally(() => { if (this.jobs.get(key) === next) this.jobs.delete(key); });
      this.jobs.set(key, next); job = next;
    }
    const active = job;
    active.subscribers++;
    let onAbort: (() => void) | undefined;
    try {
      return await new Promise<T>((resolve, reject) => {
        onAbort = () => reject(new AppError(499, 'REQUEST_CANCELLED', 'Yêu cầu đã được hủy.'));
        signal?.addEventListener('abort', onAbort, { once: true });
        active.promise.then(resolve, reject);
        if (signal?.aborted) onAbort();
      });
    } finally {
      if (onAbort) signal?.removeEventListener('abort', onAbort);
      active.subscribers--;
      if (!active.subscribers) active.controller.abort();
    }
  }
}
