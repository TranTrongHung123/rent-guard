# Kết quả kiểm thử RentGuard

Ngày kiểm tra: **14/11/2026** (Asia/Saigon). Môi trường: Windows, Node.js 24.18.0, npm11.16.0. Mobile giữ Expo58.0.25, React19.3.0, React Native0.88.1, Router58.0.31.

## Đã chạy thành công

| Kiểm tra | Kết quả / phạm vi |
| --- | --- |
| Mobile `npm run typecheck` | Đạt, TypeScript strict, không có lỗi |
| Mobile `npm run lint` | Đạt, không lỗi/cảnh báo ESLint |
| Mobile `npm test` | **36/36 đạt**, không gọi OpenAI; gồm3 regression tests lỗi mạng Expo SDK58 |
| Mobile `npm run check:contracts` | Đạt, types Mobile khớp shared chuẩn |
| `npx expo-doctor` | **20/20 đạt**, dependencies/config tương thích SDK58 |
| `npx expo export --platform all` | Đạt, Hermes bundle Android/iOS và static web với đầy đủ9 routes |
| Backend `npm run typecheck` | Đạt |
| Backend `npm test` | **21/21 đạt**, không gọi OpenAI thật |
| Backend `npm run build` | Đạt, tạo Node output chạy được |
| Backend chạy thực tế | `GET /api/health`:200, `aiConfigured:false`; phân tích khi chưa có khóa:503 rõ ràng |
| Dependency tree | Không lỗi missing/invalid trong `npm ls`; Expo SDK không bị nâng/hạ |
| EAS | **FINISHED / BUILD SUCCESSFUL**, APK preview internal trên `@trantronghung/rentguard` |
| Archive EAS cục bộ | Có types, state, helper đường dẫn và ảnh mẫu JPEG; không có `.env`/khóa và không có file artifact kiểm thử được đưa vào archive |

Mobile tests bao gồm API qua HTTP fixture cục bộ, body nhiều trang và lịch sử chat, lỗi thiếu khóa không fallback,502 HTML, JSON sai, timeout/hủy/mạng, URL sai, thứ tự trang, xác thực JSON sâu và trích dẫn, sample source labels, lưu/mở lại hội thoại, dữ liệu hỏng, lỗi ghi/đọc, xóa biệt lập. Có kiểm tra đường dẫn ảnh tương đối, migration từ đường dẫn cũ, tái tạo URI sau khi iOS đổi container và dạng đường dẫn Expo Go Android/iOS được đối chiếu với mã nguồn SDK58. AsyncStorage được thay bằng bộ nhớ fixture trong tests; tests xác minh code lưu trữ nhưng không giả định đã chạy native module trên điện thoại.

Backend tests bao gồm toàn bộ trang đúng thứ tự, partial/unreadable,42 phát hiện không bị giới hạn số mục, trích sai tiền/dấu/trang/offset, thiếu/lặp semantic review, câu hỏi gợi ý qua kiểm chứng, chat nhiều lượt và câu trả lời dài, báo cáo bị sửa, HMAC/version/migration, lỗi provider. Một nhóm test dùng OpenAI SDK thật với HTTP transport fixture để kiểm tra Responses Vision, strict Structured Outputs và `store:false`; không phải một lần gọi dịch vụ OpenAI thật.

## Kiểm tra dependencies

Backend `npm audit --omit=dev`: **0 vulnerabilities**. Mobile `npm audit`: **8 moderate**,0 high/critical; production-only audit:3 moderate. Các cảnh báo đi qua `minimatch` trong Expo fingerprint và TypeScript ESLint. `npm audit fix --dry-run` không đưa ra thay đổi tương thích; fix force đề xuất hạ Expo về52, vì vậy không thực hiện. Giữ nguyên SDK58 theo yêu cầu; không cưỡng ép major override cho thư viện build. Đây là vấn đề dependency còn tồn tại và cần kiểm tra bản vá upstream trước khi phát hành rộng.

## Phần chưa xác nhận thực tế

Cập nhật từ thử nghiệm iPhone ngày14/11/2026: ảnh người dùng cung cấp cho thấy Safari nhận health200 và app hiển thị2 trang đã chọn, nhưng phân tích báo lỗi kết nối. Kiểm tra lại từ laptop cũng nhận200 qua loopback và IP LAN. Chưa xác nhận URL đã lưu/quyền mạng của Expo Go hoặc một lần phân tích thành công trên điện thoại. `aiConfigured:true` vẫn chỉ là có cấu hình khóa.

Đã tái hiện lỗi wrapper để lọt `FetchError extends Error` của SDK58 (chỉ bắt TypeError trước đây), sửa để bắt lỗi tại chính fetch, thông báo URL đang gọi và hướng dẫn LAN/quyền iPhone.36 tests đạt, gồm native FetchError, localhost/IPv6 loopback và lỗi khác realm; HTTP, JSON, timeout và hủy vẫn tách biệt. Chưa đổi fetch stack, cấu hình khóa hay model. Sửa thông báo không tự cấp quyền hoặc thay URL đã lưu. Bản APK ở cuối tài liệu được tạo trước sửa JavaScript này; Expo Go dùng source hiện tại sau khi reload.

