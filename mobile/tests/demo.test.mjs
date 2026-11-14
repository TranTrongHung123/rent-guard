import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoAnswer, createDemoRecord, DEMO_PAGE_TEXTS } from '../src/domain/demo.ts';
import { validateSavedRecord } from '../src/domain/core.ts';

test('bundled demo is explicitly labeled and every finding quote matches its page', () => {
  const localPages = DEMO_PAGE_TEXTS.map((_, index) => ({ id: `demo-page-${index + 1}`, uri: `asset://page-${index + 1}.jpg`, width: 1240, height: 1754, mimeType: 'image/jpeg' }));
  const record = createDemoRecord(localPages, 'test-demo');
  assert.equal(validateSavedRecord(record), true);
  assert.equal(record.report.source, 'demo');
  assert.equal(record.report.model, null);
  assert.equal(record.analysisToken, '');
  assert.equal(record.report.pages.length, 2);
  assert.equal(record.report.findings.length, 4);
  for (const finding of record.report.findings) for (const evidence of finding.evidence) {
    assert.equal(record.report.pages[evidence.pageNumber - 1].text.slice(evidence.startOffset, evidence.endOffset), evidence.quote);
  }
});

test('sample answers remain labeled and repeated evidence remains valid across multiple turns', () => {
  const localPages = DEMO_PAGE_TEXTS.map((_, index) => ({ id: `demo-page-${index + 1}`, uri: `asset://page-${index + 1}.jpg`, width: 1240, height: 1754, mimeType: 'image/jpeg' }));
  const record = createDemoRecord(localPages, 'test-demo');
  for (const [index, content] of ['Khi nào hoàn cọc?', 'Tiền cọc mất hết sao?', 'Không liên quan'].entries()) {
    const answer = createDemoAnswer(content, record.report);
    assert.equal(answer.source, 'demo');
    record.messages.push({ id: `user-${index}`, role: 'user', content, evidence: [], source: 'demo', createdAt: new Date().toISOString() }, answer);
  }
  assert.equal(validateSavedRecord(record), true);
  assert.match(record.messages.at(-1).content, /chưa gọi AI/);
});
