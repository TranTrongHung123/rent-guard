# Thiết kế phân tích và hỏi đáp RentGuard

Tài liệu này mô tả **code thực tế** ở `backend/src/`, không mô tả một hệ thống pháp lý đã được thẩm định. Dữ liệu mẫu chỉ ở Mobile và có `source: "demo"`; backend không sinh báo cáo giả khi thiếu khóa hoặc gọi OpenAI lỗi.

## Luồng xử lý nhiều trang

1. `app.ts` kiểm tra số trang, ID duy nhất, MIME/chữ ký JPEG/PNG/WebP, dung lượng từng ảnh và tổng dung lượng. Thứ tự mảng ảnh là thứ tự trang người dùng đã sắp xếp.
2. Khi không có báo cáo ảnh trùng được xác thực để dùng lại, `ai.ts` gọi **OpenAI Responses API Vision** cho từng trang với `detail: "high"`, `store: false`, schema `ExtractedSchema` và `zodTextFormat`. `service.ts` giới hạn ba trang xử lý đồng thời nhưng đặt kết quả vào đúng chỉ số ban đầu.
3. Mỗi trang trả `readable`, `partial` hoặc `unreadable`, văn bản và cảnh báo. Không sửa hoặc đoán chỗ chữ mờ. Trang `unreadable` có text rỗng. Trang mờ vẫn xuất hiện trong báo cáo; nếu tất cả trang không đọc được trả lỗi `UNREADABLE_IMAGES`. Một lời gọi OCR thất bại làm hủy luồng, không âm thầm bỏ trang.
4. **Toàn bộ** các trang được gửi cùng nhau cho bước phân tích. Model nhận danh sách quy tắc, thang mức ưu tiên và các ràng buộc chống bịa. Điều khoản mâu thuẫn giữa hai trang cần trích cả hai.
5. Backend xác thực JSON, kiểm tra trích dẫn bằng code, sau đó gọi một lượt model riêng để kiểm tra ngữ nghĩa. Chỉ các phát hiện qua cả hai lớp được hiển thị. Kết quả cuối cùng được ký để hỏi đáp sau này.

Giới hạn mặc định là 20 trang, 5 MiB/ảnh, 20 MiB tổng ảnh sau giải mã, 30 MiB body JSON và 200.000 ký tự OCR. `MAX_PAGES`, `MAX_IMAGE_MB` được cấu hình qua `.env`; đây là giới hạn tài nguyên đầu vào, không phải số lượng phát hiện. Không có `maxItems` cho findings. Nếu phản hồi OpenAI chưa hoàn chỉnh hoặc vượt output budget, API trả `AI_INCOMPLETE`, không dùng kết quả bị cắt. Các giới hạn khác được báo lỗi rõ ràng, không cắt văn bản hợp đồng để tiếp tục.

## Quy tắc rà soát và mức ưu tiên

Quy tắc nằm trong `backend/src/rules.ts`. Đây là checklist hướng dẫn model rà soát; **không phải** bộ so khớp từ khóa tự kết luận, cơ sở dữ liệu luật hoặc tính điểm số tiền bằng một ngưỡng pháp lý.

| ruleId | category | Nội dung cần rà soát |
| --- | --- | --- |
| `DEPOSIT` | `deposit` | Số tiền cọc, điều kiện mất/khấu trừ, cách và hạn hoàn cọc, chứng từ |
| `RENT` | `rent` | Giá thuê, kỳ thanh toán, quyền tăng giá, báo trước, phạt chậm trả, số tiền mâu thuẫn giữa các trang |
| `FEES` | `fees` | Điện, nước, internet, xe, dịch vụ; cách đo/tính; thay đổi đơn giá và khoản phát sinh |
| `TERMINATION` | `termination` | Thời hạn, gia hạn, báo trước, chấm dứt một phía, bồi thường, giữ cọc, bàn giao |
| `REPAIRS` | `repairs` | Hao mòn và lỗi người thuê, thiết bị, trách nhiệm sửa, hiện trạng bàn giao, chứng minh thiệt hại |
| `OTHER` | `other` | Quyền ra vào, riêng tư, tài sản, người ký/quyền cho thuê, phụ lục, mâu thuẫn và nội dung chưa rõ khác |

