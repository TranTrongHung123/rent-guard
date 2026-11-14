# RentGuard backend

Express + TypeScript, chạy trên laptop. Node.js >=22 (khuyến nghị Node 24 LTS). Không cần tạo tài khoản người dùng; dữ liệu lịch sử nằm trên điện thoại. Backend không ghi ảnh/văn bản hợp đồng vào đĩa và không log nội dung hợp đồng.

## Chạy lần đầu

```powershell
cd D:\Projects\rent-guard\backend
npm ci
Copy-Item .env.example .env
# Điền OPENAI_API_KEY trong file .env bằng trình soạn thảo cục bộ
npm run dev
```

Khóa chỉ nằm trong `backend/.env` (đã được ignore). Không đưa vào biến `EXPO_PUBLIC_*`, ứng dụng, ảnh chụp màn hình, Git hoặc frontend. Không cần cung cấp khóa qua hội thoại.

`GET http://localhost:4000/api/health` hoạt động cả khi chưa có khóa; `aiConfigured` là `false` khi chưa cấu hình. Các API phân tích/hỏi đáp sẽ trả `503 AI_NOT_CONFIGURED`; không có cơ chế tự chuyển sang dữ liệu mẫu. Sau khi thêm khóa, khởi động lại backend. `aiConfigured=true` chỉ xác nhận cấu hình tồn tại, không xác minh khóa có quyền/hạn mức.

Mobile trên điện thoại phải dùng địa chỉ IPv4 LAN của laptop, ví dụ `http://192.168.1.12:4000`, cùng Wi-Fi; không dùng `localhost` trên điện thoại. Giữ laptop và backend hoạt động, cho phép Node.js qua Windows Firewall ở mạng Private. Android emulator thường dùng `http://10.0.2.2:4000`; iOS simulator dùng `http://localhost:4000`. Đây là backend phát triển chạy trong LAN; khi đưa lên Internet cần HTTPS, xác thực và giới hạn chi phí theo người dùng.

## Cấu hình

| Biến | Mặc định | Ý nghĩa |
| --- | --- | --- |
| `OPENAI_API_KEY` | rỗng | Khóa thật phía server |
| `OPENAI_MODEL` | `gpt-4.1-mini` | Model hỗ trợ Vision + Structured Outputs |
| `HOST` / `PORT` | `0.0.0.0` / `4000` | Lắng nghe LAN |
| `OPENAI_TIMEOUT_MS` | `120000` | Timeout từng lời gọi OpenAI |
| `MAX_PAGES` | `20` | Giới hạn tài nguyên mỗi lần, có thể cấu hình 1–50 |
| `MAX_IMAGE_MB` | `5` | Giới hạn từng ảnh, có thể cấu hình 1–10 |
| `CORS_ORIGINS` | localhost Expo | Danh sách origin web, cách nhau dấu phẩy |
| `REPORT_SIGNING_SECRET` | tự tạo | Chuỗi ít nhất 32 ký tự; không phải OpenAI key |
| `ANALYSIS_CACHE_TTL_MS` | `1800000` | Thời gian giữ kết quả trong RAM (30 phút), 0 tắt cache |
| `ANALYSIS_CACHE_ENTRIES` | `32` | Số báo cáo tối đa mỗi cache ảnh/văn bản, 0 tắt cache |

Nếu không đặt `REPORT_SIGNING_SECRET`, backend tạo một lần trong `.data/signing-key` (được ignore). Giữ file này khi khởi động lại để các báo cáo đã lưu tiếp tục hỏi đáp được. Đổi/xóa secret khiến báo cáo cũ không còn xác thực: cần phân tích lại. Không lưu hợp đồng vào `.data`.

Tổng ảnh tối đa 20 MiB sau giải mã; JSON tối đa 30 MiB. Chấp nhận JPEG, PNG, WebP base64 và kiểm tra chữ ký tệp. Ảnh HEIC nên được mobile chuyển sang JPEG. Giới hạn này là tài nguyên đầu vào, không giới hạn cố định số phát hiện. Các mảng phát hiện không áp `maxItems`; phản hồi vượt ngân sách output bị từ chối như `AI_INCOMPLETE`, không hiển thị báo cáo bị cắt.

## API

Kiểu dữ liệu đầy đủ: `../shared/contracts.ts`. Mobile dùng bản đồng bộ tự chứa để EAS có thể build từ thư mục mobile.

- `GET /api/health` → `{status, aiConfigured, model, analysisVersion, analysisPolicyId, limits}`.
- `POST /api/analyses` → body `{pages:[{id,dataUrl}], forceRefresh?, previousAnalysis?:{report,analysisToken}}`, giữ thứ tự ảnh; response `{report,analysisToken}`. Các tùy chọn đều không bắt buộc; client cũ vẫn gọi được.
- `POST /api/chat` → body `{report,analysisToken,messages:[{role,content}],question}`; response `{message}`.
- Lỗi có cùng cấu trúc `{error:{code,message,requestId}}` với thông báo tiếng Việt.

