import type { AnalysisReport, AnalyzeResponse, SavedAnalysis } from '../types';

/** UTF-8 SHA-256 of this JSON must match backend inputFingerprint. */
export const fingerprintInput = (pages: { dataUrl: string }[]) => JSON.stringify(pages.map(page => page.dataUrl));

export function previousAnalysis(records: SavedAnalysis[], fingerprint: string | null, pageCount: number): AnalyzeResponse | undefined {
  const compatible = records.filter(record => record.report.source === 'openai' && record.analysisToken && record.report.analysis && record.report.pages.length === pageCount);
  // A candidate with different images is only a hint. The server must extract
  // every current image and match all text before it can borrow this report.
  const record = compatible.find(record => fingerprint && record.report.analysis!.inputFingerprint === fingerprint) ?? compatible[0];
  // Leave room for up to 20 MiB of base64 images in the 30 MiB JSON envelope.
  // A very large history snapshot is optional; server caches can still match.
  if (record && JSON.stringify(record.report).length > 500000) return undefined;
  return record ? { report: record.report, analysisToken: record.analysisToken } : undefined;
}

export function analysisProvenance(report: AnalysisReport): { title: string; description: string } {
  if (!report.analysis) return { title: 'Báo cáo từ phiên bản trước', description: 'Bạn có thể đọc lại ảnh để áp dụng danh sách kiểm tra mới.' };
  switch (report.analysis.reuse) {
    case 'images': return { title: 'Đã nhận diện bộ ảnh trùng khớp', description: 'Đang dùng lại kết quả đã kiểm chứng của bộ ảnh này.' };
    case 'saved': return { title: 'Đã đối chiếu với báo cáo trên máy', description: 'Bộ ảnh trùng khớp với báo cáo đã được máy chủ xác thực.' };
    case 'text': return { title: 'Nội dung đọc được trùng khớp', description: 'Đã đọc các ảnh mới và dùng lại kết quả; trích dẫn được đối chiếu lại với văn bản của lần đọc này.' };
    default: return { title: 'Đã phân tích từ ảnh', description: 'Các điểm cần lưu ý đã được đối chiếu bằng chứng và xếp mức ưu tiên theo bộ quy tắc cố định.' };
  }
}
