import { createHash } from 'node:crypto';
import type { Evidence, ExtractedPage, Finding } from '../../shared/contracts.js';
import type { CandidateAnalysis, RawEvidence } from './schemas.js';
import { CONTRACT_CHECKS, CONTRACT_RULES, SEVERITY_ORDER } from './rules.js';
const stableId = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 32);

/** Only whitespace may vary. Case, punctuation, accents and amounts must match. */
function normalizeWithOffsets(text: string): { text: string; offsets: number[] } {
  let normalized = '';
  const offsets: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (/\s/u.test(ch)) {
      if (normalized && normalized[normalized.length - 1] !== ' ') { normalized += ' '; offsets.push(i); }
    } else { normalized += ch; offsets.push(i); }
  }
  if (normalized.endsWith(' ')) { normalized = normalized.slice(0, -1); offsets.pop(); }
  return { text: normalized, offsets };
}
export function verifyEvidence(raw: RawEvidence, pages: ExtractedPage[]): Evidence | null {
  const page = pages.find(p => p.id === raw.pageId);
  if (!page || page.status === 'unreadable') return null;
  const quote = normalizeWithOffsets(raw.quote).text;
  // Short fragments (e.g. an isolated number) cannot substantiate an explanation.
  if (quote.length < 8 || quote.length > 4000) return null;
  const normalized = normalizeWithOffsets(page.text);
  const index = normalized.text.indexOf(quote);
  if (index < 0) return null;
  const startOffset = normalized.offsets[index]!;
  const endOffset = normalized.offsets[index + quote.length - 1]! + 1;
  return { id: stableId([page.pageNumber, startOffset, endOffset, page.text.slice(startOffset, endOffset)]), pageId: page.id, pageNumber: page.pageNumber, quote: page.text.slice(startOffset, endOffset), startOffset, endOffset, boundingBox: null };
}

const unsupportedLegalVerdict = /(?:trái\s+pháp\s+luật|bất\s+hợp\s+pháp|vi\s+phạm\s+pháp\s+luật|đương\s+nhiên\s+vô\s+hiệu)/iu;
export function containsLegalVerdict(text: string): boolean { return unsupportedLegalVerdict.test(text); }

export function validateFindings(candidate: CandidateAnalysis, pages: ExtractedPage[]): { findings: Finding[]; rejected: number } {
  const findings: Finding[] = [];
  let rejected = 0;
  const duplicates = new Set<string>();
  for (const raw of candidate.findings) {
    const check = CONTRACT_CHECKS.find(item => item.id === raw.checkId);
    const rule = CONTRACT_RULES.find(r => r.id === check?.ruleId);
    const evidence = raw.evidence.map(e => verifyEvidence(e, pages));
    const verified = (evidence.filter(Boolean) as Evidence[]).filter((item, index, items) => items.findIndex(other => other.id === item.id) === index).sort((a, b) => a.pageNumber - b.pageNumber || a.startOffset - b.startOffset || a.endOffset - b.endOffset);
    const key = JSON.stringify([raw.checkId, verified.map(e => [e.pageNumber, e.startOffset, e.endOffset])]);
    if (!rule || !evidence.length || evidence.some(e => !e) || containsLegalVerdict(`${raw.title} ${raw.reason} ${raw.explanation} ${raw.suggestedQuestion}`) || !raw.title.trim() || !raw.reason.trim() || !raw.explanation.trim() || !raw.suggestedQuestion.trim() || duplicates.has(key)) { rejected++; continue; }
    duplicates.add(key);
    if (!check) { rejected++; continue; }
    findings.push({ ...raw, id: stableId(key), ruleId: rule.id, category: rule.category, severity: check.severity, evidence: verified });
  }
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
    CONTRACT_CHECKS.findIndex(check => check.id === a.checkId) - CONTRACT_CHECKS.findIndex(check => check.id === b.checkId) ||
    a.evidence[0]!.pageNumber - b.evidence[0]!.pageNumber || a.evidence[0]!.startOffset - b.evidence[0]!.startOffset || a.id.localeCompare(b.id));
  return { findings, rejected };
}
