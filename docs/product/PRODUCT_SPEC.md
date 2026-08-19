# IELTS Cozy — Tài liệu yêu cầu sản phẩm (PRD)

**Phiên bản:** 1.0  
**Trạng thái:** Bản nháp chờ duyệt  
**Nguồn giao diện và tương tác hiện tại:** `index.html`  
**Thị trường chính:** Người học IELTS tại Việt Nam  
**Nền tảng chính:** Web responsive, ưu tiên thiết bị di động

## 1. Tóm tắt sản phẩm

IELTS Cozy giúp người học chuẩn bị cho kỳ thi IELTS Academic qua các buổi luyện tập ngắn hằng ngày, phản hồi nhanh, lộ trình học rõ ràng và thi thử sát điều kiện thật.

Lời hứa sản phẩm:

> Luyện IELTS 20 phút mỗi ngày — đề thật, chấm nhanh, lộ trình rõ.

Hành trình người học:

```text
Đặt mục tiêu band + ngày thi
→ Nhận nhiệm vụ hằng ngày và lộ trình 12 tuần
→ Luyện một kỹ năng hoặc bộ từ vựng
→ Nhận điểm / nhận xét
→ Theo dõi điểm yếu và xu hướng band
→ Làm full mock test Academic
→ Điều chỉnh bài luyện tiếp theo
```

## 2. Vấn đề và cơ hội

Người học thường có tài liệu rời rạc, không biết kỹ năng nào đang kéo tụt mục tiêu band, và trì hoãn các buổi học dài. Nhận xét Writing và Speaking thường chậm hoặc đắt. IELTS Cozy làm rõ việc cần học tiếp theo, chia việc luyện tập thành phiên ngắn và biến kết quả luyện thành lộ trình trực quan.

## 3. Người dùng và việc cần hoàn thành

| Người dùng | Bối cảnh | Việc cần hoàn thành |
|---|---|---|
| Người học có mục tiêu | Có band mục tiêu và ngày thi, thường nhắm 6.0–7.5 | Duy trì luyện tập hằng ngày cho tới kỳ thi |
| Người học có lỗ hổng kỹ năng | Điểm Reading/Listening dao động; thiếu nhận xét Writing/Speaking | Tìm lỗi lặp lại và cải thiện đúng tiêu chí |
| Người ôn thi sát ngày | Cần mô phỏng kỳ thi thực tế | Làm mock Academic có giới hạn thời gian và xem lại kết quả |
| Người học cùng bạn bè | Học trong nhóm | Giữ thói quen nhờ streak, huy hiệu và so sánh trong nhóm |

## 4. Mục tiêu và chỉ số thành công

### Mục tiêu sản phẩm

1. Biến 20 phút luyện tập mỗi ngày thành thói quen dễ duy trì.
2. Bao phủ bốn kỹ năng IELTS cùng luyện từ vựng.
3. Cung cấp phản hồi nhanh, có thể hành động; ưu tiên Writing và Speaking.
4. Liên kết mọi kết quả của người học tới một bài luyện được đề xuất tiếp theo.
5. Tạo sự sẵn sàng cho kỳ thi qua mock test Academic sát thực tế.

### Chỉ số sao Bắc Đẩu

**Số phiên luyện tập đạt chuẩn mỗi tuần trên mỗi người học đang hoạt động.**

Phiên đạt chuẩn là bài học, lần ôn từ vựng hoặc phần mock test được hoàn thành với hoạt động có ý nghĩa. Chỉ số này đo hành vi học thật, không chỉ lượt xem trang.

### Chỉ số hỗ trợ

| Chỉ số | Định nghĩa |
|---|---|
| Tỷ lệ hoàn thành onboarding | Người học đặt band mục tiêu và ngày thi / người học mới |
| Tỷ lệ hoàn thành nhiệm vụ ngày | Người học hoàn thành ít nhất một nhiệm vụ được giao / người học hoạt động |
| Giữ chân ngày 7 | Người học hoạt động vào ngày 7 / người học đã kích hoạt |
| Mức sử dụng feedback Writing | Bài Writing đã nộp và mở feedback / bài Writing đã nộp |
| Tỷ lệ hoàn thành mock | Mock đã nộp đủ các phần bắt buộc / mock đã bắt đầu |
| Tín hiệu tiến bộ | Người học có điểm hoặc xu hướng độ chính xác tăng trong 4 tuần |

## 5. Phạm vi: kiến trúc thông tin

Prototype có mười một điểm đến chính. Điều hướng production phải giữ nguyên các mục đích sử dụng này.

