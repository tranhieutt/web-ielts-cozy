# IELTS Cozy — Kế hoạch thực thi Vocabulary MVP

**Nguồn yêu cầu:** [Vocabulary feature spec](VOCABULARY_SPEC.md)  
**Trạng thái:** Đã có content CI, SRS pure domain, migration/RLS và importer catalog/deck ở `draft`; application/API runtime, seed beta và publish chưa bắt đầu. Product/Content vẫn cần chốt beta deck, consent và QA.  
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
| Database foundation | Vocabulary catalog/learner schema, indexes, grants và RLS đã migrate + pgTAP verify. Catalog/deck importer idempotent đã có nhưng chưa `--apply`; Auth resolver, API và seed/publish beta chưa implement. |
| Audio source / artifact | Google TTS đã sinh và upload 10.550 MP3 UK/US; Supabase CDN delivery probe UK/US pass, chờ QA phát âm trước runtime enable |
| Backup 10.550 MP3 | **Chưa có.** `.gitignore` loại `.generated/audio/`, artifact chỉ tồn tại trên máy local |
| QA phát âm TTS | Chưa làm; 38 card đồng tự khác âm có rủi ro đọc sai |
| CI pipeline | Có workflow `vocabulary-content`: validate nguồn, build/validate catalog canonical và chạy test. GitHub admin còn phải mark check này required trong branch protection. |
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
| M1 — Content platform | JSONL import được, content publishable | M0.5 | 5.275 card query được trong dev/staging (`draft`), không trùng ID; publish beta tách sang VOC-DATA-07b |
| M2 — Learner state API | Guest/auth, queue, review SRS | M1 | Review survive reload, đúng due date |
| M3 — Vocabulary UI | Catalog + review runner responsive | M2 | Hoàn thành core user journey ở 360px/desktop |
| M4 — QA và beta | Test, content QA, analytics, release safety | M3 | VOC-01 đến VOC-10 pass |

## 4. Task backlog thực thi

> **Quy ước:** dòng ~~gạch ngang~~ là task đã xong và đã verify (test/build/CI xanh, hoặc migration đã apply + pgTAP pass). Dòng thường là việc còn lại. Task xong nhưng chỉ chạy trên fixture được ghi rõ giới hạn trong cột Definition of done — không coi là đã đạt yêu cầu bền vững của MVP.

Tình trạng hiện tại: **29/52 task xong**. Toàn bộ lát cắt dọc (app, API, UI, a11y) đã chạy trên fixture. Việc còn lại: quyết định Product (`VOC-PLAN-02/03/05/07/08`), hạ tầng cần credential hoặc quyền admin (`VOC-DATA-07a/07b`, `VOC-INFRA-03/06/07`), adapter Supabase (`VOC-API-01/02s/03s/05s`), và QA (`VOC-QA-02/04/05/06/07/08`).


### M0 — Quyết định release

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-PLAN-01 | Duyệt scope MVP | — | Xác nhận chỉ Vocabulary; giữ 2 ratings; examples/collocations English fallback. |
| VOC-PLAN-02 | Chốt beta deck | VOC-PLAN-01 | Publish list: Environment, Education, Technology, General Academic hoặc list thay thế; `publish_status` có owner. |
| VOC-PLAN-03 | Audit bản dịch `def_vi` | VOC-PLAN-01 | Review 100% nghĩa nguồn Trung, sample >=10% nghĩa nguồn Anh; tạo issue cho bản dịch sai/awkward. |
| VOC-PLAN-04 | Quyết định audio | VOC-PLAN-01 | Google TTS là nguồn approved; apply bucket migration, upload CDN và chỉ bật `audio_enabled` sau delivery probe **và** QA phát âm (VOC-PLAN-08) pass. |
| VOC-PLAN-05 | Chốt guest/account policy | VOC-PLAN-01 | Xác nhận `learner_id` = Supabase Anonymous Auth UUID theo D-12; chốt retention, thời điểm mời tạo tài khoản, xử lý đổi thiết bị. Không thiết kế `guest_id` riêng. |
| ~~VOC-PLAN-06~~ | ~~Hoãn offline review queue~~ | VOC-PLAN-01 | Đã chốt theo ADR-002: không có IndexedDB queue/sync trong Vocabulary MVP; offline khóa đánh giá, giữ card hiện tại và không báo đã lưu. |
| VOC-PLAN-07 | Chốt consent/age gate | VOC-PLAN-01 | D-05 được cụ thể hóa: ai phải consent, chặn analytics ở đâu, dữ liệu tối thiểu nào được thu. Không bắn event trước khi có quyết định này. |
| VOC-PLAN-08 | QA phát âm TTS | VOC-PLAN-04 | Nghe kiểm 38 card đồng tự khác âm + sample >=2% corpus; lập danh sách card đọc sai cần sinh lại bằng SSML `<phoneme>`. |

