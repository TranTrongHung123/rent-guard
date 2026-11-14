import test from 'node:test';
import assert from 'node:assert/strict';
import { containsLegalVerdict, validateFindings, verifyEvidence } from '../src/evidence.js';
import { signReport, verifyReport } from '../src/signing.js';
import { candidate, config, page, unsignedReport } from './helpers.js';

test('quotes tolerate whitespace only and offsets point to original text', () => {
  const source = { ...page, text: 'Điều 1.\nTiền cọc\n là\t10.000.000 đồng.' };
  const evidence = verifyEvidence({ pageId: page.id, quote: 'Tiền cọc là 10.000.000 đồng.' }, [source]);
  assert.ok(evidence);
  assert.equal(evidence.quote, 'Tiền cọc\n là\t10.000.000 đồng.');
  assert.equal(source.text.slice(evidence.startOffset, evidence.endOffset), evidence.quote);
  assert.equal(evidence.boundingBox, null);
});
test('invented amounts, changed accents, wrong pages and unreadable pages are rejected', () => {
  for (const quote of ['Tiền cọc là 20.000.000 đồng.', 'Tiền cọc là 10.000.000 dồng.', '10.000']) assert.equal(verifyEvidence({ pageId: page.id, quote }, [page]), null);
  assert.equal(verifyEvidence({ pageId: 'wrong', quote: page.text }, [page]), null);
  assert.equal(verifyEvidence({ pageId: page.id, quote: page.text }, [{ ...page, status: 'unreadable' }]), null);
});
test('findings fail closed when any citation is fabricated', () => {
  const input = structuredClone(candidate);
  input.findings[0]!.evidence.push({ pageId: page.id, quote: 'Chủ nhà tự giữ toàn bộ tài sản.' });
  const result = validateFindings(input, [page]);
  assert.equal(result.findings.length, 0);
  assert.equal(result.rejected, 1);
});
test('unsupported legal verdicts are rejected and valid findings sorted high first', () => {
  assert.equal(containsLegalVerdict('Điều khoản này trái pháp luật.'), true);
  const input = structuredClone(candidate);
  input.findings[0]!.explanation = 'Điều khoản này bất hợp pháp.';
  assert.equal(validateFindings(input, [page]).findings.length, 0);
  input.findings[0]!.explanation = candidate.findings[0]!.explanation;
  input.findings.unshift({ ...input.findings[0]!, checkId: 'OTHER_CLARIFICATION', title: 'Chi tiết cần làm rõ' });
  assert.deepEqual(validateFindings(input, [page]).findings.map(f => f.severity), ['high', 'low']);
});
test('signing survives JSON and key order but detects edited contract text', () => {
  const token = signReport(unsignedReport, config.signingSecret);
  assert.ok(verifyReport(JSON.parse(JSON.stringify(unsignedReport)), token, config.signingSecret));
  const reordered = Object.fromEntries(Object.entries(unsignedReport).reverse()) as typeof unsignedReport;
  assert.ok(verifyReport(reordered, token, config.signingSecret));
  const changed = structuredClone(unsignedReport);
  changed.pages[0]!.text += ' Không cần trả tiền cọc.';
  assert.equal(verifyReport(changed, token, config.signingSecret), false);
  assert.equal(verifyReport(unsignedReport, 'bad-token', config.signingSecret), false);
  assert.equal(verifyReport(unsignedReport, token.replace('v1.', 'v2.'), config.signingSecret), false);
  assert.equal(verifyReport(unsignedReport, token, 'rotated-secret-with-32-or-more-characters'), false);
  const historical = { ...unsignedReport, createdAt: '2020-01-01T00:00:00.000Z' };
  assert.ok(verifyReport(historical, signReport(historical, config.signingSecret), config.signingSecret), 'Saved phone history has no arbitrary TTL');
});
test('historical bare signature fixture migrates without changing signed data', () => {
  const historical = { id: 'legacy-report', title: 'Legacy', createdAt: '2020-01-01T00:00:00.000Z', source: 'openai' as const, model: 'gpt-4.1-mini', summary: 'Legacy fixture', pages: [], findings: [], missingInformation: [], warnings: [] };
  // Historical SHA-256 signature fixture, independently calculated using Python hmac.
  assert.ok(verifyReport(historical, 'YNB9l2jtgnVUfuA-CXIaGl58qJfZLkrXlr1vWOn5qyo', config.signingSecret));
  assert.equal(verifyReport({ ...historical, title: 'Edited' }, 'YNB9l2jtgnVUfuA-CXIaGl58qJfZLkrXlr1vWOn5qyo', config.signingSecret), false);
});
