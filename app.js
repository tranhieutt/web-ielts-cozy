const app = document.querySelector('#app');
const navButtons = [...document.querySelectorAll('[data-route]')];
const storageKey = 'ielts-cozy-runtime-v1';

const decks = [
  { word: 'carbon footprint', meaning: 'lượng khí thải do hoạt động tạo ra', example: 'Cycling to school can cut your carbon footprint.' },
  { word: 'sustainable', meaning: 'bền vững, có thể duy trì lâu dài', example: 'Cities need sustainable transport systems.' },
  { word: 'mitigate', meaning: 'giảm nhẹ tác động xấu', example: 'Trees help mitigate air pollution.' },
  { word: 'renewable energy', meaning: 'năng lượng tái tạo', example: 'Solar power is a renewable energy source.' }
];

const defaultState = { xp: 3960, known: 18, cardIndex: 0, flipped: false, listeningProgress: 0, listeningPlaying: false, listeningSpeed: 1, grammarAnswered: false, grammarAnswer: '', grammarCorrect: false };
let state = loadState();
let listeningTimer;

function loadState() {
  try { return { ...defaultState, ...JSON.parse(localStorage.getItem(storageKey)) }; }
  catch { return { ...defaultState }; }
}

function saveState() { localStorage.setItem(storageKey, JSON.stringify(state)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function routeFromHash() { return location.hash.replace('#', '') || 'home'; }
function setRoute(route) { location.hash = route; }
function progressPercent() { return Math.min(100, Math.round((state.xp - 3600) / 600 * 100)); }
function pageHeader(eyebrow, title, detail) { return `<header class="learning-header"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1>${detail ? `<p class="lead">${detail}</p>` : ''}</div><span class="pill">${state.xp.toLocaleString('vi-VN')} XP</span></header>`; }

function renderHome() {
  return `<section class="page">
    <div class="hero">
      <div><p class="eyebrow">IELTS Cozy · 2026</p><h1>Luyện IELTS 20 phút mỗi ngày.</h1><p class="lead">Bài tập ngắn, phản hồi rõ, nhịp học đều. Bắt đầu từ kỹ năng bạn muốn cải thiện hôm nay.</p><div class="actions"><button class="button button--primary" data-route="dashboard">Bắt đầu</button><button class="button button--outline" data-route="progress">Xem tiến độ</button></div></div>
      <div class="hero-media"><img src="assets/images/top_home_page.png" alt="Góc học tập bên cửa sổ" /><div class="hero-stat"><div><strong>6.5 → 7.5</strong><span>Band mục tiêu</span></div><div><strong>12 tuần</strong><span>Lộ trình</span></div></div></div>
    </div>
    <section class="section"><div class="section-heading"><div><p class="eyebrow">Học theo nhịp của bạn</p><h2>Chọn một việc nhỏ để bắt đầu</h2></div></div><div class="card-grid">
      ${skillCard('Từ vựng', 'Lật thẻ · giữ nhịp ôn', 'vocabulary', 'var(--color-vocabulary)', 'assets/images/reading_home_page.png')}
      ${skillCard('Ngữ pháp', 'Chấm ngay · có giải thích', 'grammar', 'var(--color-grammar)', 'assets/images/writing_home_page.png')}
      ${skillCard('Listening', 'Điền đáp án · kiểm tra', 'listening', 'var(--color-listening)', 'assets/images/listening_home_page.png')}
      ${skillCard('Tiến độ', 'Xem band và điểm yếu', 'progress', 'var(--color-review)', 'assets/images/speaking_home_page.png')}
    </div></section>
  </section>`;
}

function skillCard(name, description, route, color, image) {
  return `<button class="skill-card" style="--card-color:${color}" data-route="${route}"><img src="${image}" alt="" /><span class="skill-card__content"><span class="skill-card__title">${name}<b>↗</b></span><span>${description}</span></span></button>`;
}

function renderDashboard() {
  const xp = progressPercent();
  return `<section class="page">${pageHeader('Hôm nay / Today', 'Chào Khôi, làm 3 việc nhỏ nhé', 'Mỗi bài hoàn thành sẽ cập nhật XP ngay trên thiết bị này.')}
    <div class="dashboard-grid"><section class="card card--primary"><div class="section-heading"><div><p class="eyebrow">Nhiệm vụ ưu tiên</p><h2>Giữ streak ngày 18</h2></div><span class="pill">+120 XP</span></div><div class="stack">
      ${task('var(--color-vocabulary)', 'Ôn 4 từ · Environment', '5 phút · flashcard ngắt quãng', 'Ôn →', 'vocabulary')}
      ${task('var(--color-grammar)', 'Grammar · Sentence correction', '8 phút · nhận giải thích ngay', 'Làm →', 'grammar')}
      ${task('var(--color-listening)', 'Listening · Campus tour', '7 phút · note completion', 'Nghe →', 'listening')}
    </div></section>
    <aside class="stack"><section class="card card--grammar"><p class="eyebrow">Streak</p><h2>18 <span class="muted" style="font-size:14px;font-weight:400">ngày liên tiếp</span></h2><div class="streak-days">${['T2','T3','T4','T5','T6','T7','CN'].map((d, i) => `<span class="${i < 5 ? 'done' : ''}">${d}</span>`).join('')}</div></section>
    <section class="card"><p class="eyebrow">XP level 12</p><h2>${state.xp.toLocaleString('vi-VN')} XP</h2><div class="progress-track" aria-label="Tiến độ XP"><span style="width:${xp}%"></span></div><p class="muted" style="margin:8px 0 0;font-size:14px">${xp}% đến level tiếp theo</p></section></aside></div>
    <section class="section"><p class="eyebrow">Band dự đoán</p><h2>6.5 <span style="color:var(--color-brand);font-size:16px">▲ 0.5</span></h2><div class="stat-row">${[['L','6.5'],['R','7.0'],['W','6.0'],['S','6.0']].map(([key, value]) => `<div class="stat"><span>${key}</span><strong>${value}</strong></div>`).join('')}</div></section>
  </section>`;
}

function task(color, title, meta, action, route) { return `<button class="task" style="--task-color:${color}" data-route="${route}"><span class="task-dot"></span><span><b>${title}</b><small>${meta}</small></span><strong>${action}</strong></button>`; }

function renderVocabulary() {
  const card = decks[state.cardIndex % decks.length];
  const seen = state.cardIndex + 1;
  return `<section class="page">${pageHeader('Từ vựng · Environment', 'Ôn theo thẻ, nhớ theo ngữ cảnh', 'Chạm vào thẻ để xem nghĩa. Chọn mức nhớ để chuyển thẻ tiếp theo.')}
    <div class="learning-layout"><section class="card"><div class="section-heading"><p class="eyebrow">${seen} / ${decks.length} · Bộ Environment</p><span class="pill">Đã thuộc ${state.known}</span></div><button class="flashcard ${state.flipped ? 'is-flipped' : ''}" data-action="flip-card" aria-pressed="${state.flipped}"><span>${state.flipped ? 'Nghĩa tiếng Việt' : 'Từ vựng'}</span><strong>${state.flipped ? card.meaning : card.word}</strong><span>${state.flipped ? card.example : 'Chạm để xem nghĩa và ví dụ'}</span></button><div class="actions" style="margin-top:24px"><button class="button button--outline" data-action="review-again">Chưa thuộc</button><button class="button button--primary" data-action="review-known">Thuộc rồi +10 XP</button></div></section>
    <aside class="stack"><section class="card card--vocabulary"><p class="eyebrow">Mẹo ghi nhớ</p><h2>Đọc ví dụ thành tiếng</h2><p class="muted">Gắn từ mới vào câu quen thuộc sẽ dễ gọi lại hơn khi làm Speaking hoặc Writing.</p></section><section class="card"><p class="eyebrow">Tiến độ bộ từ</p><h2>${state.known} / 24 từ</h2><div class="progress-track"><span style="width:${Math.min(100, Math.round(state.known / 24 * 100))}%"></span></div></section></aside></div>
  </section>`;
}

function renderGrammar() {
  const feedback = state.grammarAnswered ? `<div class="feedback ${state.grammarCorrect ? '' : 'is-error'}" id="grammar-feedback"><b>${state.grammarCorrect ? 'Đúng rồi.' : 'Chưa đúng.'}</b> “has been” diễn tả thay đổi bắt đầu trong quá khứ và còn ảnh hưởng tới hiện tại.</div>` : '';
  return `<section class="page">${pageHeader('Ngữ pháp · Present perfect', 'Chọn câu đúng nhất', 'Một câu mỗi lần. Sau khi nộp, xem lý do rồi chuyển sang bài tiếp theo.')}
    <div class="learning-layout"><section class="card"><p class="eyebrow">Câu 1 / 8 · 10 XP</p><h2>Which sentence is grammatically correct?</h2><form id="grammar-form"><div class="choice-list">
      ${choice('a', 'Air pollution has increased significantly over the last decade.')}
      ${choice('b', 'Air pollution have increased significantly over the last decade.')}
      ${choice('c', 'Air pollution is increased significantly over the last decade.')}
      ${choice('d', 'Air pollution has increase significantly over the last decade.')}
    </div><button class="button button--primary" type="submit" ${state.grammarAnswered ? 'disabled' : ''}>${state.grammarAnswered ? 'Đã nộp đáp án' : 'Nộp đáp án'}</button></form>${feedback}</section>
    <aside class="stack"><section class="card card--grammar"><p class="eyebrow">Quy tắc</p><h2>has / have + past participle</h2><p class="muted">Dùng với kết quả, trải nghiệm hoặc thay đổi liên quan tới hiện tại.</p></section><section class="card"><p class="eyebrow">Chuỗi luyện hôm nay</p><h2>3 / 8 câu</h2><div class="progress-track"><span style="width:38%"></span></div></section></aside></div>
  </section>`;
}

function choice(value, label) { return `<label class="choice"><input name="grammar" type="radio" value="${value}" ${state.grammarAnswer === value ? 'checked' : ''} ${state.grammarAnswered ? 'disabled' : ''} /><span>${label}</span></label>`; }

function renderListening() {
  const percent = state.listeningProgress;
  const seconds = Math.round(percent / 100 * 42);
  return `<section class="page">${pageHeader('Listening · Section 2', 'Campus tour information', 'Bản demo không có audio thật. Dùng trình phát mô phỏng để kiểm tra flow nhập và chấm đáp án.')}
    <div class="learning-layout"><section class="card"><div class="audio-panel"><p class="eyebrow">Audio demo · 0${state.listeningSpeed.toFixed(2).replace('0.', '.')}×</p><h2>Welcome to the university campus</h2><div class="progress-track" aria-label="Tiến độ audio demo"><span style="width:${percent}%"></span></div><div class="audio-controls"><button class="play-button" data-action="toggle-audio" aria-label="${state.listeningPlaying ? 'Tạm dừng' : 'Phát'} audio demo">${state.listeningPlaying ? 'Ⅱ' : '▶'}</button><span class="timer">00:${String(seconds).padStart(2, '0')} / 00:42</span><button class="speed" data-action="change-speed">${state.listeningSpeed.toFixed(2)}×</button></div></div>
    <form id="listening-form"><div class="input-stack"><label>Question 1 · Meeting point<input class="answer-input" name="q1" maxlength="32" autocomplete="off" placeholder="Type one or two words" /></label><label>Question 2 · Tour starts at<input class="answer-input" name="q2" maxlength="32" autocomplete="off" placeholder="Type a time" /></label><label>Question 3 · Bring your<input class="answer-input" name="q3" maxlength="32" autocomplete="off" placeholder="Type one word" /></label></div><button class="button button--primary" type="submit">Kiểm tra đáp án</button></form><div id="listening-feedback" aria-live="polite"></div></section>
    <aside class="stack"><section class="card card--listening"><p class="eyebrow">Quy tắc</p><h2>Không quá hai từ</h2><p class="muted">Đọc yêu cầu trước, gạch chân loại thông tin cần nghe, sau đó kiểm tra chính tả.</p></section><section class="card"><p class="eyebrow">Lưu ý runtime</p><p class="muted">Audio thật, file licensed, signed URL và lưu attempt sẽ được thêm cùng backend.</p></section></aside></div>
  </section>`;
}

function renderProgress() {
  const values = [52, 61, 61, 70, 70, 78, 70, 78];
  return `<section class="page">${pageHeader('Tiến độ · 8 tuần', 'Bạn đang tiến gần band 7.0', 'Dữ liệu demo hiển thị trên trình duyệt hiện tại. Backend sẽ là nguồn dữ liệu thật.')}
    <div class="learning-layout"><section class="card"><p class="eyebrow">Xu hướng band dự đoán</p><h2>6.5 <span style="color:var(--color-brand);font-size:16px">▲ 0.5</span></h2><div class="chart" role="img" aria-label="Band tăng từ 5.0 lên 6.5 trong tám tuần">${values.map((value, index) => `<div class="chart-column"><span style="height:${value}%"></span><small>W${index + 1}</small></div>`).join('')}</div></section>
    <aside class="stack"><section class="card card--grammar"><p class="eyebrow">Điểm cần luyện</p><h2>True / False / Not Given</h2><p class="muted">Độ chính xác 52%. Làm 1 passage ngắn để phân biệt False và Not Given.</p><button class="button button--outline" data-route="grammar">Luyện ngay</button></section><section class="card"><p class="eyebrow">XP hiện tại</p><h2>${state.xp.toLocaleString('vi-VN')}</h2><div class="progress-track"><span style="width:${progressPercent()}%"></span></div></section></aside></div>
  </section>`;
}

function render() {
  clearInterval(listeningTimer);
  const route = routeFromHash();
  const screens = { home: renderHome, dashboard: renderDashboard, vocabulary: renderVocabulary, grammar: renderGrammar, listening: renderListening, progress: renderProgress };
  const renderScreen = screens[route] || screens.home;
  app.innerHTML = renderScreen();
  navButtons.forEach(button => button.setAttribute('aria-current', button.dataset.route === route ? 'page' : 'false'));
  document.title = `${route === 'home' ? 'IELTS Cozy' : `${route[0].toUpperCase()}${route.slice(1)} · IELTS Cozy`}`;
  if (route === 'listening' && state.listeningPlaying) startAudioTimer();
}

function startAudioTimer() {
  clearInterval(listeningTimer);
  listeningTimer = setInterval(() => {
    if (!state.listeningPlaying) return;
    state.listeningProgress = Math.min(100, state.listeningProgress + (state.listeningSpeed * 2));
    if (state.listeningProgress >= 100) state.listeningPlaying = false;
    saveState();
    render();
  }, 600);
}

document.addEventListener('click', event => {
  const routeTarget = event.target.closest('[data-route]');
  if (routeTarget) { setRoute(routeTarget.dataset.route); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (!action) return;
  if (action === 'flip-card') state.flipped = !state.flipped;
  if (action === 'review-again') { state.cardIndex += 1; state.flipped = false; }
  if (action === 'review-known') { state.cardIndex += 1; state.known += 1; state.xp += 10; state.flipped = false; }
  if (action === 'toggle-audio') state.listeningPlaying = !state.listeningPlaying;
  if (action === 'change-speed') state.listeningSpeed = state.listeningSpeed === 1 ? 1.25 : state.listeningSpeed === 1.25 ? .75 : 1;
  saveState();
  render();
});

document.addEventListener('submit', event => {
  if (event.target.id === 'grammar-form') {
    event.preventDefault();
    if (state.grammarAnswered) return;
    const answer = new FormData(event.target).get('grammar');
    if (!answer) return;
    state.grammarAnswered = true;
    state.grammarAnswer = answer;
    state.grammarCorrect = answer === 'a';
    if (state.grammarCorrect) state.xp += 10;
    saveState();
    render();
  }
  if (event.target.id === 'listening-form') {
    event.preventDefault();
    const data = new FormData(event.target);
    const correct = [['q1', 'library'], ['q2', 'ten'], ['q3', 'map']].reduce((count, [key, answer]) => count + (String(data.get(key)).trim().toLowerCase() === answer ? 1 : 0), 0);
    const feedback = document.querySelector('#listening-feedback');
    feedback.innerHTML = `<div class="feedback ${correct === 3 ? '' : 'is-error'}"><b>${correct}/3 đúng.</b> Đáp án demo: library · ten · map. ${correct === 3 ? 'Bạn nhận thêm 15 XP.' : 'Thử nghe lại từ khóa trước khi nộp.'}</div>`;
    if (correct === 3) { state.xp += 15; saveState(); }
  }
});

window.addEventListener('hashchange', render);
if (!location.hash) location.hash = 'home';
render();
