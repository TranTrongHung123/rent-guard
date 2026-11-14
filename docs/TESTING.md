# Kết quả kiểm thử RentGuard

Ngày kiểm tra: **14/11/2026** (Asia/Saigon). Môi trường: Windows, Node.js 24.18.0, npm11.16.0. Mobile giữ Expo58.0.25, React19.3.0, React Native0.88.1, Router58.0.31.

## Đã chạy thành công

| Kiểm tra | Kết quả / phạm vi |
| --- | --- |
| Mobile `npm run typecheck` | Đạt, TypeScript strict, không có lỗi |
| Mobile `npm run lint` | Đạt, không lỗi/cảnh báo ESLint |
| Mobile `npm test` | **57/57 đạt**, không gọi OpenAI; gồm giữ ảnh/báo cáo khi đọc lại/hủy, provenance, fingerprint, metadata/lịch sử cũ,13 kiểm tra tương phản và lỗi mạng SDK58 |
| Mobile `npm run check:contracts` | Đạt, types Mobile khớp shared chuẩn |
| `npx expo-doctor` | **20/20 đạt**, dependencies/config tương thích SDK58 |
| `npx expo export --platform all` | Đạt, Hermes bundle Android/iOS và static web với đầy đủ9 routes |
| Backend `npm run typecheck` | Đạt |
| Backend `npm test` | **35/35 đạt**, không gọi OpenAI thật; gồm cache, checklist, mức cố định, chữ ký, sampling fallback (kể cả code rỗng) và hủy đồng thời |
| Backend `npm run build` | Đạt, tạo Node output chạy được |
| Backend chạy thực tế | Bản build v2 khởi động cổng loopback tạm và health200, `aiConfigured:true`, model cục bộ được giữ nguyên; không gọi OpenAI. Server kiểm thử đã đóng |
| Dependency tree | Không lỗi missing/invalid trong `npm ls`; Expo SDK không bị nâng/hạ |
| EAS | **FINISHED / BUILD SUCCESSFUL**, APK preview internal trên `@trantronghung/rentguard` |
| Archive EAS cục bộ | Có types, state, helper đường dẫn và ảnh mẫu JPEG; không có `.env`/khóa và không có file artifact kiểm thử được đưa vào archive |

Mobile tests bao gồm API qua HTTP fixture cục bộ, body nhiều trang và lịch sử chat, lỗi thiếu khóa không fallback,502 HTML, JSON sai, timeout/hủy/mạng, URL sai, thứ tự trang, xác thực JSON sâu và trích dẫn, sample source labels, lưu/mở lại hội thoại, dữ liệu hỏng, lỗi ghi/đọc, xóa biệt lập. Có kiểm tra đường dẫn ảnh tương đối, migration từ đường dẫn cũ, tái tạo URI sau khi iOS đổi container và dạng đường dẫn Expo Go Android/iOS được đối chiếu với mã nguồn SDK58. AsyncStorage được thay bằng bộ nhớ fixture trong tests; tests xác minh code lưu trữ nhưng không giả định đã chạy native module trên điện thoại.

Backend tests bao gồm toàn bộ trang đúng thứ tự, partial/unreadable,42 phát hiện không bị giới hạn số mục, trích sai tiền/dấu/trang/offset, thiếu/lặp semantic review, câu hỏi gợi ý qua kiểm chứng, chat nhiều lượt và câu trả lời dài, báo cáo bị sửa, HMAC/version/migration, lỗi provider. Một nhóm test dùng OpenAI SDK thật với HTTP transport fixture để kiểm tra Responses Vision, strict Structured Outputs và `store:false`; không phải một lần gọi dịch vụ OpenAI thật.

## Kiểm tra dependencies

Backend `npm audit --omit=dev`: **0 vulnerabilities**. Mobile `npm audit`: **8 moderate**,0 high/critical; production-only audit:3 moderate. Các cảnh báo đi qua `minimatch` trong Expo fingerprint và TypeScript ESLint. `npm audit fix --dry-run` không đưa ra thay đổi tương thích; fix force đề xuất hạ Expo về52, vì vậy không thực hiện. Giữ nguyên SDK58 theo yêu cầu; không cưỡng ép major override cho thư viện build. Đây là vấn đề dependency còn tồn tại và cần kiểm tra bản vá upstream trước khi phát hành rộng.

## Phần chưa xác nhận thực tế

Cập nhật ổn định `rentguard-v2.0.0`: test xác nhận ảnh trùng nhưng picker ID mới chỉ OCR/phân tích một lần; ảnh mới có text trùng/khoảng trắng khác dùng lại đúng quote/offset; số tiền đổi và partial OCR phân tích mới; history ký dùng lại sau tạo service mới; sửa mức trong history bị403; đổi model/secret không dùng lại; `forceRefresh` không gộp với luồng dùng cache. Kiểm tra TTL/LRU/giới hạn byte/clone, mã checklist thiếu/lặp, loại trùng và ưu tiên theo code, hủy một/tất cả subscriber, lỗi không cache, temperature không được hỗ trợ và lỗi khác không retry. Đây là test fixture, **chưa đo độ lặp lại thực tế của OpenAI trên ảnh chụp hợp đồng**. Để nghiệm thu: phân tích/lưu một hợp đồng mới, chọn lại ảnh, chụp lại, sửa một số tiền và dùng Đọc lại từ ảnh; đối chiếu thông tin nguồn kết quả, số mục/mức và ảnh trích dẫn.

