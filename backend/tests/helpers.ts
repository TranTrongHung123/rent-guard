import type { AnalysisReport, ExtractedPage } from '../../shared/contracts.js';
import type { Config } from '../src/config.js';
import type { ClaimToReview, StructuredAI } from '../src/ai.js';
import type { Answer, CandidateAnalysis } from '../src/schemas.js';
import { CHECK_IDS } from '../src/rules.js';

export const config: Config = { port: 4000, host: '127.0.0.1', apiKey: 'test-placeholder-no-external-request', model: 'gpt-4.1-mini', timeoutMs: 1000, maxPages: 20, maxImageBytes: 5 * 1024 * 1024, maxTotalImageBytes: 20 * 1024 * 1024, corsOrigins: ['http://localhost:8081'], signingSecret: 'test-only-signing-secret-at-least-32-characters' };
export const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlGQAAAAASUVORK5CYII=';
export const page: ExtractedPage = { id: 'page-1', pageNumber: 1, status: 'readable', text: 'Điều 1. Tiền cọc là 10.000.000 đồng.\nKhông hoàn cọc khi bên thuê trả nhà trước hạn.', warning: null };
export const secondPage: ExtractedPage = { id: 'page-2', pageNumber: 2, status: 'readable', text: 'Điều 2. Giá điện là 4.000 đồng/kWh. Giá điện có thể thay đổi theo thông báo của bên cho thuê.', warning: null };
export const candidate: CandidateAnalysis = { reviewedChecks: [...CHECK_IDS], findings: [
  { checkId: 'DEPOSIT_FORFEITURE', title: 'Mất cọc khi trả nhà trước hạn', reason: 'Điều khoản quy định không hoàn cọc khi trả nhà trước hạn.', explanation: 'Bạn có thể mất tiền cọc nếu trả nhà trước hạn. Cần làm rõ trường hợp ngoại lệ.', suggestedQuestion: 'Nếu cần trả nhà sớm, tôi được hoàn cọc trong trường hợp nào?', evidence: [{ pageId: 'page-1', quote: 'Không hoàn cọc khi bên thuê trả nhà trước hạn.' }] },
] };
export class FakeAI implements StructuredAI {
  extracted: string[] = [];
  analysisPages: ExtractedPage[] = [];
  analysisCalls = 0;
  analysis = structuredClone(candidate);
  unsupported = false;
  unreadable = false;
  partial = false;
  reviewClaims: ClaimToReview[] = [];
  chatRequest: unknown;
  answerData: Answer = { claims: [{ text: 'Hợp đồng ghi tiền cọc là 10.000.000 đồng.', evidence: [{ pageId: 'page-1', quote: 'Tiền cọc là 10.000.000 đồng.' }] }], insufficientInformation: false };
  async extract(input: { id: string }): Promise<Pick<ExtractedPage, 'status' | 'text' | 'warning'>> { this.extracted.push(input.id); return this.unreadable ? { status: 'unreadable', text: '', warning: 'Ảnh mờ.' } : { status: this.partial ? 'partial' : 'readable', text: input.id === 'page-1' ? page.text : secondPage.text, warning: null }; }
  async analyze(pages: ExtractedPage[]) { this.analysisCalls++; this.analysisPages = pages; return this.analysis; }
  async review(claims: ClaimToReview[]) { this.reviewClaims = claims; return { reviews: claims.map(claim => ({ id: claim.id, supported: !this.unsupported, reason: 'Test fixture review.' })) }; }
  async answer(request: unknown) { this.chatRequest = request; return this.answerData; }
}
export const unsignedReport: AnalysisReport = { id: 'report-1', title: 'Test', createdAt: '2026-11-14T00:00:00.000Z', source: 'openai', model: 'gpt-4.1-mini', summary: 'Test report', pages: [page], findings: [], warnings: [], missingInformation: [] };
