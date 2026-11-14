import { z } from 'zod';

export const RawEvidenceSchema = z.object({ pageId: z.string(), quote: z.string() });
export const ExtractedSchema = z.object({
  status: z.enum(['readable', 'partial', 'unreadable']),
  text: z.string(),
  warning: z.string().nullable(),
});
export const CandidateFindingSchema = z.object({
  ruleId: z.enum(['DEPOSIT', 'RENT', 'FEES', 'TERMINATION', 'REPAIRS', 'OTHER']),
  severity: z.enum(['high', 'medium', 'low']),
  title: z.string(), reason: z.string(), explanation: z.string(), suggestedQuestion: z.string(),
  evidence: z.array(RawEvidenceSchema),
});
export const CandidateAnalysisSchema = z.object({
  findings: z.array(CandidateFindingSchema),
});
export const GroundingSchema = z.object({
  reviews: z.array(z.object({ id: z.string(), supported: z.boolean(), reason: z.string() })),
});
export const AnswerSchema = z.object({
  /** Each factual block must carry verified supporting citations. */
  claims: z.array(z.object({ text: z.string(), evidence: z.array(RawEvidenceSchema) })),
  insufficientInformation: z.boolean(),
});
export type RawEvidence = z.infer<typeof RawEvidenceSchema>;
export type CandidateAnalysis = z.infer<typeof CandidateAnalysisSchema>;
export type CandidateFinding = z.infer<typeof CandidateFindingSchema>;
export type Answer = z.infer<typeof AnswerSchema>;

const EvidenceSchema = z.object({
  id: z.string(), pageId: z.string(), pageNumber: z.number().int().positive(),
  quote: z.string(), startOffset: z.number().int().nonnegative(), endOffset: z.number().int().nonnegative(),
  boundingBox: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }).nullable(),
});
export const ReportSchema = z.object({
  id: z.string(), title: z.string(), createdAt: z.string(), source: z.enum(['openai', 'demo']), model: z.string().nullable(), summary: z.string(),
  pages: z.array(z.object({ id: z.string(), pageNumber: z.number().int().positive(), status: z.enum(['readable', 'partial', 'unreadable']), text: z.string(), warning: z.string().nullable() })),
  findings: z.array(z.object({ id: z.string(), ruleId: z.string(), category: z.enum(['deposit', 'rent', 'fees', 'termination', 'repairs', 'other']), severity: z.enum(['high', 'medium', 'low']), title: z.string(), reason: z.string(), explanation: z.string(), suggestedQuestion: z.string(), evidence: z.array(EvidenceSchema) })),
  missingInformation: z.array(z.string()), warnings: z.array(z.string()),
});
export const ChatBodySchema = z.object({
  report: ReportSchema,
  analysisToken: z.string().min(1).max(200),
  messages: z.array(z.discriminatedUnion('role', [
    z.object({ role: z.literal('user'), content: z.string().min(1).max(2000) }),
    z.object({ role: z.literal('assistant'), content: z.string().min(1).max(100000) }),
  ])).max(200),
  question: z.string().trim().min(1).max(2000),
}).strict();