`messages` chỉ chứa các lượt hoàn thành trước đó; câu hỏi hiện tại nằm riêng ở `question` (tối đa 2.000 ký tự). Tin nhắn user tối đa 2.000 ký tự, assistant tối đa 100.000 ký tự. Backend nhận tối đa 200 tin nhắn và tổng 1.000.000 ký tự hội thoại, từ chối rõ ràng khi vượt giới hạn. Mobile chủ động gửi 20 tin nhắn gần nhất và thông báo phạm vi ngữ cảnh cho người dùng. Hợp đồng luôn được gửi đầy đủ trong mỗi lượt hỏi đáp, không phụ thuộc trí nhớ OpenAI.

## AI, quy tắc và bằng chứng

1. Mỗi trang ảnh được gửi qua OpenAI Responses Vision (`detail: high`), dùng Structured Outputs để chép chữ và đánh dấu `readable/partial/unreadable`. Tối đa ba trang xử lý đồng thời, giữ thứ tự ảnh ban đầu. Lỗi một trang dừng yêu cầu thay vì bỏ trang âm thầm. Trang không đọc được vẫn hiện trong báo cáo; nếu mọi trang đều không đọc được trả `422 UNREADABLE_IMAGES`.
2. Văn bản của **tất cả trang** được rà soát cùng nhau theo sáu nhóm trong `src/rules.ts`: tiền cọc, giá thuê, phí, chấm dứt, sửa chữa và vấn đề khác. Mức Cao/Trung bình/Thấp là ưu tiên cần làm rõ, không phải phán quyết pháp luật. Không đưa mục thiếu bằng chứng vào phát hiện. `missingInformation` chỉ chứa câu hỏi checklist trung lập do code tạo theo nhóm chưa có phát hiện được kiểm chứng và trang đọc chưa đầy đủ; không khẳng định tài liệu thiếu điều khoản.
3. JSON được ràng buộc bằng schema và xác thực Zod. Backend tra đúng `pageId` và khớp đoạn trích liên tiếp với văn bản OCR. Chỉ cho khác khoảng trắng; số tiền, chữ, dấu và dấu câu phải đúng. Offset được backend tự tính; trang không tồn tại, không đọc được hoặc một bằng chứng sai làm loại cả phát hiện. Không tạo tọa độ ảnh: `boundingBox=null` khi chưa có dữ liệu định vị đáng tin cậy.
4. Một lượt Structured Outputs độc lập kiểm tra nhận định và tiền đề trong câu hỏi gợi ý có được các trích dẫn hỗ trợ trong ngữ cảnh toàn bộ hợp đồng hay không. Nhận định không đạt hoặc thiếu kết quả kiểm chứng bị loại. Báo cáo ghi rõ số mục bị loại và khả năng chưa bao quát. Phát hiện được sắp Cao → Trung bình → Thấp. Tiêu đề báo cáo và tóm tắt số lượng được tạo bằng code từ kết quả đã kiểm chứng để không lọt nhận định tự do chưa có nguồn.
5. Báo cáo được ký HMAC-SHA256 có phiên bản `v1` bằng secret cục bộ, không có TTL để giữ khả năng hỏi đáp lịch sử. Hỏi đáp kiểm tra chữ ký trước khi gọi OpenAI để không sử dụng hợp đồng/báo cáo đã bị sửa từ client. Câu trả lời được chia thành các nhận định có trích dẫn; mỗi nhận định phải vượt kiểm chứng câu chữ và lượt kiểm tra ngữ nghĩa. Phần không đủ bằng chứng được thay bằng thông báo trung lập cố định. Phiên bản token cũ không có prefix được hỗ trợ để di chuyển lịch sử cục bộ; phiên bản lạ bị từ chối.

Mọi lời gọi OpenAI dùng `store:false`, không tạo file hay conversation lưu phía provider qua API này. Ảnh/văn bản vẫn được gửi đến OpenAI để xử lý; `store:false` không phải cam kết về toàn bộ chính sách lưu giữ dữ liệu của nhà cung cấp. Ứng dụng phải thông báo rõ trước khi gửi.

Kiểm chứng giảm rủi ro, không chứng minh OCR đúng với ảnh hoặc bảo đảm không bỏ sót/không có suy luận sai. Người dùng luôn có thể đối chiếu trang ảnh gốc. Không dùng mô hình như nguồn pháp luật hay xác nhận hợp đồng an toàn.

