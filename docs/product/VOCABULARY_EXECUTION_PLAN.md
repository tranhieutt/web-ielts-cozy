# IELTS Cozy — Kế hoạch thực thi Vocabulary MVP

**Nguồn yêu cầu:** [Vocabulary feature spec](VOCABULARY_SPEC.md)  
**Trạng thái:** Content CI, SRS domain, migration/RLS, importer, seed và publish 4 deck beta đã xong. Anonymous Auth thật (ADR-004/D-20), review write transactional qua RPC — **VOC-07 đạt, tiến độ sống qua restart**. Còn lại: integration/E2E test, Google OAuth (chờ 1 lần đăng nhập thật), consent, QA phát âm, backup artifact audio, branch protection.  
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
| Database foundation | Vocabulary catalog/learner schema, indexes, grants và RLS đã migrate + pgTAP verify. Importer đã `--apply`: 5.275 card / 23 deck / 8.271 membership trên project `iixvtoaifxuqjjdbwrzh`; 4 deck beta đã `published` (1.312 card theo primary topic). Còn thiếu: auth resolver thật và đường ghi learner state vào database. |
| Application runtime | `apps/web` (Next.js App Router) có 6 endpoint (`decks`, `queue`, `reviews`, `progress`, `auth/google`, `auth/callback`) và route `/vocabulary`. Content đọc qua `repository.supabase.ts`, learner state đọc/ghi qua `learner.supabase.ts` — **cả hai bằng access token của learner, RLS quyết định phạm vi**. **VOC-07 đạt:** tiến độ sống qua restart, verify thật. Fixture chỉ còn là đường dev khi không có token. |
| Learner identity | **Xong và verify end-to-end.** Anonymous Auth cấp UUID thật, RLS cô lập đúng, app dùng session thật trong cookie httpOnly. Google sign-in **link vào cùng UUID** — đo trên database: chấm 5 thẻ khi còn anonymous, đăng nhập sau, tiến độ vẫn thuộc đúng user đó. Cookie unsigned cũ đã bị thay hoàn toàn. |
| Audio source / artifact | Google TTS đã sinh và upload 10.550 MP3 UK/US; Supabase CDN delivery probe UK/US pass, chờ QA phát âm trước runtime enable |
| Backup 10.550 MP3 | **Chưa có.** `.gitignore` loại `.generated/audio/`, artifact chỉ tồn tại trên máy local |
| QA phát âm TTS | Chưa làm; 38 card đồng tự khác âm có rủi ro đọc sai |
| CI pipeline | Có 2 workflow: `vocabulary-content` (validate nguồn, build/validate catalog canonical, test, build + typecheck app) và `vocabulary-database`. GitHub admin còn phải mark cả hai là required trong branch protection (`VOC-INFRA-07`); tới lúc đó D-16/D-18 chưa có hiệu lực thật. |
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

Tình trạng hiện tại: **39/52 task xong**. Lát cắt dọc chạy end-to-end trên Supabase thật ở **cả đường đọc lẫn đường ghi**. VOC-07 đã đạt: tiến độ sống qua restart.

13 task còn lại:

| Nhóm | Task |
|---|---|
| Quyết định Product | `VOC-PLAN-01`, `VOC-PLAN-02`, `VOC-PLAN-03`, `VOC-PLAN-04`, `VOC-PLAN-07`, `VOC-PLAN-08` |
| Hạ tầng / quyền admin | `VOC-INFRA-03`, `VOC-INFRA-05`, `VOC-INFRA-07` |
| Engineering | — (hết) |
| QA | `VOC-QA-04`, `VOC-QA-05`, `VOC-QA-07`, `VOC-QA-08` |

**Đường găng** giờ thuần engineering — quyết định Product chặn nó đã gỡ (ADR-004/D-20). Chuỗi 4 task nối tiếp này quyết định DoD quan trọng nhất ("reload không mất review đã lưu"):

```text
deploy apps/web lên Vercel  →  VOC-QA-04 (E2E trên URL thật)  →  VOC-QA-07  →  Beta
```

**VOC-07 đã đạt**: `VOC-API-05s` xong, learner state nằm trong database và sống qua restart. Đường ghi không còn fixture.

`VOC-INFRA-06` đã xong: anonymous sign-in cấp UUID thật và RLS cô lập đúng trên remote, nên `VOC-API-01` không còn chờ gì ở tầng hạ tầng.

