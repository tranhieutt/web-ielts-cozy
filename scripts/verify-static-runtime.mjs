import { access, readFile } from 'node:fs/promises';

const files = [
  'index.html',
  'assets/dc-runtime.js',
  'assets/images/top_home_page.png',
  'assets/images/reading_home_page.png',
  'assets/images/writing_home_page.png',
  'assets/images/listening_home_page.png',
  'assets/images/speaking_home_page.png'
];
for (const file of files) await access(new URL(`../${file}`, import.meta.url));

const [html, dcRuntime] = await Promise.all(['index.html', 'assets/dc-runtime.js'].map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
for (const fragment of ['<x-dc>', 'data-dc-script', 'assets/dc-runtime.js', 'assets/images/']) {
  if (!html.includes(fragment)) throw new Error(`index.html missing ${fragment}`);
}
for (const screen of ['dashboard', 'reading', 'listening', 'writing', 'speaking', 'mock', 'vocab', 'library', 'progress', 'profile']) {
  if (!html.includes(`'${screen}'`)) throw new Error(`index.html missing ${screen} mockup screen`);
}
if (html.includes('uploads/') || html.includes('Pantone')) throw new Error('index.html must use runtime assets and canonical design names');
if (!dcRuntime.includes('loadReactUmd')) throw new Error('DC runtime is incomplete');
console.log('Full mockup IELTS runtime verified.');