| severity | Nhãn | Ý nghĩa khi xem xét hợp đồng |
| --- | --- | --- |
| `high` | Cao | Điều khoản đã trích dẫn có thể dẫn tới mất khoản tiền đáng kể, mất cọc, chấm dứt đột ngột hoặc trách nhiệm không giới hạn |
| `medium` | Trung bình | Nghĩa vụ, chi phí hoặc cách thực hiện chưa rõ, cần làm rõ/thương lượng |
| `low` | Thấp | Chi tiết hoặc thủ tục cần xác nhận |

Từ `rentguard-v2.0.0`, **code quyết định mức ưu tiên theo `checkId`**, AI chỉ xác định vấn đề và mã phù hợp với bằng chứng. Mỗi phản hồi phải xác nhận đủ 16 mã trong `reviewedChecks`, không thiếu/lặp. Mỗi mã có thể có nhiều phát hiện ở các điều khoản khác nhau; không ép tổng số phát hiện. Cùng mã và vị trí bằng chứng chỉ tính một mục, dù tiêu đề thay đổi. ID được tạo từ mã/vị trí, thứ tự ổn định theo mức → mã → trang → vị trí. Không tự gắn một số tháng tiền cọc hoặc một mức giá vào ngưỡng “bất hợp pháp”. Lý do phải bám điều khoản. Lượt kiểm chứng ngữ nghĩa vẫn loại nhận định không được hỗ trợ.

| Mức cố định | Các `checkId` |
| --- | --- |
| Cao | `DEPOSIT_FORFEITURE`, `DEPOSIT_CONFLICT`, `RENT_UNILATERAL`, `RENT_CONFLICT`, `TERMINATION_UNILATERAL`, `TERMINATION_COMPENSATION`, `REPAIRS_UNLIMITED`, `OTHER_ACCESS`, `OTHER_CONFLICT` |
| Trung bình | `DEPOSIT_REFUND`, `RENT_PAYMENT`, `FEES_UNSPECIFIED`, `FEES_CHANGE`, `TERMINATION_NOTICE`, `REPAIRS_ALLOCATION` |
| Thấp | `OTHER_CLARIFICATION` |

Định nghĩa đầy đủ nằm tại `CONTRACT_CHECKS` trong `rules.ts`. Không tính lại mức báo cáo lịch sử, vì thay đổi sẽ làm sai chữ ký và mất khả năng đối chiếu bản gốc.

## Dùng lại kết quả đã kiểm chứng

`stability.ts` quản lý hai lớp cache TTL/LRU trong RAM (mặc định 30 phút, mỗi lớp tối đa 32 báo cáo/8 MiB). SHA-256 ảnh tính từ JSON mảng data URL theo thứ tự, loại ID do picker tạo. Mọi request AI dùng ID trang chuẩn `page-1...`. Kết quả dùng lại được ánh xạ về ID ảnh hiện tại và ký lại; giữ ngày phân tích gốc.

Với ảnh mới, OCR vẫn chạy trên mọi trang. Chỉ tái sử dụng phân tích khi tất cả trang `readable`, cùng số/thứ tự trang, văn bản trùng sau NFC và khoảng trắng. Không fuzzy-match; giữ số tiền, dấu, chữ hoa/thường, dấu câu và ranh giới trang. Các trích dẫn phải khớp lại với OCR mới, tính lại offset và ID bằng chứng. Một số tiền đổi hoặc trang partial/unreadable buộc phân tích mới. Trích dẫn không khớp khi đối chiếu cache sẽ bỏ cache, không gán nhầm vào ảnh hiện tại.

Mobile gửi tùy chọn `previousAnalysis:{report,analysisToken}` để khôi phục kết quả qua restart Backend. Chỉ nhận báo cáo OpenAI đúng HMAC/model/phiên bản/chính sách; kiểm tra ảnh hoặc toàn bộ text như trên. Khóa chính sách là HMAC của phiên bản, model, quy tắc, safety, rubric, sampling; thay secret/model/quy tắc không dùng lại kết quả cũ. Cần tăng `ANALYSIS_VERSION` khi sửa prompt/schema. Báo cáo cũ không có metadata vẫn đọc/hỏi đáp được với secret cũ nhưng không tự dùng lại cho pipeline mới.

`report.analysis` chứa `version`, `policyId`, `inputFingerprint`, `analyzedAt`, `reuse`. `reuse` bằng `none` (phân tích mới), `images` (cache ảnh), `text` (OCR mới khớp), `saved` (ảnh khớp báo cáo ký từ Mobile). Các trường là một phần chữ ký. Mobile hiển thị nguồn/ngày gốc, có **Đọc lại từ ảnh** gửi `forceRefresh:true` để tạo báo cáo riêng và giữ bản cũ. Không tự lưu báo cáo mới thay thao tác Lưu của người dùng.

