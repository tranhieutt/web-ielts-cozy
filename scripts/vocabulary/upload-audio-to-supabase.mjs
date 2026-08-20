import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';

const ROOT = process.cwd();
const DEFAULT_SOURCE_DIR = join(ROOT, '.generated', 'audio', 'vocabulary');

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function parsePositiveInteger(value, name) {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${name} must be a positive integer.`);
  return parsed;
}

const sourceDir = resolve(argumentValue('--source-dir') ?? DEFAULT_SOURCE_DIR);
const options = {
  apply: process.argv.includes('--apply'),
  bucket: argumentValue('--bucket') ?? 'vocabulary-audio',
  concurrency: parsePositiveInteger(argumentValue('--concurrency'), '--concurrency') ?? 4,
  sourceDir,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseUrl: process.env.SUPABASE_URL?.replace(/\/$/u, ''),
};

function manifestPath() {
  return join(options.sourceDir, 'manifest.json');
}

function uploadManifestPath() {
  return join(options.sourceDir, `supabase-upload-${options.bucket}.json`);
}

function readJson(filePath, label) {
  if (!existsSync(filePath)) throw new Error(`${label} not found: ${relative(ROOT, filePath)}`);
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function readUploadManifest() {
  const filePath = uploadManifestPath();
  if (!existsSync(filePath)) return { version: 1, bucket: options.bucket, uploaded: {} };
  const value = readJson(filePath, 'Upload manifest');
  if (value.version !== 1 || value.bucket !== options.bucket || typeof value.uploaded !== 'object') {
    throw new Error(`Invalid upload manifest: ${relative(ROOT, filePath)}`);
  }
  return value;
}

function writeUploadManifest(value) {
  mkdirSync(options.sourceDir, { recursive: true });
  const target = uploadManifestPath();
  const temp = `${target}.tmp`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temp, target);
}

function entriesFromManifest(manifest) {
  return Object.entries(manifest.entries ?? {}).map(([key, entry]) => {
    const [, accent] = key.split(':');
    if (!entry.cardId || !['uk', 'us'].includes(accent) || !entry.file) {
      throw new Error(`Invalid generated audio manifest entry: ${key}`);
    }
    const sourcePath = resolve(ROOT, entry.file);
    if (!sourcePath.startsWith(`${options.sourceDir}\\`) && !sourcePath.startsWith(`${options.sourceDir}/`)) {
      throw new Error(`Audio source is outside source directory: ${entry.file}`);
    }
    if (!existsSync(sourcePath)) throw new Error(`Generated audio file missing: ${entry.file}`);
    return {
      key,
      entry,
      sourcePath,
      objectPath: `v1/${accent}/${entry.cardId}.mp3`,
    };
  });
}

function isUploaded(item, uploadManifest) {
  const existing = uploadManifest.uploaded[item.key];
  return existing
    && existing.textHash === item.entry.textHash
    && existing.objectPath === item.objectPath;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function uploadOnce(item) {
  const body = readFileSync(item.sourcePath);
  const response = await fetch(
    `${options.supabaseUrl}/storage/v1/object/${encodeURIComponent(options.bucket)}/${item.objectPath}`,
    {
      method: 'POST',
      headers: {
        apikey: options.supabaseKey,
        Authorization: `Bearer ${options.supabaseKey}`,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'x-upsert': 'true',
      },
      body,
    },
  );
  if (!response.ok) throw new Error(`Supabase upload ${response.status}: ${await response.text()}`);
}

async function uploadWithRetry(item) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await uploadOnce(item);
      return;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const waitMs = 1000 * 2 ** (attempt - 1);
      console.error(`${item.key} attempt ${attempt}/${maxAttempts} failed; retrying in ${waitMs}ms.`);
      await delay(waitMs);
    }
  }
}

async function main() {
  const generatedManifest = readJson(manifestPath(), 'Generated audio manifest');
  const uploadManifest = readUploadManifest();
  const entries = entriesFromManifest(generatedManifest);
  const pending = entries.filter((item) => !isUploaded(item, uploadManifest));
  const totalBytes = pending.reduce((sum, item) => sum + readFileSync(item.sourcePath).length, 0);

  console.log(JSON.stringify({
    bucket: options.bucket,
    generatedFiles: entries.length,
    pendingFiles: pending.length,
    pendingBytes: totalBytes,
    concurrency: options.concurrency,
    apply: options.apply,
  }, null, 2));

  if (!options.apply) {
    console.log('Dry run only. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, then add --apply to upload.');
    return;
  }
  if (!options.supabaseUrl || !options.supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for --apply.');
  }

  let nextIndex = 0;
  let completed = 0;
  const checkpointEvery = 25;
  async function worker() {
    while (true) {
      const item = pending[nextIndex];
      nextIndex += 1;
      if (!item) return;
      await uploadWithRetry(item);
      uploadManifest.uploaded[item.key] = {
        textHash: item.entry.textHash,
        objectPath: item.objectPath,
      };
      completed += 1;
      if (completed % checkpointEvery === 0 || completed === pending.length) {
        writeUploadManifest(uploadManifest);
        console.log(`Uploaded ${completed}/${pending.length}.`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(options.concurrency, pending.length) }, () => worker()));
  writeUploadManifest(uploadManifest);
}

await main();
