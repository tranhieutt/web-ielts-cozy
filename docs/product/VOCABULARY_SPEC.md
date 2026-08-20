# IELTS Cozy — Đặc tả chức năng Từ vựng

**Phiên bản:** 0.2  
**Trạng thái:** Đã rà soát kỹ thuật; chờ Product/Content duyệt mục 2, 5, 8 trước khi code  
**Phạm vi:** Vocabulary MVP cho người học tự học IELTS B2C, tiếng Việt, Gen Z và Gen Alpha  
**Thay thế chi tiết cho:** mục 6.9 trong [PRD](PRODUCT_SPEC.md)

## 1. Mục tiêu

Giúp người học ghi nhớ từ theo chủ đề IELTS bằng phiên ôn ngắn, rõ tiến độ và có lịch ôn lặp lại ngắt quãng. Người học vào `/vocabulary`, chọn bộ từ hoặc học các từ đến hạn, lật thẻ, nghe phát âm, tự đánh giá **Chưa thuộc** hoặc **Thuộc rồi**.

MVP ưu tiên thói quen học hàng ngày và dữ liệu tiến độ đáng tin cậy. Không tối ưu cho tra từ điển đầy đủ.

### Chỉ số thành công sau khi phát hành

| Chỉ số | Mục tiêu ban đầu |
|---|---:|
| Người mở ít nhất một phiên ôn / tháng | Theo dõi baseline trước, chưa đặt quota |
| Tỷ lệ hoàn tất phiên đã bắt đầu | >= 70% |
| Số thẻ được chấm trong một phiên hoàn tất | >= 8 |
| Tỷ lệ quay lại ôn từ trong 7 ngày | Theo dõi baseline trước, chưa đặt quota |
| Lỗi mất tiến độ sau thao tác đánh giá | 0 lỗi đã xác nhận |

## 2. Phạm vi và quyết định sản phẩm

### Trong MVP

- Danh mục 23 bộ từ theo topic IELTS, sinh từ file JSONL được duyệt.
- Trang tổng quan từ vựng tại `/vocabulary`.
- Màn hình học/ôn bằng flashcard: mặt trước, lật thẻ, nghĩa, ví dụ, phát âm và hai lựa chọn tự đánh giá.
- Hàng đợi ưu tiên từ đến hạn, sau đó từ mới thuộc bộ người học chọn.
- Lịch lặp lại ngắt quãng hai mức: `Chưa thuộc` và `Thuộc rồi`.
- Theo dõi tiến độ theo bộ từ và tổng số từ đã học/đã thuộc.
- Lưu trạng thái người học từ đầu khi backend/database được triển khai; trước đăng nhập dùng Supabase Anonymous Auth UUID (D-12), tiến độ bền trên cùng thiết bị/trình duyệt nhưng không phải bản sao lưu đa thiết bị.
- Responsive từ 360px; thao tác một tay, vùng chạm tối thiểu 44px.

### Ngoài MVP

- AI chấm từ vựng, Speaking, gamification xã hội, leaderboard.
- Người học tự tạo bộ từ, import file, chia sẻ deck.
- Đồng bộ từ đã lưu từ Reading, Listening, Writing; chỉ chừa data model để thêm sau.
- Hàng đợi review offline và đồng bộ mutation. Vocabulary MVP yêu cầu kết nối để lưu đánh giá theo ADR-002.
- Bốn mức chấm kiểu Anki/FSRS; MVP giữ hai thao tác đúng với mockup hiện có.
- Dịch máy tự động xuất thẳng cho người học.

### Quyết định đã chốt

1. Chỉ đọc `*.jsonl` trong `content/vocabulary/ielts_vocab_by_topic`. Bỏ qua mọi file khác trong thư mục.
2. `index.html` là nguồn đúng cho layout/mockup đang hiển thị. Tài liệu này là nguồn đúng cho hành vi Vocabulary trước khi implement.
3. Nội dung gốc và tiến độ học tách riêng. Không ghi đè file JSONL khi người học ôn từ.
4. Không hiển thị `def_zh`, `examples[].zh`, `collocations[].zh` trong UI tiếng Việt mặc định.
5. Không dùng runtime các URL audio Youdao trong JSONL. Google Cloud TTS đã sinh và upload 10.550 MP3 UK/US mới cho 5.275 card vào Supabase Storage/CDN; delivery probe UK/US pass. Chỉ bật runtime sau QA phát âm pass.

