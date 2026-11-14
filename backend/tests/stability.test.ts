import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ContractService } from '../src/service.js';
import { validateFindings } from '../src/evidence.js';
import { verifyReport } from '../src/signing.js';
import { analysisPolicyId, inputFingerprint, ReportCache, SingleFlight, textFingerprint } from '../src/stability.js';
import { candidate, config, FakeAI, page, png, secondPage, unsignedReport } from './helpers.js';

const images = (id = 'picker-one', dataUrl = png) => ({ pages: [{ id, dataUrl }] });
// Transport fixtures only, never sent to an actual image decoder or OpenAI.
const otherImage = `${png.slice(0, -4)}AAAA`;
const thirdImage = `${png.slice(0, -4)}AQAA`;
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; };

test('identical images reuse verified results despite new picker IDs, and remain valid for chat', async () => {
  const ai = new FakeAI(); const app = createApp(config, ai);
  const first = (await request(app).post('/api/analyses').send(images()).expect(200)).body;
  const second = (await request(app).post('/api/analyses').send(images('picker-two')).expect(200)).body;
  assert.equal(ai.extracted.length, 1); assert.equal(ai.analysisCalls, 1);
  assert.equal(first.report.analysis.reuse, 'none'); assert.equal(second.report.analysis.reuse, 'images');
  assert.notEqual(first.report.id, second.report.id);
  assert.deepEqual(second.report.findings.map((f: { id: string; severity: string }) => [f.id, f.severity]), first.report.findings.map((f: { id: string; severity: string }) => [f.id, f.severity]));
  assert.equal(second.report.findings[0].evidence[0].pageId, 'picker-two');
  assert.ok(verifyReport(second.report, second.analysisToken, config.signingSecret));
  await request(app).post('/api/chat').send({ ...second, messages: [], question: 'Tiền cọc bao nhiêu?' }).expect(200);
});

test('rephotographed equal readable text reuses findings but rebinds every quote to the new OCR', async () => {
  const ai = new FakeAI(); const service = new ContractService(config, ai);
  const first = await service.analyze(images());
  const shifted = `\n  ${page.text.replaceAll(' ', '  ')}  `;
  ai.extract = async input => { ai.extracted.push(input.id); return { status: 'readable', text: shifted, warning: null }; };
  const second = await service.analyze(images('new-photo', otherImage));
  assert.equal(ai.extracted.length, 2); assert.equal(ai.analysisCalls, 1);
  assert.equal(second.report.analysis?.reuse, 'text');
  assert.equal(second.report.createdAt, first.report.createdAt);
  assert.equal(second.report.findings[0]!.id, first.report.findings[0]!.id);
  const proof = second.report.findings[0]!.evidence[0]!;
  assert.equal(proof.pageId, 'new-photo');
  assert.equal(shifted.slice(proof.startOffset, proof.endOffset), proof.quote);
  assert.notEqual(proof.startOffset, first.report.findings[0]!.evidence[0]!.startOffset);
});

test('changed digits or partial OCR require new analysis, while forceRefresh skips both cache layers', async () => {
  const ai = new FakeAI(); const service = new ContractService(config, ai);
  await service.analyze(images());
  ai.extract = async () => ({ status: 'readable', text: page.text.replace('10.000.000', '20.000.000'), warning: null });
  const changed = await service.analyze(images('changed', otherImage));
  assert.equal(changed.report.analysis?.reuse, 'none'); assert.equal(ai.analysisCalls, 2);
  ai.extract = async () => ({ status: 'partial', text: page.text, warning: 'Bị che một phần.' });
  const partial = await service.analyze(images('partial', thirdImage));
  assert.equal(partial.report.analysis?.reuse, 'none'); assert.equal(ai.analysisCalls, 3);
  const forced = await service.analyze({ ...images(), forceRefresh: true });
  assert.equal(forced.report.analysis?.reuse, 'none'); assert.equal(ai.analysisCalls, 4);
});

