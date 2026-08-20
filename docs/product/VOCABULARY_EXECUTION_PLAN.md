# IELTS Cozy — Kế hoạch thực thi Vocabulary MVP

**Nguồn yêu cầu:** [Vocabulary feature spec](VOCABULARY_SPEC.md)  
**Trạng thái:** Ready for task breakdown sau khi Product/Content duyệt spec v0.2; chưa bắt đầu implement application  
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
| Backup 10.550 MP3 | **Chưa có.** `.gitignore` loại `.generated/audio/`, artifact chỉ tồn tại trên máy local |
| QA phát âm TTS | Chưa làm; 38 card đồng tự khác âm có rủi ro đọc sai |
| CI pipeline | **Chưa có.** Repo không có `.github/`, trong khi D-16/D-18 coi test/CI là merge gate |
| Consent/age gate (D-05) | Chưa có; cần trước khi bắn analytics |

## 2. Nguyên tắc triển khai

1. JSONL là content source đầu vào, không là API runtime. Import/normalize vào database hoặc index build-time.
2. Content catalog chỉ đọc; learner state và review events là data riêng theo learner.
3. Guest-first qua Supabase Anonymous Auth (D-12): cấp anonymous UUID ngay, dùng chính UUID đó làm `learner_id`. Đăng nhập sau chỉ link identity vào cùng UUID, không migrate hàng nào, không bảng `guest_identities` riêng.
4. Mỗi review lưu event và state trong một transaction; retry dùng idempotency key.
5. Chỉ hai mức rating trong MVP. Không thêm FSRS, four-grade rating hay AI.
6. Không phát audio nguồn ngoài nếu chưa qua license, CORS và availability review.
7. UI mobile-first 360px, semantic, keyboard-capable và tôn trọng `prefers-reduced-motion`.

## 3. Milestone và dependency

| Milestone | Mục tiêu | Dependency | Exit gate |
|---|---|---|---|
| M0 — Quyết định release | Chốt policy/content/audio | Không có | Scope không còn câu hỏi blocking |
| M0.5 — Nền tảng kỹ thuật | CI, backup artifact, consent gate | M0 | CI chạy validator trên mọi PR; MP3 đã có backup |
| M1 — Content platform | JSONL import được, content publishable | M0.5 | 5.275 card query được, không trùng ID |
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
| VOC-PLAN-04 | Quyết định audio | VOC-PLAN-01 | Google TTS là nguồn approved; apply bucket migration, upload CDN và chỉ bật `audio_enabled` sau delivery probe **và** QA phát âm (VOC-PLAN-08) pass. |
| VOC-PLAN-05 | Chốt guest/account policy | VOC-PLAN-01 | Xác nhận `learner_id` = Supabase Anonymous Auth UUID theo D-12; chốt retention, thời điểm mời tạo tài khoản, xử lý đổi thiết bị. Không thiết kế `guest_id` riêng. |
| VOC-PLAN-06 | Chốt phạm vi offline | VOC-PLAN-01 | Quyết định giữ hay hoãn D-14 cho release này; nếu hoãn thì ghi vào decision log và spec §7 nói rõ hành vi khóa đánh giá khi offline. |
| VOC-PLAN-07 | Chốt consent/age gate | VOC-PLAN-01 | D-05 được cụ thể hóa: ai phải consent, chặn analytics ở đâu, dữ liệu tối thiểu nào được thu. Không bắn event trước khi có quyết định này. |
| VOC-PLAN-08 | QA phát âm TTS | VOC-PLAN-04 | Nghe kiểm 38 card đồng tự khác âm + sample >=2% corpus; lập danh sách card đọc sai cần sinh lại bằng SSML `<phoneme>`. |

### M0.5 — Nền tảng kỹ thuật

Repo hiện chưa có `.github/`, nên mọi task nói "CI" ở dưới đều không có chỗ chạy. D-16 (tests là merge gate) và D-18 (CI gate production) yêu cầu phần này tồn tại trước M1.

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-INFRA-01 | Dựng CI tối thiểu | VOC-PLAN-01 | GitHub Actions chạy `npm run vocab:validate-content` trên mọi PR; job đỏ chặn merge. |
| VOC-INFRA-02 | Mở rộng validator | VOC-INFRA-01 | `validate-content.mjs` assert đúng 5.275 card / 7.309 `def_vi` (không chỉ in ra), và fail khi `zh` lọt vào payload learner-facing. |
| VOC-INFRA-03 | Backup artifact audio | VOC-PLAN-04 | 10.550 MP3 + `manifest.json` được backup ra storage bền **trước** khi upload Supabase; ghi lại vị trí và cách khôi phục. |
| VOC-INFRA-04 | Refresh token khi sinh audio | VOC-INFRA-03 | `generate-audio.mjs` lấy lại access token theo chu kỳ thay vì một lần; job dài hơn 1 giờ không chết vì token hết hạn. |
| VOC-INFRA-05 | Design states | VOC-PLAN-01 | Design giao đủ states DoR spec §14: chưa lật, loading, audio error, save error, empty due, completed, offline. |