### M0.5 — Nền tảng kỹ thuật

Workflow `.github/workflows/vocabulary-content.yml` đã chạy validator/canonical gate/test trên pull request và trên push `main`. Hai việc trước đây chỉ nằm trong prose mà không có owner nay là task có ID: bật Anonymous Auth theo D-12 (`VOC-INFRA-06`) và mark branch protection theo D-16/D-18 (`VOC-INFRA-07`).

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| ~~VOC-INFRA-01~~ | ~~Dựng CI tối thiểu~~ | VOC-PLAN-01 | **Implemented:** GitHub Actions chạy `npm run vocab:validate-content`, build/validate catalog canonical và contract tests trên mọi PR Vocabulary. Admin phải mark `vocabulary-content` required để job đỏ chặn merge. |
| ~~VOC-INFRA-02~~ | ~~Mở rộng validator~~ | VOC-INFRA-01 | **Implemented:** `validate-content.mjs` assert đúng 23 file / 5.275 card / 7.309 `def_vi`, fail khi `zh`/Youdao lọt vào payload learner-facing. |
| VOC-INFRA-03 | Backup artifact audio | VOC-PLAN-04 | 10.550 MP3 + `manifest.json` được backup ra storage bền **trước** khi upload Supabase; ghi lại vị trí và cách khôi phục. |
| ~~VOC-INFRA-04~~ | ~~Refresh token khi sinh audio~~ | VOC-INFRA-03 | **Implemented:** `generate-audio.mjs` refresh trước expiry window và retry một HTTP 401 với token mới; giữ checkpoint/resume contract. |
| VOC-INFRA-05 | Design states | VOC-PLAN-01 | Design giao đủ states DoR spec §14: chưa lật, loading, audio error, save error, empty due, completed, offline-disabled. |
| VOC-INFRA-06 | Bật Supabase Anonymous Auth | VOC-PLAN-05 | `supabase/config.toml` hiện đặt `enable_anonymous_sign_ins = false`, **trái D-12**. DoD: bật flag ở local/preview/production theo D-17; xác nhận `auth.rate_limit.anonymous_users` (mặc định 30/giờ/IP) đủ và có chủ đích; xác định `enable_manual_linking` cần bật hay không cho luồng link identity OAuth sau đăng nhập; ghi retention của anonymous user vào ADR. Không bật production trước khi `VOC-PLAN-05` chốt retention/thời điểm mời tạo tài khoản. |
| VOC-INFRA-07 | Mark CI là merge gate | VOC-INFRA-01 | GitHub branch protection trên `main` mark check `vocabulary-content` (và `vocabulary-database`) là required; verify bằng một PR cố ý làm đỏ gate và xác nhận không merge được. Không có bước này thì D-16/D-18 chỉ tồn tại trên giấy. |
| ~~VOC-INFRA-08~~ | ~~Bootstrap application framework~~ | VOC-PLAN-01 | **Implemented:** npm workspace `apps/web` chạy Next.js App Router theo D-10; `npm run web:dev`/`web:build`, typecheck sạch, CI build + typecheck app. Mockup tĩnh ở root và `vercel.json` **không đổi** — app này build/deploy riêng tới khi lát cắt dọc thay được mockup. |

