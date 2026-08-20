/**
 * VOC-API-07 — audio provider boundary.
 *
 * Two independent gates must BOTH pass before a learner can hear anything:
 *
 * 1. `VOCABULARY_AUDIO_ENABLED=true` — the release switch. It stays off until
 *    the content owner finishes pronunciation QA on the 38 heteronyms
 *    (`VOC-PLAN-08`); an integrity audit only proves the MP3 downloads, not
 *    that it says the right word.
 * 2. `VOCABULARY_AUDIO_BASE_URL` — the approved delivery origin. Only the
 *    Google TTS objects uploaded to the `vocabulary-audio` bucket are approved;
 *    the Youdao URLs in the source JSONL are metadata for tracing and must
 *    never be played, proxied, or cached (spec §4).
 *
 * With either gate closed this module returns null and the UI renders the
 * "audio unavailable" state. Audio never blocks a review either way.
 */

/** Matches the object layout written by `upload-audio-to-supabase.mjs`. */
const OBJECT_PREFIX = 'v1';

export type Accent = 'uk' | 'us';

export interface AudioSources {
  uk: string;
  us: string;
}

function readConfig() {
  const enabled = process.env.VOCABULARY_AUDIO_ENABLED === 'true';
  const baseUrl = process.env.VOCABULARY_AUDIO_BASE_URL?.trim().replace(/\/+$/, '');
  return { enabled, baseUrl };
}

export function isAudioEnabled(): boolean {
  const { enabled, baseUrl } = readConfig();
  return enabled && Boolean(baseUrl);
}

/**
 * Public URLs for one card, or null when audio is not released yet.
 *
 * Returning null — rather than a URL that 404s — keeps the closed gate visible
 * to the UI instead of surfacing as a playback error the learner must decode.
 */
export function resolveAudioSources(cardId: string): AudioSources | null {
  const { enabled, baseUrl } = readConfig();
  if (!enabled || !baseUrl) return null;

  return {
    uk: `${baseUrl}/${OBJECT_PREFIX}/uk/${cardId}.mp3`,
    us: `${baseUrl}/${OBJECT_PREFIX}/us/${cardId}.mp3`,
  };
}
