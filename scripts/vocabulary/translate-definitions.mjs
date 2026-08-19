import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content', 'vocabulary', 'ielts_vocab_by_topic');
const WORK_DIR = join(ROOT, '.translation-work');
const DEFAULT_PROJECT = 'hanzi-cozy-diary';
const WINDOWS_GCLOUD = join(
  process.env.LOCALAPPDATA ?? '',
  'Google',
  'Cloud SDK',
  'google-cloud-sdk',
  'bin',
  'gcloud.cmd',
);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function parsePositiveInteger(value, name) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

const options = {
  apply: process.argv.includes('--apply'),
  batchSize: parsePositiveInteger(argumentValue('--batch-size'), '--batch-size') ?? 50,
  limit: parsePositiveInteger(argumentValue('--limit'), '--limit'),
  project: argumentValue('--project') ?? process.env.GOOGLE_CLOUD_PROJECT ?? DEFAULT_PROJECT,
};

if (options.apply && options.limit) {
  throw new Error('--apply cannot be combined with --limit. Run a complete translated set before writing JSONL.');
}

function hash(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function readJsonl(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split(/(?<=\n)/u);
  const rows = [];

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) continue;
    try {
      rows.push({ lineIndex: index, rawLine, value: JSON.parse(line) });
    } catch (error) {
      throw new Error(`${relative(ROOT, filePath)} line ${index + 1} is not valid JSON: ${error.message}`);
    }
  }

  return { raw, lines, rows };
}

function listFiles() {
  return readdirSync(CONTENT_DIR)
    .filter((name) => name.endsWith('.jsonl'))
    .sort()
    .map((name) => join(CONTENT_DIR, name));
}

function collectItems(files) {
  const items = [];
  const sources = new Map();

  for (const filePath of files) {
    const source = readJsonl(filePath);
    sources.set(filePath, source);

    for (const row of source.rows) {
      const senses = row.value.senses ?? [];
      for (let senseIndex = 0; senseIndex < senses.length; senseIndex += 1) {
        const sense = senses[senseIndex];
        if (sense.def_vi !== null) continue;

        const english = typeof sense.def_en === 'string' ? sense.def_en.trim() : '';
        const chinese = typeof sense.def_zh === 'string' ? sense.def_zh.trim() : '';
        const sourceText = english || chinese;
        const sourceLanguage = english ? 'en' : chinese ? 'zh' : null;

        if (!sourceLanguage) {
          throw new Error(`No source definition for ${row.value.id} sense ${senseIndex}.`);
        }

        items.push({
          key: `${relative(ROOT, filePath)}:${row.value.id}:${senseIndex}`,
          filePath,
          lineIndex: row.lineIndex,
          senseIndex,
          sourceLanguage,
          sourceText,
          sourceHash: hash(sourceText),
          cardId: row.value.id,
        });
      }
    }
  }

  return { items, sources };
}

function checkpointPath(project) {
  return join(WORK_DIR, `vocabulary-definitions-${project}.json`);
}

function readCheckpoint(project) {
  const filePath = checkpointPath(project);
  if (!existsSync(filePath)) {
    return { version: 1, project, translations: {} };
  }

  const checkpoint = JSON.parse(readFileSync(filePath, 'utf8'));
  if (checkpoint.version !== 1 || checkpoint.project !== project || typeof checkpoint.translations !== 'object') {
    throw new Error(`Invalid checkpoint: ${relative(ROOT, filePath)}`);
  }
  return checkpoint;
}

function writeCheckpoint(project, checkpoint) {
  mkdirSync(WORK_DIR, { recursive: true });
  const target = checkpointPath(project);
  const temp = `${target}.tmp`;
  writeFileSync(temp, `${JSON.stringify(checkpoint, null, 2)}\n`, 'utf8');
  renameSync(temp, target);
}