### M1 — Content platform và database

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| ~~VOC-DATA-01~~ | ~~Viết schema migration content~~ | VOC-PLAN-02 | **Implemented:** `vocabulary_cards`, `vocabulary_decks`, `vocabulary_deck_cards`; PK/FK/index và `publish_status`. Chưa seed/publish deck khi Product chưa chốt beta list. |
| ~~VOC-DATA-02~~ | ~~Viết schema migration learner~~ | VOC-PLAN-05 | **Implemented:** `learner_card_states`, `learner_card_reviews`; `learner_id` FK tới `auth.users`, unique `(learner_id, card_id)` và `(learner_id, idempotency_key)`. Không có `guest_identities`. |
| ~~VOC-DATA-03~~ | ~~Bật RLS và policy~~ | VOC-DATA-01, VOC-DATA-02 | **Implemented and remote-verified:** content read-only theo publish status; policy learner dùng `auth.uid()`, grants tối thiểu, learner chỉ đọc/ghi data của mình. |
| ~~VOC-DATA-04~~ | ~~Xây importer JSONL~~ | VOC-DATA-01 | **Implemented:** importer nhận catalog canonical `*.jsonl`, validate UTF-8/one-object-per-line/ID/topic/`def_vi`, upsert idempotent `vocabulary_cards` ở `draft`, báo file + line khi lỗi. |
| ~~VOC-DATA-05~~ | ~~Normalize deck mapping~~ | VOC-DATA-04 | **Implemented:** `topic` là deck chính; `topics_all` tạo membership không nhân bản learner state; 23 display name Việt; deck/card dùng cùng catalog SHA content version. |
| ~~VOC-DATA-06~~ | ~~Content quality gate CI~~ | VOC-DATA-04, VOC-INFRA-02 | **Implemented:** CI validate source và catalog canonical output: 5.275 card, 7.309 `def_vi` non-empty, không duplicate ID, không lộ `zh`/Youdao ở payload learner. |
| VOC-DATA-07a | Seed dev/staging content | VOC-DATA-03, VOC-DATA-04 | **Không chờ Product.** `--apply` toàn bộ catalog vào môi trường dev/staging, toàn bộ deck giữ `publish_status = 'draft'`; deck Environment được đánh dấu là deck lát cắt dọc. Đủ để API/UI query thật; không có gì learner-facing được publish ở bước này. |
| VOC-DATA-07b | Publish beta content | VOC-DATA-07a, VOC-PLAN-02 | Beta decks chuyển `published` theo list Product chốt; counts theo database khớp importer report; production chỉ nhận bước này. |

### Vị trí thực thi hiện tại — 2026-08-20

- Đã xong kỹ thuật: `VOC-DATA-04`, `VOC-DATA-05`, `VOC-DATA-06`, `VOC-QA-03`; dry-run catalog là 5.275 card, deck mapping là 23 deck / 8.271 membership.
- Chưa chạy `--apply`, seed hoặc publish. `VOC-DATA-07a` (seed dev/staging, toàn bộ `draft`) **không** chờ Product và nên chạy ngay để mở lát cắt dọc; chỉ `VOC-DATA-07b` (publish beta) mới chờ `VOC-PLAN-02`.
- Lát cắt dọc đã chạy end-to-end trên fixture: `apps/web` (Next.js) + 3 endpoint + `/vocabulary`, verify bằng `next start` thật (catalog -> queue -> review -> replay idempotent -> catalog phản ánh progress). Learner state đang ở bộ nhớ tiến trình nên **chưa** đạt VOC-07; đổi sang Supabase là thay `repository.fixture.ts`, service không đổi.
- Không mở `VOC-API-01` trong task này: repo hiện chỉ có static mockup, chưa có Next.js BFF/Supabase client; `supabase/config.toml` đang đặt `enable_anonymous_sign_ins = false` dù D-12 yêu cầu Anonymous Auth — việc này nay do `VOC-INFRA-06` chịu trách nhiệm và vẫn chờ `VOC-PLAN-05` chốt retention/policy guest trước khi bật production. Bootstrap app framework vẫn chưa có task ID.