Cập nhật giao diện xanh dương: đã tối ưu toàn bộ màn hình theo [UI_UX.md](UI_UX.md), thêm13 test tương phản palette; tổng Mobile49 tests. Lint, TypeScript, đồng bộ shared types, Expo Doctor20/20 và export Hermes Android/iOS/static web đạt. Bundle mới ở `mobile/test-results/blue-ui-export`. Bộ test này không thay thế thao tác visual/native trên thiết bị; cấu hình SDK58 được giữ nguyên.

Sau pipeline v2, đã chạy lại lint, TypeScript, shared types, Expo Doctor20/20, dependency tree và export Android/iOS/web với `expo-crypto` phiên bản58.0.8. Bundle mới nhất tại `mobile/test-results/stability-export`. Hai test provider dùng hooks/Expo/storage fixture xác nhận lệnh đọc lại giữ báo cáo/ảnh nháp và hủy an toàn; không phải test render native.

Cập nhật từ thử nghiệm iPhone ngày14/11/2026: ảnh người dùng cung cấp cho thấy Safari nhận health200 và app hiển thị2 trang đã chọn, nhưng phân tích báo lỗi kết nối. Kiểm tra lại từ laptop cũng nhận200 qua loopback và IP LAN. Chưa xác nhận URL đã lưu/quyền mạng của Expo Go hoặc một lần phân tích thành công trên điện thoại. `aiConfigured:true` vẫn chỉ là có cấu hình khóa.

Đã tái hiện lỗi wrapper để lọt `FetchError extends Error` của SDK58 (chỉ bắt TypeError trước đây), sửa để bắt lỗi tại chính fetch, thông báo URL đang gọi và hướng dẫn LAN/quyền iPhone. Các regression tests gồm native FetchError, localhost/IPv6 loopback và lỗi khác realm; HTTP, JSON, timeout và hủy vẫn tách biệt. Chưa đổi fetch stack, cấu hình khóa hay model. Sửa thông báo không tự cấp quyền hoặc thay URL đã lưu. APK1.0.1 ở cuối tài liệu đã chứa sửa này; APK1.0.0 cũ chưa có.

- **OpenAI thật:** đã chạy luồng thật trên hai trang hợp đồng mẫu của dự án, model cục bộ `gpt-6.1-terra`, pipeline `rentguard-v2.0.1`: 3 phát hiện; câu trả lời đầu có 2 bằng chứng, lượt tiếp có 3 bằng chứng; gửi lại đúng ảnh giữ nguyên ID/mức phát hiện qua cache. Đã sửa lỗi thực tế HTTP400 `param=temperature`, `code=null`; không đổi khóa/model. Metadata: `artifacts/live-openai-verification-1.0.1.json`. Đây là kiểm thử kết nối và luồng trên mẫu, chưa phải benchmark độ chính xác, ảnh chụp lại, hợp đồng riêng hoặc chạy trên điện thoại.
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

Build mới nhất: [97dd3c59-eb8c-4a33-8e56-9f39f745f911](https://expo.dev/accounts/trantronghung/projects/rentguard/builds/97dd3c59-eb8c-4a33-8e56-9f39f745f911), **FINISHED** lúc **15:58:19 ngày14/11/2026** (Asia/Saigon).

- [Tải APK RentGuard 1.0.1](https://expo.dev/artifacts/eas/_BT4ZClvZnWAUg6tWH7SSB2IArtGvlRrVqbHy454mHo.apk); bản local: `artifacts/RentGuard-1.0.1.apk`.
- Android package `vn.rentguard.app`, version1.0.1, versionCode2, SDK58, profile preview, distribution internal. Manifest thực tế: minSdk24, targetSdk36, cho phép HTTP LAN.
- Có giao diện xanh dương, hành vi dùng lại/đọc lại báo cáo và native module Expo Crypto. Mobile source commit `4b3057c`; mã Mobile hiện tại khớp nguồn đã build. Backend sửa tương thích OpenAI ở commit `2e5a673`, chạy riêng và không nằm trong APK.
- Dung lượng: **100.421.268 bytes**, khoảng95,77 MiB.
- SHA-256: `7ead3eed4c63540ecc596b32aa161c1fef718182cf1ea989e81533cf53636fcb`.
- Đã kiểm tra CRC toàn bộ ZIP, manifest/DEX, bundle `assets/index.android.bundle`, native `CryptoModule` trong DEX; hai ảnh mẫu JPEG khớp SHA-256 với source mới.
- **Chữ ký mật mã hợp lệ** theo Google/AOSP apksig9.5.1, APK Signature Scheme v2, không lỗi. SHA-256 chứng chỉ `c264578d467370eadf170893be14aeecc6b30c07ae803b31069b00b584a1d398`, khớp APK1.0.0. Thư viện kiểm tra tải từ Google Maven và đối chiếu checksum của nguồn.
- Archive trước upload có73 files, đầy đủ source/types/ảnh mẫu, không có Backend, `.env` hoặc khóa bí mật. API Key tiếp tục chỉ ở laptop.
- **Chưa cài/chạy APK trên Android thật trong phiên này.** Kiểm tra chữ ký, bundle và OpenAI mẫu không thay thế nghiệm thu camera, quyền, bố cục và lưu/mở lại trên thiết bị.

Hướng dẫn cài và kết nối Backend: [APK_INSTALL.md](APK_INSTALL.md). Metadata: `artifacts/build-info.json`, `artifacts/apk-verification.json`, `artifacts/apk-1.0.1-signature.json`. APK cũ1.0.0 ở `artifacts/RentGuard-preview.apk`, thông tin cũ giữ trong `artifacts/build-info-1.0.0.json`; không dùng bản cũ để kiểm tra UI/pipeline mới. Server smoke test đã đóng; chạy Backend theo README khi dùng AI thật.
