import { access, readFile } from 'node:fs/promises';

const files = [
  'index.html',
  'assets/dc-runtime.js',
  'assets/images/hero-768.webp',
  'assets/images/hero-1280.webp',
  'assets/images/reading-480.webp',
  'assets/images/reading-768.webp',
  'assets/images/writing-480.webp',
  'assets/images/writing-768.webp',
  'assets/images/listening-480.webp',
  'assets/images/listening-768.webp',
  'assets/images/speaking-480.webp',
  'assets/images/speaking-768.webp'
];
for (const file of files) await access(new URL(`../${file}`, import.meta.url));

const [html, dcRuntime] = await Promise.all(['index.html', 'assets/dc-runtime.js'].map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
for (const fragment of ['<x-dc>', 'data-dc-script', 'assets/dc-runtime.js', 'hero-1280.webp', 'loading="lazy"', 'srcset="{{ s.srcSet }}"']) {
  if (!html.includes(fragment)) throw new Error(`index.html missing ${fragment}`);
}
for (const screen of ['dashboard', 'reading', 'listening', 'writing', 'speaking', 'mock', 'vocab', 'library', 'progress', 'profile']) {
  if (!html.includes(`'${screen}'`)) throw new Error(`index.html missing ${screen} mockup screen`);
}
for (const fragment of ['@media (max-width:767px)', 'primary-nav', 'page-content', 'home-skill-grid', 'position:static!important']) {
  if (!html.includes(fragment)) throw new Error(`index.html missing mobile responsive contract: ${fragment}`);
}
if (html.includes('uploads/') || html.includes('Pantone') || html.includes('.png')) throw new Error('index.html must use optimized runtime assets and canonical design names');
if (!dcRuntime.includes('loadReactUmd')) throw new Error('DC runtime is incomplete');
console.log('Full mockup IELTS runtime verified.');
