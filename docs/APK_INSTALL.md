# Cài và sử dụng RentGuard APK

APK hiện tại: **RentGuard 1.0.1**, Android package `vn.rentguard.app`, versionCode2. Link tải và checksum được ghi trong [TESTING.md](TESTING.md#apk).

## Cài trên Android

1. Tải APK vào điện thoại Android, mở file và cho phép cài từ nguồn tải đó nếu máy yêu cầu.
2. Mở RentGuard. APK có sẵn giao diện, JavaScript và ảnh mẫu; không cần Expo Go hoặc Metro.
3. Có thể xem báo cáo mẫu để thử giao diện. Dữ liệu mẫu luôn có nhãn riêng.

## Kết nối AI thật

Trên laptop, cập nhật mã nguồn mới nhất, giữ nguyên khóa cục bộ trong `backend/.env`, rồi chạy:

```powershell
cd D:\Projects\rent-guard\backend
npm ci
npm run dev
```

Điện thoại và laptop dùng cùng Wi-Fi. Trong ứng dụng, mở **Kết nối**, nhập URL Backend rồi lưu/kiểm tra. Với laptop hiện tại, địa chỉ Wi-Fi đã kiểm tra là `http://192.168.173.234:4000`; nếu IP thay đổi, lấy địa chỉ IPv4 Wi-Fi mới bằng `ipconfig`. Không nhập đường dẫn `/api/health` hoặc OpenAI API Key vào ứng dụng.

Chụp/chọn ảnh → sắp thứ tự → phân tích → đối chiếu trích dẫn → lưu báo cáo. Báo cáo đã lưu mở lại trên thiết bị; phân tích mới và hỏi đáp OpenAI cần Backend hoạt động và có mạng. Backend chạy riêng trên laptop, không nằm trong APK.

**Đọc lại từ ảnh** tạo một báo cáo riêng, giữ bản trước. Ảnh hoặc văn bản trùng có thể dùng lại kết quả đã kiểm chứng, với nhãn nguồn và ngày phân tích gốc.

Đã kiểm tra OpenAI thật trên hai trang mẫu: phân tích, gửi lại ảnh trùng và hỏi đáp hai lượt có bằng chứng. Việc này chưa thay thế nghiệm thu camera, quyền truy cập, lưu/mở lại và giao diện trên điện thoại Android thật.