`VOC-INFRA-03` (backup 10.550 MP3) **không phụ thuộc task nào** và là rủi ro mất dữ liệu không phục hồi được — chạy ngay, song song, không chờ ai.


### M0 — Quyết định release

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| VOC-PLAN-01 | Duyệt scope MVP | — | Xác nhận chỉ Vocabulary; giữ 2 ratings; examples/collocations English fallback. **Cần làm rõ:** toàn bộ M1–M3 phụ thuộc task này đã implement xong theo đúng scope trên. Hoặc scope đã được duyệt ngầm và chỉ quên tick, hoặc cả nhánh dưới đang chạy trên scope chưa duyệt chính thức. Product xác nhận và gạch, không để treo. |
| VOC-PLAN-02 | Chốt beta deck | VOC-PLAN-01 | Publish list: Environment, Education, Technology, General Academic hoặc list thay thế; `publish_status` có owner. |
| VOC-PLAN-03 | Audit bản dịch `def_vi` | VOC-PLAN-01 | Review 100% nghĩa nguồn Trung, sample >=10% nghĩa nguồn Anh; tạo issue cho bản dịch sai/awkward. |
| VOC-PLAN-04 | Quyết định audio | VOC-PLAN-01 | Google TTS là nguồn approved; apply bucket migration, upload CDN và chỉ bật `audio_enabled` sau delivery probe **và** QA phát âm (VOC-PLAN-08) pass. Code phía audio (`VOC-API-07`, `VOC-WEB-06`) đã xong và **an toàn khi task này còn treo**: theo ADR-003 gate mặc định off, cấu hình nửa vời không lọt URL, gate đóng thì payload bỏ hẳn key `audio`. Task này chỉ còn là quyết định bật cờ, không chặn engineering. |
| ~~VOC-PLAN-05~~ | ~~Chốt guest/account policy~~ | VOC-PLAN-01 | **Decided (ADR-004 / D-20):** `learner_id` = Supabase Anonymous Auth UUID theo D-12, không có `guest_id` riêng. Retention 30 ngày không hoạt động (cascade tự xóa state/review). Mời tạo tài khoản = link thụ động ở header, không modal. Catalog hiện "Tiến độ đang lưu trên trình duyệt này" khi chưa đăng nhập. Google OAuth nên `enable_manual_linking = true` (bắt buộc, nếu không đăng nhập sẽ tạo user mới và mất tiến độ). Rate limit anonymous 50/giờ/IP. |
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
| VOC-INFRA-05 | Design states | VOC-PLAN-01 | **Đã bị implementation vượt qua:** `VOC-WEB-02` đến `VOC-WEB-08` đã build đủ các state DoR spec §14 (chưa lật, loading, audio error, save error, empty due, completed, offline-disabled) mà không chờ design giao. Task này không còn là input; DoD rút lại thành: design review lại các state đã build và ghi vào design source of truth, hoặc đóng task nếu Design chấp nhận implementation hiện tại. |
| ~~VOC-INFRA-06~~ | ~~Bật Supabase Anonymous Auth~~ | ~~VOC-PLAN-05~~ | **Implemented and remote-verified.** `supabase/config.toml`: `enable_anonymous_sign_ins = true`, `enable_manual_linking = true`, `anonymous_users = 50`, mỗi dòng comment trỏ ADR-004. Ba setting đã bật bằng tay trong Dashboard (không dùng `config push` để tránh ghi đè `site_url` bằng `127.0.0.1`). Verify trên project thật `iixvtoaifxuqjjdbwrzh`: (1) `POST /auth/v1/signup` cấp access token + UUID với `is_anonymous = true`, `role = authenticated`; (2) learner mới đọc `learner_card_states` và `learner_card_reviews` đều trả `[]` — RLS cô lập đúng; (3) cùng token vẫn đọc được 4 deck published, tức gate content không bị siết nhầm. Cascade `ON DELETE CASCADE` từ `auth.users` sang cả hai bảng learner đã xác nhận, nên retention 30 ngày của ADR-004 chỉ cần xóa user.
| VOC-INFRA-07 | Mark CI là merge gate | VOC-INFRA-01 | GitHub branch protection trên `main` mark check `vocabulary-content` (và `vocabulary-database`) là required; verify bằng một PR cố ý làm đỏ gate và xác nhận không merge được. Không có bước này thì D-16/D-18 chỉ tồn tại trên giấy. |
| ~~VOC-INFRA-08~~ | ~~Bootstrap application framework~~ | VOC-PLAN-01 | **Implemented:** npm workspace `apps/web` chạy Next.js App Router theo D-10; `npm run web:dev`/`web:build`, typecheck sạch, CI build + typecheck app. Mockup tĩnh ở root và `vercel.json` **không đổi** — app này build/deploy riêng tới khi lát cắt dọc thay được mockup. |