`SingleFlight` gộp công việc đồng thời theo ảnh/text, tách luồng đọc lại chủ động. Hủy một subscriber không hủy các subscriber khác; khi hết người chờ, abort truyền tới OpenAI và không ghi cache. Lỗi/schema thiếu không được cache.

Pipeline `rentguard-v2.1.0` hỗ trợ reasoning effort theo bước: Sol dùng `low` cho OCR/kiểm chứng/chat, `medium` cho phân tích theo cấu hình đề xuất. Khi effort khác `none`, bỏ hẳn `temperature` theo hướng dẫn API. Các model không cấu hình reasoning vẫn thử `temperature:0`; chỉ fallback với HTTP400 chỉ rõ `param=temperature` không được hỗ trợ, bao gồm trường hợp code rỗng đã kiểm thử thật. Model và cả hai effort được đưa vào khóa chính sách, tránh dùng lại báo cáo từ cấu hình cũ. Điều này **không bảo đảm tất định** hoặc chứng minh Sol chính xác hơn trên mọi hợp đồng. Cache bảo toàn một kết quả đã kiểm chứng, không chứng minh kết quả đó đầy đủ hoặc đúng với ảnh.

## JSON cuối cùng và nguồn kết quả

Kiểu wire đầy đủ ở `shared/contracts.ts`; Mobile có bản sao tự chứa được đồng bộ bằng script root. Ví dụ rút gọn về cấu trúc (nội dung minh họa, không phải kết quả AI thật):

```json
{
  "report": {
    "id": "report-id",
    "title": "Hợp đồng thuê nhà",
    "createdAt": "2026-11-14T00:00:00.000Z",
    "source": "openai",
    "model": "gpt-4.1-mini",
    "summary": "Số trang và số phát hiện được code tính từ kết quả đã kiểm chứng.",
    "pages": [
      {
        "id": "page-1",
        "pageNumber": 1,
        "status": "readable",
        "text": "Tiền cọc là 10.000.000 đồng.",
        "warning": null
      }
    ],
    "findings": [
      {
        "id": "finding-id",
        "ruleId": "DEPOSIT",
        "category": "deposit",
        "checkId": "DEPOSIT_REFUND",
        "severity": "medium",
        "title": "Xác nhận khoản tiền cọc",
        "reason": "Cần đối chiếu khoản thanh toán trước khi ký.",
        "explanation": "Đoạn được trích ghi tiền cọc là 10.000.000 đồng.",
        "suggestedQuestion": "Tôi có nhận được biên nhận cho khoản cọc 10.000.000 đồng không?",
        "evidence": [
          {
            "id": "evidence-id",
            "pageId": "page-1",
            "pageNumber": 1,
            "quote": "Tiền cọc là 10.000.000 đồng.",
            "startOffset": 0,
            "endOffset": 28,
            "boundingBox": null
          }
        ]
      }
    ],
    "missingInformation": ["Bạn đã xác nhận cách tính điện, nước và toàn bộ phí dịch vụ trước khi ký chưa?"],
    "warnings": ["AI có thể đọc sai chữ trong ảnh. Hãy đối chiếu ảnh gốc."]
  },
  "analysisToken": "v1.<HMAC-SHA256>"
}
```

`title` và `summary` được code tạo; không có nhận định tự do không được kiểm chứng từ model trong hai trường này. `missingInformation` là câu hỏi checklist trung lập do code tạo cho nhóm chưa có phát hiện được kiểm chứng và trang chưa đọc đầy đủ. Nó **không khẳng định** rằng hợp đồng thiếu điều khoản. Báo cáo không có phát hiện cũng không được gọi là an toàn.

`source: "openai"` chỉ xuất hiện sau khi pipeline dùng provider thành công hoặc khi dùng lại báo cáo OpenAI đã kiểm chứng/xác thực; xem `analysis.reuse` để phân biệt. Trong unit/integration test, provider được khai báo thay bằng fixture để kiểm tra code; đó không phải bằng chứng đã gọi OpenAI thật. Dữ liệu mẫu Mobile mang `source: "demo"`, không có token xác thực cho API hỏi đáp thật.

## Hai lớp kiểm chứng bằng chứng

**Lớp xác định bằng code** trong `evidence.ts`:

- `pageId` phải có trong bộ trang đã trích xuất và trang không được `unreadable`.
- Đoạn trích phải là chuỗi liên tiếp; chỉ chuẩn hóa khoảng trắng khi so khớp. Chữ hoa/thường, số tiền, dấu câu và dấu tiếng Việt phải đúng; không fuzzy-match, không nối nhiều đoạn, không tự sửa tiền hoặc dấu.
- Chỉ nhận đoạn 8–4.000 ký tự để tránh chứng minh cả nhận định bằng một con số đơn lẻ hoặc dán cả tài liệu.
- Backend tự tính `startOffset` và `endOffset` trên **chuỗi OCR gốc**, rồi lấy lại `quote` từ chuỗi đó. Client không được quyết định offset. Đây là chỉ số UTF-16 của JavaScript, không phải byte, pixel hoặc vị trí ảnh.
- Một bằng chứng sai làm loại toàn bộ phát hiện. Phát hiện không có bằng chứng cũng bị loại. `pageNumber` do code lấy từ trang tương ứng.
- `boundingBox` luôn `null` trong phiên bản này vì không có nguồn tọa độ OCR đáng tin cậy. Mobile mở đúng ảnh gốc và làm nổi đoạn văn trích xuất; không vẽ khung pixel đoán lên ảnh.

**Lớp ngữ nghĩa bằng model** trong `ai.ts` / `service.ts`:

- Một lượt Structured Outputs riêng nhận tất cả trang, nhận định, mức ưu tiên và bằng chứng đã khớp.
- Kiểm tra cả tiêu đề, lý do, diễn giải và **tiền đề cụ thể trong câu hỏi gợi ý**. Trích dẫn đúng chữ nhưng không hỗ trợ diễn giải vẫn phải loại.
- Thiếu ID review, ID bị lặp hoặc `supported=false` đều loại mục đó. Lỗi provider làm thất bại yêu cầu, không mặc định chấp nhận.
- Báo cáo ghi rõ số mục bị loại và khả năng kết quả chưa bao quát; không hiển thị nội dung đã bị loại cho người dùng như một phát hiện.

Hai lớp không tương đương xác minh pháp lý hay kiểm chứng độc lập với ảnh. OCR có thể bịa/sai chữ, lượt model kiểm chứng có thể đồng ý với suy luận sai, model có thể bỏ sót điều khoản. Lượt kiểm chứng hiện dùng cùng model được cấu hình, chỉ là một request riêng. Người dùng phải đối chiếu ảnh gốc và hỏi người có chuyên môn khi cần.

## Hỏi đáp nhiều lượt

`POST /api/chat` nhận `{report, analysisToken, messages, question}`. `messages` là các lượt hoàn thành trước đó, `question` là câu hỏi mới. Mobile gửi 20 tin nhắn gần nhất (thường 10 cặp hỏi/đáp); các lượt xa hơn vẫn lưu trong lịch sử giao diện nhưng không được gửi trong ngữ cảnh hiện tại. Backend luôn gửi **toàn bộ văn bản trang** của báo cáo đã ký cho mỗi câu hỏi. Không dùng hội thoại cũ như nguồn bằng chứng.

Đầu ra model chia thành các `claims` có bằng chứng. Mỗi claim phải vượt cả kiểm chứng chuỗi và lượt kiểm chứng ngữ nghĩa. Chỉ phần vượt kiểm chứng được ghép thành câu trả lời; có nhãn số trang và mảng `evidence` để mở ảnh. Nếu thiếu thông tin, không có claim được xác nhận hoặc một phần bị loại, code thêm thông báo trung lập cố định rằng chưa đủ thông tin và mời bổ sung trang liên quan. Không hiển thị một lời “làm rõ” tự do của model chưa được kiểm chứng.

Giới hạn: câu hỏi/tin user 2.000 ký tự, tin assistant trong lịch sử 100.000 ký tự, 200 tin nhắn và tổng 1.000.000 ký tự hội thoại. Giới hạn tin assistant đủ nhận lại câu trả lời dài làm ngữ cảnh và có test xác nhận trường hợp này. Backend không âm thầm bỏ lượt khi vượt giới hạn mà trả lỗi rõ ràng. Giới hạn context thực của model cấu hình vẫn được provider thực thi.

## Lịch sử, chữ ký và khởi động lại

