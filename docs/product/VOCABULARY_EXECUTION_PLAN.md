# IELTS Cozy — Kế hoạch thực thi Vocabulary MVP

**Nguồn yêu cầu:** [Vocabulary feature spec](VOCABULARY_SPEC.md)  
**Trạng thái:** Ready for task breakdown; chưa bắt đầu implement application  
**Phạm vi release:** Vocabulary MVP cho người học khách và người dùng đăng nhập; không AI scoring, không Speaking, không dịch ví dụ/collocation ở release này.

## 1. Mục tiêu delivery

Phát hành luồng `/vocabulary` cho phép người học xem deck theo topic, ôn thẻ đến hạn hoặc học từ mới, lật flashcard, nghe audio khi được bật và chọn `Chưa thuộc` / `Thuộc rồi`. Mỗi thao tác phải lưu bền vững, sinh lịch ôn đúng và phản ánh tiến độ.

### Baseline đã có

| Hạng mục | Trạng thái |
|---|---|
| 23 JSONL / 5.275 card | Có |
| `senses[].def_vi` | Có đủ 7.309 nghĩa; cần QA nội dung song ngữ trước production |
| `examples[].vi`, `collocations[].vi` | Chưa có; UI dùng English fallback theo spec |
| Mockup `/vocabulary` | Có trong `index.html`; chỉ là prototype visual |
| Database, auth, API, ingestion runtime | Chưa implement |
| Audio source / artifact | Google TTS đã sinh 10.550 MP3 UK/US; Supabase CDN upload chờ project credential |

## 2. Nguyên tắc triển khai

1. JSONL là content source đầu vào, không là API runtime. Import/normalize vào database hoặc index build-time.
2. Content catalog chỉ đọc; learner state và review events là data riêng theo learner.
3. Guest-first: cấp `guest_id` ngay, claim/migrate tiến độ khi đăng nhập sau.
4. Mỗi review lưu event và state trong một transaction; retry dùng idempotency key.
5. Chỉ hai mức rating trong MVP. Không thêm FSRS, four-grade rating hay AI.
6. Không phát audio nguồn ngoài nếu chưa qua license, CORS và availability review.
7. UI mobile-first 360px, semantic, keyboard-capable và tôn trọng `prefers-reduced-motion`.

## 3. Milestone và dependency

| Milestone | Mục tiêu | Dependency | Exit gate |
|---|---|---|---|
| M0 — Quyết định release | Chốt policy/content/audio | Không có | Scope không còn câu hỏi blocking |
| M1 — Content platform | JSONL import được, content publishable | M0 | 5.275 card query được, không trùng ID |
| M2 — Learner state API | Guest/auth, queue, review SRS | M1 | Review survive reload, đúng due date |
| M3 — Vocabulary UI | Catalog + review runner responsive | M2 | Hoàn thành core user journey ở 360px/desktop |
| M4 — QA và beta | Test, content QA, analytics, release safety | M3 | VOC-01 đến VOC-10 pass |

## 4. Task backlog thực thi

### M0 — Quyết định release

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-PLAN-01 | Duyệt scope MVP | — | Xác nhận chỉ Vocabulary; giữ 2 ratings; examples/collocations English fallback. |
| VOC-PLAN-02 | Chốt beta deck | VOC-PLAN-01 | Publish list: Environment, Education, Technology, General Academic hoặc list thay thế; `publish_status` có owner. |
| VOC-PLAN-03 | Audit bản dịch `def_vi` | VOC-PLAN-01 | Review 100% nghĩa nguồn Trung, sample >=10% nghĩa nguồn Anh; tạo issue cho bản dịch sai/awkward. |
| VOC-PLAN-04 | Quyết định audio | VOC-PLAN-01 | Google TTS là nguồn approved; apply bucket migration, upload CDN và chỉ bật `audio_enabled` sau delivery probe. |
| VOC-PLAN-05 | Chốt guest/account policy | VOC-PLAN-01 | Quy tắc tạo `guest_id`, retention, lúc claim tiến độ và xử lý conflict được viết thành decision. |