| Điểm đến | Mục đích người dùng | Nội dung / hành động chính |
|---|---|---|
| Trang chủ | Hiểu giá trị và vào sản phẩm | Lời hứa sản phẩm, lối vào bốn kỹ năng, CTA bắt đầu học và thi thử |
| Dashboard | Biết hôm nay cần làm gì | Nhiệm vụ ngày, streak, band dự đoán, huy hiệu, nhóm, ngày thi |
| Reading | Luyện một bài đọc | Passage, bộ đếm giờ, câu hỏi, nộp bài, kết quả và mẹo |
| Listening | Hoàn thành bài nghe | Điều khiển audio, điền ghi chú, kiểm tra đáp án |
| Writing | Viết Task 1 hoặc Task 2 | Đề bài, trình soạn thảo, đếm từ, feedback AI |
| Speaking | Luyện câu trả lời nói | Cue card, bộ đếm chuẩn bị/thu âm, từ gợi ý, nhận xét gần nhất |
| Mock | Mô phỏng full test Academic | Bốn phần thi, thời gian, trạng thái, lịch sử |
| Từ vựng | Ghi nhớ từ vựng | Flashcard lật, thao tác Chưa thuộc/Thuộc rồi, bộ từ theo chủ đề |
| Kho đề & lộ trình | Tìm nội dung và kế hoạch học | Bộ lọc kỹ năng, thẻ bài luyện, lộ trình 12 tuần |
| Tiến độ | Hiểu kết quả học | Tổng quan, xu hướng band, điểm yếu, CTA sửa điểm yếu |
| Hồ sơ | Quản lý tài khoản và tùy chọn | Mục tiêu, ngày thi, huy hiệu, cài đặt thông báo và riêng tư |

## 6. Yêu cầu chức năng

### 6.1 Trang chủ / thu hút người dùng

- Trình bày lời hứa: luyện IELTS ngắn hằng ngày, chấm nhanh, lộ trình rõ.
- Hiển thị bốn thẻ vào kỹ năng: Reading, Listening, Writing, Speaking.
- Hiển thị quy mô nội dung: 120 bài Reading, 96 bài Listening, Writing Tasks 1–2, Speaking Parts 1–3. Số lượng thật phải lấy từ catalog nội dung, không hard-code ở UI.
- CTA chính mở Dashboard với người đã đăng nhập; người chưa đăng nhập bắt đầu onboarding.
- CTA phụ mở trang tổng quan mock test.
- Nêu khác biệt: phản hồi Writing/Speaking nhanh, streak/XP/huy hiệu, so điểm mock trong nhóm.

### 6.2 Onboarding, mục tiêu và kế hoạch

- Thu thập tên hiển thị, band mục tiêu, ngày thi, trình độ hiện tại hoặc kết quả diagnostic, nhịp học mong muốn.
- Tạo kế hoạch học theo ngày thi, mục tiêu và điểm yếu.
- Sau onboarding, thanh ứng dụng cố định hiển thị band mục tiêu, ngày thi, level hiện tại, XP level và streak.
- Khi thay đổi ngày thi hoặc mục tiêu, tính lại lộ trình đề xuất và giải thích thay đổi về tải học.

### 6.3 Dashboard: màn hình vận hành hằng ngày

- Hiển thị danh sách nhiệm vụ ưu tiên với tiêu đề, kỹ năng, thời lượng ước tính, XP thưởng và thao tác bắt đầu trực tiếp.
- Prototype hiện có: Reading Passage, Writing Task 2, ôn từ vựng theo chủ đề. Production cần engine đề xuất chọn bài theo lịch sử và kế hoạch của người học.
- Hiển thị streak hiện tại, lịch hoàn thành theo thứ, band tổng dự đoán, band từng kỹ năng, huy hiệu và tiến độ XP/level.
- Hiển thị bảng xếp hạng nhóm và lời mời chỉ khi người học bật chia sẻ xã hội.
- Hiển thị ngày thi và CTA tới lộ trình đầy đủ.
- Hoàn thành nhiệm vụ phải cập nhật Dashboard không cần người học tự tải lại trang.

### 6.4 Luyện Reading

**Luồng chính:** chọn passage → đọc → trả lời câu hỏi có thời gian → nộp → xem điểm và bằng chứng.

- Hiển thị cấp độ, số passage, thời lượng đọc dự kiến, nội dung passage, số từ và câu hỏi.
- Hỗ trợ tối thiểu: multiple choice, matching headings, True/False/Not Given, matching information và sentence completion.
- Có điều hướng câu hỏi, trạng thái lựa chọn, bộ đếm giờ, nút nộp và chính sách làm lại theo từng bài.
- Khi nộp, hiển thị tổng điểm, trạng thái đúng/sai, đáp án đúng, giải thích và đoạn bằng chứng.
- Ghi nhận độ chính xác và thời gian ở cấp câu hỏi để đề xuất điểm yếu chính xác hơn.

