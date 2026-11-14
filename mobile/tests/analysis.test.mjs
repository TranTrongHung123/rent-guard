import test from 'node:test';
import assert from 'node:assert/strict';
import { analysisProvenance, fingerprintInput, previousAnalysis } from '../src/domain/analysis.ts';

const record = (fingerprint = 'a'.repeat(64)) => ({ report: { source: 'openai', pages: [{}], analysis: { inputFingerprint: fingerprint, reuse: 'none' } }, analysisToken: 'signed-fixture' });

test('fingerprint serialization preserves image bytes and ordering while ignoring local picker IDs', () => {
  const a = [{ id: 'a', dataUrl: 'data:image/jpeg;base64,YQ==' }, { id: 'b', dataUrl: 'data:image/jpeg;base64,Yg==' }];
  assert.equal(fingerprintInput(a), '["data:image/jpeg;base64,YQ==","data:image/jpeg;base64,Yg=="]');
  assert.equal(fingerprintInput(a), fingerprintInput(a.map(page => ({ ...page, id: 'new-picker-id' }))));
  assert.notEqual(fingerprintInput(a), fingerprintInput([...a].reverse()));
});

test('history prefers exact image fingerprint and sends only the signed report, without chat or local URIs', () => {
  const older = { ...record(), localPages: [{ uri: 'private-local-image' }], messages: ['private-chat'] };
  const recent = record('b'.repeat(64));
  const candidate = previousAnalysis([recent, older], 'a'.repeat(64), 1);
  assert.deepEqual(candidate, { report: older.report, analysisToken: older.analysisToken });
  assert.equal(previousAnalysis([recent, older], 'c'.repeat(64), 1).report, recent.report);
  assert.equal(previousAnalysis([recent], null, 1).report, recent.report);
});

test('demo, unsigned, legacy and different page counts are never suggested for reuse', () => {
  const demo = record(); demo.report.source = 'demo';
  const unsigned = record(); unsigned.analysisToken = '';
  const legacy = record(); delete legacy.report.analysis;
  const morePages = record(); morePages.report.pages.push({});
  assert.equal(previousAnalysis([demo, unsigned, legacy, morePages], 'a'.repeat(64), 1), undefined);
  const oversized = record(); oversized.report.summary = 'a'.repeat(500001);
  assert.equal(previousAnalysis([oversized], 'a'.repeat(64), 1), undefined, 'optional history must leave room for current images');
});

test('provenance distinguishes a new AI run, same images, saved history and rephotographed matching text', () => {
  const titles = new Set();
  for (const reuse of ['none', 'images', 'saved', 'text']) {
    const report = record().report; report.analysis.reuse = reuse;
    const details = analysisProvenance(report);
    assert.ok(details.description.length > 30); titles.add(details.title);
  }
  assert.equal(titles.size, 4);
  assert.match(analysisProvenance({}).title, /phiên bản trước/);
});
