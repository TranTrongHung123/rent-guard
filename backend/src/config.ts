import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';

function numberEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Invalid ${name}`);
  return value;
}
export type ReasoningEffort = 'none' | 'low' | 'medium' | 'high' | 'xhigh' | 'max';
function effortEnv(name: string, fallback?: ReasoningEffort): ReasoningEffort | undefined {
  const value = process.env[name]?.trim();
  if (!value) return fallback;
  if (!['none', 'low', 'medium', 'high', 'xhigh', 'max'].includes(value)) throw new Error(`Invalid ${name}: use none, low, medium, high, xhigh or max`);
  return value as ReasoningEffort;
}
export interface Config {
  port: number; host: string; apiKey: string; model: string; timeoutMs: number;
  maxPages: number; maxImageBytes: number; maxTotalImageBytes: number;
  corsOrigins: string[]; signingSecret: string;
  analysisCacheTtlMs?: number;
  analysisCacheEntries?: number;
  reasoningEffort?: ReasoningEffort;
  analysisReasoningEffort?: ReasoningEffort;
}
export function loadConfig(): Config {
  const model = process.env.OPENAI_MODEL?.trim() || 'gpt-6.1-sol';
  const reasoningEffort = effortEnv('OPENAI_REASONING_EFFORT', model === 'gpt-6.1-sol' ? 'low' : undefined);
  const analysisReasoningEffort = effortEnv('OPENAI_ANALYSIS_REASONING_EFFORT', reasoningEffort);
  if (/^gpt-(?:6\.1-sol|6-astra)(?:-|$)/.test(model) && [reasoningEffort, analysisReasoningEffort].includes('none')) {
    throw new Error('This model does not support reasoning effort none; use low or higher');
  }
  let signingSecret = process.env.REPORT_SIGNING_SECRET?.trim() || '';
  if (signingSecret && signingSecret.length < 32) throw new Error('REPORT_SIGNING_SECRET must be at least 32 characters');
  if (!signingSecret) {
    const directory = path.resolve('.data');
    const secretPath = path.join(directory, 'signing-key');
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    if (!existsSync(secretPath)) writeFileSync(secretPath, randomBytes(48).toString('base64url'), { mode: 0o600, flag: 'wx' });
    signingSecret = readFileSync(secretPath, 'utf8').trim();
    if (signingSecret.length < 32) throw new Error('Invalid local report signing secret');
  }
  return {
    port: numberEnv('PORT', 4000, 1, 65535), host: process.env.HOST || '0.0.0.0',
    apiKey: process.env.OPENAI_API_KEY?.trim() || '',
    model, reasoningEffort, analysisReasoningEffort,
    timeoutMs: numberEnv('OPENAI_TIMEOUT_MS', 120_000, 1000, 300_000),
    maxPages: numberEnv('MAX_PAGES', 20, 1, 50),
    maxImageBytes: numberEnv('MAX_IMAGE_MB', 5, 1, 10) * 1024 * 1024,
    maxTotalImageBytes: 20 * 1024 * 1024,
    analysisCacheTtlMs: numberEnv('ANALYSIS_CACHE_TTL_MS', 1800000, 0, 86400000),
    analysisCacheEntries: numberEnv('ANALYSIS_CACHE_ENTRIES', 32, 0, 128),
    corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:8081,http://localhost:19006').split(',').map(v => v.trim()).filter(Boolean),
    signingSecret,
  };
}
