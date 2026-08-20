# IELTS Cozy — Đặc tả chức năng Từ vựng

**Phiên bản:** 0.1  
**Trạng thái:** Bản nháp để duyệt trước khi code  
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
- Lưu trạng thái người học từ đầu khi backend/database được triển khai; trước đăng nhập dùng định danh khách tạm thời, không được coi là bản sao lưu vĩnh viễn.
- Responsive từ 360px; thao tác một tay, vùng chạm tối thiểu 44px.

### Ngoài MVP

- AI chấm từ vựng, Speaking, gamification xã hội, leaderboard.
- Người học tự tạo bộ từ, import file, chia sẻ deck.
- Đồng bộ từ đã lưu từ Reading, Listening, Writing; chỉ chừa data model để thêm sau.
- Bốn mức chấm kiểu Anki/FSRS; MVP giữ hai thao tác đúng với mockup hiện có.
- Dịch máy tự động xuất thẳng cho người học.

### Quyết định đã chốt

1. Chỉ đọc `*.jsonl` trong `content/vocabulary/ielts_vocab_by_topic`. Bỏ qua mọi file khác trong thư mục.
2. `index.html` là nguồn đúng cho layout/mockup đang hiển thị. Tài liệu này là nguồn đúng cho hành vi Vocabulary trước khi implement.
3. Nội dung gốc và tiến độ học tách riêng. Không ghi đè file JSONL khi người học ôn từ.
4. Không hiển thị `def_zh`, `examples[].zh`, `collocations[].zh` trong UI tiếng Việt mặc định.
5. Không dùng runtime các URL audio Youdao trong JSONL. Google Cloud TTS đã sinh 10.550 MP3 UK/US mới cho 5.275 card; chỉ bật runtime sau khi upload Supabase Storage/CDN và kiểm tra delivery.

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
| `phonetic.uk`, `phonetic.us` | Có | Chọn UK mặc định; cho phép đổi US khi cả hai có dữ liệu. |
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

1. `def_vi` đã có cho toàn bộ corpus hiện tại: hiển thị nghĩa Việt làm nội dung chính.
2. Nếu chưa có nghĩa Việt nhưng có `def_en`: hiển thị nghĩa Anh, kèm nhãn “Nghĩa tiếng Việt đang cập nhật”.
3. Nếu không có cả nghĩa Việt lẫn nghĩa Anh: không publish thẻ.
4. Không dùng tiếng Trung làm fallback trong UI mặc định. Chỉ có thể mở tính năng Trung ngữ qua quyết định sản phẩm riêng.
5. Ví dụ/collocation tiếng Việt tuân theo quy tắc tương tự; bản Anh vẫn được phép hiển thị nếu được duyệt.

### Release gate nội dung

- Coverage `def_vi` đã đạt cho toàn bộ deck. Bản dịch máy vẫn cần reviewer song ngữ audit trước production, ưu tiên Health, Government/Law, C1/C2 và các nghĩa dịch từ tiếng Trung.
- Mỗi thẻ publish phải có: `id`, `word`, tối thiểu một `sense.def_en` hoặc `sense.def_vi`, và topic hợp lệ.
- 10.550 MP3 Google TTS đã pass manifest/file integrity audit. Audio chỉ bật sau khi bucket Supabase/CDN upload và browser delivery probe pass; không gọi URL Youdao từ browser production.
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
| Mặt trước | Word/phrase, loại từ nếu có, phonetic UK mặc định, audio control, nhãn CEFR/band. |
| Lật thẻ | Tap/click/Enter lật thẻ. Animation phải tôn trọng `prefers-reduced-motion`. |
| Mặt sau | Nghĩa theo policy ngôn ngữ, tối đa 1–2 sense đầu tiên, một ví dụ, collocation khi có. |
| Đánh giá | `Chưa thuộc` và `Thuộc rồi` chỉ active sau khi mặt sau đã được mở. |
| Feedback | Sau mỗi đánh giá, ghi tiến độ rồi chuyển thẻ tiếp theo; khi offline phải báo trạng thái chưa đồng bộ. |

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
- Offline: có thể queue review cục bộ nếu implement offline; khi chưa có queue, khóa đánh giá và giải thích. Không giả báo đã lưu.

## 8. Thuật toán lặp lại ngắt quãng MVP

Hai lựa chọn đúng với design hiện tại. Đây là lịch deterministic, dễ kiểm thử; có thể thay bằng FSRS sau khi đủ dữ liệu học thực.

| State trước | Chọn `Chưa thuộc` | Chọn `Thuộc rồi` |
|---|---|---|
| `new` | `learning`, ôn lại sau 10 phút | `review`, stage 1, hẹn 1 ngày |
| `learning` | giữ `learning`, hẹn 10 phút | `review`, stage 1, hẹn 1 ngày |
| `review`, stage 1–6 | giảm 1 stage, tối thiểu stage 0; hẹn 10 phút | tăng 1 stage, tối đa stage 6; hẹn theo lịch |
| `mastered` (stage 6) | `review`, stage 5; hẹn 10 phút | giữ `mastered`; hẹn 60 ngày |

Lịch `Thuộc rồi`: stage 1 = 1 ngày, stage 2 = 3 ngày, stage 3 = 7 ngày, stage 4 = 14 ngày, stage 5 = 30 ngày, stage 6 = 60 ngày.