### 6.5 Luyện Listening

**Luồng chính:** mở section → nghe → điền đáp án → kiểm tra → xem lại.

- Hiển thị section IELTS, ngữ cảnh, dải câu hỏi, thời lượng audio, dạng bài và quy định số từ tối đa.
- Audio hỗ trợ phát/dừng, thanh tiến độ và tốc độ 0.75×, 1.0×, 1.25×.
- Cấu hình bài học quyết định chính sách nghe lại. Prototype minh họa bài chỉ nghe một lần.
- Bản đầu hỗ trợ note/form completion; mô hình nội dung phải mở rộng được cho các dạng Listening khác.
- Xác thực chính tả và biến thể đáp án theo answer key cấu hình. Nêu rõ câu còn thiếu và feedback sau nộp.
- Lưu câu trả lời khi người học thoát trang hoặc mạng gián đoạn ngắn.

### 6.6 Luyện Writing và phản hồi

**Luồng chính:** chọn Task 1 hoặc Task 2 → đọc đề → viết → nộp → nhận feedback → sửa bài.

- Bộ chọn Task 1/Task 2 thay đổi đề, số từ tối thiểu và thời lượng khuyến nghị.
- Trình soạn thảo có autosave, khôi phục bản nháp, đếm từ, trạng thái nộp và cảnh báo số từ tối thiểu.
- Mặc định: Task 1 = 150 từ / 20 phút; Task 2 = 250 từ / 40 phút.
- Mục tiêu phản hồi: trả về trong 60 giây khi dịch vụ sẵn sàng; nếu không, hiển thị trạng thái chờ và thông báo khi hoàn tất.
- Feedback hiển thị band ước tính và bốn tiêu chí IELTS: Task Response/Achievement, Coherence & Cohesion, Lexical Resource, Grammar Range & Accuracy.
- Cung cấp ít nhất ba góp ý sửa bài cụ thể: cấu trúc/bằng chứng còn thiếu, nâng cấp từ vựng và hành động tiếp theo.
- Lưu phiên bản để người học sửa và so sánh các lần viết.
- Mọi kết quả tự động phải gắn nhãn **feedback ước tính**, không phải điểm IELTS chính thức.

### 6.7 Luyện Speaking và phản hồi

**Luồng chính:** xem đề Part 1/2/3 → chuẩn bị → thu âm → nghe lại/nộp → xem feedback.

- Bắt đầu với cue card Part 2: đề, bốn gợi ý, một phút chuẩn bị và hai phút trả lời.
- Xin quyền microphone trước khi thu; hiển thị trạng thái thu và thời gian đã ghi.
- Người học có thể dừng, nghe lại, xóa và thu lại trước khi nộp.
- Hiển thị cụm từ theo chủ đề như hỗ trợ tùy chọn, không phải bài mẫu bắt buộc.
- Khi đã chấm, hiển thị chỉ dấu fluency, pronunciation, vocabulary, grammar và ít nhất một góp ý gắn timestamp hoặc transcript khi độ tin cậy đủ cao.
- Lưu audio cần sự đồng ý rõ ràng và có nút xóa.

### 6.8 Full mock test Academic

- Hiển thị full mock Academic có tổng thời gian 2 giờ 45 phút.
- Bốn phần: Listening (30 phút / 40 câu), Reading (60 phút / 40 câu), Writing (60 phút / 2 task), Speaking (14 phút / 3 part).
- Trang tổng quan mock hiển thị trạng thái mỗi phần: chưa bắt đầu, đang làm, hoàn thành; đồng thời hiển thị tiến độ.
- Cho phép tạm dừng một lần mỗi mock; lưu sự kiện dừng và thời gian còn lại.
- Các phần khách quan chấm ngay. Writing/Speaking có thể ở trạng thái chờ feedback ước tính.
- Lưu lịch sử mock gồm ngày làm, điểm từng kỹ năng, overall estimate và thao tác xem lại.
- Nút bắt đầu phải mở mock runner có thời gian thật, không điều hướng tới một bài Reading chung.

### 6.9 Ôn từ vựng

Chi tiết hành vi, data contract, lịch ôn và release gate: [Vocabulary feature spec](VOCABULARY_SPEC.md).

