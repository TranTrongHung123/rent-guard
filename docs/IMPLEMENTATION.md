# Kế hoạch và đối chiếu PRD RentGuard

Giữ nguyên dự án Mobile Expo SDK 58 và Expo Router. Backend Express độc lập chạy trên laptop. Không lưu ảnh hợp đồng trên Backend. Chỉ Mobile giữ lịch sử và ảnh trong vùng dữ liệu ứng dụng.

| Giai đoạn | Phạm vi |
| --- | --- |
| 1. Mobile UI | Trang chủ, hệ thống giao diện tiếng Việt, điều hướng, trạng thái rỗng/lỗi |
| 2. Ảnh | Chụp, chọn nhiều ảnh, xem trước, đổi thứ tự, xóa; chuẩn hóa JPEG |
| 3. Backend | Health, giới hạn đầu vào, lỗi có mã, bảo vệ ngữ cảnh phân tích |
| 4. AI | Vision OCR từng trang, Structured Outputs, quy tắc và kiểm chứng trích dẫn |
| 5. Báo cáo | Ưu tiên Cao/Trung bình/Thấp, lý do, giải thích, ảnh gốc, câu hỏi sao chép |
| 6. Hỏi đáp | Nhiều lượt, dựa trên hợp đồng đã phân tích, trích dẫn và từ chối khi thiếu dữ kiện |
| 7. Lịch sử | AsyncStorage, ảnh lưu bền vững, mở lại, xóa dữ liệu trên máy |
| 8. Kiểm thử | TypeScript, lint, dependency doctor, unit/API tests và bundle Android/iOS |
| 9. APK | Cấu hình EAS preview APK độc lập, hướng dẫn backend LAN và cài Android |

## Quyết định kỹ thuật

- Kết quả mẫu có `source: demo`, không được gửi sang endpoint hỏi đáp thật và không thay thế lỗi API.
- Tất cả ảnh đã chọn được xem trước trước khi người dùng chủ động gửi phân tích. Giới hạn vận hành mặc định 20 trang/lần và 5 MiB/ảnh; số phát hiện không bị giới hạn cố định trong giao diện.
- Trích dẫn được kiểm tra bằng đối sánh với văn bản OCR của đúng trang. Đây là kiểm chứng nguồn văn bản, không phải chứng nhận OCR đọc đúng ảnh. Người dùng luôn có thể đối chiếu ảnh.
- Không đoán tọa độ trên ảnh. Nếu không có tọa độ đáng tin, chỉ đánh dấu đoạn trong văn bản OCR và mở đúng trang ảnh gốc.
- Backend ký dữ liệu phân tích để ngăn chỉnh sửa hợp đồng trước khi hỏi đáp. Khóa ký nội bộ khác với API Key OpenAI.
- Thiếu API Key, thiết bị Android thật và tài khoản EAS có thể ngăn xác minh dịch vụ thực tế/build cloud; các giới hạn này phải được ghi rõ trong báo cáo kiểm thử.

Kết quả kiểm tra thực tế được ghi tại `docs/TESTING.md` khi hoàn thành triển khai.

## Trạng thái triển khai 14/11/2026

Các giai đoạn1–7 đã có mã nguồn và được nối thành luồng đầy đủ. Giai đoạn8 hiện có57 Mobile tests (gồm13 kiểm tra tương phản),38 Backend tests. Pipeline v2.1.0 có16 mã kiểm tra, mức ưu tiên do code gán, cache ảnh/text có kiểm chứng và lịch sử ký, thao tác Đọc lại từ ảnh giữ bản cũ; profile Sol dùng reasoning low cho OCR/kiểm chứng/chat, medium cho phân tích. Đã gọi OpenAI thật trên hai trang mẫu, xác nhận hỏi đáp hai lượt có bằng chứng, gửi lại ảnh giữ nguyên kết quả và đo so sánh với Terra. Đây là thử nghiệm mẫu, không chứng minh độ chính xác chung. Giai đoạn9: **APK1.0.1/versionCode2 đã build thành công** trên tài khoản cá nhân được chọn, có UI xanh dương và thay đổi Mobile mới; đã tải artifact, kiểm tra CRC, native Crypto, bundle, ảnh mẫu và xác minh chữ ký mật mã khớp bản cũ. Đổi model/effort ở Backend không cần build lại APK. Xem TESTING để biết build/checksum và số đo, APK_INSTALL để cài và kết nối Backend.

Các tiêu chí nghiệm thu còn lại: camera, quyền truy cập, hiển thị và độ ổn định Android thật cần cài APK trên thiết bị; độ chính xác/độ lặp lại trên bộ hợp đồng thực tế cần benchmark riêng. Kiểm tra API thật trên mẫu không thay thế các tiêu chí này.
