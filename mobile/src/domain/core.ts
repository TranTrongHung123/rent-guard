import type { SavedAnalysis } from '../types';

export const MAX_PAGES = 20;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_QUESTION_LENGTH = 2000;

export function normalizeApiUrl(value: string): string {
  const raw = value.trim().replace(/\/+$/, '');
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('Địa chỉ máy chủ chưa đúng. Ví dụ: http://192.168.1.10:4000'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Nhập địa chỉ HTTP/HTTPS của máy chủ, không kèm đường dẫn, mật khẩu hoặc tham số.');
  }
  return url.origin;
}

export function moveItem<T extends { id: string }>(items: T[], id: string, direction: -1 | 1): T[] {
  const index = items.findIndex((item) => item.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= items.length) return items;
  const next = [...items];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function validateSavedRecord(value: unknown): value is SavedAnalysis {
  const isObject = (item: unknown): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item);
  const isText = (item: unknown): item is string => typeof item === 'string' && item.trim().length > 0;
  const isDate = (item: unknown): item is string => typeof item === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(item) && Number.isFinite(Date.parse(item));
  const isPositive = (item: unknown): item is number => typeof item === 'number' && Number.isFinite(item) && item > 0;
  const isStringArray = (items: unknown): items is string[] => Array.isArray(items) && items.every(item => typeof item === 'string');
  if (!isObject(value) || !isText(value.id) || !isObject(value.report) || typeof value.isSaved !== 'boolean' || typeof value.analysisToken !== 'string') return false;
  const report = value.report;
  if (value.id !== report.id || !['demo', 'openai'].includes(String(report.source)) || !isText(report.title) ||
    !isDate(report.createdAt) || !isText(report.summary) || (report.model !== null && !isText(report.model)) ||
    !isStringArray(report.warnings) || !isStringArray(report.missingInformation) ||
    !Array.isArray(report.pages) || report.pages.length === 0 || !Array.isArray(report.findings) ||
    !Array.isArray(value.localPages) || !Array.isArray(value.messages) ||
    (report.source === 'openai' && !value.analysisToken.trim())) return false;

  if (report.analysis !== undefined) {
    const analysis = report.analysis;
    if (!isObject(analysis) || !isText(analysis.version) || !isDate(analysis.analyzedAt) ||
      typeof analysis.policyId !== 'string' || !/^[a-f0-9]{64}$/.test(analysis.policyId) ||
      typeof analysis.inputFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(analysis.inputFingerprint) ||
      !['none', 'images', 'text', 'saved'].includes(String(analysis.reuse))) return false;
  }

  const pages = new Map<string, { pageNumber: number; status: string; text: string }>();
  for (const [index, page] of report.pages.entries()) {
    if (!isObject(page) || !isText(page.id) || pages.has(page.id) || page.pageNumber !== index + 1 ||
      !['readable', 'partial', 'unreadable'].includes(String(page.status)) || typeof page.text !== 'string' ||
      (page.warning !== null && typeof page.warning !== 'string') ||
      (page.status !== 'unreadable' && !page.text.trim())) return false;
    pages.set(page.id, { pageNumber: index + 1, status: String(page.status), text: page.text });
  }

  // Keep offsets tied to the exact OCR text. A quote that merely looks plausible
  // must not become a tappable citation after loading local or network data.
  const evidenceById = new Map<string, string>();
  function validEvidence(items: unknown): boolean {
    if (!Array.isArray(items)) return false;
    const ids = new Set<string>();
    for (const item of items) {
      if (!isObject(item) || !isText(item.id) || ids.has(item.id) || !isText(item.pageId) || !isText(item.quote)) return false;
      const page = pages.get(item.pageId);
      if (!page || page.status === 'unreadable' || item.pageNumber !== page.pageNumber ||
        typeof item.startOffset !== 'number' || !Number.isSafeInteger(item.startOffset) || item.startOffset < 0 ||
        typeof item.endOffset !== 'number' || !Number.isSafeInteger(item.endOffset) || item.endOffset <= item.startOffset ||
        item.endOffset > page.text.length || page.text.slice(item.startOffset, item.endOffset) !== item.quote) return false;
      const box = item.boundingBox;
      if (box !== null && (!isObject(box) || typeof box.x !== 'number' || typeof box.y !== 'number' ||
        !Number.isFinite(box.x) || !Number.isFinite(box.y) || box.x < 0 || box.y < 0 || !isPositive(box.width) ||
        !isPositive(box.height) || box.x + box.width > 1.000001 || box.y + box.height > 1.000001)) return false;
      const signature = JSON.stringify([item.pageId, item.pageNumber, item.quote, item.startOffset, item.endOffset, box]);
      if (evidenceById.has(item.id) && evidenceById.get(item.id) !== signature) return false;
      evidenceById.set(item.id, signature);
      ids.add(item.id);
    }
    return true;
  }

  const findingIds = new Set<string>();
  for (const finding of report.findings) {
    if (!isObject(finding) || !isText(finding.id) || findingIds.has(finding.id) || !isText(finding.ruleId) ||
      (finding.checkId !== undefined && !isText(finding.checkId)) ||
      !['deposit', 'rent', 'fees', 'termination', 'repairs', 'other'].includes(String(finding.category)) ||
      !['high', 'medium', 'low'].includes(String(finding.severity)) || !isText(finding.title) ||
      !isText(finding.reason) || !isText(finding.explanation) || !isText(finding.suggestedQuestion) ||
      !Array.isArray(finding.evidence) || finding.evidence.length === 0 || !validEvidence(finding.evidence)) return false;
    findingIds.add(finding.id);
  }

  const localPageIds = new Set<string>();
  for (const page of value.localPages) {
    if (!isObject(page) || !isText(page.id) || !pages.has(page.id) || localPageIds.has(page.id) ||
      !isText(page.uri) || !isPositive(page.width) || !isPositive(page.height) || page.mimeType !== 'image/jpeg') return false;
    localPageIds.add(page.id);
  }
  if (localPageIds.size !== pages.size) return false;

  const messageIds = new Set<string>();
  for (const message of value.messages) {
    if (!isObject(message) || !isText(message.id) || messageIds.has(message.id) || !['user', 'assistant'].includes(String(message.role)) ||
      !isText(message.content) || !isDate(message.createdAt) || message.source !== report.source || !validEvidence(message.evidence) ||
      (message.role === 'user' && Array.isArray(message.evidence) && message.evidence.length > 0)) return false;
    messageIds.add(message.id);
  }
  return true;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'Đã xảy ra lỗi. Vui lòng thử lại.';
}