Backend không giữ hợp đồng trong database. Mobile lưu báo cáo, token, hội thoại và đường dẫn ảnh nội bộ bằng AsyncStorage/file storage. `signing.ts` dùng canonical JSON sắp thứ tự khóa (giữ thứ tự mảng), HMAC-SHA256 và so sánh constant-time.

- Token mới là `v1.<digest>` với domain `rentguard-report:v1:`. Có thể đọc lại JSON hoặc đổi thứ tự thuộc tính mà chữ ký vẫn đúng.
- Chỉnh chữ OCR, bằng chứng, nguồn, ngày hoặc bất kỳ trường báo cáo nào làm token sai. Backend từ chối `INVALID_ANALYSIS` trước khi gọi OpenAI. Chữ ký không phải mã hóa dữ liệu hoặc xác thực danh tính người dùng.
- **Không có TTL**, để báo cáo lưu trên điện thoại vẫn hỏi đáp được về sau. Độ cũ của hợp đồng không tự thay đổi nội dung; hệ thống không khẳng định phản ánh luật mới nhất.
- `REPORT_SIGNING_SECRET` được cấu hình cục bộ hoặc tự tạo một lần trong `backend/.data/signing-key` (ignore). Giữ secret và thư mục khi restart để token cũ vẫn đúng. Đổi hoặc mất secret cần phân tích lại; không tự nhận báo cáo không xác thực.
- Hỗ trợ xác thực token bare không có prefix do phiên bản cục bộ đầu tiên tạo. Phiên bản token lạ bị từ chối. Thay đổi schema báo cáo trong tương lai cần migration có chủ đích; không sửa báo cáo đã ký trong Mobile rồi kỳ vọng giữ token.

## Khóa, dữ liệu và lỗi

Chỉ backend đọc `OPENAI_API_KEY` từ file `.env` được ignore. `.env.example` không có khóa. Mobile chỉ biết URL backend và không giữ OpenAI key. Khi thiếu khóa trả `503 AI_NOT_CONFIGURED`; không tự chuyển demo. `health.aiConfigured` chỉ chứng minh đã có giá trị cấu hình, không chứng minh quyền truy cập/hạn mức.

Ảnh và văn bản được gửi OpenAI khi người dùng chọn phân tích/hỏi đáp thật. `store:false` tắt lưu Response qua cơ chế này, không thay thế chính sách dữ liệu của provider. Backend không ghi nội dung hợp đồng lên đĩa hoặc log ảnh/prompt/response/khóa. Chữ ký secret là file duy nhất hệ thống tự giữ; lịch sử nằm trên điện thoại. Kết nối laptop LAN dùng HTTP theo cấu hình phát triển; triển khai Internet cần HTTPS và kiểm soát truy cập.

Các lỗi không đọc được ảnh, ảnh hỏng/quá lớn, thiếu trang, mạng, timeout, hạn mức, quyền API, refusal, JSON/schema sai và phản hồi chưa hoàn chỉnh đều có code/thông báo riêng. Cancel/disconnect từ Mobile được chuyển thành AbortSignal cho lời gọi OpenAI đang chạy. Không gọi kết quả giả là phân tích thật.

## Bằng chứng kiểm thử và giới hạn nghiệm thu

Backend tests gồm: toàn bộ trang đúng thứ tự; trang partial không bị bỏ; 42 phát hiện vẫn được giữ nếu đủ căn cứ; loại trích sai số tiền/dấu/trang; offset về text gốc; thiếu/lặp semantic review; câu hỏi gợi ý đi qua kiểm chứng; hội thoại nhiều lượt và tin assistant dài; chữ ký sau JSON, phiên bản, secret rotation và migration; lỗi ảnh/khóa/network; OpenAI SDK thật qua HTTP transport giả với Vision + strict schema + `store:false`; refusal, incomplete và schema sai. Khả năng hỏi đáp thật sau restart laptop vẫn cần nghiệm thu với khóa OpenAI thật và cùng signing secret.

`npm run test:live -- <ảnh1> <ảnh2>` trong backend là kiểm thử **opt-in có tính phí**: dùng khóa thật đã cấu hình để phân tích và hỏi tiếp hai lượt, chỉ in metadata. Chưa có khóa thì không chạy và không chứng minh kết nối thật. Không có test tự động nào thay thế nghiệm thu ảnh thực tế, OpenAI thật hoặc cài APK trên Android/iOS thật.

Tài liệu API chính thức: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Vision](https://developers.openai.com/api/docs/guides/images-vision), [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create).
