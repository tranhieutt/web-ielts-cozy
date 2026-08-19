import { access, readFile } from 'node:fs/promises';

const files = [
  'index.html',
  'styles.css',
  'app.js',
  'assets/images/top_home_page.png',
  'assets/images/reading_home_page.png',
  'assets/images/writing_home_page.png',
  'assets/images/listening_home_page.png',
  'assets/images/speaking_home_page.png'
];
for (const file of files) await access(new URL(`../${file}`, import.meta.url));

const [html, css, js] = await Promise.all(['index.html', 'styles.css', 'app.js'].map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')));
for (const fragment of ['id="app"', 'styles.css', 'app.js']) {
  if (!html.includes(fragment)) throw new Error(`index.html missing ${fragment}`);
}
for (const token of ['--color-brand', '--color-vocabulary', '--radius-card']) {
  if (!css.includes(token)) throw new Error(`styles.css missing token ${token}`);
}
for (const route of ['vocabulary', 'grammar', 'listening', 'progress']) {
  if (!js.includes(`render${route[0].toUpperCase()}${route.slice(1)}`)) throw new Error(`app.js missing ${route} runtime`);
}
if (js.includes('references/mockup/')) throw new Error('Runtime must not import mockup reference assets');
console.log('Static IELTS runtime verified.');