#### VOC-INFRA-06 — ghi chú hạ tầng còn mở

Ba vướng mắc gặp khi apply, hai đã xử lý và một còn mở:

1. ~~Không chạy được local stack~~ — máy dev không có Docker/Podman nên `supabase start` không chạy. Đã đi đường vòng: verify trực tiếp trên remote bằng anonymous sign-in thật + đọc RLS, thay vì verify local. Chấp nhận được cho task này, nhưng D-17 vẫn thiếu tầng local.
2. ~~`config push` đẩy cả file~~ — đã tránh bằng cách bật 3 setting thủ công trong Dashboard. `config.toml` giữ vai trò source of truth đã commit; **không chạy `supabase config push`** trên repo này khi `site_url` còn trỏ `127.0.0.1`.
3. ~~Chỉ có một Supabase project~~ — **đã quyết (2026-08-20): chấp nhận một môi trường trong giai đoạn phát triển.** Product xác nhận `iixvtoaifxuqjjdbwrzh` đang là môi trường test, được tạo/xoá learner tuỳ ý. Hệ quả phải nhớ: (a) **D-17 chưa có thật ở tầng hạ tầng** — không có preview/production tách biệt, nên mọi thay đổi auth/schema là chạm thẳng vào nơi giữ content đã seed; (b) `VOC-QA-02` được phép tạo/xoá learner ở đây; (c) **trước khi mở beta cho người học thật**, phải tách project production hoặc chấp nhận rủi ro một cách có văn bản — đây là điều kiện của `VOC-QA-07`, không phải việc tuỳ chọn.

Dọn dẹp: 2 anonymous user do bước verify tạo ra vẫn còn trong `auth.users` (`is_anonymous = true`, không có review nào). Vô hại, và sẽ tự rơi vào diện xóa của job retention 30 ngày khi job đó được viết.

### M1 — Content platform và database

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| ~~VOC-DATA-01~~ | ~~Viết schema migration content~~ | VOC-PLAN-02 | **Implemented:** `vocabulary_cards`, `vocabulary_decks`, `vocabulary_deck_cards`; PK/FK/index và `publish_status`. Chưa seed/publish deck khi Product chưa chốt beta list. |
| ~~VOC-DATA-02~~ | ~~Viết schema migration learner~~ | VOC-PLAN-05 | **Implemented:** `learner_card_states`, `learner_card_reviews`; `learner_id` FK tới `auth.users`, unique `(learner_id, card_id)` và `(learner_id, idempotency_key)`. Không có `guest_identities`. |
| ~~VOC-DATA-03~~ | ~~Bật RLS và policy~~ | VOC-DATA-01, VOC-DATA-02 | **Implemented and remote-verified:** content read-only theo publish status; policy learner dùng `auth.uid()`, grants tối thiểu, learner chỉ đọc/ghi data của mình. |
| ~~VOC-DATA-04~~ | ~~Xây importer JSONL~~ | VOC-DATA-01 | **Implemented:** importer nhận catalog canonical `*.jsonl`, validate UTF-8/one-object-per-line/ID/topic/`def_vi`, upsert idempotent `vocabulary_cards` ở `draft`, báo file + line khi lỗi. |
| ~~VOC-DATA-05~~ | ~~Normalize deck mapping~~ | VOC-DATA-04 | **Implemented:** `topic` là deck chính; `topics_all` tạo membership không nhân bản learner state; 23 display name Việt; deck/card dùng cùng catalog SHA content version. |
| ~~VOC-DATA-06~~ | ~~Content quality gate CI~~ | VOC-DATA-04, VOC-INFRA-02 | **Implemented:** CI validate source và catalog canonical output: 5.275 card, 7.309 `def_vi` non-empty, không duplicate ID, không lộ `zh`/Youdao ở payload learner. |
| ~~VOC-DATA-07a~~ | ~~Seed dev/staging content~~ | VOC-DATA-03, VOC-DATA-04 | **Implemented:** `--apply` đã chạy trên project `iixvtoaifxuqjjdbwrzh`; database có 5.275 card / 23 deck / 8.271 membership, khớp importer report. |
| ~~VOC-DATA-07b~~ | ~~Publish beta content~~ | VOC-DATA-07a, VOC-PLAN-02 | **Implemented:** publish 4 deck beta theo spec §13 Q4 — Environment, Education, Technology, General Academic. Publish theo **primary topic** (1.312 card `published`), nên card thuộc deck chưa audit không lộ qua membership phụ. Deck chưa publish trả rỗng, đã verify. |

