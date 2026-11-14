/** Shared wire contract. Never place credentials or native-only dependencies here. */
export type Severity = 'high' | 'medium' | 'low';
export type AnalysisSource = 'openai' | 'demo';
export type FindingCategory = 'deposit' | 'rent' | 'fees' | 'termination' | 'repairs' | 'other';

export interface BoundingBox { x: number; y: number; width: number; height: number }
export interface Evidence {
  id: string;
  pageId: string;
  pageNumber: number;
  quote: string;
  /** Offsets in the original extracted page text, calculated by the backend. */
  startOffset: number;
  endOffset: number;
  /** Null when reliable image coordinates are unavailable; never guessed. */
  boundingBox: BoundingBox | null;
}
export interface ExtractedPage {
  id: string;
  pageNumber: number;
  status: 'readable' | 'partial' | 'unreadable';
  text: string;
  warning: string | null;
}
export interface Finding {
  id: string;
  checkId?: string;
  ruleId: string;
  category: FindingCategory;
  severity: Severity;
  title: string;
  reason: string;
  explanation: string;
  suggestedQuestion: string;
  evidence: Evidence[];
}
export interface AnalysisReport {
  id: string;
  title: string;
  createdAt: string;
  source: AnalysisSource;
  model: string | null;
  summary: string;
  pages: ExtractedPage[];
  findings: Finding[];
  missingInformation: string[];
  warnings: string[];
  analysis?: {
    version: string;
    policyId: string;
    inputFingerprint: string;
    analyzedAt: string;
    reuse: 'none' | 'images' | 'text' | 'saved';
  };
}
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence: Evidence[];
  createdAt: string;
  source: AnalysisSource;
}
export interface AnalyzeRequest {
  pages: { id: string; dataUrl: string }[];
  forceRefresh?: boolean;
  previousAnalysis?: AnalyzeResponse;
}
export interface AnalyzeResponse { report: AnalysisReport; analysisToken: string }
export interface ChatRequest {
  report: AnalysisReport;
  analysisToken: string;
  /** Previous completed turns only; current question is sent separately. */
  messages: Pick<ChatMessage, 'role' | 'content'>[];
  question: string;
}
export interface ChatResponse { message: ChatMessage }
export interface ApiError { error: { code: string; message: string; requestId?: string } }
export interface HealthResponse {
  status: 'ok';
  aiConfigured: boolean;
  model: string;
  limits: { maxPages: number; maxImageBytes: number; maxQuestionLength: number };
  analysisVersion?: string;
  analysisPolicyId?: string;
}
