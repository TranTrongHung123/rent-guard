import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/errors.js';
import { signReport } from '../src/signing.js';
import { config, FakeAI, png, unsignedReport } from './helpers.js';

test('health works without a key, and analysis explicitly fails without mock fallback', async () => {
  const app = createApp({ ...config, apiKey: '' }, new FakeAI());
  const health = await request(app).get('/api/health').expect(200);
  assert.equal(health.body.aiConfigured, false);
  const result = await request(app).post('/api/analyses').send({ pages: [{ id: 'page-1', dataUrl: png }] }).expect(503);
  assert.equal(result.body.error.code, 'AI_NOT_CONFIGURED');
  assert.ok(!JSON.stringify(result.body).includes(config.signingSecret));
});
test('multi-page analysis processes all pages in order and returns a signed OpenAI report', async () => {
  const ai = new FakeAI();
  const result = await request(createApp(config, ai)).post('/api/analyses').send({ pages: [{ id: 'page-1', dataUrl: png }, { id: 'page-2', dataUrl: png }] }).expect(200);
  assert.equal(ai.extracted.length, 2);
  assert.deepEqual(ai.analysisPages.map(p => p.id), ['page-1', 'page-2']);
  assert.deepEqual(result.body.report.pages.map((p: { pageNumber: number }) => p.pageNumber), [1, 2]);
  assert.equal(result.body.report.source, 'openai'); // Provider is explicitly mocked by this test only.
  assert.equal(result.body.report.findings.length, 1);
  assert.equal(result.body.analysisToken, signReport(result.body.report, config.signingSecret));
});
test('analysis removes semantically unsupported findings and announces incomplete coverage', async () => {
  const ai = new FakeAI(); ai.unsupported = true;
  const result = await request(createApp(config, ai)).post('/api/analyses').send({ pages: [{ id: 'page-1', dataUrl: png }] }).expect(200);
  assert.equal(result.body.report.findings.length, 0);
  assert.ok(result.body.report.warnings.some((w: string) => w.includes('Đã loại 1')));
});
test('partial pages stay in the report and suggestion premises are included in grounding review', async () => {
  const ai = new FakeAI(); ai.partial = true;
  const result = await request(createApp(config, ai)).post('/api/analyses').send({ pages: [{ id: 'page-1', dataUrl: png }, { id: 'page-2', dataUrl: png }] }).expect(200);
  assert.equal(result.body.report.pages.length, 2);
  assert.equal(result.body.report.pages[1].status, 'partial');
  assert.ok(result.body.report.warnings.some((text: string) => text.includes('Trang 2')));
  assert.ok(ai.reviewClaims[0]!.text.includes(ai.analysis.findings[0]!.suggestedQuestion));
  assert.ok(result.body.report.missingInformation.every((text: string) => text.endsWith('?')));
  assert.equal(result.body.report.title, 'Hợp đồng thuê nhà');
});
test('missing or duplicate semantic reviews never accept a finding', async () => {
  for (const duplicate of [false, true]) {
    const ai = new FakeAI();
    ai.review = async claims => ({ reviews: duplicate ? [0, 1].map(() => ({ id: claims[0]!.id, supported: true, reason: 'Duplicate result.' })) : [] });
    const result = await request(createApp(config, ai)).post('/api/analyses').send({ pages: [{ id: 'page-1', dataUrl: png }] }).expect(200);
    assert.equal(result.body.report.findings.length, 0);
  }
});
test('analysis preserves all supported findings without a small display-driven result cap', async () => {
  const ai = new FakeAI();
  ai.analysis.findings = Array.from({ length: 42 }, (_, index) => ({ ...ai.analysis.findings[0]!, title: `Điểm cần làm rõ số ${index + 1}` }));
  const result = await request(createApp(config, ai)).post('/api/analyses').send({ pages: [{ id: 'page-1', dataUrl: png }] }).expect(200);
  assert.equal(result.body.report.findings.length, 42);
});
test('unreadable images fail explicitly; duplicate IDs, invalid signatures and missing pages are rejected', async () => {
  const ai = new FakeAI(); ai.unreadable = true;
  const app = createApp(config, ai);
  const result = await request(app).post('/api/analyses').send({ pages: [{ id: 'page-1', dataUrl: png }] }).expect(422);
  assert.equal(result.body.error.code, 'UNREADABLE_IMAGES');
  await request(app).post('/api/analyses').send({ pages: [{ id: 'same', dataUrl: png }, { id: 'same', dataUrl: png }] }).expect(400);
  await request(app).post('/api/analyses').send({ pages: [{ id: 'p', dataUrl: 'data:image/png;base64,aGVsbG8=' }] }).expect(422);
  await request(app).post('/api/analyses').send({ pages: [] }).expect(400);
});
test('chat preserves multiple previous turns and uses the current question separately', async () => {
  const ai = new FakeAI();
  const messages = [{ role: 'user', content: 'Tiền cọc bao nhiêu?' }, { role: 'assistant', content: '10 triệu đồng.' }, { role: 'user', content: 'Khi nào được hoàn?' }, { role: 'assistant', content: 'Cần làm rõ với chủ nhà.' }];
  const question = 'Khoản đó được nêu ở trang nào?';
  const result = await request(createApp(config, ai)).post('/api/chat').send({ report: unsignedReport, analysisToken: signReport(unsignedReport, config.signingSecret), messages, question }).expect(200);
  assert.deepEqual((ai.chatRequest as { messages: unknown }).messages, messages);
  assert.equal((ai.chatRequest as { question: string }).question, question);
  assert.equal(result.body.message.evidence[0].pageNumber, 1);
  assert.equal(result.body.message.source, 'openai');
});
test('tampered reports never reach the chat provider', async () => {
  const ai = new FakeAI();
  const report = structuredClone(unsignedReport); report.pages[0]!.text = 'Nội dung tự sửa.';
  const result = await request(createApp(config, ai)).post('/api/chat').send({ report, analysisToken: signReport(unsignedReport, config.signingSecret), messages: [], question: 'Tiền cọc?' }).expect(403);
  assert.equal(result.body.error.code, 'INVALID_ANALYSIS');
  assert.equal(ai.chatRequest, undefined);
});
test('long assistant responses remain valid context while oversized user input fails clearly', async () => {
  const app = createApp(config, new FakeAI());
  const body = { report: unsignedReport, analysisToken: signReport(unsignedReport, config.signingSecret), messages: [{ role: 'assistant', content: 'Nội dung đã trả lời. '.repeat(1200) }], question: 'Hãy làm rõ khoản tiền cọc.' };
  await request(app).post('/api/chat').send(body).expect(200);
  await request(app).post('/api/chat').send({ ...body, messages: [{ role: 'user', content: 'a'.repeat(2001) }] }).expect(400);
  await request(app).post('/api/chat').send({ ...body, messages: Array.from({ length: 11 }, () => ({ role: 'assistant', content: 'a'.repeat(100000) })) }).expect(422);
});
test('chat never displays fabricated or semantically unsupported claims', async () => {
  const ai = new FakeAI();
  ai.answerData.claims[0]!.evidence[0]!.quote = 'Tiền cọc là 50.000.000 đồng.';
  const body = { report: unsignedReport, analysisToken: signReport(unsignedReport, config.signingSecret), messages: [], question: 'Tiền cọc bao nhiêu?' };
  const result = await request(createApp(config, ai)).post('/api/chat').send(body).expect(200);
  assert.equal(result.body.message.evidence.length, 0);
  assert.ok(result.body.message.content.includes('Chưa đủ thông tin'));
  assert.ok(!result.body.message.content.includes('50.000.000'));
  ai.answerData.claims[0]!.evidence[0]!.quote = 'Tiền cọc là 10.000.000 đồng.';
  ai.unsupported = true;
  const second = await request(createApp(config, ai)).post('/api/chat').send(body).expect(200);
  assert.equal(second.body.message.evidence.length, 0);
  assert.ok(second.body.message.content.includes('Chưa đủ thông tin'));
});
test('network/provider errors are useful, JSON errors and browser origins are handled', async () => {
  const ai = new FakeAI(); ai.extract = async () => { throw new AppError(504, 'AI_TIMEOUT', 'OpenAI phản hồi quá lâu.'); };
  const app = createApp(config, ai);
  const result = await request(app).post('/api/analyses').send({ pages: [{ id: 'page-1', dataUrl: png }] }).expect(504);
  assert.equal(result.body.error.code, 'AI_TIMEOUT');
  await request(app).post('/api/analyses').set('Content-Type', 'application/json').send('{broken').expect(400);
  await request(app).get('/api/health').set('Origin', 'https://unapproved.example').expect(403);
  await request(app).get('/api/missing').expect(404);
});