function getAccessToken() {
  const gcloudBin = process.env.GCLOUD_BIN || (process.platform === 'win32' ? WINDOWS_GCLOUD : 'gcloud');
  if (!gcloudBin || !existsSync(gcloudBin) && process.platform === 'win32') {
    throw new Error('gcloud not found. Set GCLOUD_BIN or install Google Cloud CLI.');
  }
  const command = ['auth', 'application-default', 'print-access-token'];
  const invocation = process.platform === 'win32'
    ? ['powershell.exe', ['-NoProfile', '-Command', `& '${gcloudBin.replace(/'/g, "''")}' ${command.join(' ')}`]]
    : [gcloudBin, command];
  return execFileSync(invocation[0], invocation[1], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function splitBatches(items, batchSize) {
  const batches = [];
  for (const language of ['en', 'zh']) {
    const languageItems = items.filter((item) => item.sourceLanguage === language);
    for (let index = 0; index < languageItems.length; index += batchSize) {
      batches.push(languageItems.slice(index, index + batchSize));
    }
  }
  return batches;
}

async function translateBatch(batch, accessToken, project) {
  const response = await fetch(
    `https://translation.googleapis.com/v3/projects/${encodeURIComponent(project)}/locations/global:translateText`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=utf-8',
        'x-goog-user-project': project,
      },
      body: JSON.stringify({
        contents: batch.map((item) => item.sourceText),
        mimeType: 'text/plain',
        sourceLanguageCode: batch[0].sourceLanguage,
        targetLanguageCode: 'vi',
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(`Google Translation ${response.status}: ${JSON.stringify(payload)}`);
  }
  if (!Array.isArray(payload.translations) || payload.translations.length !== batch.length) {
    throw new Error('Google Translation returned an unexpected number of translations.');
  }

  return payload.translations.map((translation) => translation.translatedText?.trim());
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function translateBatchWithRetry(batch, accessToken, project) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await translateBatch(batch, accessToken, project);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const waitMilliseconds = 1000 * 2 ** (attempt - 1);
      console.error(`Translation attempt ${attempt}/${maxAttempts} failed; retrying in ${waitMilliseconds}ms.`);
      await delay(waitMilliseconds);
    }
  }
  throw new Error('Translation retry loop exited unexpectedly.');
}

async function translateMissing(items, checkpoint) {
  const missing = items.filter((item) => {
    const saved = checkpoint.translations[item.key];
    return !saved || saved.sourceHash !== item.sourceHash || !saved.translatedText;
  });

  if (missing.length === 0) return;

  const accessToken = getAccessToken();
  const batches = splitBatches(missing, options.batchSize);
  for (let index = 0; index < batches.length; index += 1) {
    const batch = batches[index];
    let translations;
    try {
      translations = await translateBatchWithRetry(batch, accessToken, options.project);
    } catch (error) {
      if (index + 1 < batches.length) {
        console.error(`Batch ${index + 1}/${batches.length} failed. Checkpoint saved; rerun to resume.`);
      }
      throw error;
    }

    for (let translationIndex = 0; translationIndex < batch.length; translationIndex += 1) {
      const translatedText = translations[translationIndex];
      if (!translatedText) {
        throw new Error(`Empty translation for ${batch[translationIndex].key}.`);
      }
      checkpoint.translations[batch[translationIndex].key] = {
        sourceHash: batch[translationIndex].sourceHash,
        sourceLanguage: batch[translationIndex].sourceLanguage,
        translatedText,
      };
    }

    writeCheckpoint(options.project, checkpoint);
    console.log(`Translated batch ${index + 1}/${batches.length} (${batch.length} definitions).`);
  }
}

function buildUpdatedContent(files, sources, items, checkpoint) {
  const changes = new Map();
  for (const item of items) {
    const translatedText = checkpoint.translations[item.key]?.translatedText;
    if (!translatedText) throw new Error(`Missing translation for ${item.key}.`);
    const lineKey = `${item.filePath}:${item.lineIndex}`;
    const rowChanges = changes.get(lineKey) ?? [];
    rowChanges.push({ senseIndex: item.senseIndex, translatedText });
    changes.set(lineKey, rowChanges);
  }

  const updated = new Map();
  for (const filePath of files) {
    const source = sources.get(filePath);
    const lines = [...source.lines];

    for (const row of source.rows) {
      const rowChanges = changes.get(`${filePath}:${row.lineIndex}`);
      if (!rowChanges) continue;
      const ordered = rowChanges.sort((left, right) => left.senseIndex - right.senseIndex);
      let replacementIndex = 0;
      lines[row.lineIndex] = lines[row.lineIndex].replace(/"def_vi"\s*:\s*null/g, (match) => {
        const replacement = ordered[replacementIndex];
        replacementIndex += 1;
        return replacement ? match.replace(/null$/, JSON.stringify(replacement.translatedText)) : match;
      });
      if (replacementIndex !== ordered.length) {
        throw new Error(`Could not apply all translations for ${relative(ROOT, filePath)} line ${row.lineIndex + 1}.`);
      }
    }
    updated.set(filePath, lines.join(''));
  }
  return updated;
}

function validateUpdatedContent(files, originalSources, updatedContent) {
  let cardCount = 0;
  let definitionCount = 0;
  let translatedCount = 0;
  const ids = new Set();

  for (const filePath of files) {
    const original = originalSources.get(filePath).rows.map((row) => row.value);
    const updatedLines = updatedContent.get(filePath)
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
    const parsed = updatedLines.map((line) => JSON.parse(line));

    if (parsed.length !== original.length) {
      throw new Error(`Record count changed in ${relative(ROOT, filePath)}.`);
    }

    for (let index = 0; index < parsed.length; index += 1) {
      const sourceRow = structuredClone(original[index]);
      const targetRow = structuredClone(parsed[index]);
      for (const sense of sourceRow.senses ?? []) sense.def_vi = null;
      for (const sense of targetRow.senses ?? []) {
        definitionCount += 1;
        if (typeof sense.def_vi !== 'string' || !sense.def_vi.trim()) {
          throw new Error(`Missing def_vi in ${relative(ROOT, filePath)} record ${targetRow.id}.`);
        }
        translatedCount += 1;
        sense.def_vi = null;
      }
      if (JSON.stringify(sourceRow) !== JSON.stringify(targetRow)) {
        throw new Error(`A non-def_vi field changed in ${relative(ROOT, filePath)} record ${parsed[index].id}.`);
      }
      if (ids.has(parsed[index].id)) throw new Error(`Duplicate card ID: ${parsed[index].id}`);
      ids.add(parsed[index].id);
      cardCount += 1;
    }
  }

  return { cardCount, definitionCount, translatedCount, uniqueIds: ids.size };
}

function applyUpdatedContent(files, updatedContent) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(CONTENT_DIR, '.backups', `def-vi-${timestamp}`);
  mkdirSync(backupDir, { recursive: true });

  for (const filePath of files) {
    copyFileSync(filePath, join(backupDir, basename(filePath)));
  }
  for (const filePath of files) {
    const temp = `${filePath}.translation-tmp`;
    writeFileSync(temp, updatedContent.get(filePath), 'utf8');
    renameSync(temp, filePath);
  }
  return backupDir;
}

async function main() {
  const files = listFiles();
  const { items, sources } = collectItems(files);
  const selectedItems = options.limit ? items.slice(0, options.limit) : items;
  const checkpoint = readCheckpoint(options.project);

  console.log(`Definitions found: ${items.length}. Selected: ${selectedItems.length}.`);
  await translateMissing(selectedItems, checkpoint);

  if (!options.apply) {
    console.log(`Preview complete. Checkpoint: ${relative(ROOT, checkpointPath(options.project))}`);
    console.log('JSONL unchanged. Re-run without --limit and with --apply only after QA.');
    return;
  }

  const updatedContent = buildUpdatedContent(files, sources, items, checkpoint);
  const summary = validateUpdatedContent(files, sources, updatedContent);
  const backupDir = applyUpdatedContent(files, updatedContent);
  console.log(JSON.stringify({ ...summary, backupDir: relative(ROOT, backupDir) }, null, 2));
}

await main();
