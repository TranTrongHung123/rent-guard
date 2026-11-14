import assert from 'node:assert/strict';
import test from 'node:test';

import { moveItem, normalizeApiUrl, selectApiUrl, validateSavedRecord } from '../src/domain/core.ts';

function sampleRecord() {
  const text = 'Tiền cọc được hoàn trong 30 ngày sau bàn giao.';
  const quote = 'được hoàn trong 30 ngày';
  const startOffset = text.indexOf(quote);
  const evidence = { id: 'evidence-1', pageId: 'page-1', pageNumber: 1, quote, startOffset, endOffset: startOffset + quote.length, boundingBox: null };
  return {
    id: 'analysis-1', isSaved: true, analysisToken: 'signed-context',
    report: {
      id: 'analysis-1', title: 'Hợp đồng thuê nhà', createdAt: '2026-11-14T00:00:00.000Z', source: 'openai', model: 'vision-model',
      summary: 'Cần làm rõ điều kiện hoàn cọc.',
      pages: [{ id: 'page-1', pageNumber: 1, text, status: 'readable', warning: null }],
      findings: [{ id: 'finding-1', ruleId: 'deposit-refund', category: 'deposit', severity: 'medium', title: 'Làm rõ điều kiện hoàn tiền cọc', reason: 'Chưa nêu điều kiện khấu trừ.', explanation: 'Hãy thống nhất các trường hợp khấu trừ.', suggestedQuestion: 'Tiền cọc được khấu trừ trong trường hợp nào?', evidence: [evidence] }],
      missingInformation: ['Các khoản khấu trừ cụ thể.'], warnings: [],
    },
    localPages: [{ id: 'page-1', uri: 'file:///documents/page-1.jpg', width: 1240, height: 1754, mimeType: 'image/jpeg' }],
    messages: [
      { id: 'user-1', role: 'user', source: 'openai', createdAt: '2026-11-14T00:00:01.000Z', content: 'Bao lâu thì được hoàn cọc?', evidence: [] },
      { id: 'assistant-1', role: 'assistant', source: 'openai', createdAt: '2026-11-14T00:00:02.000Z', content: 'Hợp đồng ghi 30 ngày sau bàn giao.', evidence: [structuredClone(evidence)] },
    ],
  };
}

test('normalizeApiUrl accepts laptop LAN and HTTPS addresses and removes trailing slashes', () => {
  assert.equal(normalizeApiUrl('  http://192.168.1.10:4000/  '), 'http://192.168.1.10:4000');
  assert.equal(normalizeApiUrl('https://rentguard.example.com///'), 'https://rentguard.example.com');
  assert.equal(normalizeApiUrl('http://localhost:4000'), 'http://localhost:4000');
});

test('normalizeApiUrl rejects malformed addresses, credentials, paths and query strings', () => {
  for (const value of ['192.168.1.10:4000', 'ftp://example.com', 'http://user:pass@example.com', 'https://example.com/api', 'https://example.com?token=secret', 'https://example.com#fragment', '']) {
    assert.throws(() => normalizeApiUrl(value), Error, value);
  }
});
test('cloud release replaces an old stored LAN address while preserving custom valid HTTPS choices', () => {
  const cloud = 'https://rentguard-api.onrender.com';
  assert.equal(selectApiUrl(cloud, 'http://192.168.1.10:4000', true), cloud);
  assert.equal(selectApiUrl(cloud, 'https://localhost:4000', true), cloud);
  assert.equal(selectApiUrl(cloud, 'broken', true), cloud);
  assert.equal(selectApiUrl(cloud, 'https://other-rentguard.onrender.com', true), 'https://other-rentguard.onrender.com');
  assert.equal(selectApiUrl('http://localhost:4000', 'http://192.168.1.10:4000'), 'http://192.168.1.10:4000');
  assert.throws(() => normalizeApiUrl('http://192.168.1.10:4000', true), /HTTPS/);
});

test('moving pages preserves every page and never mutates the previous order', () => {
  const pages = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(moveItem(pages, 'b', -1).map(page => page.id), ['b', 'a', 'c']);
  assert.deepEqual(moveItem(pages, 'b', 1).map(page => page.id), ['a', 'c', 'b']);
  assert.deepEqual(pages.map(page => page.id), ['a', 'b', 'c']);
  assert.strictEqual(moveItem(pages, 'a', -1), pages);
  assert.strictEqual(moveItem(pages, 'c', 1), pages);
  assert.strictEqual(moveItem(pages, 'missing', 1), pages);
});

test('accepts a complete record and repeated references to the same verified evidence', () => {
  assert.equal(validateSavedRecord(sampleRecord()), true);
  const demo = sampleRecord();
  demo.report.source = 'demo';
  demo.report.model = null;
  demo.analysisToken = '';
  demo.messages.forEach(message => { message.source = 'demo'; });
  assert.equal(validateSavedRecord(demo), true);
});