## 3. Dữ liệu nguồn đã rà soát

Nguồn: `content/vocabulary/ielts_vocab_by_topic/*.jsonl`, kiểm tra ngày 2026-08-19.

| Hạng mục | Kết quả |
|---|---:|
| File JSONL | 23 |
| Dòng hợp lệ / bản ghi | 5.275 |
| Dòng JSON lỗi | 0 |
| ID duy nhất | 5.275 |
| Topic chính | 23 |
| Bản ghi có UK audio / US audio | 5.275 / 5.275 |
| Bản ghi có senses | 5.275 |
| Bản ghi có ví dụ | 5.080 |
| Bản ghi có collocation | 3.561 |
| Bản ghi có nghĩa, ví dụ, collocation tiếng Việt | 5.275 / 0 / 0 |
| Bản ghi có nghĩa tiếng Trung | 5.275 |

Phân bố CEFR hiện có: A1 160, A2 609, B1 1.212, B2 1.413, C1 379, C2 1.453, thiếu 49.

| Topic slug | Số từ |
|---|---:|
| art_entertainment | 260 |
| business_economy | 258 |
| change_process | 297 |
| education | 154 |
| emotion_attitude | 195 |
| environment | 360 |
| family_relationships | 75 |
| food_agriculture | 126 |
| general_academic | 622 |
| government_law | 335 |
| health | 221 |
| movement_space | 86 |
| object_material | 190 |
| opinion_argument | 248 |
| people_character | 345 |
| science_research | 201 |
| society_culture | 161 |
| sport_leisure | 71 |
| technology | 176 |
| time_measure | 393 |
| travel_transport | 136 |
| urban_housing | 189 |
| work | 176 |

## 4. Content contract

Mỗi dòng JSONL là một `VocabularyCard` gốc. Parser phải đọc UTF-8, một JSON object trên một dòng; dòng lỗi làm build/ingestion thất bại kèm tên file và số dòng.

| Trường nguồn | Dùng trong MVP | Quy tắc |
|---|---|---|
| `id` | Có | Khóa toàn cục, bắt buộc, duy nhất. |
| `word`, `is_phrase` | Có | Tiêu đề thẻ; cụm từ hiển thị nguyên văn. |
| `topic`, `topics_all`, `topic_scores` | Có | `topic` quyết định deck chính; `topics_all` chỉ hỗ trợ khám phá sau này. |
| `phonetic.uk`, `phonetic.us` | Có | Chọn UK mặc định; cho phép đổi US khi cả hai có dữ liệu. Corpus hiện thiếu `phonetic.uk` ở 20 card và `phonetic.us` ở 90 card; 20 card thiếu UK đều là `is_phrase`. Thiếu phonetic thì ẩn hẳn vùng phonetic, không hiển thị chuỗi rỗng hay dấu ngoặc trống. |
| `audio.uk`, `audio.us` | Không dùng runtime | Metadata Youdao gốc giữ để trace, không phát/proxy/cache. Runtime dùng object path Google TTS sau CDN upload. |
| `cefr`, `target_band` | Có | Nhãn độ khó/filter. Thiếu CEFR hiển thị “Chưa phân cấp”. |
| `senses` | Có | Lấy nghĩa ưu tiên theo policy ở mục 5. |
| `examples`, `collocations` | Có | Hiển thị khi có; không có thì ẩn vùng tương ứng. |
| `synonyms`, `antonyms`, `family` | Sau MVP | Giữ trong catalog, chưa bắt buộc UI. |
| `freq`, `collins`, `oxford_3000`, `star`, `tags` | Sau MVP | Dùng cho xếp hạng/chọn từ, không hứa hiển thị. |
| `sources`, `rank`, `meta` | Nội bộ | Provenance, kiểm duyệt, không hiển thị trực tiếp cho người học. |

### Quy tắc membership và trùng lặp

- Một từ có đúng một deck chính theo `topic`/tên file nguồn.
- Một từ có thể có nhiều `topics_all`, nhưng không được tạo nhiều trạng thái ôn. `learner_card_state` khóa bằng `learner_id + card_id`, không khóa bằng deck.
- Nếu cùng `id` xuất hiện hai lần ở lần ingest sau: chặn publish; không tự chọn bản ghi thắng.
- Số thẻ hiển thị trong deck là số bản ghi hợp lệ, publishable của deck đó; không hard-code theo mockup.