## Ổn định kết quả và phân tích lại

`src/stability.ts` tạo SHA-256 cho bộ ảnh theo thứ tự (không gồm ID picker), chuẩn hóa ID trước khi gọi AI và quản lý cache RAM có TTL/LRU. Hai cache ảnh/văn bản có giới hạn riêng 32 báo cáo và 8 MiB, tổng tối đa 16 MiB nội dung JSON. Không lưu hợp đồng lên đĩa. Khóa chính sách phụ thuộc phiên bản `rentguard-v2.0.1`, model, quy tắc và secret; sửa prompt/schema phải tăng `ANALYSIS_VERSION`.

- AI phải xác nhận đã rà soát đủ 16 mã trong `reviewedChecks`, không thiếu/lặp; code gán mức ưu tiên theo `checkId`, loại trùng theo mã/vị trí và sắp thứ tự cố định. Mỗi mã có thể có nhiều phát hiện ở các điều khoản khác nhau.
- Ảnh trùng byte, đúng thứ tự: dùng lại báo cáo đã kiểm chứng, không OCR/phân tích lại.
- Ảnh chụp lại: đọc đủ mọi trang; chỉ dùng lại khi tất cả trang `readable` và văn bản từng trang trùng sau chuẩn hóa Unicode NFC/khoảng trắng. Giữ nguyên chữ hoa/thường, dấu, dấu câu, số tiền và ranh giới trang. Mọi trích dẫn được kiểm tra/tính lại offset trên văn bản hiện tại; không mượn ID ảnh cũ. Nếu không đối chiếu được thì phân tích mới.
- Mobile có thể gửi một báo cáo ký từ lịch sử/phiên hiện tại để dùng lại sau restart Backend. Backend kiểm tra HMAC, model, chính sách và ảnh/văn bản; không tin kết quả tự sửa. Snapshot quá lớn được Mobile bỏ qua để không làm tràn body ảnh.
- `forceRefresh:true` luôn đọc/phân tích lại. Mobile có nút **Đọc lại từ ảnh**, giữ nguyên bản cũ và tạo báo cáo riêng. `report.analysis` ghi phiên bản, fingerprint, ngày phân tích gốc và `reuse: none/images/text/saved`; các trường này cũng được ký.
- Các yêu cầu đồng thời cùng đầu vào chia sẻ một công việc. Một người hủy không hủy người còn chờ; tất cả hủy thì dừng OpenAI, không cache lỗi/kết quả bị hủy.

Sampling dùng `temperature:0` khi model hỗ trợ; chỉ bỏ tham số và thử lại nếu provider trả 400 nêu rõ `param=temperature` với `unsupported_parameter/unsupported_value`, hoặc code rỗng kèm thông báo rõ `Unsupported parameter/value: temperature`. Trường hợp code rỗng đã được xác nhận bằng API thật. Không thử lại kiểu này với lỗi quyền, quota hay đầu vào khác. Temperature thấp không bảo đảm AI tất định. Ảnh mới có OCR khác, cache hết hạn mà không có báo cáo ký phù hợp, model/quy tắc đổi hoặc chủ động đọc lại vẫn có thể cho danh sách khác. Để kiểm tra phiên bản mới, phân tích mới một lần; báo cáo cũ giữ nguyên và vẫn mở được.

## Kiểm thử

```powershell
npm run typecheck
npm test
npm run build
npm start
```

Tests không dùng API thật: fake provider có khai báo trong fixture và HTTP transport giả cho **OpenAI SDK thật**. Phạm vi gồm nhiều trang, thứ tự trang, nhiều lượt hỏi đáp, giả mạo bằng chứng, sai số tiền/dấu, đối chiếu offset, kiểm tra ngữ nghĩa, sửa báo cáo, ảnh lỗi, thiếu khóa, lỗi mạng/quota, refusal, output chưa hoàn chỉnh và schema sai. Build dùng output `dist/backend/src/server.js` vì chia sẻ type từ thư mục `shared`.

Khi đã tự cấu hình khóa và có ảnh hợp đồng được phép gửi, chạy kiểm thử kết nối thật (có tính phí OpenAI):

```powershell
npm run test:live -- "C:\contracts\trang-1.jpg" "C:\contracts\trang-2.jpg"
```

Lệnh gọi thật luồng phân tích, hỏi và hỏi tiếp; chỉ in ID, model và số lượng, không in nội dung ảnh/khóa. Test thất bại nếu chưa có khóa; không gọi demo. Kiểm thử này không thay thế chạy đầy đủ trên Android/iOS thật.

Tài liệu chính thức được đối chiếu khi triển khai: [Responses Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Vision](https://developers.openai.com/api/docs/guides/images-vision), [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
