# RentGuard — giao diện xanh dương

Giao diện được cập nhật ngày14/11/2026 trên dự án Expo SDK58 hiện có. Giữ nguyên API, quy tắc phân tích, kiểm chứng bằng chứng, cấu trúc báo cáo và dữ liệu lịch sử.

## Nền tảng giao diện

Màu dùng chung nằm tại `mobile/src/ui/palette.ts`, các thành phần tại `mobile/src/ui/index.tsx`.

| Vai trò | Màu |
| --- | --- |
| Hành động chính, điều hướng đang chọn | `#2563EB` |
| Tiêu đề thương hiệu, vùng tổng quan | `#153C83` |
| Nền xanh nhạt | `#E8F0FF` |
| Nền ứng dụng / thẻ | `#F4F7FC` / `#FFFFFF` |
| Nội dung chính / phụ | `#10233F` / `#52657F` |
| Điểm ưu tiên cao / trung bình / thấp | `#B42335` / `#946200` / `#176A50` |

Màu mức độ luôn đi cùng nhãn và số lượng. Không dùng một màu xanh để thay mọi mức cảnh báo. Nút và điều khiển chính có vùng chạm tối thiểu44px; nội dung cho phép xuống dòng và phóng chữ theo cài đặt thiết bị.

`Screen` tách phần cuộn và `footer` cố định để hành động chính vẫn nhìn thấy khi đọc nhiều trang. Safe area được xử lý tại Shell, không cộng lặp tại footer. `Notice` và các token dùng chung giúp lỗi/cảnh báo/trạng thái có bố cục nhất quán.

## Các thay đổi theo luồng

- **Trang chủ:** tập trung vào thêm/tiếp tục hợp đồng; hiển thị địa chỉ máy chủ hiện tại; hướng dẫn3 bước gọn; hợp đồng gần đây có ngày giờ; bản mẫu tách rõ khỏi AI thật.
- **Ảnh:** tiêu đề và hướng dẫn ngắn; địa chỉ máy chủ gần nút chụp/chọn; xem ảnh với zoom/pan có nút trên cả Android/iOS; giữ các nút đổi thứ tự/xóa; nút phân tích/hủy cố định. Khi lỗi, cuộn về thông báo để người dùng không bỏ lỡ ở cuối danh sách dài. Đi tới Kết nối giữ ảnh trong phiên.
- **Báo cáo:** tổng quan và bộ lọc mức độ xuất hiện sớm; cảnh báo dài thu gọn nhưng trang chưa đọc đầy đủ vẫn được chỉ rõ. Giữ toàn bộ phát hiện, lý do, trích dẫn và câu hỏi. Lưu/Hỏi AI nằm ở footer cố định.
- **Bằng chứng:** tab Ảnh gốc/Văn bản rõ ràng; đoạn đang đối chiếu có thể mở đầy đủ; chỉ đánh dấu ảnh khi thực sự có tọa độ; chuyển trang cố định và trích dẫn trên từng trang có thể nhấn.
- **Hỏi đáp:** phần nhập gọn, câu hỏi gợi ý dễ chọn, thông tin ngữ cảnh thu gọn; đo vị trí màn hình cho bàn phím; tránh hiển thị lặp câu hỏi chờ khi câu trả lời đã vào lịch sử; có nút lưu và thử lại.
- **Lịch sử:** tiêu đề/tìm kiếm/bộ lọc cuộn cùng danh sách để còn chỗ trên màn hình nhỏ; hiển thị ngày và giờ; xóa có xác nhận; tìm kiếm có nút xóa từ khóa.
- **Kết nối:** một hành động lưu và kiểm tra; dùng trực tiếp URL vừa xác thực để tránh state cũ; phân biệt Backend đã kết nối với OpenAI đã cấu hình; trợ giúp thu gọn; có nút quay lại hợp đồng đang chuẩn bị.
- **Lỗi chung:** thông báo nằm trong luồng bố cục, không phủ header/nút quay lại. Có bản tóm tắt, chi tiết và thao tác kết nối khi phù hợp. Các màn hình có lỗi riêng không bị lặp thêm banner chung.

Icon, splash và ảnh hợp đồng mẫu được dựng lại từ script đồ họa có sẵn để đồng bộ màu. Nội dung ví dụ và nhãn dữ liệu mẫu không thay đổi. Không thêm thư viện hoặc đổi SDK.

## Kiểm tra và giới hạn

13 bài kiểm thử kiểm tra tỷ lệ tương phản của các cặp màu chữ/nền thực tế, yêu cầu ít nhất4.5:1 cho chữ thường. Đây là kiểm tra palette, không phải chứng nhận toàn bộ khả năng tiếp cận. Các test API, lưu trữ, dữ liệu mẫu, bằng chứng và đường dẫn ảnh tiếp tục chạy cùng bộ kiểm thử Mobile.

Môi trường phiên triển khai không có browser/thiết bị để tự thao tác giao diện. Cần thử trên điện thoại: thêm nhiều trang rồi gây lỗi mạng; kiểm tra nút footer và thông báo; nhập chat khi bàn phím mở; xem trích dẫn dài; tăng cỡ chữ; mở lại lịch sử và thử trên màn hình nhỏ.

Trong Expo Go, tải lại project để xem source mới. Bản APK được build trước lần thay giao diện này vẫn dùng giao diện cũ; muốn cập nhật APK cần chạy lại profile preview. Không thực hiện cloud build mới trong đợt chỉnh giao diện này.