test('signed history survives backend restart and supports image or full-text reuse', async () => {
  const first = await new ContractService(config, new FakeAI()).analyze(images());
  const ai = new FakeAI(); const restarted = new ContractService(config, ai);
  const exact = await restarted.analyze({ ...images('after-restart'), previousAnalysis: first });
  assert.equal(exact.report.analysis?.reuse, 'saved'); assert.equal(ai.extracted.length, 0);
  const nextCaller = await restarted.analyze(images('without-local-history'));
  assert.equal(nextCaller.report.analysis?.reuse, 'images'); assert.equal(ai.extracted.length, 0);
  const photo = await restarted.analyze({ ...images('rephotographed', otherImage), previousAnalysis: first });
  assert.equal(photo.report.analysis?.reuse, 'text'); assert.equal(ai.extracted.length, 1); assert.equal(ai.analysisCalls, 0);
  assert.ok(verifyReport(photo.report, photo.analysisToken, config.signingSecret));
});

test('edited history is rejected; model/policy changes never reuse a prior report', async () => {
  const previous = await new ContractService(config, new FakeAI()).analyze(images());
  const edited = structuredClone(previous); edited.report.findings[0]!.severity = 'low';
  const app = createApp(config, new FakeAI());
  await request(app).post('/api/analyses').send({ ...images(), previousAnalysis: edited }).expect(403);
  const ai = new FakeAI(); const changedModel = new ContractService({ ...config, model: 'other-vision-model' }, ai);
  const fresh = await changedModel.analyze({ ...images(), previousAnalysis: previous });
  assert.equal(fresh.report.analysis?.reuse, 'none'); assert.equal(ai.analysisCalls, 1);
  assert.notEqual(fresh.report.analysis?.policyId, previous.report.analysis?.policyId);
  assert.notEqual(analysisPolicyId(config), analysisPolicyId({ ...config, signingSecret: 'a-different-secret-for-this-test-only' }));
  assert.notEqual(analysisPolicyId(config), analysisPolicyId({ ...config, reasoningEffort: 'low' }));
  assert.notEqual(analysisPolicyId({ ...config, reasoningEffort: 'low' }), analysisPolicyId({ ...config, reasoningEffort: 'low', analysisReasoningEffort: 'medium' }));
  // Explicit fresh run can recover from damaged history without trusting it.
  await request(app).post('/api/analyses').send({ ...images(), previousAnalysis: edited, forceRefresh: true }).expect(200);
});

test('omitted or duplicate checklist checks fail closed and never populate caches', async () => {
  for (const duplicate of [false, true]) {
    const ai = new FakeAI(); const service = new ContractService(config, ai);
    ai.analysis.reviewedChecks = duplicate ? ai.analysis.reviewedChecks.map(() => 'DEPOSIT_FORFEITURE') : ai.analysis.reviewedChecks.slice(1);
    await assert.rejects(service.analyze(images()), { code: 'AI_INCOMPLETE_CHECKLIST' });
    ai.analysis = structuredClone(candidate);
    const retried = await service.analyze(images());
    assert.equal(ai.analysisCalls, 2); assert.equal(retried.report.analysis?.reuse, 'none');
  }
});

test('priorities, order and issue IDs come from checks and citations, independent of wording or model ordering', () => {
  const input = structuredClone(candidate);
  input.findings.push({ ...input.findings[0]!, title: 'Cùng một vấn đề nhưng đổi cách viết' });
  input.findings.unshift({ ...input.findings[0]!, checkId: 'OTHER_CLARIFICATION', title: 'Một mục khác' });
  input.findings[1] = { ...input.findings[1]!, severity: 'low' } as typeof input.findings[number];
  input.findings[1]!.evidence.push(structuredClone(input.findings[1]!.evidence[0]!));
  const a = validateFindings(input, [page]);
  const b = validateFindings({ ...input, findings: [...input.findings].reverse() }, [page]);
  assert.equal(a.findings.length, 2);
  assert.deepEqual(a.findings.map(f => [f.id, f.checkId, f.severity]), b.findings.map(f => [f.id, f.checkId, f.severity]));
  assert.deepEqual(a.findings.map(f => f.severity), ['high', 'low']);
  assert.equal(a.findings[0]!.evidence.length, 1);
});

