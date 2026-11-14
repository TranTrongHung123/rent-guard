import type { AnalysisReport, ChatMessage } from './contracts';
export type * from './contracts';

export interface LocalPage {
  id: string;
  uri: string;
  width: number;
  height: number;
  mimeType: 'image/jpeg';
}

export interface SavedAnalysis {
  id: string;
  report: AnalysisReport;
  localPages: LocalPage[];
  analysisToken: string;
  messages: ChatMessage[];
  isSaved: boolean;
}
