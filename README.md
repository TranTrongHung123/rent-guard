# RentGuard

Ứng dụng đọc hợp đồng thuê nhà bằng ảnh nhiều trang, báo cáo có bằng chứng và hỏi đáp nhiều lượt. Mobile tiếp tục từ **Expo SDK 58 + React Native + TypeScript + Expo Router** hiện có; Backend là **Node.js + Express**, gọi **OpenAI Vision + Structured Outputs** thật.

Giao diện hiện dùng xanh dương làm màu chủ đạo, với nút phân tích/lưu/hỏi đáp cố định, báo cáo ưu tiên rõ ràng và lỗi không che điều hướng. Chi tiết thiết kế và phạm vi kiểm tra: [docs/UI_UX.md](docs/UI_UX.md). APK bên dưới được tạo trước lần cập nhật giao diện này; Expo Go tải source mới khi reload project.

**APK Android đã build thành công:** [Tải RentGuard](https://expo.dev/artifacts/eas/7pSWZBMVKaWP42iSv1P6KJ8hdpGl5EQENy6hxV4ko4c.apk). Bản tải trong workspace: `artifacts/RentGuard-preview.apk` (102.689.192 bytes). [Thông tin build](https://expo.dev/accounts/trantronghung/projects/rentguard/builds/42b6af69-42fb-40c5-9092-878d740cf7ff). Cài xong, mở **Kết nối** để đặt địa chỉ Backend trên laptop.

## Chạy Backend

Cần Node.js 22 trở lên, khuyến nghị Node 24. Mở PowerShell:

```powershell
cd D:\Projects\rent-guard\backend
npm ci
Copy-Item .env.example .env
npm run dev
```

Để dùng AI thật, tự điền `OPENAI_API_KEY` trong `backend/.env` bằng trình soạn thảo và khởi động lại Backend. Không gửi khóa qua hội thoại, không đưa vào Mobile hoặc biến `EXPO_PUBLIC_*`. Model mặc định là `gpt-4.1-mini`; có thể đổi `OPENAI_MODEL` sang model hỗ trợ Vision và Structured Outputs.

Mở `http://localhost:4000/api/health` để kiểm tra. `aiConfigured: true` chỉ cho biết đã có cấu hình khóa; một lần phân tích thành công mới chứng minh kết nối OpenAI. Khi chưa có khóa, API phân tích trả `503 AI_NOT_CONFIGURED` rõ ràng, không trả kết quả mẫu.

## Chạy Mobile bằng Expo Go

```powershell
cd D:\Projects\rent-guard\mobile
npm ci
npx expo start --lan
```

Dùng Expo Go tương thích SDK 58 để quét QR. Điện thoại và laptop ở cùng Wi-Fi. Trong ứng dụng, mở **Kết nối**, nhập `http://<IPv4-LAN-của-laptop>:4000`, nhấn **Lưu địa chỉ** rồi **Kiểm tra kết nối**. Tìm IPv4 của adapter Wi-Fi bằng `ipconfig`. Nếu Windows hỏi, cho phép Node.js trên mạng Private; backend phải tiếp tục chạy trên laptop.

Android emulator dùng `http://10.0.2.2:4000`; iOS simulator có thể dùng `http://localhost:4000`. `localhost` trên điện thoại thật trỏ về chính điện thoại. Không cần nhập API Key trong ứng dụng. Có thể đặt địa chỉ mặc định bằng `mobile/.env` theo `mobile/.env.example`; khởi động lại Metro sau khi thay đổi. Địa chỉ trong **Kết nối** được lưu trên máy và ưu tiên hơn mặc định này.

Nếu Safari mở được `/api/health` nhưng Expo Go không kết nối: kiểm tra URL **đã lưu trong app**, không kèm `/api/health`, rồi vào iPhone **Cài đặt → Quyền riêng tư & Bảo mật → Mạng cục bộ → Expo Go** và bật quyền nếu đang tắt. Đóng/mở lại Expo Go rồi kiểm tra kết nối trong app. Safari được miễn kiểm tra quyền này, nên Safari truy cập được chưa chứng minh Expo Go có quyền. [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy).

**Xem thử khi chưa có khóa:** Trang chủ → **Khám phá báo cáo mẫu**. Cả báo cáo và câu trả lời đều gắn nhãn **DỮ LIỆU MẪU**, sử dụng hợp đồng giả định được đóng gói cùng app, không gọi OpenAI. Mẫu không phân tích ảnh người dùng và không thay thế kết quả thật khi có lỗi.

## Luồng sử dụng đầy đủ

1. **Phân tích hợp đồng mới** → chụp từng trang hoặc chọn nhiều ảnh từ thư viện.
2. Xem trước, dùng mũi tên sắp xếp đúng thứ tự, xóa/chọn lại ảnh lỗi. Ảnh được chuẩn hóa JPEG, giữ tỷ lệ và tối đa cạnh dài 2.400 px.
3. Nhấn **Phân tích** để gửi ảnh đến Backend và OpenAI. Giới hạn hiện tại: 20 trang, 5 MiB/trang, tổng 20 MiB. Có loading, hủy và thông báo lỗi; ảnh được giữ để thử lại nếu yêu cầu thất bại.
4. Xem toàn bộ phát hiện theo mức **Cao / Trung bình / Thấp**, đọc lý do và giải thích; nhấn bằng chứng để mở đúng trang ảnh và đoạn OCR được tô màu. Khi chưa có tọa độ đáng tin, app không vẽ khung giả trên ảnh.
5. Sao chép câu hỏi gợi ý để trao đổi với chủ nhà, hoặc mở **Hỏi về hợp đồng**. Mỗi lượt AI nhận đầy đủ hợp đồng và tối đa 10 lượt trao đổi gần nhất; toàn bộ hội thoại vẫn được giữ trong phiên/lịch sử đã lưu.
6. Nhấn **Lưu báo cáo**. Báo cáo, ảnh và hội thoại được lưu trên điện thoại; mở lại ở **Lịch sử**, tìm kiếm, lọc nguồn hoặc xóa. Sau khi đã lưu, các lượt hỏi đáp thành công tiếp theo cũng được lưu. Báo cáo chưa lưu chỉ tồn tại trong phiên hiện tại.

Lịch sử dùng AsyncStorage; ảnh thực được giữ trong thư mục riêng của app và lưu đường dẫn tương đối để chịu được thay đổi container iOS. Dữ liệu mẫu tải lại ảnh từ asset đóng gói. Backend không ghi hợp đồng/ảnh vào đĩa. Lịch sử chưa có đồng bộ đám mây; gỡ app hoặc xóa dữ liệu app có thể mất lịch sử.

## Build APK Android độc lập

`mobile/eas.json` có profile **preview**, `distribution: internal`, `android.buildType: apk`. Đây là ứng dụng release có JavaScript và asset đi kèm, chạy không cần Expo Go hoặc Metro. Khi dùng AI thật vẫn cần laptop chạy Backend và kết nối mạng.

```powershell
cd D:\Projects\rent-guard\mobile
npx eas-cli@latest whoami
# Nếu chưa đăng nhập:
npx eas-cli@latest login
# Dự án đã liên kết tài khoản cá nhân được chọn trong phiên triển khai.
npx eas-cli@latest build --platform android --profile preview
```

EAS quản lý keystore Android; không đưa keystore/mật khẩu vào Git. Tải APK từ build thành công, mở trên Android và cho phép cài từ nguồn tải đó nếu điện thoại yêu cầu. Mở app → **Kết nối** → đặt IP LAN của laptop. Không cần build lại APK khi đổi IP hoặc API Key ở Backend. Tài liệu chính thức: [Build APK bằng Expo](https://docs.expo.dev/build-reference/apk/).

Kết quả build và phạm vi kiểm thử thực tế xem [docs/TESTING.md](docs/TESTING.md).

## Source và kiểm tra

Phân tích v2 rà soát16 mã vấn đề; Backend gán mức ưu tiên cố định theo mã và loại trùng theo bằng chứng. Ảnh trùng hoặc ảnh mới có toàn bộ văn bản đọc được trùng khớp có thể dùng lại kết quả đã kiểm chứng (cache RAM/historical report ký). Báo cáo hiển thị nguồn kết quả và ngày phân tích gốc. **Đọc lại từ ảnh** gọi OpenAI mới, giữ nguyên báo cáo trước; AI/OCR vẫn có thể khác khi đọc lại hoặc đầu vào thay đổi. Khởi động lại Backend và reload Expo Go để dùng phiên bản mới, phân tích mới một lần để có metadata v2 rồi lưu báo cáo. Cấu hình cache là tùy chọn; không cần đổi API Key hoặc model hiện tại. Chi tiết: [thiết kế AI](docs/AI_DESIGN.md#dùng-lại-kết-quả-đã-kiểm-chứng).

```text
mobile/src/app/          Expo Router: trang chủ, ảnh, báo cáo, bằng chứng, chat, lịch sử, kết nối
mobile/src/ui/           thành phần giao diện và màu dùng chung
mobile/src/state/        điều phối phiên, ảnh, phân tích, lưu và hỏi đáp
mobile/src/services/     API, AsyncStorage, xử lý ảnh
mobile/src/domain/       kiểm chứng JSON, thứ tự trang, đường dẫn bền vững, dữ liệu mẫu
backend/src/             Express, OpenAI, schema, quy tắc, kiểm chứng, ký báo cáo
shared/contracts.ts      hợp đồng dữ liệu API chuẩn
docs/                    PRD, thiết kế AI, đối chiếu triển khai và kiểm thử
```

Toàn bộ dự án được quản lý bởi **một Git repository tại thư mục gốc**: `backend/`, `mobile/`, `shared/` và `docs/` đều là source bình thường. Không tạo Git repository hoặc submodule riêng trong `mobile/`. Chạy `git add`, `git commit` và `git push` từ thư mục gốc.

Mobile dùng bản type tự chứa `src/types/contracts.ts` được sinh từ `shared/contracts.ts`. Khi đổi shared type, chạy `npm run sync:contracts` trong Mobile; `npm run check:contracts` phát hiện sai lệch. Tiếp tục chạy EAS trong `mobile/`, với `eas.json` ở đó; file `.easignore` **tại gốc repository** loại Backend, khóa, artifact và cấu hình cục bộ khỏi gói upload. Không khởi tạo lại Mobile hoặc đổi Expo SDK.

```powershell
cd D:\Projects\rent-guard\backend
npm run typecheck
npm test
npm run build

cd ..\mobile
npm run check:contracts
npm run typecheck
npm run lint
npm test
npx expo-doctor
npx expo export --platform all --output-dir test-results/export
```

Kiểm thử OpenAI thật sau khi cấu hình khóa (có tính phí API, chỉ dùng ảnh được phép gửi):

```powershell
cd D:\Projects\rent-guard\backend
npm run test:live -- "C:\contracts\trang-1.jpg" "C:\contracts\trang-2.jpg"
```

Lệnh chạy phân tích và hai lượt hỏi đáp, không in nội dung hợp đồng hoặc khóa. Chi tiết API, giới hạn và vận hành: [backend/README.md](backend/README.md). Quy tắc, JSON và giới hạn kiểm chứng: [docs/AI_DESIGN.md](docs/AI_DESIGN.md). AI có thể đọc sai hoặc bỏ sót; kết quả hỗ trợ người thuê đối chiếu trước khi ký, không xác nhận hợp đồng an toàn hay tự kết luận trái pháp luật.