### M1 — Content platform và database

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-DATA-01 | Viết schema migration content | VOC-PLAN-02 | Có `vocabulary_cards`, `vocabulary_decks`, `vocabulary_deck_cards`; PK/FK/index và `publish_status`. |
| VOC-DATA-02 | Viết schema migration learner | VOC-PLAN-05 | Có `learner_card_states`, `learner_card_reviews`, `guest_identities`; unique `(learner_id, card_id)` và idempotency key unique. |
| VOC-DATA-03 | Bật RLS và policy | VOC-DATA-01, VOC-DATA-02 | Content public/read-only theo publish status; learner chỉ đọc/ghi state của mình. |
| VOC-DATA-04 | Xây importer JSONL | VOC-DATA-01 | Đọc **chỉ** `*.jsonl`; validate UTF-8/one-object-per-line/ID/topic; upsert idempotent; report file + line khi lỗi. |
| VOC-DATA-05 | Normalize deck mapping | VOC-DATA-04 | `topic` là deck chính; `topics_all` không nhân bản learner state; display name Việt có mapping. |
| VOC-DATA-06 | Content quality gate CI | VOC-DATA-04 | Check 5.275 card, 7.309 `def_vi` non-empty, không duplicate ID, không lộ `zh` ở payload learner default. |
| VOC-DATA-07 | Seed beta content | VOC-DATA-03, VOC-DATA-04 | Beta decks query được; counts theo database khớp importer report. |

### M2 — Domain service và API

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-API-01 | Identity resolver guest/user | VOC-DATA-02 | Request có learner identity an toàn; guest không thấy data guest khác. |
| VOC-API-02 | Deck catalog endpoint | VOC-DATA-07 | Trả deck name, count publishable, due count, learner progress; không trả cả corpus. |
| VOC-API-03 | Review queue endpoint | VOC-API-01, VOC-DATA-07 | `due` xếp overdue -> due -> learning; `new` theo CEFR/order; limit server-side. |
| VOC-API-04 | SRS domain function | VOC-API-01 | Implement đúng bảng stage 0–6, interval 10m/1d/3d/7d/14d/30d/60d, UTC và timezone display. |
| VOC-API-05 | Submit review endpoint | VOC-API-03, VOC-API-04 | Một request transactionally tạo event + update state; idempotent; trả next due/state. |
| VOC-API-06 | Session/progress endpoint | VOC-API-05 | Tổng reviewed/learning/mastered, per-deck progress, completed session summary. |
| VOC-API-07 | Audio provider boundary | VOC-PLAN-04 | Endpoint/payload chỉ trả audio URL khi feature flag + source approved; audio failure không chặn review. |

### M3 — Web application và UX

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-WEB-01 | Foundation route `/vocabulary` | VOC-API-02 | Route dùng app architecture, không phụ thuộc static mockup state; nav active đúng URL. |
| VOC-WEB-02 | Deck catalog screen | VOC-WEB-01 | CTA Ôn ngay, due count, progress, deck list, filter/empty/loading/error states. |
| VOC-WEB-03 | Review route/state | VOC-API-03 | Route support `deck`, `mode`, `limit`; back/exit không làm mất review đã save. |
| VOC-WEB-04 | Flashcard component | VOC-WEB-03 | Front/back, phonetic, sense, English example fallback, reduced-motion, keyboard flip. |
| VOC-WEB-05 | Rating interaction | VOC-WEB-04, VOC-API-05 | Nút disabled trước flip; optimistic state chỉ commit sau response; retry/error state rõ. |
| VOC-WEB-06 | Audio interaction | VOC-WEB-04, VOC-API-07 | Không autoplay; accessible label; unavailable/error fallback. |
| VOC-WEB-07 | Session completion | VOC-WEB-05, VOC-API-06 | Summary, Ôn tiếp/Chọn bộ khác/Về từ vựng; không streak shaming. |
| VOC-WEB-08 | Responsive/a11y polish | VOC-WEB-02 đến VOC-WEB-07 | Pass 360px, touch target >=44px, keyboard-only, focus, contrast, reduced motion. |