### Vị trí thực thi hiện tại — 2026-08-20

- Content đã lên database: importer `--apply` chạy xong (5.275 card / 23 deck / 8.271 membership), 4 deck beta đã publish theo primary topic (1.312 card). Deck chưa publish trả rỗng, đã verify.
- Lát cắt dọc chạy end-to-end, verify bằng `next start` thật: catalog -> queue -> review -> replay idempotent -> catalog phản ánh progress. Catalog và queue **đã đọc dữ liệu thật** qua `repository.supabase.ts` (publishable key, RLS quyết định phạm vi); catalog rút xuống 1 request nhờ view `vocabulary_deck_summary`.
- **Giới hạn còn lại của lát cắt:** đường *ghi* vẫn ở `repository.fixture.ts`, tức learner state nằm trong bộ nhớ tiến trình và mất khi restart — chưa đạt VOC-07. `repository.supabase.ts` hiện không có insert/update nào. Đóng bằng `VOC-API-05s`; service, schema và domain không đổi.
- **Identity: hạ tầng xong, app chưa nối.** `VOC-INFRA-06` đã bật Anonymous Auth và verify trên remote thật. Nhưng `identity.ts` trong app vẫn là cookie unsigned, tự khai "không phải auth system, không được dùng để bảo vệ learner data thật". Nối app vào Anonymous Auth là việc của `VOC-API-01` — giờ không còn chờ gì.
- Vì `learner_card_states.learner_id` có FK tới `auth.users`, **không thể ghi bền trước khi có identity thật**. Đây là lý do `VOC-API-01` nằm trước `VOC-API-05s` trên đường găng, chứ không phải hai việc song song.

### M2 — Domain service và API