test('fingerprints ignore picker IDs but preserve page boundaries, ordering, digits, case and accents', () => {
  assert.equal(inputFingerprint(images().pages), inputFingerprint(images('another-id').pages));
  assert.notEqual(inputFingerprint([...images().pages, ...images('b', otherImage).pages]), inputFingerprint([...images('b', otherImage).pages, ...images().pages]));
  assert.equal(textFingerprint([page]), textFingerprint([{ ...page, text: ` ${page.text.replaceAll(' ', '\n  ')} ` }]));
  for (const text of [page.text.replace('10.000.000', '10.000.001'), page.text.replace('cọc', 'coc'), page.text.toUpperCase(), `${page.text}.`]) assert.notEqual(textFingerprint([page]), textFingerprint([{ ...page, text }]));
  assert.notEqual(textFingerprint([page, secondPage]), textFingerprint([{ ...page, text: page.text + ' ' + secondPage.text }]));
  assert.equal(textFingerprint([{ ...page, status: 'partial' }]), null);
  assert.equal(textFingerprint([{ ...page, status: 'unreadable' }]), null);
});

test('cache enforces TTL, LRU, byte bounds, disabled mode and independent clones', () => {
  let now = 0; const cache = new ReportCache(100, 2, () => now);
  cache.set('a', unsignedReport); cache.set('b', unsignedReport);
  cache.get('a')!.pages[0]!.text = 'mutated client';
  assert.equal(cache.get('a')!.pages[0]!.text, page.text);
  cache.set('c', unsignedReport); assert.equal(cache.get('b'), undefined);
  now = 100; assert.equal(cache.get('a'), undefined); assert.equal(cache.get('c'), undefined);
  const tiny = new ReportCache(100, 5, () => 0, 1); tiny.set('large', unsignedReport); assert.equal(tiny.get('large'), undefined);
  const disabled = new ReportCache(0, 2); disabled.set('x', unsignedReport); assert.equal(disabled.get('x'), undefined);
});

test('concurrent identical analyses share extraction and analysis while retaining caller image IDs', async () => {
  const ai = new FakeAI(); const service = new ContractService(config, ai);
  const [a, b] = await Promise.all([service.analyze(images('caller-a')), service.analyze(images('caller-b'))]);
  assert.equal(ai.extracted.length, 1); assert.equal(ai.analysisCalls, 1);
  assert.equal(a.report.findings[0]!.evidence[0]!.pageId, 'caller-a');
  assert.equal(b.report.findings[0]!.evidence[0]!.pageId, 'caller-b');
});

test('single flight isolates one cancellation, cancels when all leave, and retries failures', async () => {
  const flight = new SingleFlight<number>(); const gate = deferred<number>();
  const one = new AbortController(); const two = new AbortController();
  let calls = 0; let underlying!: AbortSignal;
  const work = async (signal: AbortSignal) => { calls++; underlying = signal; return gate.promise; };
  const a = flight.run('shared', work, one.signal); const b = flight.run('shared', work, two.signal);
  await Promise.resolve(); one.abort();
  await assert.rejects(a, { code: 'REQUEST_CANCELLED' }); assert.equal(underlying.aborted, false);
  gate.resolve(7); assert.equal(await b, 7); assert.equal(calls, 1);
  const stop = new AbortController(); const started = deferred<void>();
  const pending = flight.run('abandon', async signal => { underlying = signal; started.resolve(); return new Promise<number>((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('underlying cancelled')), { once: true })); }, stop.signal);
  await started.promise; stop.abort(); await assert.rejects(pending, { code: 'REQUEST_CANCELLED' }); assert.equal(underlying.aborted, true);
  await assert.rejects(flight.run('error', async () => { throw new Error('transient'); }), /transient/);
  assert.equal(await flight.run('error', async () => 9), 9);
});

test('a cancelled request is not cached, and a fresh request never joins a reuse job', async () => {
  const ai = new FakeAI(); const entered = deferred<void>(); const gate = deferred<void>();
  ai.extract = async () => { entered.resolve(); await gate.promise; return { status: 'readable', text: page.text, warning: null }; };
  const service = new ContractService(config, ai); const controller = new AbortController();
  const abandoned = service.analyze(images(), controller.signal); await entered.promise;
  controller.abort(); await assert.rejects(abandoned, { code: 'REQUEST_CANCELLED' }); gate.resolve();
  ai.extract = async () => ({ status: 'readable', text: page.text, warning: null });
  const [normal, fresh] = await Promise.all([service.analyze(images()), service.analyze({ ...images(), forceRefresh: true })]);
  assert.equal(normal.report.analysis?.reuse, 'none'); assert.equal(fresh.report.analysis?.reuse, 'none');
  assert.equal(ai.analysisCalls, 2);
});