## 5. Chính sách ngôn ngữ và chất lượng nội dung

Mockup/PRD yêu cầu nghĩa và ví dụ tiếng Việt. Đợt enrichment ngày 2026-08-19 đã điền 7.309 `senses[].def_vi` cho toàn bộ 5.275 card; `examples[].vi` và `collocations[].vi` vẫn chưa có nội dung tiếng Việt.

### Fallback hiển thị

1. `def_vi` là **bắt buộc để publish**. Mọi sense của thẻ publishable phải có `def_vi` non-empty; corpus hiện đạt 7.309/7.309. Đây là quy tắc đang được `scripts/vocabulary/validate-content.mjs` thực thi cứng.
2. Không có fallback "nghĩa Anh thay nghĩa Việt" cho `senses`. Thẻ thiếu `def_vi` bị chặn publish và báo lỗi kèm card ID; không đẩy sang UI kèm nhãn tạm.
3. `def_en` hiển thị như nội dung bổ trợ song ngữ khi có, không thay thế `def_vi`.
4. Không dùng tiếng Trung làm fallback trong UI mặc định. Chỉ có thể mở tính năng Trung ngữ qua quyết định sản phẩm riêng.
5. `examples[].vi` và `collocations[].vi` hiện chưa có và **không** bắt buộc để publish: hiển thị bản tiếng Anh đã duyệt, không kèm nhãn "đang cập nhật".

Lý do tách rule 1–2 khỏi rule 5: nghĩa là nội dung lõi của thẻ, thiếu thì thẻ vô dụng với người học Việt; ví dụ/collocation là bổ trợ, thiếu bản Việt vẫn dùng được. Quy tắc này phải khớp một-một với validator, nếu lệch thì sửa cả hai cùng lúc.

### Release gate nội dung

- Coverage `def_vi` đã đạt cho toàn bộ deck. Bản dịch máy vẫn cần reviewer song ngữ audit trước production, ưu tiên Health, Government/Law, C1/C2 và các nghĩa dịch từ tiếng Trung.
- Mỗi thẻ publish phải có: `id`, `word`, topic hợp lệ, và `def_vi` non-empty ở **mọi** sense.
- 10.550 MP3 Google TTS đã pass manifest/file integrity audit. Lưu ý integrity audit chỉ chứng minh file tải được và đúng định dạng MP3, **không** chứng minh đọc đúng.
- Trước khi bật audio phải QA phát âm bằng tai tối thiểu 38 card đồng tự khác âm (`record`, `content`, `subject`, `present`, `separate`, `deliberate`, `advocate`, `conflict`, `tear`, `bow`, `desert`, `lead`…). `generate-audio.mjs` gửi plain text nên Google TTS tự chọn một cách đọc; corpus đã có IPA ở `phonetic.uk`/`phonetic.us` nên card sai phải sinh lại bằng SSML `<phoneme>`.
- Audio đã upload bucket Supabase/CDN và browser delivery probe UK/US pass; vẫn chỉ bật runtime sau QA phát âm pass. Không gọi URL Youdao từ browser production.
- Không hiển thị text lỗi mã hóa, source URL, tag nội bộ, hay văn bản chưa review.

## 6. Cấu trúc màn hình

### 6.1 `/vocabulary` — Dashboard từ vựng

Mục tiêu: cho người học biết nên ôn gì ngay và có thể chọn chủ đề.

Khối nội dung theo thứ tự:

1. Header page: “Từ vựng”, số thẻ đến hạn hôm nay, CTA **Ôn ngay**.
2. Tiến độ ngắn: số đã học, đang học, đã thuộc; không đánh đồng “đã xem” với “đã thuộc”.
3. Deck đề xuất: ưu tiên deck có thẻ đến hạn, rồi deck gần mục tiêu IELTS/CEFR của người học.
4. Danh sách all decks: tên tiếng Việt, slug nội bộ, số thẻ publishable, CEFR chủ đạo, tiến độ cá nhân.
5. Filter: topic, CEFR, chỉ từ đến hạn. Search word là sau MVP nếu chưa có index nhanh.
6. Empty state: chưa có thẻ đến hạn vẫn cho phép chọn deck học từ mới.