### M2 — Domain service và API

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-API-01 | Identity resolver guest/user | VOC-DATA-02, VOC-INFRA-06 | Anonymous sign-in cấp UUID ngay lần vào đầu; request có learner identity an toàn; guest không thấy data guest khác; đăng nhập sau giữ nguyên UUID nên không cần bước migrate. |
| ~~VOC-API-02~~ | ~~Deck catalog endpoint (fixture)~~ | VOC-INFRA-08 | **Implemented:** `GET /api/vocabulary/decks` trả summary (tên Việt, count publishable, due count, progress), không nhúng card. Đổi sang Supabase = thay adapter, không đổi service. |
| VOC-API-02s | Deck catalog trên Supabase | VOC-DATA-07a | Trả deck name, count publishable, due count, learner progress; không trả cả corpus. |
| ~~VOC-API-03~~ | ~~Review queue endpoint (fixture)~~ | VOC-INFRA-08, VOC-API-04 | **Implemented:** `GET /api/vocabulary/queue?deck=&mode=&limit=`; `due` xếp overdue -> due, `new` theo CEFR -> order -> id; limit cap server-side 1–50. |
| VOC-API-03s | Queue trên Supabase | VOC-API-01, VOC-DATA-07a | `due` xếp overdue -> due -> learning; `new` theo CEFR/order; limit server-side. |
| ~~VOC-API-04~~ | ~~SRS domain function~~ | VOC-API-01 | **Implemented early:** pure function đúng bảng 8.1 (stage 0–6, interval 10m/1d/3d/7d/14d/30d/60d) và 16 ô bảng 8.2; stage 6 đổi `mastered`, due time UTC. Không chạm DB. |
| ~~VOC-API-04b~~ | ~~Session queue domain function~~ | VOC-PLAN-01 | **Implemented early:** pure module `apps/web/src/features/vocabulary/srs/session-queue.mjs` theo spec §8.3 — chèn lại thẻ `again` sau đúng 3 thẻ chưa chấm, bỏ chèn khi tail < 3, tối đa 2 lần/thẻ/phiên, không đọc `due_at`, không chạm DB. |
| ~~VOC-API-05~~ | ~~Submit review endpoint (fixture)~~ | VOC-API-03, VOC-API-04 | **Implemented:** `POST /api/vocabulary/reviews`; replay `idempotencyKey` trả lại kết quả đầu tiên, không nhảy stage. **Chưa transactional và chưa bền** — cần adapter Supabase. |
| VOC-API-05s | Review write transactional/bền | VOC-API-03, VOC-API-04 | Một request transactionally tạo event + update state; idempotent; trả next due/state. |
| ~~VOC-API-06~~ | ~~Session/progress endpoint~~ | VOC-API-05 | **Implemented:** `GET /api/vocabulary/progress` trả reviewedCount/learning/mastered/due/scheduled + per-deck. `reviewedCount` đếm thẻ **đã chấm**, không phải đã xem (spec §6.1). Counter trong phiên thuộc session runner, không thuộc endpoint này. |
| ~~VOC-API-07~~ | ~~Audio provider boundary~~ | VOC-PLAN-04 | **Implemented (ADR-003):** hai cổng độc lập `VOCABULARY_AUDIO_ENABLED=true` **và** `VOCABULARY_AUDIO_BASE_URL`; mặc định off, cấu hình nửa vời không lọt URL, chỉ chấp nhận object path Google TTS `v1/{accent}/{id}.mp3`. Gate đóng thì payload **bỏ hẳn** key `audio`, không trả null. |

