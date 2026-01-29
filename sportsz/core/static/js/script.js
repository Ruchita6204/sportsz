// script.js - Interactive logic for SportsZ prototype
// Stores data in localStorage and provides UI interactions for the HTML/CSS provided.

// ---------- Utilities ----------
const qs = sel => document.querySelector(sel);
const qsa = sel => Array.from(document.querySelectorAll(sel));

const STORAGE = {
  users: 'sportsz_users',
  history: 'sportsz_history',
  videos: 'sportsz_videos',
  community: 'sportsz_community',
  dream: 'sportsz_dream',
  quotes: 'sportsz_quotes'
};

function load(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    console.error('load error', e);
    return fallback;
  }
}
function save(key, val) {
  localStorage.setItem(key, JSON.stringify(val));
}

function uid(prefix = '') {
  return prefix + Math.random().toString(36).slice(2, 9);
}

// ---------- Navigation ----------
function showSection(id) {
  qsa('section').forEach(s => s.classList.remove('active'));
  const target = qs(`#${id}`);
  if (target) target.classList.add('active');

  // nav active button
  qsa('nav button').forEach(b => b.classList.remove('active'));
  qsa('nav button').forEach(b => {
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`showSection('${id}')`)) {
      b.classList.add('active');
    }
  });
}
window.showSection = showSection;

// set initial section
showSection('home');

// ---------- Dream Board ----------
const quotesDefault = [
  'Champions keep playing until they get it right.',
  'Hard work beats talent when talent doesn\'t work hard.',
  'Practice like you\'ve never won. Perform like you\'ve never lost.',
  'Small progress each day adds up to big results.'
];

function initDream() {
  const dream = load(STORAGE.dream, { goal: '', progress: 20 });
  qs('#dreamGoal').value = dream.goal || '';
  qs('#dreamProgress').value = dream.progress ?? 20;
  qs('#dreamProgressVal').innerText = (dream.progress ?? 20) + '%';
  qs('#dreamDisplay').innerText = dream.goal ? `Dream: ${dream.goal}` : '';
}

function saveDream() {
  const goal = qs('#dreamGoal').value.trim();
  const progress = Number(qs('#dreamProgress').value || 0);
  const dream = { goal, progress };
  save(STORAGE.dream, dream);
  qs('#dreamDisplay').innerText = goal ? `Dream: ${goal}` : '';
  showConfettiIfMilestone(progress);
}
window.saveDream = saveDream;

function updateDreamProgress() {
  const val = Number(qs('#dreamProgress').value || 0);
  qs('#dreamProgressVal').innerText = val + '%';
  const dream = load(STORAGE.dream, { goal: '', progress: 20 });
  dream.progress = val;
  save(STORAGE.dream, dream);
}
window.updateDreamProgress = updateDreamProgress;

function newQuote() {
  const arr = load(STORAGE.quotes, quotesDefault);
  const q = arr[Math.floor(Math.random() * arr.length)];
  qs('#quoteDisplay').innerText = `“${q}”`;
}
window.newQuote = newQuote;

// initialize dream & quote
if (!localStorage.getItem(STORAGE.quotes)) save(STORAGE.quotes, quotesDefault);
initDream();
newQuote();

// ---------- Registration ----------
function registerUser() {
  const name = qs('#name').value.trim();
  const age = Number(qs('#age').value || 0);
  const gender = qs('#gender').value.trim();
  const location = qs('#location').value.trim();
  const sport = qs('#sport').value.trim();
  const consent = qs('#consentChk').checked;

  if (!name || !age || !sport) {
    qs('#registerMsg').innerText = 'Please enter name, age and sport.';
    return;
  }
  if (!consent) {
    qs('#registerMsg').innerText = 'Please provide consent to proceed.';
    return;
  }

  const users = load(STORAGE.users, []);
  const user = { id: uid('u_'), name, age, gender, location, sport, createdAt: Date.now() };
  users.push(user);
  save(STORAGE.users, users);
  qs('#registerMsg').innerText = `Registered ${name}.`;

  populateDashboardFilters();
}
window.registerUser = registerUser;

// ---------- Running Speed (Camera) ----------
let runStream = null;
let runStart = null;
let runTimerInterval = null;

