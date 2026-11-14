import { randomUUID } from 'node:crypto';
import type { AnalyzeRequest, AnalyzeResponse, AnalysisReport, ChatRequest, ChatResponse, Evidence, ExtractedPage } from '../../shared/contracts.js';
import type { Config } from './config.js';
import type { StructuredAI } from './ai.js';
import { AppError } from './errors.js';
import { containsLegalVerdict, validateFindings, verifyEvidence } from './evidence.js';
import { signReport, verifyReport } from './signing.js';
import { CONTRACT_CHECKS, CONTRACT_RULES, RULE_CLARIFICATIONS } from './rules.js';
import { ANALYSIS_VERSION, analysisPolicyId, inputFingerprint, ReportCache, SingleFlight, textFingerprint } from './stability.js';

type Reuse = NonNullable<AnalysisReport['analysis']>['reuse'];

export class ContractService {
  private imageCache: ReportCache;
  private textCache: ReportCache;
  private imageFlights = new SingleFlight<{ report: AnalysisReport; reuse: Reuse }>();
  private textFlights = new SingleFlight<AnalysisReport>();
  private policyId: string;
  constructor(private config: Config, private ai: StructuredAI) {
    this.imageCache = new ReportCache(config.analysisCacheTtlMs ?? 1800000, config.analysisCacheEntries ?? 32);
    this.textCache = new ReportCache(config.analysisCacheTtlMs ?? 1800000, config.analysisCacheEntries ?? 32);
    this.policyId = analysisPolicyId(config);
  }