### M3 — Web application và UX

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| ~~VOC-WEB-01~~ | ~~Foundation route `/vocabulary`~~ | VOC-API-02, VOC-INFRA-08 | **Implemented:** route Next.js App Router, không phụ thuộc state của mockup tĩnh. Nav active theo URL để lại cho shell chung. |
| ~~VOC-WEB-02~~ | ~~Deck catalog screen~~ | VOC-WEB-01 | **Implemented:** CTA (đổi sang “Học từ mới” khi không có thẻ đến hạn), due count, 4 chip tiến độ, deck list + progress bar, filter “chỉ bộ đến hạn”, loading/error/empty states. CSS chỉ dùng `var(--token)` sinh từ `design-tokens.json`. Verify ở 360px: không tràn ngang, mọi target >= 44px. |
| ~~VOC-WEB-03~~ | ~~Review route/state~~ | VOC-API-03, VOC-API-04b | **Implemented:** route nhận `deck`/`mode`/`limit` (limit cap 1–50), điểm phiên không nằm trong URL. Hàng đợi trong phiên dùng `session-queue.mjs`, verify trên browser thật: thẻ `Chưa thuộc` quay lại sau đúng 3 thẻ khác (hide -> air, branch, form -> hide). | Route support `deck`, `mode`, `limit`; back/exit không làm mất review đã save. Hàng đợi trong phiên theo spec §8.3: chèn lại thẻ `Chưa thuộc` sau >= 3 thẻ, tối đa 2 lần, **không** đọc `due_at`. |
| ~~VOC-WEB-04~~ | ~~Flashcard component~~ | VOC-WEB-03 | **Implemented:** cả thẻ là một `button` nên tap/click/Enter/Space đều lật; tối đa 2 sense, `def_en` chỉ bổ trợ, example/collocation English fallback; thiếu phonetic thì không render vùng phonetic (VOC-08b); reduced-motion xử lý ở `globals.css`. Audio để cho VOC-WEB-06. | Front/back, phonetic, sense, English example fallback, reduced-motion, keyboard flip. Card thiếu phonetic (20 card `is_phrase`) ẩn vùng phonetic, không render ngoặc rỗng. |
| ~~VOC-WEB-05~~ | ~~Rating interaction~~ | VOC-WEB-04, VOC-API-05 | **Implemented:** hai nút disabled trước lần lật đầu; **không** optimistic — chỉ sang thẻ sau khi server xác nhận. Verify: chặn `/reviews` -> giữ nguyên thẻ, không tăng vị trí, hiện thông báo cần kết nối (ADR-002); có mạng lại thì chấm tiếp bình thường. | Nút disabled trước flip; optimistic state chỉ commit sau response; retry/error state rõ. |
| ~~VOC-WEB-06~~ | ~~Audio interaction~~ | VOC-WEB-04, VOC-API-07 | **Implemented:** không autoplay; nhãn “Nghe phát âm Anh-Anh/Anh-Mỹ của {word}”; target 44x44; gate đóng hiện “Phát âm chưa khả dụng”; lỗi phát hiện “Chưa phát được audio” và phiên ôn vẫn chạy. |
| ~~VOC-WEB-07~~ | ~~Session completion~~ | VOC-WEB-05, VOC-API-06 | **Implemented:** đã ôn / thuộc rồi / sẽ quay lại sớm / còn đến hạn + 3 CTA Ôn tiếp, Chọn bộ khác, Về từ vựng. Không copy streak-shaming. | Summary, Ôn tiếp/Chọn bộ khác/Về từ vựng; không streak shaming. |
| ~~VOC-WEB-08~~ | ~~Responsive/a11y polish~~ | VOC-WEB-02 đến VOC-WEB-07 | **Implemented và đo trên browser:** 360px không tràn ngang ở cả 3 màn; không control nào < 44px; mọi control có tên trợ năng; mỗi màn đúng 1 `h1`; focus ring thật `2px solid #3860be` offset 4px đúng token; 10/10 cặp màu đạt WCAG AA (thấp nhất 5.40); `prefers-reduced-motion` có rule. Thêm: `h1` sr-only + live region báo thẻ mới cho screen reader, và **focus chuyển sang thẻ kế sau khi chấm** thay vì rơi về `<body>`. |