### M1 — Content platform và database

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-DATA-01 | Viết schema migration content | VOC-PLAN-02 | Có `vocabulary_cards`, `vocabulary_decks`, `vocabulary_deck_cards`; PK/FK/index và `publish_status`. |
| VOC-DATA-02 | Viết schema migration learner | VOC-PLAN-05 | Có `learner_card_states`, `learner_card_reviews`; `learner_id` FK tới `auth.users` (anonymous UUID), unique `(learner_id, card_id)` và idempotency key unique. Không tạo `guest_identities`. |
| VOC-DATA-03 | Bật RLS và policy | VOC-DATA-01, VOC-DATA-02 | Content public/read-only theo publish status; policy learner dùng thẳng `auth.uid()`, learner chỉ đọc/ghi state của mình. |
| VOC-DATA-04 | Xây importer JSONL | VOC-DATA-01 | Đọc **chỉ** `*.jsonl`; validate UTF-8/one-object-per-line/ID/topic; upsert idempotent; report file + line khi lỗi. |
| VOC-DATA-05 | Normalize deck mapping | VOC-DATA-04 | `topic` là deck chính; `topics_all` không nhân bản learner state; display name Việt có mapping. |
| VOC-DATA-06 | Content quality gate CI | VOC-DATA-04, VOC-INFRA-02 | Gate của VOC-INFRA-02 chạy trên cả output importer, không chỉ file JSONL: 5.275 card, 7.309 `def_vi` non-empty, không duplicate ID, không lộ `zh` ở payload learner default. |
| VOC-DATA-07 | Seed beta content | VOC-DATA-03, VOC-DATA-04 | Beta decks query được; counts theo database khớp importer report. |

### M2 — Domain service và API

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-API-01 | Identity resolver guest/user | VOC-DATA-02 | Anonymous sign-in cấp UUID ngay lần vào đầu; request có learner identity an toàn; guest không thấy data guest khác; đăng nhập sau giữ nguyên UUID nên không cần bước migrate. |
| VOC-API-02 | Deck catalog endpoint | VOC-DATA-07 | Trả deck name, count publishable, due count, learner progress; không trả cả corpus. |
| VOC-API-03 | Review queue endpoint | VOC-API-01, VOC-DATA-07 | `due` xếp overdue -> due -> learning; `new` theo CEFR/order; limit server-side. |
| VOC-API-04 | SRS domain function | VOC-API-01 | Implement đúng bảng 8.1 (stage 0–6, interval 10m/1d/3d/7d/14d/30d/60d) và toàn bộ 16 ô bảng 8.2 spec, gồm việc đạt stage 6 đổi state sang `mastered`; UTC và timezone display. Pure function, không chạm DB. |
| VOC-API-05 | Submit review endpoint | VOC-API-03, VOC-API-04 | Một request transactionally tạo event + update state; idempotent; trả next due/state. |
| VOC-API-06 | Session/progress endpoint | VOC-API-05 | Tổng reviewed/learning/mastered, per-deck progress, completed session summary. |
| VOC-API-07 | Audio provider boundary | VOC-PLAN-04 | Endpoint/payload chỉ trả audio URL khi feature flag + source approved; audio failure không chặn review. |

### M3 — Web application và UX

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-WEB-01 | Foundation route `/vocabulary` | VOC-API-02 | Route dùng app architecture, không phụ thuộc static mockup state; nav active đúng URL. |
| VOC-WEB-02 | Deck catalog screen | VOC-WEB-01 | CTA Ôn ngay, due count, progress, deck list, filter/empty/loading/error states. |
| VOC-WEB-03 | Review route/state | VOC-API-03 | Route support `deck`, `mode`, `limit`; back/exit không làm mất review đã save. Hàng đợi trong phiên theo spec §8.3: chèn lại thẻ `Chưa thuộc` sau >= 3 thẻ, tối đa 2 lần, **không** đọc `due_at`. |
| VOC-WEB-04 | Flashcard component | VOC-WEB-03 | Front/back, phonetic, sense, English example fallback, reduced-motion, keyboard flip. Card thiếu phonetic (20 card `is_phrase`) ẩn vùng phonetic, không render ngoặc rỗng. |
| VOC-WEB-05 | Rating interaction | VOC-WEB-04, VOC-API-05 | Nút disabled trước flip; optimistic state chỉ commit sau response; retry/error state rõ. |
| VOC-WEB-06 | Audio interaction | VOC-WEB-04, VOC-API-07 | Không autoplay; accessible label; unavailable/error fallback. |
| VOC-WEB-07 | Session completion | VOC-WEB-05, VOC-API-06 | Summary, Ôn tiếp/Chọn bộ khác/Về từ vựng; không streak shaming. |
| VOC-WEB-08 | Responsive/a11y polish | VOC-WEB-02 đến VOC-WEB-07 | Pass 360px, touch target >=44px, keyboard-only, focus, contrast, reduced motion. |