async function ensureCamera(videoEl) {
  try {
    if (!runStream) {
      runStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
    videoEl.srcObject = runStream;
  } catch (e) {
    console.error('camera error', e);
    alert('Unable to access camera. Check permissions.');
  }
}

async function startRunTimer() {
  const videoEl = qs('#runVideo');
  await ensureCamera(videoEl);
  runStart = performance.now();
  qs('#liveTimer').innerText = '0.00s';
  runTimerInterval = setInterval(() => {
    const elapsed = (performance.now() - runStart) / 1000;
    qs('#liveTimer').innerText = elapsed.toFixed(2) + 's';
  }, 50);
}
window.startRunTimer = startRunTimer;

function endRunTimer() {
  if (!runStart) return;
  clearInterval(runTimerInterval);
  const elapsed = (performance.now() - runStart) / 1000;
  qs('#liveTimer').innerText = elapsed.toFixed(2) + 's';
  runStart = null;

  // compute speed if distance provided
  const dist = Number(qs('#camDistance').value || 0);
  if (dist > 0) {
    const speed = (dist / elapsed).toFixed(2); // m/s
    qs('#camSpeedResult').innerText = `Speed: ${speed} m/s (${(speed * 3.6).toFixed(2)} km/h)`;

    // save to history
    addHistory({ type: 'run', distance: dist, time: elapsed, speed: Number(speed), ts: Date.now() });
    drawHistoryChart();
  }
}
window.endRunTimer = endRunTimer;

// ---------- Manual Speed Calculator ----------
function calculateSpeed() {
  const dist = Number(qs('#runDistance').value || 0);
  const time = Number(qs('#runTime').value || 0);
  if (!dist || !time) {
    qs('#speedResult').innerText = 'Enter distance and time.';
    return;
  }
  const speed = (dist / time).toFixed(2);
  qs('#speedResult').innerText = `Speed: ${speed} m/s (${(speed * 3.6).toFixed(2)} km/h)`;
  addHistory({ type: 'run_manual', distance: dist, time, speed: Number(speed), ts: Date.now() });
  drawHistoryChart();
}
window.calculateSpeed = calculateSpeed;

// ---------- Eye Detection (Demo) ----------
let eyeStream = null;
async function startEyeDetection() {
  const videoEl = qs('#eyeVideo');
  try {
    if (!eyeStream) eyeStream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoEl.srcObject = eyeStream;
    qs('#eyeResult').innerText = '👁 Detection running (demo): Keep your eye steady and centered.';

    // Demo: sample a few frames and give simple feedback
    const feedbackTimeout = setTimeout(() => {
      qs('#eyeResult').innerText = 'Good — eyes appear steady for demo sample.';
      clearTimeout(feedbackTimeout);
    }, 1500);
  } catch (e) {
    console.error(e);
    alert('Camera access required for eye demo.');
  }
}
window.startEyeDetection = startEyeDetection;

// ---------- Eligibility Info ----------
const eligibilityData = {
  basketball: { minAge: 14, note: 'Emphasis on height and vertical leap. Diet: high-protein, carbs around training.' },
  boxing: { minAge: 12, note: 'Cardio and strength. Diet: lean proteins and controlled weight management.' },
  archery: { minAge: 10, note: 'Focus on posture, eye alignment, steady hands. Diet: balanced for focus.' },
  marathon: { minAge: 16, note: 'High mileage training, endurance fuel (carbohydrate-rich).' },
  wrestling: { minAge: 12, note: 'Strength, weight classes — controlled diet, protein.' },
  football: { minAge: 10, note: 'Agility, endurance, team drills — balanced diet.' },
  badminton: { minAge: 10, note: 'Explosiveness and reflexes — carbs and protein.' },
  cricket: { minAge: 10, note: 'Skill-specific training — balanced diet.' }
};

function showEligibility() {
  const s = qs('#sportSelect').value;
  const box = qs('#eligibilityInfo');
  if (!s) { box.innerHTML = '' ; return; }
  const info = eligibilityData[s];
  if (!info) { box.innerHTML = '<em>No info yet.</em>'; return; }
  box.innerHTML = `\n    <div class="tag">Min Age: ${info.minAge}</div>
    <p>${info.note}</p>
  `;
}
window.showEligibility = showEligibility;

// ---------- History & Charts ----------
function addHistory(entry) {
  const hist = load(STORAGE.history, []);
  hist.push(entry);
  save(STORAGE.history, hist);
  renderHistoryUI();
}

function renderHistoryUI() {
  const hist = load(STORAGE.history, []);
  // badges and streak
  const badgesEl = qs('#badges');
  const streakEl = qs('#streak');
  badgesEl.innerHTML = '';
  const top = hist.slice(-5).map(h => {
    return `<div class="badge">${h.type === 'run' || h.type === 'run_manual' ? '🏃 ' + (h.speed || '') + ' m/s' : h.type}</div>`;
  }).join('');
  badgesEl.innerHTML = top;
  streakEl.innerText = `Records: ${hist.length}`;
}

// simple chart drawing using canvas 2D
function drawHistoryChart() {
  const canvas = qs('#historyChart');
  const ctx = canvas.getContext('2d');
  const hist = load(STORAGE.history, []).filter(h => h.type === 'run' || h.type === 'run_manual');
  // clear
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!hist.length) {
    ctx.fillStyle = '#999';
    ctx.font = '12px Arial';
    ctx.fillText('No run history yet', 10, 20);
    return;
  }
  // take last 12
  const last = hist.slice(-12);
  const speeds = last.map(h => h.speed || 0);
  const max = Math.max(...speeds) || 1;

  const w = canvas.width;
  const h = canvas.height;
  const pad = 10;
  const stepX = (w - pad * 2) / (speeds.length - 1 || 1);

  // axis
  ctx.strokeStyle = '#eee';
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  ctx.lineTo(w - pad, h - pad);
  ctx.stroke();

  // line
  ctx.beginPath();
  for (let i = 0; i < speeds.length; i++) {
    const x = pad + i * stepX;
    const y = h - pad - (speeds[i] / max) * (h - pad * 2);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = '#ff9800';
  ctx.lineWidth = 2;
  ctx.stroke();

  // dots
  ctx.fillStyle = '#ff9800';
  for (let i = 0; i < speeds.length; i++) {
    const x = pad + i * stepX;
    const y = h - pad - (speeds[i] / max) * (h - pad * 2);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function exportHistory() {
  const hist = load(STORAGE.history, []);
  if (!hist.length) return alert('No history to export');
  const rows = [Object.keys(hist[0]).join(',')];
  hist.forEach(r => rows.push(Object.values(r).join(',')));
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `sportsz_history_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
window.exportHistory = exportHistory;

// ---------- Video Uploads (UGC) ----------
function uploadVideo() {
  const input = qs('#videoUpload');
  const file = input.files && input.files[0];
  if (!file) return alert('Choose a video to upload');

  // quick checks: size and duration
  const videos = load(STORAGE.videos, []);
  // duplicate size check
  const dup = videos.find(v => v.size === file.size && v.name === file.name);
  if (dup) return alert('Duplicate video blocked.');

  const url = URL.createObjectURL(file);
  const tmpVideo = document.createElement('video');
  tmpVideo.preload = 'metadata';
  tmpVideo.src = url;
  tmpVideo.onloadedmetadata = () => {
    const dur = tmpVideo.duration;
    URL.revokeObjectURL(url);
    if (dur < 1) return alert('Video too short.');
    // save
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      const item = { id: uid('v_'), name: file.name, size: file.size, duration: dur, data: base64, ts: Date.now() };
      videos.push(item);
      save(STORAGE.videos, videos);
      renderVideoFeed();
      alert('Video uploaded (demo).');
    };
    reader.readAsDataURL(file);
  };
}
window.uploadVideo = uploadVideo;

function renderVideoFeed() {
  const feed = qs('#videoFeed');
  const videos = load(STORAGE.videos, []);
  feed.innerHTML = videos.slice().reverse().map(v => `
    <div class="video-card">
      <video src="${v.data}" controls></video>
      <div class="video-actions">
        <small>${v.name} — ${Math.round(v.duration)}s</small>
        <button onclick="playVideo('${v.id}')">Play</button>
        <button onclick="deleteVideo('${v.id}')">Delete</button>
      </div>
    </div>
  `).join('');
}

function playVideo(id) {
  const videos = load(STORAGE.videos, []);
  const v = videos.find(x => x.id === id);
  if (!v) return;
  const tmp = document.createElement('video');
  tmp.src = v.data;
  tmp.controls = true;
  tmp.style.width = '100%';
  alert('Playing video in a new window is not allowed in this demo. Use the feed controls.');
}

function deleteVideo(id) {
  let videos = load(STORAGE.videos, []);
  videos = videos.filter(v => v.id !== id);
  save(STORAGE.videos, videos);
  renderVideoFeed();
}

// ---------- Communities ----------
function postTalent() {
  const name = qs('#talentName').value.trim();
  const title = qs('#talentTitle').value.trim();
  if (!name || !title) return alert('Enter name and title');
  const feed = load(STORAGE.community, []);
  const item = { id: uid('c_'), name, title, ts: Date.now() };
  feed.push(item);
  save(STORAGE.community, feed);
  renderCommunityFeed();
  qs('#talentName').value = '';
  qs('#talentTitle').value = '';
}
window.postTalent = postTalent;

function renderCommunityFeed() {
  const container = qs('#communityFeed');
  const feed = load(STORAGE.community, []);
  container.innerHTML = feed.slice().reverse().map(i => `
    <div class="talent-card">
      <div class="talent-head">
        <div class="avatar">${i.name[0] || 'A'}</div>
        <div><b>${i.name}</b><br><small>${new Date(i.ts).toLocaleString()}</small></div>
      </div>
      <div><em>${i.title}</em></div>
    </div>
  `).join('');
}

// ---------- News (placeholder) ----------
function loadNewsPlaceholder() {
  const list = qs('#newsList');
  const sample = [
    { title: 'Local meet: Emerging athletes shine', date: '2025-08-28', src: 'District Sports' },
    { title: 'Tips to improve sprint starts', date: '2025-07-12', src: 'Coach Corner' }
  ];
  list.innerHTML = sample.map(n => `\n    <div class="news-card">\n      <b>${n.title}</b><br><small>${n.src} • ${n.date}</small>\n    </div>\n  `).join('');
}

// ---------- Meta AI (rule-based demo) ----------
function aiRespond() {
  const text = qs('#aiInput').value.trim();
  if (!text) return;
  pushAIMessage(text, true);
  qs('#aiInput').value = '';

  // simple rules
  setTimeout(() => {
    let reply = 'Sorry, I\'m a demo assistant. Try: "improve 100m" or "archery eye".';
    if (/100m|100 m|sprint/.test(text.toLowerCase())) {
      reply = 'To improve 100m: work on reaction time, explosive starts, stride length, and strength. Do short sprints + plyometrics.';
    } else if (/archery|eye|aim/.test(text.toLowerCase())) {
      reply = 'Archery tips: consistent anchor point, focus on the target with your dominant eye, breathing control, and steady release.';
    } else if (/diet|nutrition/.test(text.toLowerCase())) {
      reply = 'General sports nutrition: balance carbs around training, include lean protein for recovery, stay hydrated.';
    }
    pushAIMessage(reply, false);
  }, 700);
}
window.aiRespond = aiRespond;

function pushAIMessage(text, isUser = false) {
  const box = qs('#aiChat');
  const el = document.createElement('div');
  el.className = `msg ${isUser ? 'me' : 'ai'}`;
  el.innerText = text;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

// ---------- Dashboard / Filters ----------
function populateDashboardFilters() {
  const users = load(STORAGE.users, []);
  const sel = qs('#filterSport');
  const currentOptions = Array.from(sel.options).map(o => o.value);
  const sports = Array.from(new Set(users.map(u => u.sport))).filter(Boolean);
  // add new options
  sports.forEach(s => {
    if (!currentOptions.includes(s)) {
      const o = document.createElement('option');
      o.value = s; o.innerText = s; sel.appendChild(o);
    }
  });
  renderAthleteTable();
}

function applyFilters() {
  renderAthleteTable();
}
window.applyFilters = applyFilters;

function renderAthleteTable() {
  const nameFilter = qs('#filterName').value.trim().toLowerCase();
  const sportFilter = qs('#filterSport').value;
  const users = load(STORAGE.users, []);
  const rows = users.filter(u => {
    if (nameFilter && !u.name.toLowerCase().includes(nameFilter)) return false;
    if (sportFilter && u.sport !== sportFilter) return false;
    return true;
  });
  const container = qs('#athleteTable');
  if (!rows.length) { container.innerHTML = '<small>No athletes</small>'; return; }
  const table = `\n    <table>\n      <thead><tr><th>Name</th><th>Age</th><th>Sport</th><th>Location</th></tr></thead>\n      <tbody>\n        ${rows.map(r => `<tr><td>${r.name}</td><td>${r.age}</td><td>${r.sport}</td><td>${r.location || ''}</td></tr>`).join('')}\n      </tbody>\n    </table>\n  `;
  container.innerHTML = table;
  renderInsight();
}

function renderInsight() {
  const hist = load(STORAGE.history, []);
  const insightBox = qs('#insightBox');
  if (!hist.length) { insightBox.innerText = 'No insights yet'; return; }
  // example insight: top 10% speed
  const runs = hist.filter(h => h.speed).map(h => h.speed).sort((a,b)=>b-a);
  if (!runs.length) { insightBox.innerText = 'No speed data yet'; return; }
  const top10pct = runs[Math.max(0, Math.floor(runs.length * 0.1) - 1)] || runs[0];
  insightBox.innerHTML = `<b>Insight</b><div>Top ~10% speed: ${top10pct.toFixed(2)} m/s</div>`;
}

// ---------- Reports ----------
function generateReport() {
  // for demo, compile simple CSV of users + top speed
  const users = load(STORAGE.users, []);
  const hist = load(STORAGE.history, []);
  let csv = 'name,age,sport,top_speed_m_s\n';
  users.forEach(u => {
    const speeds = hist.filter(h => h.speed && h.ts && u).map(h => h.speed);
    const top = speeds.length ? Math.max(...speeds) : '';
    csv += `${u.name},${u.age},${u.sport},${top}\n`;
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `sportsz_report_${Date.now()}.csv`; a.click(); URL.revokeObjectURL(url);
}
window.generateReport = generateReport;

// ---------- Notifications (demo) ----------
function triggerNotification() {
  if (!('Notification' in window)) return alert('Notifications not supported.');
  if (Notification.permission === 'granted') {
    new Notification('SportsZ Reminder', { body: 'Time for your weekly practice!' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification('SportsZ Reminder', { body: 'Time for your weekly practice!' });
    });
  }
}
window.triggerNotification = triggerNotification;

// ---------- Simple Confetti ----------
const confettiCanvas = qs('#confettiCanvas');
confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight;
const confettiCtx = confettiCanvas.getContext('2d');
let confettiParticles = [];

function spawnConfetti() {
  for (let i = 0; i < 60; i++) {
    confettiParticles.push({
      x: Math.random() * confettiCanvas.width,
      y: Math.random() * -200,
      r: Math.random() * 6 + 4,
      vx: (Math.random() - 0.5) * 3,
      vy: Math.random() * 3 + 2,
      o: Math.random() * .9 + .1,
      color: null
    });
  }
  confettiParticles.forEach(p => p.color = `hsl(${Math.random()*360},60%,60%)`);
  requestAnimationFrame(stepConfetti);
}

function stepConfetti() {
  confettiCtx.clearRect(0,0,confettiCanvas.width, confettiCanvas.height);
  for (let i = confettiParticles.length -1; i >= 0; i--) {
    const p = confettiParticles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.03; p.o -= 0.002;
    confettiCtx.globalAlpha = Math.max(0, p.o);
    confettiCtx.fillStyle = p.color;
    confettiCtx.beginPath();
    confettiCtx.ellipse(p.x, p.y, p.r, p.r*0.6, 0, 0, Math.PI*2);
    confettiCtx.fill();
    if (p.y > confettiCanvas.height + 50 || p.o <= 0) confettiParticles.splice(i,1);
  }
  if (confettiParticles.length) requestAnimationFrame(stepConfetti);
}

function showConfettiIfMilestone(progress) {
  if (progress >= 100) spawnConfetti();
}

// ---------- Init ----------
function boot() {
  renderHistoryUI();
  drawHistoryChart();
  renderVideoFeed();
  renderCommunityFeed();
  loadNewsPlaceholder();
  populateDashboardFilters();
}

boot();

// Handle window resize for canvas
window.addEventListener('resize', () => {
  confettiCanvas.width = innerWidth; confettiCanvas.height = innerHeight;
  drawHistoryChart();
});

// expose for debugging
window._sportsz = { load, save, STORAGE };