- Hiển thị bộ từ theo chủ đề như Environment, Education và Technology; nguồn dữ liệu quyết định số bộ thực tế.
- Flashcard lật giữa từ và nghĩa tiếng Việt/ví dụ.
- Người học chọn **Chưa thuộc / Again** hoặc **Thuộc rồi / Got it**.
- Áp dụng lịch lặp lại ngắt quãng; hiển thị tiến độ bộ từ và số từ đã thuộc.
- Về sau, người học có thể lưu từ từ Reading, Listening, Writing và feedback Speaking.

### 6.10 Kho nội dung và lộ trình 12 tuần

- Lọc kho theo Tất cả, Reading, Listening, Writing, Speaking.
- Mỗi thẻ bài luyện hiển thị kỹ năng, thời lượng, tiêu đề, dạng bài và dải band mục tiêu nếu có.
- Mở trực tiếp bài luyện từ thẻ.
- Hiển thị các giai đoạn: tuần 1–3 nền tảng/chiến thuật Reading; tuần 4–6 Listening Sections 3–4; tuần 7–9 Writing Tasks 1–2; tuần 10–12 mock test và xem lỗi lặp.
- Trạng thái lộ trình gồm hoàn thành, đang học, sắp tới; thay đổi theo lịch và mức hoàn thành của người học.

### 6.11 Tiến độ và đề xuất

- Hiển thị tổng giờ học, số bài đã làm, độ chính xác chung, XP và thay đổi so với kỳ trước.
- Hiển thị xu hướng band trong tám tuần gần nhất; mỗi điểm dữ liệu phải có nguồn đánh giá hoặc nêu rõ là ước tính.
- Hiển thị kỹ năng/dạng câu hỏi yếu với độ chính xác hoặc điểm tiêu chí, ví dụ True/False/Not Given, Matching Headings, Listening Section 4, Writing coherence.
- “Luyện đúng phần này” mở kho đã lọc hoặc bài được đề xuất cho đúng điểm yếu đã chọn.

### 6.12 Gamification, xã hội và cài đặt

- Trao XP cho bài luyện và ôn từ hoàn thành. Hiển thị level hiện tại và thanh tiến độ.
- Duy trì streak ngày theo một hoạt động đạt chuẩn có thể cấu hình; hiển thị lịch hoạt động theo thứ.
- Trao huy hiệu cho mốc như streak 14 ngày, 50 bài Reading, học buổi sáng và mốc band.
- Bảng xếp hạng nhóm chỉ hiển thị người đã đồng ý chia sẻ. Luồng mời phải nói rõ dữ liệu được chia sẻ.
- Cài đặt gồm: giờ nhắc học ngày, giải thích song ngữ, chế độ thi nghiêm, chia sẻ điểm với bạn bè và âm thanh khi trả lời đúng.

## 7. Yêu cầu nội dung và dữ liệu

| Thực thể | Trường bắt buộc |
|---|---|
| Hồ sơ người học | Tên, band mục tiêu, ngày thi, level, streak, XP, cấp độ, tùy chọn, đồng ý chia sẻ xã hội |
| Nội dung luyện tập | Kỹ năng, dạng IELTS, tiêu đề, band mục tiêu, thời lượng, đề/passage/audio, câu hỏi, answer key, giải thích, trạng thái xuất bản |
| Phiên luyện tập | Người học, nội dung, thời điểm bắt đầu/kết thúc, câu trả lời, điểm, thời lượng, trạng thái hoàn thành |
| Bản nháp Writing | Người học, đề, loại task, văn bản, số từ, phiên bản, trạng thái/kết quả feedback |
| Lần Speaking | Người học, đề, consent, tham chiếu audio, transcript, trạng thái/kết quả feedback |
| Flashcard từ vựng | Bộ từ, từ, nghĩa, ví dụ, trạng thái ôn, ngày ôn tiếp theo |
| Lần mock | Người học, đề, trạng thái/thời gian/điểm mỗi phần, lượt tạm dừng, tổng kết cuối |
| Đề xuất | Người học, bằng chứng điểm yếu, nội dung đề xuất, thời điểm tạo |

Nội dung phải có metadata về nguồn/quyền sử dụng. Giải thích đáp án cần được duyệt học thuật trước khi xuất bản.

## 8. Yêu cầu phi chức năng