Tên hiển thị phải thân thiện, ví dụ `environment` -> “Môi trường”, `general_academic` -> “Từ vựng học thuật nền tảng”. Không dùng slug tiếng Anh làm heading chính.

### 6.2 `/vocabulary/review` — Phiên học

Query/route state tối thiểu: `deck`, `mode` (`due` hoặc `new`), `limit`. Route không được là nơi lưu điểm; server/client state là nguồn đúng.

| Vùng | Hành vi |
|---|---|
| Thanh phiên | Hiển thị vị trí, số thẻ còn lại, nút thoát; tiến độ đã chấm mới được tính. |
| Mặt trước | Word/phrase, loại từ nếu có, phonetic UK mặc định, audio control, nhãn CEFR/band. Card không có phonetic (20 card `is_phrase`) ẩn vùng phonetic, các phần còn lại giữ nguyên. |
| Lật thẻ | Tap/click/Enter lật thẻ. Animation phải tôn trọng `prefers-reduced-motion`. |
| Mặt sau | Nghĩa theo policy ngôn ngữ, tối đa 1–2 sense đầu tiên, một ví dụ, collocation khi có. |
| Đánh giá | `Chưa thuộc` và `Thuộc rồi` chỉ active sau khi mặt sau đã được mở. |
| Feedback | Sau mỗi đánh giá, chỉ chuyển thẻ tiếp theo sau khi server xác nhận đã lưu. Khi offline, giữ thẻ hiện tại, khóa đánh giá và giải thích cần kết nối để lưu tiến độ. |

Không tự phát audio. Mọi audio control có nhãn trợ năng rõ: “Nghe phát âm Anh-Anh của {word}”.

### 6.3 Kết thúc phiên

Hiển thị số thẻ đã ôn, số chọn Thuộc rồi, số sẽ quay lại sớm, số thẻ còn đến hạn và CTA: **Ôn tiếp**, **Chọn bộ khác**, **Về từ vựng**. Không dùng copy gây áp lực/streak shaming.

## 7. Luồng nghiệp vụ

### Luồng A — Ôn thẻ đến hạn

1. Người học mở `/vocabulary`.
2. Hệ thống tải số lượng thẻ `due_at <= now` của người học.
3. Người học chọn **Ôn ngay**.
4. Hệ thống xếp: overdue lâu nhất -> due sớm nhất -> thẻ đang học; mỗi lần tối đa 20 thẻ mặc định.
5. Người học lật thẻ và chấm một trong hai lựa chọn.
6. Hệ thống lưu review event và cập nhật state nguyên tử.
7. Kết thúc hoặc người học thoát; thẻ đã chấm không mất.

### Luồng B — Học bộ từ mới

1. Người học mở một deck.
2. Hệ thống cho chọn “Học từ mới” hoặc “Ôn từ đến hạn trong bộ”.
3. Với từ mới, ưu tiên CEFR gần mức/mục tiêu của người học; fallback theo thứ tự `order`, rồi `id` để ổn định.
4. Không đưa card đã có state `mastered` vào hàng đợi từ mới, trừ khi người học chủ động reset sau MVP.
5. Tối đa 10 thẻ mới/ngày mặc định; con số này là cấu hình, không hard-code UI.

### Luồng C — Xử lý lỗi

- Không có thẻ hợp lệ: nói rõ “Bộ từ đang được cập nhật”, không hiện card rỗng.
- Audio lỗi: giữ phiên học chạy, hiển thị “Chưa phát được audio”, không đổi kết quả ôn.
- Lưu review lỗi: không chuyển sang thẻ tiếp theo cho tới khi retry thành công hoặc người học chọn thoát; hiển thị trạng thái rõ ràng.
- Offline: Vocabulary MVP không queue review cục bộ. Khóa đánh giá, giữ thẻ hiện tại và giải thích cần kết nối để lưu; không giả báo đã lưu. Xem ADR-002.

## 8. Thuật toán lặp lại ngắt quãng MVP

Hai lựa chọn đúng với design hiện tại. Đây là lịch deterministic, dễ kiểm thử; có thể thay bằng FSRS sau khi đủ dữ liệu học thực.

### 8.1 Stage và interval

Stage là số nguyên 0–6. Mỗi stage có đúng một interval:

| Stage | 0 | 1 | 2 | 3 | 4 | 5 | 6 |
|---|---|---|---|---|---|---|---|
| Interval | 10 phút | 1 ngày | 3 ngày | 7 ngày | 14 ngày | 30 ngày | 60 ngày |

### 8.2 Bảng chuyển trạng thái đầy đủ

`due_at` luôn = thời điểm chấm + interval của stage kết quả. Bảng này là đặc tả đầy đủ, không suy diễn thêm:

| State trước | Stage trước | Chọn `Chưa thuộc` | Chọn `Thuộc rồi` |
|---|---|---|---|
| `new` | — | `learning` stage 0, +10 phút | `review` stage 1, +1 ngày |
| `learning` | 0 | `learning` stage 0, +10 phút | `review` stage 1, +1 ngày |
| `review` | 1 | `learning` stage 0, +10 phút | `review` stage 2, +3 ngày |
| `review` | 2 | `review` stage 1, +1 ngày | `review` stage 3, +7 ngày |
| `review` | 3 | `review` stage 2, +3 ngày | `review` stage 4, +14 ngày |
| `review` | 4 | `review` stage 3, +7 ngày | `review` stage 5, +30 ngày |
| `review` | 5 | `review` stage 4, +14 ngày | **`mastered` stage 6**, +60 ngày |
| `mastered` | 6 | `review` stage 5, +30 ngày | `mastered` stage 6, +60 ngày |

Hai điểm trước đây mơ hồ, nay chốt:

- Hạ stage từ `review` stage 1 khi chọn `Chưa thuộc` đưa thẻ về `learning` stage 0 (+10 phút), không giữ `review` stage 0. State `review` không tồn tại ở stage 0.
- Đạt stage 6 tự động đổi state sang `mastered` trong cùng transaction. `mastered` là hệ quả của stage, không phải cờ riêng.

### 8.3 Hàng đợi trong phiên tách khỏi `due_at`

Đây là hai cơ chế khác nhau, trước đây bị lẫn:

- **`due_at`** quyết định thẻ có được nạp vào một phiên **mới** hay không. Chỉ dùng lúc build queue.
- **Hàng đợi trong phiên** là danh sách trong bộ nhớ, **không** đọc lại `due_at`. Thẻ bị chấm `Chưa thuộc` được chèn lại vào hàng đợi hiện tại sau ít nhất 3 thẻ khác, kể cả khi `due_at` của nó là +10 phút ở tương lai.
- Nếu hàng đợi còn ít hơn 3 thẻ chưa chấm, thẻ `Chưa thuộc` không chèn lại; nó chờ phiên sau theo `due_at`.
- Một phiên không bao giờ tự kéo dài vô hạn: mỗi thẻ được chèn lại tối đa 2 lần trong cùng phiên, sau đó chờ phiên sau.

Không có quy tắc này thì thẻ +10 phút không bao giờ quay lại trong một phiên dài 3–5 phút, và mức `Chưa thuộc` mất tác dụng luyện tập tức thời.

### 8.4 Quy tắc chung

- `mastered` nghĩa là đã trả lời đúng ở stage 6; không phải số lần từng nhìn thấy thẻ.
- Tất cả mốc thời gian lưu UTC; UI hiển thị theo timezone của người học.
- Một click chỉ tạo một review event. Request retry cần idempotency key để không nhảy hai stage.
- Lần chèn lại trong phiên vẫn tạo review event riêng; stage đi theo bảng 8.2 như mọi lần chấm khác.

## 9. Data model mục tiêu

Không tạo schema ở bước spec này. Khi triển khai database, tách content catalog và learner data như sau.

| Entity | Trường lõi | Mục đích |
|---|---|---|
| `vocabulary_cards` | `id`, word, is_phrase, senses, phonetic, CEFR, target_band, content_status, source_version | Bản ghi nội dung chuẩn hóa từ JSONL. |
| `vocabulary_decks` | `slug`, display_name_vi, description, publish_status, content_version | Danh mục topic. |
| `vocabulary_deck_cards` | `deck_slug`, `card_id`, position, is_primary | Membership deck, không nhân bản card. |
| `learner_card_states` | `learner_id`, `card_id`, state, stage, due_at, first_seen_at, last_reviewed_at, review_count | Trạng thái hiện tại, một hàng mỗi learner/card. |
| `learner_card_reviews` | `id`, learner_id, card_id, rating, reviewed_at, previous_state, next_due_at, idempotency_key | Lịch sử audit và analytics. |

