# RentGuard — AI Rental Contract Analyzer

## 1. Mục tiêu sản phẩm

Ứng dụng di động sử dụng AI giúp người thuê nhà **hiểu hợp đồng, phát hiện các điều khoản cần lưu ý trước khi ký**, nhằm giảm thiểu rủi ro khi thuê nhà.

## 2. Đối tượng người dùng

- Sinh viên thuê trọ.
- Người đi làm, người thuê nhà lần đầu.
- Người chưa có kinh nghiệm đọc hợp đồng.

## 3. Chức năng chính trong MVP

- **Chụp/chọn ảnh hợp đồng:** Sử dụng camera hoặc thư viện ảnh để cung cấp nhiều trang hợp đồng, hỗ trợ xem trước và sắp xếp các trang.
- **AI phân tích hợp đồng:** Trích xuất và tổng hợp nội dung từ tất cả các trang được cung cấp, rà soát các điều khoản liên quan đến tiền cọc, giá thuê, phí phát sinh, chấm dứt hợp đồng, trách nhiệm sửa chữa và các vấn đề đáng chú ý khác.
- **Báo cáo AI:** Hiển thị các điểm cần lưu ý được phát hiện, phân loại theo mức độ **Cao / Trung bình / Thấp**, kèm lý do đánh giá, giải thích ngắn gọn và bằng chứng trích từ hợp đồng. Ưu tiên các vấn đề quan trọng nhất, cho phép xem toàn bộ kết quả và nhấn vào bằng chứng để xem trang ảnh gốc tương ứng, với vị trí đoạn trích nếu xác định được.
- **Gợi ý câu hỏi:** AI đề xuất câu hỏi tương ứng với từng vấn đề để người thuê trao đổi với chủ nhà, hỗ trợ sao chép câu hỏi.
- **AI hỏi đáp về hợp đồng:** Cho phép người dùng đặt câu hỏi và trao đổi nhiều lượt với AI về những điều khoản chưa rõ trong hợp đồng đã phân tích. AI trả lời dựa trên nội dung hợp đồng, kèm bằng chứng khi có và thông báo nếu không đủ thông tin để kết luận.
- **Lịch sử:** Lưu và xem lại các kết quả phân tích trên điện thoại.

## 4. Công nghệ sử dụng

- **Mobile:** React Native + Expo SDK 58 + TypeScript.
- **Giao diện và điều hướng:** Expo Router.
- **Camera/Ảnh:** Expo Image Picker.
- **Backend:** Node.js + Express.
- **AI:** OpenAI API (Vision + Structured Outputs).
- **Lưu trữ:** AsyncStorage trên điện thoại.
- **Kiểm thử:** Expo Go.
- **Demo:** Build APK bằng Expo EAS, cài trên Android thật.
- **Server:** Chạy backend trên laptop.

## 5. Luồng hoạt động

- **Phân tích:** Mở app → Chụp/chọn ảnh hợp đồng → Xem trước và xác nhận các trang → AI trích xuất và phân tích → Xem báo cáo được sắp xếp theo mức độ ưu tiên → Xem bằng chứng trên ảnh gốc → Xem, sao chép câu hỏi gợi ý → Lưu kết quả.
- **Hỏi đáp:** Từ báo cáo phân tích → Người dùng nhập câu hỏi → AI trả lời dựa trên nội dung hợp đồng và ngữ cảnh trao đổi → Người dùng có thể tiếp tục đặt câu hỏi để làm rõ.

## 6. Điểm khác biệt

- Mỗi phát hiện được giải thích dựa trên **bằng chứng trích từ hợp đồng**, có thể đối chiếu với trang ảnh gốc.
- Phát hiện các vấn đề cần lưu ý mà không giới hạn cố định số lượng, đồng thời phân loại và ưu tiên những vấn đề quan trọng nhất.
- Giải thích đơn giản, dễ hiểu với người không có kiến thức pháp lý.
- Cho phép người dùng **tương tác và hỏi đáp nhiều lượt với AI** dựa trên hợp đồng đã phân tích.
- Đưa ra câu hỏi và hành động cụ thể trước khi ký.
- Không tự tạo điều khoản hoặc bằng chứng không tồn tại; thông báo khi nội dung chưa đọc được hoặc chưa đủ thông tin.
- Không tự kết luận điều khoản trái pháp luật khi chưa đủ căn cứ.

## 7. Tiêu chí hoàn thành MVP

- Ứng dụng chạy ổn định trên điện thoại Android thật.
- AI phân tích hợp đồng nhiều trang trực tiếp thông qua API, không sử dụng kết quả giả.
- Phát hiện và giải thích các điều khoản cần lưu ý, phân loại mức độ ưu tiên, kèm bằng chứng có thể đối chiếu với ảnh hợp đồng.
- Người dùng có thể hỏi đáp nhiều lượt về hợp đồng đã phân tích và nhận phản hồi từ AI.
- Hoàn thiện luồng sử dụng từ chụp ảnh đến phân tích, xem báo cáo, hỏi đáp và lưu kết quả.
