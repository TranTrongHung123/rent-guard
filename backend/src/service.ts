import { randomUUID } from 'node:crypto';
import type { AnalyzeRequest, AnalyzeResponse, AnalysisReport, ChatRequest, ChatResponse, Evidence, ExtractedPage } from '../../shared/contracts.js';
import type { Config } from './config.js';
import type { StructuredAI } from './ai.js';
import { AppError } from './errors.js';
import { containsLegalVerdict, validateFindings, verifyEvidence } from './evidence.js';
import { signReport, verifyReport } from './signing.js';
import { CONTRACT_RULES, RULE_CLARIFICATIONS } from './rules.js';

export class ContractService {
  constructor(private config: Config, private ai: StructuredAI) {}

  async analyze(request: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> {
    // Bounded concurrency preserves input order and avoids bursty API quota use.
    const pages: ExtractedPage[] = new Array(request.pages.length);
    let next = 0;
    const extractionController = new AbortController();
    const extractionSignal = signal ? AbortSignal.any([signal, extractionController.signal]) : extractionController.signal;
    try { await Promise.all(Array.from({ length: Math.min(3, request.pages.length) }, async () => {
      while (next < request.pages.length) {
        const index = next++;
        if (extractionSignal.aborted) throw new AppError(499, 'REQUEST_CANCELLED', 'Yêu cầu đã được hủy.');
        const input = request.pages[index]!;
        const extracted = await this.ai.extract(input, index + 1, extractionSignal);
        const text = extracted.status === 'unreadable' ? '' : extracted.text;
        const status = text.trim() ? extracted.status : 'unreadable';
        pages[index] = { id: input.id, pageNumber: index + 1, status, text, warning: extracted.warning || (status !== 'readable' ? 'Không đọc được đầy đủ trang này. Hãy đối chiếu ảnh gốc hoặc chụp lại.' : null) };
      }
    })); } catch (error) { extractionController.abort(); throw error; }
    if (pages.every(p => p.status === 'unreadable')) throw new AppError(422, 'UNREADABLE_IMAGES', 'Không đọc được nội dung hợp đồng trong các ảnh. Hãy chụp rõ chữ, đủ sáng, đủ bốn góc trang rồi thử lại.');
    if (pages.reduce((sum, page) => sum + page.text.length, 0) > 200000) throw new AppError(422, 'CONTRACT_TOO_LONG', 'Hợp đồng vượt dung lượng một lần phân tích. Chia thành các phần nhỏ hơn và xem xét các giới hạn khi đối chiếu.');
    const raw = await this.ai.analyze(pages, signal);
    const validated = validateFindings(raw, pages);
    const reviews = validated.findings.length ? await this.ai.review(validated.findings.map(f => ({ id: f.id, text: `Nhóm ${f.ruleId}; mức ưu tiên ${f.severity}\n${f.title}\n${f.reason}\n${f.explanation}\nCâu hỏi gợi ý: ${f.suggestedQuestion}`, evidence: f.evidence })), pages, signal) : { reviews: [] };
    // Missing/duplicate review IDs fail closed.
    const findings = validated.findings.filter(f => reviews.reviews.filter(r => r.id === f.id).length === 1 && reviews.reviews.find(r => r.id === f.id)?.supported === true);
    const rejected = raw.findings.length - findings.length;
    const warnings = [
      'AI có thể đọc sai chữ trong ảnh. Bằng chứng đã được đối chiếu với văn bản trích xuất; hãy kiểm tra lại trên ảnh gốc trước khi quyết định.',
      'Mức độ thể hiện ưu tiên cần làm rõ, không phải kết luận pháp lý hoặc chứng nhận hợp đồng an toàn.',
      ...pages.filter(p => p.status !== 'readable').map(p => `Trang ${p.pageNumber}: ${p.warning || 'Nội dung chưa đọc đầy đủ.'}`),
      ...(rejected ? [`Đã loại ${rejected} nhận định không vượt qua kiểm chứng bằng chứng. Kết quả có thể chưa bao quát hết vấn đề.`] : []),
    ];
    const high = findings.filter(f => f.severity === 'high').length;
    const report: AnalysisReport = {
      id: randomUUID(), title: 'Hợp đồng thuê nhà', createdAt: new Date().toISOString(), source: 'openai', model: this.config.model,
      summary: findings.length ? `Đã rà soát ${pages.length} trang và ghi nhận ${findings.length} điểm cần làm rõ${high ? `, trong đó ${high} điểm ưu tiên cao` : ''}. Hãy đối chiếu bằng chứng và trao đổi với chủ nhà trước khi ký.` : `Đã rà soát ${pages.length} trang. Chưa có nhận định nào đủ bằng chứng để hiển thị. Điều này không có nghĩa hợp đồng không có rủi ro.`,
      pages, findings,
      // Model free text outside verified findings must not introduce uncited factual assertions.
      // These are neutral questions, not claims that a contract omitted a provision.
      missingInformation: [
        ...pages.filter(p => p.status !== 'readable').map(p => `Bạn có thể chụp lại trang ${p.pageNumber} để đối chiếu đầy đủ nội dung không?`),
        ...CONTRACT_RULES.filter(rule => !findings.some(finding => finding.ruleId === rule.id)).map(rule => RULE_CLARIFICATIONS[rule.id]!),
      ], warnings,
    };
    return { report, analysisToken: signReport(report, this.config.signingSecret) };
  }

  async chat(request: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    if (request.report.source !== 'openai' || !verifyReport(request.report, request.analysisToken, this.config.signingSecret)) throw new AppError(403, 'INVALID_ANALYSIS', 'Báo cáo không được xác thực bởi backend này. Hãy mở đúng backend đã phân tích hoặc phân tích lại hợp đồng.');
    // Preserve complete recent turns within a bounded context; fail rather than silently forget.
    if (request.messages.reduce((sum, message) => sum + message.content.length, 0) > 1000000) throw new AppError(422, 'CONVERSATION_TOO_LONG', 'Cuộc trò chuyện vượt dung lượng một lần hỏi đáp. Hãy gửi ít lượt trước đó hơn rồi thử lại.');
    const answer = await this.ai.answer(request, signal);
    const candidates = answer.claims.map((claim, index) => ({ id: String(index), text: claim.text, evidence: claim.evidence.map(e => verifyEvidence(e, request.report.pages)) })).filter(claim => claim.text.trim() && !containsLegalVerdict(claim.text) && claim.evidence.length && claim.evidence.every(Boolean)) as { id: string; text: string; evidence: Evidence[] }[];
    const reviews = candidates.length ? await this.ai.review(candidates, request.report.pages, signal) : { reviews: [] };
    const claims = candidates.filter(claim => reviews.reviews.filter(r => r.id === claim.id).length === 1 && reviews.reviews.find(r => r.id === claim.id)?.supported === true);
    const incomplete = answer.insufficientInformation || claims.length !== answer.claims.length || !claims.length;
    const evidence = claims.flatMap(claim => claim.evidence).filter((item, index, items) => items.findIndex(e => e.pageId === item.pageId && e.startOffset === item.startOffset && e.endOffset === item.endOffset) === index);
    return { message: {
      id: randomUUID(), role: 'assistant', source: 'openai', createdAt: new Date().toISOString(), evidence,
      content: [
        ...claims.map(claim => `${claim.text.trim()} (Trang ${[...new Set(claim.evidence.map(e => e.pageNumber))].join(', ')})`),
        ...(incomplete ? ['Chưa đủ thông tin đã được kiểm chứng trong hợp đồng để kết luận đầy đủ. Bạn nên đối chiếu trang gốc và hỏi chủ nhà về phần còn thiếu.'] : []),
        ...(incomplete ? ['Bạn có thể bổ sung ảnh hoặc chỉ rõ điều khoản liên quan để đối chiếu thêm không?'] : []),
      ].join('\n\n'),
    } };
  }
}