test('new analysis metadata is validated while legacy history remains readable', () => {
  const metadata = { version: 'rentguard-v2.0.0', policyId: 'a'.repeat(64), inputFingerprint: 'b'.repeat(64), analyzedAt: '2026-11-14T00:00:00.000Z', reuse: 'text' };
  const record = sampleRecord(); record.report.analysis = metadata; record.report.findings[0].checkId = 'DEPOSIT_REFUND';
  assert.equal(validateSavedRecord(record), true);
  for (const change of [
    analysis => { analysis.reuse = 'pretend-fresh'; },
    analysis => { analysis.inputFingerprint = 'not-a-hash'; },
    analysis => { analysis.policyId = 'short'; },
    analysis => { analysis.analyzedAt = 'invalid'; },
    analysis => { analysis.version = ''; },
  ]) {
    const broken = sampleRecord(); broken.report.analysis = structuredClone(metadata); change(broken.report.analysis);
    assert.equal(validateSavedRecord(broken), false);
  }
  record.report.analysis = null; assert.equal(validateSavedRecord(record), false);
  delete record.report.analysis; assert.equal(validateSavedRecord(record), true);
});

test('a source quote must match the extracted text and offsets exactly', () => {
  for (const change of [
    evidence => { evidence.quote = 'được hoàn trong 3 ngày'; },
    evidence => { evidence.startOffset = -1; },
    evidence => { evidence.startOffset = 0.5; },
    evidence => { evidence.endOffset = 9000; },
    evidence => { evidence.endOffset = evidence.startOffset; },
    evidence => { evidence.pageId = 'missing-page'; },
    evidence => { evidence.pageNumber = 2; },
    evidence => { evidence.boundingBox = { x: 0.8, y: 0.5, width: 0.4, height: 0.1 }; },
    evidence => { evidence.boundingBox = { x: 0, y: NaN, width: 0.2, height: 0.2 }; },
  ]) {
    const record = sampleRecord();
    change(record.report.findings[0].evidence[0]);
    assert.equal(validateSavedRecord(record), false);
  }
  const validBox = sampleRecord();
  validBox.report.findings[0].evidence[0].boundingBox = { x: 0.1, y: 0.1, width: 0.3, height: 0.2 };
  validBox.messages[1].evidence[0].boundingBox = { x: 0.1, y: 0.1, width: 0.3, height: 0.2 };
  assert.equal(validateSavedRecord(validBox), true);
});

test('rejects unverifiable findings, citations from unreadable pages and inconsistent evidence identifiers', () => {
  const noEvidence = sampleRecord();
  noEvidence.report.findings[0].evidence = [];
  assert.equal(validateSavedRecord(noEvidence), false);
  const unreadable = sampleRecord();
  unreadable.report.pages[0].status = 'unreadable';
  assert.equal(validateSavedRecord(unreadable), false);
  const inconsistent = sampleRecord();
  const evidence = inconsistent.messages[1].evidence[0];
  evidence.quote = 'Tiền cọc'; evidence.startOffset = 0; evidence.endOffset = 8;
  assert.equal(validateSavedRecord(inconsistent), false);
  const duplicate = sampleRecord();
  duplicate.report.findings[0].evidence.push(structuredClone(duplicate.report.findings[0].evidence[0]));
  assert.equal(validateSavedRecord(duplicate), false);
});

test('rejects malformed reports without throwing and preserves records with unreadable uncited pages', () => {
  for (const value of [null, undefined, [], {}, 'text', 12, { report: null }, { id: 'x', report: { findings: [null] } }]) {
    assert.equal(validateSavedRecord(value), false);
  }
  for (const change of [
    record => { record.report.findings[0] = null; },
    record => { record.report.findings[0].category = 'invented'; },
    record => { record.report.findings[0].severity = 'critical'; },
    record => { record.report.findings[0].suggestedQuestion = undefined; },
    record => { record.report.findings[0].evidence = [null]; },
    record => { record.report.pages[0].pageNumber = 0; },
    record => { record.report.pages[0].status = 'unknown'; },
    record => { record.report.pages[0].text = ''; },
    record => { record.report.createdAt = 'not-a-date'; },
    record => { record.report.warnings = [null]; },
    record => { record.analysisToken = ''; },
    record => { record.isSaved = 'true'; },
    record => { record.localPages = []; },
    record => { record.localPages[0].width = Infinity; },
    record => { record.localPages[0].id = 'unknown-page'; },
    record => { record.localPages.push(structuredClone(record.localPages[0])); },
    record => { record.messages[1].source = 'demo'; },
    record => { record.messages[1].createdAt = 'invalid'; },
    record => { record.messages[1].evidence[0].quote = 'Không có trong hợp đồng'; },
    record => { record.messages.push(structuredClone(record.messages[0])); },
  ]) {
    const record = sampleRecord();
    change(record);
    assert.equal(validateSavedRecord(record), false);
  }
  const partial = sampleRecord();
  partial.report.pages.push({ id: 'page-2', pageNumber: 2, text: '', status: 'unreadable', warning: 'Ảnh quá mờ.' });
  partial.localPages.push({ id: 'page-2', uri: 'file:///documents/page-2.jpg', width: 1240, height: 1754, mimeType: 'image/jpeg' });
  assert.equal(validateSavedRecord(partial), true);
});
