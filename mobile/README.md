# RentGuard Mobile

React Native + **Expo SDK 58** + TypeScript + Expo Router. Giữ nguyên SDK của dự án đã khởi tạo.

```powershell
npm ci
npx expo start --lan
```

Mở bằng Expo Go tương thích SDK58. Trong app → **Kết nối** → lưu `http://<IP-LAN-laptop>:4000`. Điện thoại và laptop phải cùng Wi-Fi; chạy backend ở thư mục `../backend`. Android emulator dùng `http://10.0.2.2:4000`.

Có thể cấu hình mặc định bằng `.env` dựa theo `.env.example`, chỉ với `EXPO_PUBLIC_API_URL`. **Không đặt API Key OpenAI trong Mobile**; khóa chỉ ở `backend/.env`. Cài đặt URL trong app có ưu tiên hơn biến mặc định.

Khi chưa có khóa, mở **Khám phá báo cáo mẫu** trên Trang chủ. Mẫu luôn được ghi nhãn và không thay thế lỗi phân tích thật.

```powershell
npm run typecheck
npm run lint
npm test
npm run check:contracts
npx expo-doctor
```

`src/types/contracts.ts` là bản tự chứa sinh từ `../shared/contracts.ts`; sau khi thay đổi shared type chạy `npm run sync:contracts`. Không chỉnh tay bản sinh. Bản Mobile tự chứa được đưa lên EAS, không cần kéo Backend vào APK.

Build APK release độc lập (không cần Expo Go/Metro):

```powershell
npx eas-cli@latest build --platform android --profile preview
```

Dự án đã liên kết `@trantronghung/rentguard` theo lựa chọn của chủ dự án. EAS giữ keystore; file `../.easignore` ở Git root loại Backend, `.env` và artifact kiểm thử khỏi archive. Sau khi cài APK, vẫn cần Backend trên laptop để dùng AI thật; chỉnh IP trong **Kết nối** khi đổi mạng.

Git quản lý toàn bộ dự án tại thư mục gốc `rent-guard/`; `mobile/` là thư mục source bình thường, không có repository hoặc submodule riêng. Chạy thao tác commit/push từ Git root; tiếp tục chạy Expo/EAS từ `mobile/`.

Hướng dẫn toàn bộ: [README gốc](../README.md). Thiết kế AI: [AI_DESIGN](../docs/AI_DESIGN.md). Kết quả thực tế và phần cần nghiệm thu trên thiết bị: [TESTING](../docs/TESTING.md).