  async analyze(request: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResponse> {
    if (signal?.aborted) throw new AppError(499, 'REQUEST_CANCELLED', 'Yêu cầu đã được hủy.');
    const fingerprint = inputFingerprint(request.pages);
    const imageKey = `${this.policyId}:${fingerprint}`;
    let previous: AnalysisReport | undefined;
    if (!request.forceRefresh && request.previousAnalysis?.report.analysis?.policyId === this.policyId) {
      const supplied = request.previousAnalysis;
      if (supplied.report.source !== 'openai' || !verifyReport(supplied.report, supplied.analysisToken, this.config.signingSecret)) {
        throw new AppError(403, 'INVALID_ANALYSIS', 'Báo cáo đã lưu không được xác thực. Hãy dùng Đọc lại từ ảnh để tạo phân tích mới.');
      }
      if (supplied.report.model === this.config.model && supplied.report.analysis?.version === ANALYSIS_VERSION && supplied.report.pages.length === request.pages.length) {
        previous = this.canonicalReport(supplied.report);
      }
    }
    let result: { report: AnalysisReport; reuse: Reuse } | undefined;
    if (!request.forceRefresh) {
      const cached = this.imageCache.get(imageKey);
      if (cached) result = { report: cached, reuse: 'images' };
      else if (previous && request.previousAnalysis!.report.analysis!.inputFingerprint === fingerprint) {
        this.imageCache.set(imageKey, previous);
        const textHash = textFingerprint(previous.pages);
        if (textHash) this.textCache.set(`${this.policyId}:${textHash}`, previous);
        result = { report: previous, reuse: 'saved' };
      }
    }
    if (!result) result = await this.imageFlights.run(`${imageKey}:${request.forceRefresh ? 'fresh' : 'reuse'}`, async jobSignal => {
      // Canonical page IDs make the model input independent of picker-generated IDs.
      const canonicalRequest = { pages: request.pages.map((page, index) => ({ id: `page-${index + 1}`, dataUrl: page.dataUrl })) };
      const pages = await this.extractPages(canonicalRequest, jobSignal);
      const textHash = textFingerprint(pages);
      const textKey = textHash ? `${this.policyId}:${textHash}` : null;
      let report: AnalysisReport | undefined;
      let reuse: Reuse = 'none';
      if (!request.forceRefresh && textKey) {
        const known = this.textCache.get(textKey) ?? (previous && textFingerprint(previous.pages) === textHash ? previous : undefined);
        if (known) { report = this.withPages(known, pages) ?? undefined; if (report) reuse = 'text'; }
      }
      if (!report) {
        report = textKey && !request.forceRefresh
          ? await this.textFlights.run(textKey, sharedSignal => this.analyzeText(pages, sharedSignal), jobSignal)
          : await this.analyzeText(pages, jobSignal);
        // Concurrent equivalent OCR can have different whitespace/offsets.
        const rebound = this.withPages(report, pages);
        if (!rebound) throw new AppError(502, 'AI_INVALID_RESPONSE', 'Không đối chiếu được bằng chứng với các trang hiện tại. Hãy thử lại.');
        report = rebound;
      }
      if (jobSignal.aborted) throw new AppError(499, 'REQUEST_CANCELLED', 'Yêu cầu đã được hủy.');
      this.imageCache.set(imageKey, report);
      if (textKey) this.textCache.set(textKey, report);
      return { report, reuse };
    }, signal);
    const report = this.withPages(result.report, result.report.pages.map((page, index) => ({ ...page, id: request.pages[index]!.id })));
    if (!report) throw new AppError(502, 'AI_INVALID_RESPONSE', 'Bằng chứng không khớp bộ trang hợp đồng.');
    report.id = randomUUID();
    report.analysis = { version: ANALYSIS_VERSION, policyId: this.policyId, inputFingerprint: fingerprint, analyzedAt: report.createdAt, reuse: result.reuse };
    return { report, analysisToken: signReport(report, this.config.signingSecret) };
  }

  private canonicalReport(input: AnalysisReport): AnalysisReport {
    const report = structuredClone(input);
    delete report.analysis;
    return this.withPages(report, report.pages.map((page, index) => ({ ...page, id: `page-${index + 1}` })))!;
  }

  /** Never borrow offsets from a different OCR pass or point at an old image ID. */
  private withPages(template: AnalysisReport, pages: ExtractedPage[]): AnalysisReport | null {
    if (pages.length !== template.pages.length) return null;
    const report = structuredClone(template);
    report.pages = structuredClone(pages);
    for (const finding of report.findings) {
      const evidence = finding.evidence.map(item => {
        const page = pages[item.pageNumber - 1];
        return page ? verifyEvidence({ pageId: page.id, quote: item.quote }, pages) : null;
      });
      if (evidence.some(item => !item)) return null;
      finding.evidence = evidence as Evidence[];
    }
    return report;
  }

  private async extractPages(request: AnalyzeRequest, signal?: AbortSignal): Promise<ExtractedPage[]> {
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
        if (extractionSignal.aborted) throw new AppError(499, 'REQUEST_CANCELLED', 'Yêu cầu đã được hủy.');
        const text = extracted.status === 'unreadable' ? '' : extracted.text;
        const status = text.trim() ? extracted.status : 'unreadable';
        pages[index] = { id: input.id, pageNumber: index + 1, status, text, warning: extracted.warning || (status !== 'readable' ? 'Không đọc được đầy đủ trang này. Hãy đối chiếu ảnh gốc hoặc chụp lại.' : null) };
      }
    })); } catch (error) { extractionController.abort(); throw error; }
    if (pages.every(p => p.status === 'unreadable')) throw new AppError(422, 'UNREADABLE_IMAGES', 'Không đọc được nội dung hợp đồng trong các ảnh. Hãy chụp rõ chữ, đủ sáng, đủ bốn góc trang rồi thử lại.');
    if (pages.reduce((sum, page) => sum + page.text.length, 0) > 200000) throw new AppError(422, 'CONTRACT_TOO_LONG', 'Hợp đồng vượt dung lượng một lần phân tích. Chia thành các phần nhỏ hơn và xem xét các giới hạn khi đối chiếu.');
    return pages;
  }

  private async analyzeText(pages: ExtractedPage[], signal?: AbortSignal): Promise<AnalysisReport> {
    const raw = await this.ai.analyze(pages, signal);
    if (raw.reviewedChecks.length !== CONTRACT_CHECKS.length || new Set(raw.reviewedChecks).size !== CONTRACT_CHECKS.length ||
      CONTRACT_CHECKS.some(check => !raw.reviewedChecks.includes(check.id))) {
      throw new AppError(502, 'AI_INCOMPLETE_CHECKLIST', 'AI chưa rà soát đủ danh sách kiểm tra. Không sử dụng kết quả thiếu mục; hãy thử lại.');
    }
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
    return report;
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
