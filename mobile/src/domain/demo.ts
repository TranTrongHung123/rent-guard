import type { AnalysisReport, ChatMessage, Evidence, Finding, LocalPage, SavedAnalysis } from '@/types';

export const DEMO_PAGE_TEXTS = [
  'HỢP ĐỒNG THUÊ NHÀ — DỮ LIỆU MẪU\nĐiều 1. Giá thuê: 4.000.000 đồng/tháng. Thời hạn thuê 12 tháng.\nĐiều 2. Tiền đặt cọc là 8.000.000 đồng. Bên thuê chấm dứt trước hạn sẽ mất toàn bộ tiền cọc, bất kể lý do.\nĐiều 3. Chủ nhà có quyền điều chỉnh giá thuê vào bất kỳ thời điểm nào, không cần báo trước.',
  'HỢP ĐỒNG THUÊ NHÀ — TRANG 2 — DỮ LIỆU MẪU\nĐiều 4. Tiền điện tính 5.000 đồng/kWh. Các chi phí dịch vụ khác sẽ do chủ nhà thông báo sau.\nĐiều 5. Bên thuê chịu mọi chi phí sửa chữa trong thời gian thuê, bao gồm hư hỏng hệ thống điện nước có sẵn.\nĐiều 6. Mỗi bên phải thông báo trước 30 ngày khi kết thúc hợp đồng.\nĐây là hợp đồng giả định phục vụ thử nghiệm giao diện, không phải tài liệu của người dùng.',
];

function evidence(pageNumber: number, quote: string): Evidence {
  const startOffset = DEMO_PAGE_TEXTS[pageNumber - 1].indexOf(quote);
  return { id: `demo-evidence-${pageNumber}-${startOffset}`, pageId: `demo-page-${pageNumber}`, pageNumber, quote, startOffset, endOffset: startOffset + quote.length, boundingBox: null };
}

export function createDemoRecord(localPages: LocalPage[], id: string): SavedAnalysis {
  const findings: Finding[] = [
    { id: 'demo-deposit', ruleId: 'deposit-refund', category: 'deposit', severity: 'high', title: 'Có thể mất toàn bộ tiền cọc khi rời trước hạn', reason: 'Điều khoản không nêu ngoại lệ hay cách khấu trừ khoản thiệt hại thực tế.', explanation: 'Bạn có thể mất 8 triệu đồng ngay cả khi việc kết thúc sớm có lý do cần được hai bên xem xét. Hãy đề nghị làm rõ các trường hợp và điều kiện hoàn cọc.', suggestedQuestion: 'Nếu tôi cần kết thúc hợp đồng trước hạn, trường hợp nào được hoàn cọc và số tiền khấu trừ được tính như thế nào?', evidence: [evidence(1, 'Bên thuê chấm dứt trước hạn sẽ mất toàn bộ tiền cọc, bất kể lý do.')] },
    { id: 'demo-rent', ruleId: 'rent-adjustment', category: 'rent', severity: 'high', title: 'Giá thuê có thể thay đổi mà không báo trước', reason: 'Không có thời điểm, mức tăng tối đa hoặc thời hạn báo trước.', explanation: 'Chi phí thuê thực tế có thể vượt dự tính trong thời hạn 12 tháng. Bạn nên thỏa thuận cách điều chỉnh và ghi rõ trong hợp đồng.', suggestedQuestion: 'Giá thuê có được giữ ổn định trong 12 tháng không? Nếu tăng thì mức tối đa và thời gian báo trước là bao lâu?', evidence: [evidence(1, 'Chủ nhà có quyền điều chỉnh giá thuê vào bất kỳ thời điểm nào, không cần báo trước.')] },
    { id: 'demo-repairs', ruleId: 'repair-responsibility', category: 'repairs', severity: 'medium', title: 'Trách nhiệm sửa chữa đang dồn về người thuê', reason: 'Điều khoản bao gồm cả hư hỏng của hệ thống có sẵn.', explanation: 'Cần phân biệt lỗi do sử dụng với hao mòn tự nhiên và hư hỏng trước khi bàn giao.', suggestedQuestion: 'Chủ nhà có chịu chi phí sửa chữa do hao mòn tự nhiên và lỗi điện nước có sẵn không?', evidence: [evidence(2, 'Bên thuê chịu mọi chi phí sửa chữa trong thời gian thuê, bao gồm hư hỏng hệ thống điện nước có sẵn.')] },
    { id: 'demo-fees', ruleId: 'fee-transparency', category: 'fees', severity: 'medium', title: 'Chưa xác định đầy đủ các khoản phí dịch vụ', reason: 'Phí dịch vụ sẽ được thông báo sau mà chưa có danh mục hay mức phí.', explanation: 'Bạn chưa thể tính tổng chi phí hàng tháng từ nội dung này.', suggestedQuestion: 'Xin liệt kê đầy đủ tiền nước, internet, gửi xe và các phí dịch vụ khác cùng mức thu và cách điều chỉnh.', evidence: [evidence(2, 'Các chi phí dịch vụ khác sẽ do chủ nhà thông báo sau.')] },
  ];
  const report: AnalysisReport = {
    id, title: 'Hợp đồng căn hộ • Bản mẫu', createdAt: new Date().toISOString(), source: 'demo', model: null,
    summary: 'Ví dụ minh họa với 4 điểm cần trao đổi: điều kiện mất cọc, tăng giá thuê, chi phí sửa chữa và phí dịch vụ. Đây là dữ liệu soạn sẵn để trải nghiệm giao diện.',
    pages: DEMO_PAGE_TEXTS.map((text, index) => ({ id: `demo-page-${index + 1}`, pageNumber: index + 1, status: 'readable', text, warning: null })),
    findings, missingInformation: ['Chưa có thời hạn hoàn tiền cọc sau khi bàn giao nhà.', 'Chưa có biên bản hiện trạng và danh sách thiết bị.'],
    warnings: ['DỮ LIỆU MẪU — không có cuộc gọi OpenAI nào được thực hiện.'],
  };
  return { id, report, localPages, analysisToken: '', messages: [], isSaved: false };
}

export function createDemoAnswer(question: string, report: AnalysisReport): ChatMessage {
  const normalized = question.toLocaleLowerCase('vi');
  const finding = /cọc|hoàn|trả tiền/.test(normalized) ? report.findings[0]
    : /giá|tăng|thuê.*tháng/.test(normalized) ? report.findings[1]
    : /sửa|hỏng|điện nước/.test(normalized) ? report.findings[2]
    : /phí|dịch vụ|internet/.test(normalized) ? report.findings[3] : null;
  return {
    id: `demo-answer-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`, role: 'assistant', source: 'demo', createdAt: new Date().toISOString(),
    content: finding ? `Trả lời mẫu soạn sẵn: ${finding.explanation}\n\nBạn có thể hỏi chủ nhà: ${finding.suggestedQuestion}` : 'Đây là chế độ mẫu với câu trả lời soạn sẵn, chưa gọi AI và không xử lý hội thoại thật. Hãy thử hỏi về tiền cọc, tăng giá, sửa chữa hoặc phí dịch vụ; dùng hợp đồng của bạn với máy chủ đã cấu hình để hỏi đáp AI nhiều lượt.',
    evidence: finding?.evidence ?? [],
  };
}