| ID | Task | Dependency | Definition of done |
|---|---|---|---|
| ~~VOC-API-01~~ | ~~Identity resolver guest/user~~ | VOC-DATA-02, ~~VOC-INFRA-06~~ | **Implemented and remote-verified, cả anonymous lẫn Google link.** Anonymous: `auth.supabase.ts` gọi GoTrue bằng raw REST, `identity.ts` giữ session trong 2 cookie httpOnly maxAge 30 ngày khớp ADR-004, resolve theo thứ tự token sống -> refresh -> sign-in mới; `route-helpers.ts` gom resolve/handle/attach nên không route nào quên attach rồi vô tình cấp learner mới mỗi request. Google: dùng **`linkIdentity`, KHÔNG phải `signInWithOAuth`** — sign-in thường sẽ xác thực một user KHÁC và bỏ rơi tiến độ anonymous. PKCE server-side, token không bao giờ vào URL fragment (D-13). **Verify link bằng dòng thời gian trên database thật:** user tạo lúc 13:38:00 khi còn anonymous -> chấm 5 thẻ lúc 13:38:25–13:39:05 -> Google identity gắn vào **chính user đó** lúc 13:41:34. `rated_before_google = true`, `is_anonymous` false, `providers = ['google']`, 5 state + 5 review vẫn thuộc cùng UUID `86cdae1d-…`, **không có user thứ hai nào sinh ra** và không dòng nào mồ côi. Nhánh lỗi cũng verify: huỷ trên Google -> `?signin=cancelled`, thiếu code hoặc code giả -> `failed` và không cấp session, PKCE cookie single-use. |
| ~~VOC-API-02~~ | ~~Deck catalog endpoint (fixture)~~ | VOC-INFRA-08 | **Implemented:** `GET /api/vocabulary/decks` trả summary (tên Việt, count publishable, due count, progress), không nhúng card. Đổi sang Supabase = thay adapter, không đổi service. |
| ~~VOC-API-02s~~ | ~~Deck catalog trên Supabase~~ | VOC-DATA-07a | **Implemented:** đọc qua PostgREST bằng **publishable key**, RLS quyết định phạm vi nhìn thấy. Catalog trả 4 deck với count thật (168/379/205/622). |
| ~~VOC-API-03~~ | ~~Review queue endpoint (fixture)~~ | VOC-INFRA-08, VOC-API-04 | **Implemented:** `GET /api/vocabulary/queue?deck=&mode=&limit=`; `due` xếp overdue -> due, `new` theo CEFR -> order -> id; limit cap server-side 1–50. |
| ~~VOC-API-03s~~ | ~~Queue trên Supabase~~ | VOC-API-01, VOC-DATA-07a | **Implemented:** queue lấy card thật theo deck, phân trang PostgREST, cache theo tiến trình. Payload không lộ `zh`/Youdao — verify trên dữ liệu thật. |
| ~~VOC-API-04~~ | ~~SRS domain function~~ | VOC-API-01 | **Implemented early:** pure function đúng bảng 8.1 (stage 0–6, interval 10m/1d/3d/7d/14d/30d/60d) và 16 ô bảng 8.2; stage 6 đổi `mastered`, due time UTC. Không chạm DB. |
| ~~VOC-API-04b~~ | ~~Session queue domain function~~ | VOC-PLAN-01 | **Implemented early:** pure module `apps/web/src/features/vocabulary/srs/session-queue.mjs` theo spec §8.3 — chèn lại thẻ `again` sau đúng 3 thẻ chưa chấm, bỏ chèn khi tail < 3, tối đa 2 lần/thẻ/phiên, không đọc `due_at`, không chạm DB. |
| ~~VOC-API-05~~ | ~~Submit review endpoint (fixture)~~ | VOC-API-03, VOC-API-04 | **Implemented:** `POST /api/vocabulary/reviews`; replay `idempotencyKey` trả lại kết quả đầu tiên, không nhảy stage. **Chưa transactional và chưa bền** — cần adapter Supabase. |
| ~~VOC-API-05s~~ | ~~Review write transactional/bền~~ | ~~VOC-API-01~~, ~~VOC-DATA-07a~~, ~~VOC-API-05~~ | **Implemented and remote-verified — VOC-07 đạt.** Migration `20260820140000_create_submit_vocabulary_review.sql`: RPC `submit_vocabulary_review` viết review event + state update trong **một transaction**; hai lệnh PostgREST rời không thể là một transaction nên crash giữa chừng sẽ mất tiến độ hoặc mất audit row. `security invoker` nên RLS vẫn áp và `auth.uid()` là learner. Idempotency do **unique `(learner_id, idempotency_key)`** quyết định, không phải code ứng dụng; `unique_violation` được bắt và trả lại kết quả gốc nên hai request đua cùng key vẫn an toàn. Toán SRS **không** viết lại bằng SQL — giữ ở `transition.mjs` để luật không tồn tại ở hai ngôn ngữ rồi lệch nhau. `learner.ts` chọn adapter theo **access token của request**, không theo env flag, nên đường fixture không thể vô tình đứng trước database thật. **Verify:** chấm 3 thẻ -> **kill server -> start lại** -> progress vẫn 3, catalog vẫn 3, queue `new` không trả lại thẻ đã chấm, replay key cũ **sống qua restart** trả `replayed: true` và không nhảy stage; learner mới vẫn thấy 0. |
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
| ~~VOC-QA-02~~ | ~~Integration test review write~~ | ~~VOC-API-05s~~ | **Implemented — 7 test chạy trên project thật, không mock.** `test/vocabulary/review-write.integration.test.mjs`, opt-in bằng `VOCABULARY_INTEGRATION=1 npm run vocab:test-integration` để `npm test` vẫn hermetic (43 test, 0 network). Không mock có chủ đích: transaction, unique constraint và RLS là tính chất của Postgres, mock chỉ chứng minh mock đồng ý với chính nó. Cover: (1) một call ghi **cả** event lẫn state, và ghi đúng `previous_state`; (2) replay trả kết quả gốc kể cả khi retry gửi payload KHÁC — **key quyết định, không phải payload**; (3) **6 request đồng thời cùng key -> đúng 1 writer, 5 replay, 1 review row** (nhánh `unique_violation` mà replay tuần tự không bao giờ chạm tới); (4) RLS: learner B không thấy dòng của A, và **giả `learner_id` của A bị chặn 403** — credential quyết định quyền sở hữu, không phải payload; (5) card chưa publish bị từ chối thay vì tạo state ẩn; (6) publishable key một mình **không** ghi được (`auth.uid()` null); (7) state sống qua session mới (VOC-07). **Giới hạn:** anonymous user do test tạo ra không xoá được (cần service-role key, không được đưa vào tầm với của app) — rơi vào retention 30 ngày của ADR-004. Chạy trong CI cần thêm secret vào GitHub, chưa làm. |
| ~~VOC-QA-03~~ | ~~Importer regression test~~ | VOC-DATA-04 | **Implemented:** reject malformed line/duplicate ID/non-JSONL catalog, xác nhận source normalizer chỉ đọc `*.jsonl`. |
| VOC-QA-04 | E2E core journeys | VOC-WEB-07 | Due review, new deck, no due cards, save retry, audio failure, guest refresh, thẻ `Chưa thuộc` quay lại trong phiên, và offline khóa đánh giá/không tạo review event theo ADR-002. |
| VOC-QA-05 | Instrument analytics | VOC-WEB-02 đến VOC-WEB-07, VOC-PLAN-07 | Emit events section 11 spec; không event nào rời thiết bị trước khi có consent; không gửi `learner_id`/`auth.uid()` sang analytics bên thứ ba; không lộ word/nghĩa. |
| ~~VOC-QA-06~~ | ~~Performance check~~ | VOC-DATA-07a, VOC-WEB-08 | **Implemented và đo trên dữ liệu thật:** client không bao giờ nhận cả corpus (queue 20 thẻ = 13KB, catalog = 1KB). Cold catalog 903ms, warm 12ms; cold queue ~1s, warm 13ms — dưới ngưỡng 3s. Phát hiện: DB chỉ tốn ~2ms còn round-trip tới Supabase ~600ms, nên chi phí nằm ở **số lượt gọi**. Catalog rút từ 4 request (hoặc 600KB card) xuống **1 request** qua view `vocabulary_deck_summary` (`security_invoker`, RLS còn nguyên). Giới hạn còn lại: queue vẫn kéo cả deck (151KB server-side, cache theo tiến trình) rồi cắt — sẽ thành một câu SQL khi learner state vào database. |
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