Quy tắc thêm:

- Thẻ `Chưa thuộc` không được xuất hiện lại ngay lập tức; chen lại sau ít nhất 3 thẻ khác, hoặc chuyển sang phiên tiếp theo nếu hàng đợi không đủ.
- `mastered` nghĩa là đã trả lời đúng ở stage 6; không phải số lần từng nhìn thấy thẻ.
- Tất cả mốc thời gian lưu UTC; UI hiển thị theo timezone của người học.
- Một click chỉ tạo một review event. Request retry cần idempotency key để không nhảy hai stage.

## 9. Data model mục tiêu

Không tạo schema ở bước spec này. Khi triển khai database, tách content catalog và learner data như sau.

| Entity | Trường lõi | Mục đích |
|---|---|---|
| `vocabulary_cards` | `id`, word, is_phrase, senses, phonetic, CEFR, target_band, content_status, source_version | Bản ghi nội dung chuẩn hóa từ JSONL. |
| `vocabulary_decks` | `slug`, display_name_vi, description, publish_status, content_version | Danh mục topic. |
| `vocabulary_deck_cards` | `deck_slug`, `card_id`, position, is_primary | Membership deck, không nhân bản card. |
| `learner_card_states` | `learner_id`, `card_id`, state, stage, due_at, first_seen_at, last_reviewed_at, review_count | Trạng thái hiện tại, một hàng mỗi learner/card. |
| `learner_card_reviews` | `id`, learner_id, card_id, rating, reviewed_at, previous_state, next_due_at, idempotency_key | Lịch sử audit và analytics. |
| `guest_identities` | `guest_id`, created_at, migration_target_user_id | Phân biệt tiến độ khách với user đăng nhập. |

Ràng buộc database sau này: RLS theo `learner_id`; content chỉ đọc; review update transactionally state + event; không lưu nghĩa/âm thanh nhạy cảm của người học vì không có.

## 10. Requirements có thể nghiệm thu

| ID | Requirement | Tiêu chí nghiệm thu |
|---|---|---|
| VOC-01 | Chỉ ingest JSONL | Thêm file không phải `.jsonl` không làm thay đổi danh mục; JSONL lỗi chặn publish và báo file/dòng. |
| VOC-02 | Danh mục deck | Hiển thị đúng số deck publishable, count lấy từ content đã validate. |
| VOC-03 | Không trùng tiến độ | Một card nằm nhiều topic vẫn chỉ có một state ôn cho mỗi người học. |
| VOC-04 | Học/ôn được | Người học lật card, nghe audio khi khả dụng, chấm hai mức và xem card kế. |
| VOC-05 | Không chấm khi chưa xem đáp án | Hai nút đánh giá disabled trước lần lật đầu tiên. |
| VOC-06 | Lịch ôn đúng | Test fixture xác nhận toàn bộ chuyển stage và `due_at` ở mục 8. |
| VOC-07 | Lưu bền vững | Reload sau review thành công vẫn phản ánh state/due_at mới. |
| VOC-08 | Nội dung Việt an toàn | Không có `zh` xuất hiện trong UI mặc định; thiếu `vi` dùng đúng fallback đã công bố. |
| VOC-09 | Responsive/a11y | Luồng hoàn tất ở 360px, keyboard-only và reduced-motion; control audio/flip/rating có nhãn. |
| VOC-10 | Khả năng phục hồi | Audio hỏng hoặc deck trống không làm mất review đã lưu hay làm app trắng màn hình. |

## 11. Analytics đề xuất

Không gửi word, nghĩa, hoặc lịch sử card đầy đủ vào analytics bên thứ ba. Dùng card ID/category đã pseudonymize khi cần phân tích.

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
| Supabase Storage chưa provision/configured | Audio generated chưa delivery qua CDN | Engineering + project owner |
| 5.275 cards trong static bundle | Tải chậm nếu nhét toàn bộ JSONL vào browser | Engineering: ingest/index/paginate trước runtime |
| Guest-first nhưng cần database | Rủi ro mất tiến độ khi đổi thiết bị | Product: thời điểm mời tạo tài khoản/claim progress |
| Chất lượng topic/CEFR không đồng đều | Deck đề xuất sai mức | Content owner: review/publish status |

## 13. Câu hỏi mở

1. Có dịch tiếp `examples[].vi` và `collocations[].vi` sau khi QA xong `def_vi` không?
2. Cấp Supabase project URL và service-role key local để upload manifest MP3 vào bucket `vocabulary-audio`?
3. Người học khách giữ tiến độ bao lâu và lúc nào được mời tạo tài khoản để đồng bộ?
4. Deck nào được publish beta đầu tiên? Khuyến nghị: Environment, Education, Technology, General Academic.

## 14. Definition of Ready để code

- Product duyệt mục 2, 5 và lịch ở mục 8.
- Content owner audit mẫu bản dịch `def_vi`, chốt danh sách deck beta, `publish_status`.
- Engineering chốt pipeline JSONL -> catalog/index; không fetch 23 file thô vào first load.
- Áp dụng migration bucket Supabase, upload manifest MP3 và test CDN delivery; giữ feature flag off cho tới lúc probe pass.
- Design bổ sung states: card chưa lật, loading, audio error, save error, empty due, completed, offline.