### M4 — Analytics, test và beta

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-QA-01 | Unit test SRS | VOC-API-04 | Cover all rating/state transitions, UTC boundaries, repeated `Again`, mastered reset. |
| VOC-QA-02 | Integration test review write | VOC-API-05 | Verify transaction, idempotency, RLS isolation, reload persistence. |
| VOC-QA-03 | Importer regression test | VOC-DATA-04 | Reject malformed line/duplicate ID; ensure only JSONL consumed. |
| VOC-QA-04 | E2E core journeys | VOC-WEB-07 | Due review, new deck, no due cards, save retry, audio failure, guest refresh. |
| VOC-QA-05 | Instrument analytics | VOC-WEB-02 đến VOC-WEB-07 | Emit events section 11 spec; no word/meaning content leaked to third-party analytics. |
| VOC-QA-06 | Performance check | VOC-DATA-07, VOC-WEB-08 | Không tải toàn bộ 5.275 card lúc first load; core interaction <3s mobile baseline. |
| VOC-QA-07 | Beta acceptance review | VOC-QA-01 đến VOC-QA-06, VOC-PLAN-03 | VOC-01…VOC-10 pass; issue list triaged; rollback/backup verified. |

## 5. Thứ tự chạy đề xuất

```text
VOC-PLAN-01..05
        ↓
VOC-DATA-01..07
        ↓
VOC-API-01..07
        ↓
VOC-WEB-01..08
        ↓
VOC-QA-01..07 → Beta
```

Có thể chạy song song sau M0:

- `VOC-PLAN-03` content QA song song với schema/importer.
- `VOC-DATA-01..03` song song với design state cho loading/error/empty.
- `VOC-QA-01` bắt đầu ngay khi `VOC-API-04` có pure domain function.
- `VOC-WEB-02` có thể dùng fixture contract trong khi API thật đang làm; không freeze interface trước `VOC-API-02` review.

## 6. Contract cần chốt trước từng handoff

| Handoff | Input | Output bắt buộc |
|---|---|---|
| Product/content -> engineering | Publish deck list, translation QA decisions, audio decision | Content acceptance manifest và change log. |
| Data -> API | Migrations + importer report | Stable card/deck schema, fixture data, RLS verification. |
| API -> web | Endpoint contract + error model | OpenAPI/typed contract, queue/review examples, idempotency behavior. |
| Web -> QA | Staging build | Test accounts/guest scenarios, seeded due cards, analytics test sink. |
| QA -> beta | Evidence VOC-01…VOC-10 | Signed acceptance, known issues, rollback steps. |

## 7. Definition of Done cho MVP

- Beta deck content đã publish và quality-gated.
- Người học guest hoặc user hoàn thành được một session 10–20 thẻ.
- Reload không mất review đã lưu; due date/stage đúng policy spec.
- Không có Chinese source text trong Vietnamese UI mặc định.
- Audio disabled an toàn nếu chưa được duyệt; audio lỗi không crash session.
- E2E core paths, SRS unit tests, importer regression tests pass.
- Dashboard/review usable ở 360px và keyboard.
- Analytics chỉ chứa event metadata cho phép.
- Docs, migration, importer report và rollback instructions cùng release.

## 8. Không làm trong kế hoạch này

- Dịch examples/collocations sang Việt.
- AI scoring, Speaking, social, payments, learner-created decks.
- Thay thế SRS hai mức bằng FSRS/Anki rating model.
- Expose raw JSONL hoặc Google Translation credential ở browser/runtime.