**Đã chạy (2026-08-20).** Bước 1 dựng trên fixture (`VOC-INFRA-08` + `VOC-API-02/03/05` + route `/vocabulary`) nên không phải chờ Supabase credential. Bước 2 đã đổi đường *đọc* sang Supabase thật (`VOC-DATA-07a/07b`, `VOC-API-02s/03s`). Còn lại bước 3: đường *ghi* (`VOC-API-01` → `VOC-API-05s`) — service, schema và domain không đổi.

Lát cắt này phát hiện sai lầm ở hợp đồng API và ở bảng SRS sớm hơn nhiều so với việc đợi hết M3. Nếu nó chạy được end-to-end thì phần còn lại chủ yếu là nhân rộng.

Quan trọng: `VOC-PLAN-02` (beta deck) **đã hết vai trò blocker** — `VOC-DATA-07b` publish xong 4 deck theo spec §13 Q4, task chỉ còn là xác nhận chính thức list đó.

`VOC-PLAN-05` (guest/account policy) **đã chốt** ở ADR-004/D-20, nên đường găng không còn quyết định Product nào: `VOC-INFRA-06` → `VOC-API-01` → `VOC-API-05s` → `VOC-QA-02` sẵn sàng chạy liên tục. Ràng buộc bên ngoài duy nhất còn lại của chuỗi là Google OAuth credential, cần trước khi `VOC-API-01` làm tới luồng đăng nhập.

### Thứ tự đề xuất cho 18 task còn lại

