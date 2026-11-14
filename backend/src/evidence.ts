import { randomUUID } from 'node:crypto';
import type { Evidence, ExtractedPage, Finding } from '../../shared/contracts.js';
import type { CandidateAnalysis, RawEvidence } from './schemas.js';
import { CONTRACT_RULES, SEVERITY_ORDER } from './rules.js';

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
  return { id: randomUUID(), pageId: page.id, pageNumber: page.pageNumber, quote: page.text.slice(startOffset, endOffset), startOffset, endOffset, boundingBox: null };
}

const unsupportedLegalVerdict = /(?:trái\s+pháp\s+luật|bất\s+hợp\s+pháp|vi\s+phạm\s+pháp\s+luật|đương\s+nhiên\s+vô\s+hiệu)/iu;
export function containsLegalVerdict(text: string): boolean { return unsupportedLegalVerdict.test(text); }

export function validateFindings(candidate: CandidateAnalysis, pages: ExtractedPage[]): { findings: Finding[]; rejected: number } {
  const findings: Finding[] = [];
  let rejected = 0;
  const duplicates = new Set<string>();
  for (const raw of candidate.findings) {
    const rule = CONTRACT_RULES.find(r => r.id === raw.ruleId);
    const evidence = raw.evidence.map(e => verifyEvidence(e, pages));
    const key = `${raw.ruleId}:${raw.title.trim().toLocaleLowerCase('vi')}:${raw.evidence.map(e => e.pageId + e.quote).join('|')}`;
    if (!rule || !evidence.length || evidence.some(e => !e) || containsLegalVerdict(`${raw.title} ${raw.reason} ${raw.explanation} ${raw.suggestedQuestion}`) || !raw.title.trim() || !raw.reason.trim() || !raw.explanation.trim() || !raw.suggestedQuestion.trim() || duplicates.has(key)) { rejected++; continue; }
    duplicates.add(key);
    findings.push({ id: randomUUID(), ...raw, category: rule.category, evidence: evidence as Evidence[] });
  }
  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return { findings, rejected };
}