### Learner identity

Không tạo bảng `guest_identities` và không sinh `guest_id` riêng. Theo D-12 trong [Decision log](../architecture/DECISION_LOG.md), `learner_id` **là** UUID của Supabase Anonymous Auth:

- Khách vào lần đầu: gọi anonymous sign-in, nhận UUID thật trong `auth.users`.
- Khách đăng ký/đăng nhập sau: Supabase link identity vào **cùng** UUID đó, nên `learner_card_states` và `learner_card_reviews` không cần migrate hàng nào.
- Nhờ vậy RLS dùng thẳng `auth.uid()`, không phải tự viết lớp phân giải identity song song.

Một bảng identity tự quản sẽ tạo hai nguồn sự thật cho `learner_id` và buộc phải viết tay bước claim progress mà Supabase đã làm sẵn. Nếu sau này thực sự cần tách, phải cập nhật ADR trước.

Ràng buộc database sau này: RLS theo `auth.uid()`; content chỉ đọc; review update transactionally state + event; không lưu nghĩa/âm thanh nhạy cảm của người học vì không có.

## 10. Requirements có thể nghiệm thu

| ID | Requirement | Tiêu chí nghiệm thu |
|---|---|---|
| VOC-01 | Chỉ ingest JSONL | Thêm file không phải `.jsonl` không làm thay đổi danh mục; JSONL lỗi chặn publish và báo file/dòng. |
| VOC-02 | Danh mục deck | Hiển thị đúng số deck publishable, count lấy từ content đã validate. |
| VOC-03 | Không trùng tiến độ | Một card nằm nhiều topic vẫn chỉ có một state ôn cho mỗi người học. |
| VOC-04 | Học/ôn được | Người học lật card, nghe audio khi khả dụng, chấm hai mức và xem card kế. |
| VOC-05 | Không chấm khi chưa xem đáp án | Hai nút đánh giá disabled trước lần lật đầu tiên. |
| VOC-06 | Lịch ôn đúng | Test fixture xác nhận toàn bộ 16 ô của bảng 8.2 và interval bảng 8.1; kiểm cả việc đạt stage 6 đổi state sang `mastered`. |
| VOC-06b | Hàng đợi trong phiên | Thẻ `Chưa thuộc` quay lại sau đúng >= 3 thẻ khác dù `due_at` ở tương lai; tối đa 2 lần chèn lại; hàng đợi còn < 3 thẻ thì không chèn. |
| VOC-07 | Lưu bền vững | Reload sau review thành công vẫn phản ánh state/due_at mới. |
| VOC-08 | Nội dung Việt an toàn | Không có `zh` xuất hiện trong UI mặc định hay trong payload API trả cho learner; thẻ thiếu `def_vi` bị chặn publish chứ không rơi vào UI. |
| VOC-08b | Phonetic khuyết | 20 card `is_phrase` không phonetic vẫn render đúng, ẩn vùng phonetic, không hiện ngoặc rỗng. |
| VOC-09 | Responsive/a11y | Luồng hoàn tất ở 360px, keyboard-only và reduced-motion; control audio/flip/rating có nhãn. |
| VOC-10 | Khả năng phục hồi | Audio hỏng hoặc deck trống không làm mất review đã lưu hay làm app trắng màn hình. |

## 11. Analytics đề xuất

Không gửi word, nghĩa, ví dụ hay lịch sử card đầy đủ vào analytics bên thứ ba.

`card_id` và `deck_slug` là định danh **nội dung công khai**, không phải dữ liệu cá nhân, nên được gửi nguyên văn. Thứ phải pseudonymize là định danh **người học**: không bao giờ gửi `learner_id`/`auth.uid()` sang analytics bên thứ ba; dùng `session_id` sinh riêng cho mỗi phiên và không map ngược được về tài khoản.

Theo D-05 (hỗ trợ người học vị thành niên), analytics là consent-gated: chưa có consent thì **không** event nào rời thiết bị. Điều này chặn trước sự kiện đầu tiên, không phải lọc sau.