1. `VOC-INFRA-03` — backup 10.550 MP3. Không blocker, rủi ro mất dữ liệu không phục hồi được. Chạy ngay.
2. ~~`VOC-PLAN-05`~~ — **xong**, xem ADR-004/D-20.
3. `VOC-INFRA-06` → `VOC-API-01` → `VOC-API-05s` → `VOC-QA-02`. Chuỗi này biến MVP từ "chạy trên fixture" thành "bền". Chuẩn bị Google OAuth credential song song, cần ở giữa `VOC-API-01`.
4. Song song với (2)(3): `VOC-INFRA-07` (cần quyền GitHub admin), `VOC-PLAN-01/02/04` (xác nhận chính thức), `VOC-PLAN-03` + `VOC-PLAN-08` (content QA + QA phát âm), `VOC-QA-08` (runbook), `VOC-INFRA-05` (design review hoặc đóng).
5. Cuối: `VOC-PLAN-07` → `VOC-QA-05` (analytics, không bắn event trước consent), `VOC-QA-04` (E2E), rồi `VOC-QA-07` (beta acceptance).

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

### Deploy: app Next phục vụ cả domain (2026-08-20)

Product chọn **thay hẳn** — một deployment, app Next đứng trước toàn bộ domain.

Phát hiện khi khảo sát: mockup **không phải HTML viết tay** mà là bản export design-canvas (runtime riêng 69KB, 22 `sc-for`, 16 `sc-if`, 184 binding `{{ }}`, 11 `style-hover`), và nó phủ **10 route** trong khi app Next chỉ có `/vocabulary`. Chép tay 10 màn đó sang React là tái hiện một template engine phản ứng để dựng lại những màn vốn sẽ bị thay — nên prototype được **phục vụ nguyên trạng** thay vì port.

Cấu hình:

- `apps/web/next.config.mjs` rewrite 10 route (`/`, `/dashboard`, `/library`, `/listening`, `/mock`, `/profile`, `/progress`, `/reading`, `/speaking`, `/writing`) sang `/prototype.html`. Dạng array chạy **sau** filesystem route nên `/vocabulary` thật luôn thắng.
- `scripts/sync-prototype.mjs` copy `index.html` + `assets/` vào `apps/web/public/` ở **build time**; bản copy được gitignore. Copy tay sẽ tạo hai bản phân kỳ và hỏng **âm thầm** — sửa file gốc, site deploy không đổi, không lỗi gì cả.
- `vercel.json` chuyển từ SPA rewrite sang build Next (`outputDirectory: apps/web/.next`).
- `scripts/verify-static-runtime.mjs`: bỏ assertion SPA cũ, thay bằng invariant mạnh hơn — **mọi route prototype có thể điều hướng tới đều phải được phục vụ**, bởi rewrite hoặc bởi một Next page thật. Đã xác nhận nó fail đúng khi thêm route lạ vào prototype.

Verify local (`next start`, sau khi xoá sạch `public/` rồi build lại): 10/10 route prototype trả 200, `/vocabulary` + `/vocabulary/review` trả app Next, `/api/vocabulary/decks` 200, đường không tồn tại vẫn 404.

**Chưa deploy lên Vercel.** Còn lại: set env var trên Vercel (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VOCABULARY_CONTENT_SOURCE=supabase`; **không** đưa service-role key), rồi làm checklist OAuth ngay dưới.

### Checklist deploy `apps/web` lần đầu (VOC-API-01 / OAuth)

`apps/web` hiện **chưa deploy**: `vercel.json` ở gốc vẫn phục vụ mockup tĩnh, nên Google OAuth mới chỉ cấu hình được cho `localhost`. Ba việc dưới đây phải làm **cùng lúc** với lần deploy đầu tiên, nếu không luồng đăng nhập sẽ hỏng theo kiểu im lặng — Google báo thành công, Supabase link xong, nhưng redirect về `Site URL` thay vì callback của app, nên app không nhận được `code` và người học quay lại vẫn là anonymous. Không có log lỗi nào.

1. **Supabase → Authentication → URL Configuration → Redirect URLs**: thêm `https://<domain-production>/api/vocabulary/auth/callback`. Không wildcard cho domain thật — wildcard biến mọi path thành đích redirect hợp lệ sau đăng nhập.
2. **Supabase → Site URL**: trỏ về domain production, không để `127.0.0.1`.
3. **Google Cloud Console → Credentials → OAuth client**: Authorized redirect URI vẫn chỉ cần callback của Supabase (`https://iixvtoaifxuqjjdbwrzh.supabase.co/auth/v1/callback`) — **không** thêm domain app vào đây; app không bao giờ nhận trực tiếp từ Google.

Giữ nguyên entry `localhost` song song để dev không hỏng.

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