### M4 — Analytics, test và beta

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-QA-01 | Unit test SRS | VOC-API-04 | Cover đủ 16 ô bảng 8.2, interval bảng 8.1, UTC boundaries, repeated `Again`, chuyển stage 6 -> `mastered`, và `review` stage 1 + `Chưa thuộc` -> `learning` stage 0. |
| VOC-QA-02 | Integration test review write | VOC-API-05 | Verify transaction, idempotency, RLS isolation, reload persistence. |
| VOC-QA-03 | Importer regression test | VOC-DATA-04 | Reject malformed line/duplicate ID; ensure only JSONL consumed. |
| VOC-QA-04 | E2E core journeys | VOC-WEB-07 | Due review, new deck, no due cards, save retry, audio failure, guest refresh, thẻ `Chưa thuộc` quay lại trong phiên, và hành vi offline theo quyết định VOC-PLAN-06. |
| VOC-QA-05 | Instrument analytics | VOC-WEB-02 đến VOC-WEB-07, VOC-PLAN-07 | Emit events section 11 spec; không event nào rời thiết bị trước khi có consent; không gửi `learner_id`/`auth.uid()` sang analytics bên thứ ba; không lộ word/nghĩa. |
| VOC-QA-06 | Performance check | VOC-DATA-07, VOC-WEB-08 | Không tải toàn bộ 5.275 card lúc first load; core interaction <3s mobile baseline. |
| VOC-QA-08 | Viết rollback/backup runbook | VOC-DATA-07, VOC-INFRA-03 | Có văn bản: cách rollback migration, khôi phục content version trước, khôi phục artifact audio. Đây là input của VOC-QA-07, không phải sản phẩm phụ. |
| VOC-QA-07 | Beta acceptance review | VOC-QA-01 đến VOC-QA-06, VOC-QA-08, VOC-PLAN-03, VOC-PLAN-08 | VOC-01…VOC-10 (gồm VOC-06b, VOC-08b) pass; issue list triaged; rollback/backup verified theo runbook VOC-QA-08. |

## 5. Thứ tự chạy đề xuất

```text
VOC-PLAN-01..08
        ↓
VOC-INFRA-01..05
        ↓
VOC-DATA-01..07
        ↓
VOC-API-01..07
        ↓
VOC-WEB-01..08
        ↓
VOC-QA-01..08 → Beta
```

### Lát cắt dọc trước khi mở rộng

Chuỗi M1 -> M4 tuyến tính nghĩa là không có gì chạy được cho tới gần cuối. Ngay sau `VOC-DATA-04`, chạy một lát cắt dọc mỏng trước khi làm nốt backlog:

> 1 deck (Environment) -> 20 card -> `VOC-API-03` + `VOC-API-04` + `VOC-API-05` bản tối giản -> một màn review chạy thật.

Lát cắt này phát hiện sai lầm ở hợp đồng API và ở bảng SRS sớm hơn nhiều so với việc đợi hết M3. Nếu nó chạy được end-to-end thì phần còn lại chủ yếu là nhân rộng.

Có thể chạy song song sau M0:

- `VOC-PLAN-03` content QA và `VOC-PLAN-08` QA phát âm song song với schema/importer.
- `VOC-INFRA-01..02` song song với `VOC-PLAN-*`; CI không phụ thuộc quyết định sản phẩm nào.
- `VOC-DATA-01..03` song song với `VOC-INFRA-05` design states.
- `VOC-QA-01` bắt đầu ngay khi `VOC-API-04` có pure domain function. Task này và `VOC-API-04` đụng cùng vùng file, nên phải cùng một người hoặc nối tiếp, không giao cho hai agent song song.
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

- CI xanh và chặn được merge khi content gate đỏ.
- Beta deck content đã publish và quality-gated.
- Người học guest hoặc user hoàn thành được một session 10–20 thẻ.
- Reload không mất review đã lưu; due date/stage đúng policy spec.
- Không có Chinese source text trong Vietnamese UI mặc định.
- Audio disabled an toàn nếu chưa được duyệt; audio lỗi không crash session.
- E2E core paths, SRS unit tests, importer regression tests pass.
- Dashboard/review usable ở 360px và keyboard.
- Analytics chỉ chứa event metadata cho phép, và bị chặn hoàn toàn khi chưa có consent.
- QA phát âm pass; không card đồng tự khác âm nào đọc sai còn sót ở deck beta.
- Artifact audio đã backup và khôi phục thử được.
- Docs, migration, importer report và rollback runbook cùng release.

## 8. Không làm trong kế hoạch này

- Dịch examples/collocations sang Việt.
- AI scoring, Speaking, social, payments, learner-created decks.
- Thay thế SRS hai mức bằng FSRS/Anki rating model.
- Expose raw JSONL hoặc Google Translation credential ở browser/runtime.
- Bảng `guest_identities` riêng: đã bỏ, dùng Supabase Anonymous Auth UUID theo D-12.

Hai mục dưới đây **chưa** quyết định, không được mặc định là ngoài phạm vi cho tới khi `VOC-PLAN-06`/`VOC-PLAN-07` chốt:

- Offline queue (D-14).
- Consent/age gate (D-05) làm trong release này hay ở luồng onboarding chung.
