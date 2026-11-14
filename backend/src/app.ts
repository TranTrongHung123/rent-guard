import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { AnalyzeRequest } from '../../shared/contracts.js';
import type { Config } from './config.js';
import type { StructuredAI } from './ai.js';
import { OpenAIService } from './ai.js';
import { ContractService } from './service.js';
import { AppError } from './errors.js';
import { ChatBodySchema, ReportSchema } from './schemas.js';
import { ANALYSIS_VERSION, analysisPolicyId } from './stability.js';

export function validateImages(body: unknown, config: Config): AnalyzeRequest {
  const parsed = z.object({
    pages: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/), dataUrl: z.string() }).strict()).min(1).max(config.maxPages),
    forceRefresh: z.boolean().optional(),
    previousAnalysis: z.object({ report: ReportSchema, analysisToken: z.string().min(1).max(200) }).strict().optional(),
  }).strict().safeParse(body);
  if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', `Cung cấp từ 1 đến ${config.maxPages} trang ảnh hợp đồng với ID riêng biệt.`);
  if (new Set(parsed.data.pages.map(p => p.id)).size !== parsed.data.pages.length) throw new AppError(400, 'DUPLICATE_PAGE', 'Mỗi trang phải có một ID riêng biệt.');
  let total = 0;
  for (const page of parsed.data.pages) {
    const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(page.dataUrl);
    if (!match || match[2]!.length % 4 !== 0) throw new AppError(422, 'INVALID_IMAGE', 'Ảnh phải ở định dạng JPEG, PNG hoặc WebP hợp lệ. Hãy chọn lại ảnh.');
    const bytes = Buffer.from(match[2]!, 'base64');
    if (bytes.length > config.maxImageBytes) throw new AppError(413, 'IMAGE_TOO_LARGE', `Một ảnh vượt quá ${config.maxImageBytes / 1024 / 1024} MB. Hãy giảm kích thước hoặc chụp lại.`);
    total += bytes.length;
    const validSignature = bytes.length >= 24 && (
      (match[1] === 'jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) ||
      (match[1] === 'png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
      (match[1] === 'webp' && bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP')
    );
    if (!validSignature) throw new AppError(422, 'INVALID_IMAGE', 'Tệp ảnh bị hỏng hoặc không đúng định dạng. Hãy chọn lại ảnh.');
  }
  if (total > config.maxTotalImageBytes) throw new AppError(413, 'IMAGES_TOO_LARGE', 'Tổng dung lượng ảnh vượt 20 MB. Hãy giảm kích thước ảnh rồi thử lại.');
  return parsed.data;
}

export function createApp(config: Config, ai: StructuredAI = new OpenAIService(config)) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.locals.requestId = randomUUID(); res.setHeader('X-Request-Id', res.locals.requestId); res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(helmet());
  app.use(cors({ origin(origin, callback) { if (!origin || config.corsOrigins.includes(origin)) callback(null, true); else callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'Nguồn truy cập chưa được cấu hình trong CORS_ORIGINS.')); } }));
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', aiConfigured: Boolean(config.apiKey), model: config.model, analysisVersion: ANALYSIS_VERSION, analysisPolicyId: analysisPolicyId(config), limits: { maxPages: config.maxPages, maxImageBytes: config.maxImageBytes, maxQuestionLength: 2000 } }));
  app.use('/api', rateLimit({ windowMs: 60_000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false, handler: (_req, res) => res.status(429).json({ error: { code: 'RATE_LIMIT', message: 'Bạn gửi yêu cầu quá nhanh. Hãy chờ một phút rồi thử lại.', requestId: res.locals.requestId } }) }));
  // Reject oversized/missing-key workloads before reading a large image body.
  app.use(['/api/analyses', '/api/chat'], (_req, _res, next) => {
    if (!config.apiKey) return next(new AppError(503, 'AI_NOT_CONFIGURED', 'Backend chưa được cấu hình OpenAI API Key. Hãy thêm khóa trong backend/.env rồi khởi động lại backend.'));
    next();
  });
  app.use(express.json({ limit: '30mb', strict: true }));
  const service = new ContractService(config, ai);
  let activeRequests = 0;
  function run(task: (req: Request, signal: AbortSignal) => Promise<unknown>) {
    return async (req: Request, res: Response, next: NextFunction) => {
      if (activeRequests >= 3) return next(new AppError(429, 'SERVER_BUSY', 'Backend đang xử lý các hợp đồng khác. Hãy chờ rồi thử lại.'));
      activeRequests++;
      const controller = new AbortController();
      const abort = () => { if (!res.writableEnded) controller.abort(); };
      req.on('aborted', abort);
      res.on('close', abort);
      try { const result = await task(req, controller.signal); if (!controller.signal.aborted) res.json(result); }
      catch (error) { if (!controller.signal.aborted) next(error); }
      finally { activeRequests--; req.off('aborted', abort); res.off('close', abort); }
    };
  }
  app.post('/api/analyses', run((req, signal) => service.analyze(validateImages(req.body, config), signal)));
  app.post('/api/chat', run((req, signal) => {
    const parsed = ChatBodySchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(400, 'INVALID_INPUT', 'Dữ liệu hỏi đáp không hợp lệ. Câu hỏi tối đa 2.000 ký tự; hãy mở lại báo cáo và thử lại.');
    return service.chat(parsed.data, signal);
  }));
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'API không tồn tại.')));
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    let known = error instanceof AppError ? error : null;
    if (error && typeof error === 'object' && 'type' in error && error.type === 'entity.too.large') known = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Tổng ảnh quá lớn. Hãy giảm kích thước ảnh và thử lại.');
    if (error instanceof SyntaxError && 'body' in error) known = new AppError(400, 'INVALID_JSON', 'Dữ liệu JSON không hợp lệ.');
    // Do not log contract content, image bytes, prompts, provider responses or secrets.
    if (!known) console.error(JSON.stringify({ event: 'request_error', requestId: res.locals.requestId, type: error instanceof Error ? error.name : 'unknown' }));
    res.status(known?.status || 500).json({ error: { code: known?.code || 'INTERNAL_ERROR', message: known?.message || 'Backend gặp lỗi. Vui lòng thử lại.', requestId: res.locals.requestId } });
  });
  return app;
}