- **Responsive:** Luồng cốt lõi chạy từ màn hình 360px tới desktop; điều hướng vẫn dùng được khi mười một điểm đến không thể nằm trên một hàng.
- **Hiệu năng:** Màn hình cốt lõi tương tác được dưới 3 giây trên mạng di động phổ biến sau khi cache tài nguyên. Audio và ảnh tải lười.
- **Độ tin cậy:** Writing autosave ít nhất mỗi 5 giây và trước khi rời trang. Câu trả lời luyện tập được giữ khi mất mạng tạm thời.
- **Khả năng tiếp cận:** Tương phản WCAG 2.2 AA, điều khiển semantic, điều hướng bàn phím, focus rõ, hành động audio/recording có nhãn và hỗ trợ giảm chuyển động.
- **Riêng tư:** Upload audio cần opt-in; người học có thể xóa audio và dữ liệu tài khoản. Không đưa văn bản Writing hay audio thô vào analytics.
- **Bảo mật:** Xác thực/session an toàn; mã hóa dữ liệu người học khi truyền và khi lưu trữ.

## 9. Sự kiện analytics

`onboarding_completed`, `target_updated`, `daily_task_opened`, `practice_started`, `question_answered`, `practice_submitted`, `reading_review_opened`, `listening_checked`, `writing_autosaved`, `writing_feedback_ready`, `speaking_recording_started`, `speaking_attempt_submitted`, `vocab_reviewed`, `mock_started`, `mock_paused`, `mock_completed`, `roadmap_viewed`, `recommendation_opened`, `setting_changed`.

Thuộc tính sự kiện: mã người học đã ẩn danh, mã nội dung, kỹ năng, dạng task, thời lượng, trạng thái hoàn thành, điểm/độ chính xác/band nếu có. Loại trừ văn bản Writing, audio, transcript và thông tin định danh cá nhân.

## 10. Ưu tiên MVP

| Phải có khi phát hành | Nên có tiếp theo | Để sau |
|---|---|---|
| Onboarding/mục tiêu, Dashboard, Reading, Listening, bản nháp Writing + feedback ước tính, thu âm Speaking, từ vựng, bộ lọc kho đề, tiến độ, cài đặt cốt lõi | Full mock runner có thời gian, thuật toán lặp lại ngắt quãng, lộ trình thích ứng, bảng xếp hạng nhóm, phân tích transcript | Thử thách bạn bè, gói trả phí, không gian giáo viên chấm bài, lớp học trực tiếp |

## 11. Tiêu chí nghiệm thu production

1. Người học hoàn thành được ít nhất một bài ở Reading, Listening, Writing, Speaking và Vocabulary.
2. Dashboard gán nhiệm vụ, phản ánh hoàn thành, XP và streak sau khi tải lại trang.
3. Reading và Listening lưu câu trả lời, thời gian, điểm và giải thích.
4. Bản nháp Writing được khôi phục sau reload; feedback ghi rõ là ước tính.
5. Người học Speaking có thể cho phép/từ chối microphone, thu, nghe lại, thu lại, nộp và xóa audio.
6. Luồng mock áp dụng thời gian từng phần, giới hạn một lần dừng, trạng thái tiếp tục được và trang tổng kết.
7. CTA điểm yếu mở nội dung liên quan, không mở kho đề chung chung.
8. Chia sẻ điểm tắt mặc định; thay đổi là tường minh và có thể hoàn tác.
9. Hành động chính qua kiểm tra khả dụng bằng bàn phím và mobile.

## 12. Khoảng cách từ prototype tới production

PRD này dùng `index.html` làm nguồn giao diện và tương tác ưu tiên. Các hành vi prototype cần hệ thống thật:

- Điểm Reading và Listening mẫu hiện được mô phỏng/theo luật đơn giản; production cần answer key, engine chấm điểm và giải thích do hệ thống nội dung quản lý.
- Feedback Writing hiện suy ra band từ số từ và tiêu chí cố định; production cần dịch vụ feedback có đánh giá, trạng thái xử lý và nhận xét có bằng chứng.
- Màn hình Speaking hiện mới có bộ đếm và trạng thái thu; production cần Browser Recording, lưu trữ an toàn, transcript tùy chọn và thao tác xóa.
- CTA mock hiện đi vào màn Reading; production cần điều phối mock end-to-end và trạng thái tiếp tục làm.
- XP, streak, bảng nhóm, thông báo, filter, tùy chọn và lịch sử hiện là state prototype; production cần lưu bền vững theo tài khoản và các kiểm soát consent.

## 13. Quyết định cần chốt trước khi triển khai

1. Ra mắt chỉ Academic hay gồm cả General Training?
2. Nhà cung cấp feedback: AI, giáo viên hay hybrid? Chính sách độ chính xác/khiếu nại là gì?
3. Nguồn nội dung, quyền sử dụng, quy trình biên soạn và người chịu trách nhiệm QA học thuật?
4. Giới hạn gói miễn phí và giá trị gói trả phí?
5. Có phục vụ người học dưới 18 tuổi không? Nếu có, cần chính sách consent và lưu giữ dữ liệu nào?
