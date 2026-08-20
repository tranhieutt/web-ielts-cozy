# Vocabulary content build

## Mục đích

Biến corpus vocabulary thành content runtime có thể publish: nghĩa Việt đã QA, audio Google TTS, manifest CDN và dữ liệu sẵn sàng import database. Quy trình này chỉ nhận `*.jsonl` trong `content/vocabulary/ielts_vocab_by_topic/`.

Không dùng CSV, `index.json`, URL audio Youdao hoặc file audio copy từ bên thứ ba.

## Contract đầu vào và đầu ra

| Hạng mục | Contract |
|---|---|
| Input content | Một JSON object trên mỗi dòng JSONL UTF-8; `id` duy nhất; `word`, `topic`, `senses` bắt buộc. |
| Nghĩa Việt | Mỗi `senses[].def_vi` là string không rỗng. Không sửa word, ID, English/Chinese source hay metadata trong bước dịch. |
| Audio | Google TTS tạo `MP3` mới cho `word`; hai accent `uk`/`us`. |
| Local asset | `.generated/audio/vocabulary/{uk|us}/{card_id}.mp3`, không commit Git. |
| CDN object | `v1/{uk|us}/{card_id}.mp3` trong bucket Supabase `vocabulary-audio`. |
| Runtime data | Database lưu object path + version, không lưu URL Youdao và không tải JSONL thô ở browser. |

## Quy trình chuẩn

### 1. Thay đổi content nguồn

1. Chỉnh/sync chỉ file `.jsonl`.
2. Giữ nguyên `id`, `word`, `topic`, `senses` và schema.
3. Nếu thêm card/sense, `def_vi` phải có trước khi publish.
4. Chạy validation cơ bản:

```powershell
npm run vocab:validate-content
```

Output cần có: số JSONL/card/definition, `uniqueIds` bằng số card và exit code 0.

### 2. Dịch và QA `def_vi`

1. Dịch chỉ các `senses[].def_vi` null bằng Google Cloud Translation. Script checkpoint/resume ở `.translation-work/`.
2. Nguồn dịch ưu tiên `def_en`; chỉ fallback `def_zh` nếu English thiếu.
3. Review 100% fallback Trung → Việt và sample >=10% English → Việt; ưu tiên Health, Government/Law, C1/C2.
4. Chạy validator lại.

```powershell
npm run vocab:translate-definitions -- --project hanzi-cozy-diary
npm run vocab:validate-content
```

Không đổi `examples[].vi` hay `collocations[].vi` trong workflow hiện tại.

### 3. Sinh audio Google TTS

1. Bật `texttospeech.googleapis.com` trong project có billing và Application Default Credentials.
2. Dry-run để thấy số file/ký tự trước:

```powershell
npm run vocab:generate-audio -- --accent both
```

3. Chạy pilot 10 card, nghe thủ công UK/US:

```powershell
npm run vocab:generate-audio -- --project hanzi-cozy-diary --accent both --limit 10 --apply
```

4. Chạy full. Runner bốn worker, retry, manifest checkpoint mỗi 25 file; rerun sẽ skip file hợp lệ đã có.

```powershell
npm run vocab:generate-audio -- --project hanzi-cozy-diary --accent both --concurrency 4 --apply
```

Voice default: `en-GB-Neural2-A`, `en-US-Neural2-A`. Override qua local `TTS_VOICE_UK` / `TTS_VOICE_US` khi cần. Không ghi các biến này vào Git.

### 4. Validate full corpus và audio

```powershell
npm run vocab:validate-content -- --require-audio
```

Release asset gate:

- 23 JSONL hợp lệ.
- Không duplicate card ID.
- Mọi `def_vi` không rỗng.
- Manifest có đúng `card_count × 2` entry.
- File UK/US tồn tại và có MP3 header hợp lệ.

### 5. Upload Supabase Storage CDN

1. Apply `supabase/migrations/202608190001_create_vocabulary_audio_bucket.sql`.
2. Cấu hình local-only `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
3. Dry-run, rồi upload resumable:

```powershell
npm run vocab:upload-audio -- --source-dir .generated/audio/vocabulary
npm run vocab:upload-audio -- --source-dir .generated/audio/vocabulary --apply
```

4. Probe tối thiểu một object UK và US bằng public CDN URL. Nếu lỗi, giữ feature flag audio off.
5. Import object paths vào content database; ví dụ `audio_version='v1'`, `audio_path_uk='v1/uk/{id}.mp3'`.

Service-role key chỉ nằm local/CI secret. Không đưa vào browser, Vercel public env hay Git.

### 6. Publish và rollback

1. Content importer ghi content version mới, không sửa version đang được learner attempt dùng.
2. Bật audio feature flag sau CDN probe + UI error-state test.
3. Cache CDN dùng object path versioned. Khi thay voice/file, tăng `v2`, không overwrite `v1` đang phát hành.
4. Rollback: tắt audio feature flag hoặc quay content version/path về version trước; không xóa asset đang có active reference.

## Trạng thái hiện tại — 2026-08-19

- 23 JSONL, 5.275 card, 7.309 `def_vi`: validated.
- 10.550 MP3 Google TTS: local validated, 5.275 UK + 5.275 US, 91.736.256 bytes.
- Supabase migration/uploader: ready; chưa upload vì môi trường local chưa có `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY`.