### M4 — Analytics, test và beta

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| ~~VOC-QA-01b~~ | ~~Unit test session queue~~ | VOC-API-04b | **Implemented:** `test/srs/session-queue.test.mjs` cover VOC-06b — gap 3, tail < 3 không chèn, trần 2 lần, phiên luôn kết thúc, state immutable. |
| ~~VOC-QA-01~~ | ~~Unit test SRS~~ | VOC-API-04 | **Implemented:** cover đủ 16 ô bảng 8.2, interval bảng 8.1, UTC boundary, stage 6 -> `mastered`, và `review` stage 1 + `Chưa thuộc` -> `learning` stage 0. |
| VOC-QA-02 | Integration test review write | VOC-API-05s | Verify transaction, idempotency, RLS isolation, reload persistence. |
| ~~VOC-QA-03~~ | ~~Importer regression test~~ | VOC-DATA-04 | **Implemented:** reject malformed line/duplicate ID/non-JSONL catalog, xác nhận source normalizer chỉ đọc `*.jsonl`. |
| VOC-QA-04 | E2E core journeys | VOC-WEB-07 | Due review, new deck, no due cards, save retry, audio failure, guest refresh, thẻ `Chưa thuộc` quay lại trong phiên, và offline khóa đánh giá/không tạo review event theo ADR-002. |
| VOC-QA-05 | Instrument analytics | VOC-WEB-02 đến VOC-WEB-07, VOC-PLAN-07 | Emit events section 11 spec; không event nào rời thiết bị trước khi có consent; không gửi `learner_id`/`auth.uid()` sang analytics bên thứ ba; không lộ word/nghĩa. |
| VOC-QA-06 | Performance check | VOC-DATA-07a, VOC-WEB-08 | Không tải toàn bộ 5.275 card lúc first load; core interaction <3s mobile baseline. |
| VOC-QA-08 | Viết rollback/backup runbook | VOC-DATA-07b, VOC-INFRA-03 | Có văn bản: cách rollback migration, khôi phục content version trước, khôi phục artifact audio. Đây là input của VOC-QA-07, không phải sản phẩm phụ. |
| VOC-QA-07 | Beta acceptance review | VOC-QA-01 đến VOC-QA-06, VOC-QA-08, VOC-PLAN-03, VOC-PLAN-08 | VOC-01…VOC-10 (gồm VOC-06b, VOC-08b) pass; issue list triaged; rollback/backup verified theo runbook VOC-QA-08. |

## 5. Thứ tự chạy đề xuất

```text
VOC-PLAN-01..08
        ↓
VOC-INFRA-01..05
        ↓
VOC-DATA-01..07a
        ↓
VOC-API-01..07
        ↓
VOC-WEB-01..08
        ↓
VOC-QA-01..08 → Beta
```

### Lát cắt dọc trước khi mở rộng

Chuỗi M1 -> M4 tuyến tính nghĩa là không có gì chạy được cho tới gần cuối. Chạy một lát cắt dọc mỏng trước khi làm nốt backlog:

> `VOC-DATA-07a` (deck Environment, `draft`, ~20 card) -> `VOC-API-01` + `VOC-API-03` + `VOC-API-04` + `VOC-API-05` bản tối giản -> một màn review chạy thật.

**Đã chạy (2026-08-20)** trên fixture thay vì database: `VOC-INFRA-08` + fixture 20 card Environment + `VOC-API-02/03/05` + route `/vocabulary`. Nhờ đó lát cắt không cần chờ `VOC-DATA-07a` hay Supabase credential. Bước tiếp là đổi `repository.fixture.ts` sang adapter Supabase (`VOC-API-02s/03s/05s`) — service, schema và domain không đổi.

Lát cắt này phát hiện sai lầm ở hợp đồng API và ở bảng SRS sớm hơn nhiều so với việc đợi hết M3. Nếu nó chạy được end-to-end thì phần còn lại chủ yếu là nhân rộng.

Quan trọng: **quyết định beta deck (`VOC-PLAN-02`) không còn nằm trên đường găng của M2/M3.** Nó chỉ chặn `VOC-DATA-07b` và bước release, nên toàn bộ API/UI có thể build và test song song trong khi Product/Content còn đang chốt list.

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

- CI xanh và chặn được merge khi content gate đỏ, có branch protection thật sự enforce (`VOC-INFRA-07`), không chỉ workflow tồn tại.
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

Consent/age gate (D-05) chưa quyết định: làm trong release Vocabulary hay tại luồng onboarding chung. Không bắn analytics trước khi quyết định này được chốt.