- **OpenAI thật:** chưa có API Key. Chưa đo độ chính xác OCR, phát hiện điều khoản, độ trễ/chi phí hoặc hỏi đáp trên hợp đồng thật. Không coi test fixture hay `aiConfigured:true` là bằng chứng kết nối thực.
- **Android/iOS thật:** chưa có thiết bị/emulator/ADB kết nối trong phiên này. Chưa xác nhận quyền camera/thư viện, keyboard, notch, phóng to, khởi động lại app, cập nhật iOS container hoặc độ ổn định bộ nhớ trên thiết bị thật.
- **Visual browser:** môi trường Computer Use không cung cấp browser/app để thao tác. Metro/web export thành công không thay thế kiểm tra giao diện trực quan.
- **Tính đúng nghiệp vụ/pháp lý:** kiểm chứng trích dẫn không chứng minh OCR đọc đúng ảnh hoặc model không bỏ sót/không suy luận sai. Chưa có thẩm định pháp lý hay bộ benchmark tài liệu thực.

## Nghiệm thu trên Android sau khi cài APK

1. Mở app khi chưa chạy Backend; mở báo cáo mẫu, lọc mức độ, chép câu hỏi, mở trích dẫn, đổi trang/phóng to, hỏi nhiều lượt mẫu. Mọi màn hình phải ghi rõ dữ liệu mẫu.
2. Lưu mẫu, đóng hẳn app và mở lại; kiểm tra ảnh/hội thoại trong Lịch sử. Tìm kiếm, lọc, xóa và xác nhận các mục khác còn nguyên.
3. Chạy Backend, nhập IP LAN trong Kết nối. Xác nhận health phân biệt máy chủ hoạt động với OpenAI được cấu hình. Tắt Wi-Fi và thử để kiểm tra thông báo lỗi.
4. Tự thêm khóa trong `backend/.env`, restart. Chụp/chọn ít nhất hai trang hợp đồng được phép gửi, đổi thứ tự, xem trước và phân tích thật.
5. Đối chiếu bằng mắt mọi bằng chứng, số tiền, thứ tự trang và nội dung. Thử trang mờ/trống, một trang đọc được đi với một trang mờ, tệp hỏng và phụ lục có điều khoản mâu thuẫn.
6. Hỏi một câu và hỏi tiếp có tham chiếu lượt trước; câu trả lời phải có trích dẫn hoặc báo chưa đủ thông tin. Thử câu hỏi ngoài hợp đồng; không được tự tạo điều khoản.
7. Lưu báo cáo thật, restart app và laptop giữ nguyên `.data/signing-key`; mở lại ảnh và hỏi tiếp. Khóa OpenAI không được có trong app hoặc log.
8. Thử hủy phân tích, lỗi mạng, quota hoặc model sai; không có kết quả mẫu tự xuất hiện thay lỗi. Thử gửi lại từ các ảnh còn giữ.

Kiểm thử kết nối opt-in (có phí) ở Backend: `npm run test:live -- <ảnh1> <ảnh2>`, phân tích và hai lượt hỏi đáp, chỉ in metadata.

## APK

Build Android cloud: [42b6af69-42fb-40c5-9092-878d740cf7ff](https://expo.dev/accounts/trantronghung/projects/rentguard/builds/42b6af69-42fb-40c5-9092-878d740cf7ff), **FINISHED** lúc **13:25:57 ngày14/11/2026** (Asia/Saigon). Gradle `BUILD SUCCESSFUL`, `assembleRelease` và upload artifact hoàn tất.

- [Tải APK](https://expo.dev/artifacts/eas/7pSWZBMVKaWP42iSv1P6KJ8hdpGl5EQENy6hxV4ko4c.apk); bản local: `artifacts/RentGuard-preview.apk`.
- Android package `vn.rentguard.app`, version1.0.0, versionCode1, SDK58, profile preview, distribution internal.
- Dung lượng: **102.689.192 bytes**, khoảng97,93 MiB.
- SHA-256: `a44e1f786c073c5cd4dd2bf4b074530c9be35861a955b4a8243ccad7c1579ee6`.
- Đã tải file về, kiểm tra CRC toàn bộ ZIP, có AndroidManifest/classes.dex, có bundle `assets/index.android.bundle` và APK signing block. Hai ảnh mẫu JPEG trong APK khớp SHA-256 với source.
- Đây là kiểm tra cấu trúc/tính toàn vẹn file; chưa kiểm tra mật mã chứng chỉ bằng apksigner hoặc chạy trên thiết bị. Không coi build thành công là chứng minh toàn bộ chức năng runtime.

Metadata kiểm tra file ở `artifacts/apk-verification.json`, thông tin build ở `artifacts/build-info.json`. Các server kiểm thử Metro/Backend đã dừng để giải phóng cổng; khởi động lại theo README khi sử dụng.
