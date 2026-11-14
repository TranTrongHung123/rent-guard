import OpenAI from 'openai';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import type { AnalyzeResponse, ChatResponse } from '../../shared/contracts.js';
import { createApp } from './app.js';
import { OpenAIService } from './ai.js';
import { loadConfig, type Config } from './config.js';

/** Paid, opt-in comparison using ONLY the two project-owned sample pages.
 * Records timings, usage and check IDs; never records OCR, prompts or secrets.
 * One run is a connectivity/smoke comparison, not a general quality benchmark. */
const base = loadConfig();
if (!base.apiKey) throw new Error('Configure OPENAI_API_KEY in backend/.env first.');
const pages = await Promise.all([1, 2].map(async page => ({ id: `page-${page}`, dataUrl: `data:image/jpeg;base64,${(await readFile(`../mobile/assets/demo/page-${page}.jpg`)).toString('base64')}` })));
const expectedChecks = ['DEPOSIT_FORFEITURE', 'RENT_UNILATERAL', 'FEES_UNSPECIFIED', 'REPAIRS_UNLIMITED'];
const profiles: (Pick<Config, 'model' | 'reasoningEffort' | 'analysisReasoningEffort'> & { name: string })[] = [
  { name: 'terra-default', model: 'gpt-6.1-terra', reasoningEffort: undefined, analysisReasoningEffort: undefined },
  { name: 'sol-balanced', model: 'gpt-6.1-sol', reasoningEffort: 'low', analysisReasoningEffort: 'medium' },
];
const results: object[] = [];
for (const profile of profiles) {
  const calls: { stage: string; seconds: number; status: number; inputTokens: number; cachedTokens: number; outputTokens: number; reasoningTokens: number }[] = [];
  const config = { ...base, ...profile };
  const client = new OpenAI({ apiKey: config.apiKey, timeout: config.timeoutMs, maxRetries: 1, fetch: async (url, init) => {
    const input = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const started = performance.now();
    const response = await fetch(url, init);
    const body = await response.clone().json().catch(() => null);
    const usage = body?.usage;
    const call = { stage: input.text?.format?.name ?? 'unknown', seconds: Math.round((performance.now() - started) / 10) / 100, status: response.status, inputTokens: usage?.input_tokens ?? 0, cachedTokens: usage?.input_tokens_details?.cached_tokens ?? 0, outputTokens: usage?.output_tokens ?? 0, reasoningTokens: usage?.output_tokens_details?.reasoning_tokens ?? 0 };
    calls.push(call);
    console.log(JSON.stringify({ event: 'provider_call', profile: profile.name, ...call }));
    return response;
  } });
  const server = createApp(config, new OpenAIService(config, client)).listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Cannot start benchmark server.');
  async function post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(600000) });
    const result = await response.json();
    if (!response.ok) throw new Error(`${result.error?.code}: ${result.error?.message}`);
    return result as T;
  }
  const totalStarted = performance.now();
  try {
    const started = performance.now();
    const analysis = await post<AnalyzeResponse>('/api/analyses', { pages, forceRefresh: true });
    const analysisSeconds = Math.round((performance.now() - started) / 10) / 100;
    const firstQuestion = 'Hợp đồng quy định tiền cọc như thế nào?';
    const chatStarted = performance.now();
    const first = await post<ChatResponse>('/api/chat', { ...analysis, messages: [], question: firstQuestion });
    const firstChatSeconds = Math.round((performance.now() - chatStarted) / 10) / 100;
    const followupStarted = performance.now();
    const second = await post<ChatResponse>('/api/chat', { ...analysis, messages: [{ role: 'user', content: firstQuestion }, { role: 'assistant', content: first.message.content }], question: 'Tôi nên hỏi chủ nhà điều gì để làm rõ khoản đó?' });
    const followupSeconds = Math.round((performance.now() - followupStarted) / 10) / 100;
    const repeated = await post<AnalyzeResponse>('/api/analyses', { pages });
    if (repeated.report.analysis?.reuse !== 'images' || JSON.stringify(repeated.report.findings) !== JSON.stringify(analysis.report.findings)) throw new Error('Image reuse changed findings.');
    if (!first.message.evidence.length || !second.message.evidence.length) throw new Error('Sample chat lacks verified evidence.');
    const checkIds = [...new Set(analysis.report.findings.map(finding => finding.checkId))].sort();
    const result = { profile, analysisSeconds, firstChatSeconds, followupSeconds, totalSeconds: Math.round((performance.now() - totalStarted) / 10) / 100, pages: analysis.report.pages.length, pageStatuses: analysis.report.pages.map(page => page.status), findings: analysis.report.findings.length, checkIds, expectedSampleChecks: expectedChecks, matchedSampleChecks: expectedChecks.filter(check => checkIds.includes(check)), firstChatEvidence: first.message.evidence.length, followupEvidence: second.message.evidence.length, repeatedImagesStable: true, calls };
    results.push(result);
    console.log(JSON.stringify({ event: 'profile_complete', ...result }));
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
await mkdir('test-results', { recursive: true });
const filename = `test-results/model-benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await writeFile(filename, JSON.stringify({ sampleOnly: true, runsPerProfile: 1, date: new Date().toISOString(), results }, null, 2));
console.log(JSON.stringify({ event: 'saved', file: filename }));