| Event | Thuộc tính tối thiểu |
|---|---|
| `vocabulary_opened` | source, due_count |
| `vocabulary_deck_opened` | deck_slug, published_card_count |
| `vocabulary_review_started` | mode, deck_slug, queue_size |
| `vocabulary_card_flipped` | session_id, card_id, position |
| `vocabulary_audio_played` | accent, success |
| `vocabulary_review_rated` | rating, previous_state, next_state, interval_days |
| `vocabulary_review_completed` | reviewed_count, duration_seconds, completion_reason |
| `vocabulary_sync_failed` | operation, recoverable |

## 12. Rủi ro và việc cần chốt trước implementation

| Vấn đề | Ảnh hưởng | Người cần chốt |
|---|---|---|
| Ví dụ/collocation tiếng Việt chưa có | Mặt sau flashcard chưa song ngữ hoàn toàn | Product + content owner |
| QA phát âm TTS chưa hoàn tất | Audio delivery đã pass nhưng có thể dạy sai cách đọc đồng tự khác âm | Content owner + Engineering |
| 5.275 cards trong static bundle | Tải chậm nếu nhét toàn bộ JSONL vào browser | Engineering: ingest/index/paginate trước runtime |
| Guest-first nhưng cần database | Rủi ro mất tiến độ khi đổi thiết bị | Product: thời điểm mời tạo tài khoản/claim progress |
| Chất lượng topic/CEFR không đồng đều | Deck đề xuất sai mức | Content owner: review/publish status |
| TTS đọc sai 38 từ đồng tự khác âm | Dạy sai phát âm, lỗi nội dung nghiêm trọng với sản phẩm luyện IELTS | Content owner: QA nghe; Engineering: sinh lại bằng SSML `<phoneme>` từ IPA có sẵn |
| 10.550 MP3 chỉ nằm trên máy local, `.gitignore` loại `.generated/audio/` | Mất máy trước khi upload xong là phải sinh lại toàn bộ, tốn chi phí TTS | Engineering: backup artifact + `manifest.json` **trước** khi upload |
| Repo chưa có CI (`.github/` không tồn tại) | D-16 và D-18 yêu cầu test/CI là merge gate; content quality gate không có chỗ chạy | Engineering: dựng pipeline tối thiểu trước M1 |
| Chưa có age gate/consent cho người học vị thành niên | D-05 chưa được thực thi trong khi §11 đã lên lịch 8 event | Product + Engineering: consent trước event đầu tiên |
| Offline review chưa hỗ trợ | Người học không thể chấm card khi mất mạng trong MVP | Theo ADR-002; đo nhu cầu sau beta trước khi mở lại scope |

## 13. Câu hỏi mở

1. Có dịch tiếp `examples[].vi` và `collocations[].vi` sau khi QA xong `def_vi` không?
2. Cấp Supabase project URL và service-role key local để upload manifest MP3 vào bucket `vocabulary-audio`?
3. Người học khách giữ tiến độ bao lâu và lúc nào được mời tạo tài khoản để đồng bộ? Lưu ý anonymous UUID đã giữ tiến độ trên cùng thiết bị/trình duyệt; câu hỏi còn lại chỉ là thời điểm mời và cách xử lý đổi thiết bị.
4. Deck nào được publish beta đầu tiên? Khuyến nghị: Environment, Education, Technology, General Academic.
5. Consent/age gate cho người học vị thành niên (D-05) do release Vocabulary tự làm hay chờ luồng onboarding chung?

## 14. Definition of Ready để code

- Product duyệt mục 2, 5 và lịch ở mục 8.
- Content owner audit mẫu bản dịch `def_vi`, chốt danh sách deck beta, `publish_status`.
- Engineering chốt pipeline JSONL -> catalog/index; không fetch 23 file thô vào first load.
- Migration bucket, upload manifest MP3 và CDN delivery probe đã pass; giữ feature flag off tới khi QA phát âm pass.
- Design bổ sung states: card chưa lật, loading, audio error, save error, empty due, completed, offline-disabled.
- Engineering dựng CI tối thiểu chạy được `npm run vocab:validate-content`; D-16/D-18 yêu cầu gate này tồn tại trước khi merge content.
- Product chốt consent/age gate (D-05) cho release này. Offline review đã hoãn theo ADR-002.
- Content owner QA phát âm 38 card đồng tự khác âm; card sai được sinh lại trước khi bật `audio_enabled`.
