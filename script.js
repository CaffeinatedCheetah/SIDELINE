'use strict';

/* ── VIEW ROUTER ─────────────────────────────── */
const VIEWS = ['home','my-arena','game-room','debate-center','communities','profile','hall-of-flame','more'];

function showView(id) {
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.classList.remove('active');
  });
  const target = document.getElementById('view-' + id);
  if (target) { target.classList.add('active'); window.scrollTo(0,0); }
  document.querySelectorAll('[data-view]').forEach(a => {
    a.classList.toggle('nav-active', a.dataset.view === id);
  });
  history.pushState({ view: id }, '', '#' + id);
  onViewLoad(id);
}

function onViewLoad(id) {
  if (id === 'home') { loadLiveScores(); loadTrendingTakes(); }
  if (id === 'my-arena') initArena();
  if (id === 'hall-of-flame') loadHallOfFlame();
}

window.addEventListener('popstate', e => showView(e.state?.view || 'home'));

/* ── TOAST ───────────────────────────────────── */
const toast = document.getElementById('toast');
function showToast(msg) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* ── FOOTER YEAR ─────────────────────────────── */
const fy = document.getElementById('footer-year');
if (fy) fy.textContent = new Date().getFullYear();

/* ── MODAL ───────────────────────────────────── */
const modalBackdrop = document.getElementById('modal-backdrop');
function openModal(mode) {
  if (!modalBackdrop) return;
  const title = document.getElementById('modal-title');
  const sub = document.getElementById('modal-sub');
  if (title) title.textContent = mode === 'login' ? 'Welcome back to FanTakes' : 'Create your FanTakes profile';
  if (sub) sub.textContent = mode === 'login'
    ? 'Sign in to access your arena, takes & fan score.'
    : 'Pick your teams, join communities, and build your reputation.';
  modalBackdrop.hidden = false;
  document.body.style.overflow = 'hidden';
  const container = document.getElementById('clerk-container');
  const form = document.getElementById('signup-form');
  if (window.clerkReady && window.clerk && container) {
    if (form) form.style.display = 'none';
    container.style.display = 'block';
    try {
      if (mode === 'login') window.clerk.mountSignIn(container, { afterSignInUrl: '#my-arena' });
      else window.clerk.mountSignUp(container, { afterSignUpUrl: '/onboarding.html' });
    } catch { container.style.display = 'none'; if (form) form.style.display = 'flex'; }
  } else {
    if (container) container.style.display = 'none';
    if (form) form.style.display = 'flex';
  }
}
function closeModal() {
  if (modalBackdrop) modalBackdrop.hidden = true;
  document.body.style.overflow = '';
}
if (modalBackdrop) modalBackdrop.addEventListener('click', e => { if (e.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ── SIGNUP FORM ─────────────────────────────── */
const signupForm = document.getElementById('signup-form');
if (signupForm) {
  signupForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('f-name')?.value?.trim();
    const team = document.getElementById('f-team')?.value;
    if (!name || !team) return;
    localStorage.setItem('ft_name', name);
    localStorage.setItem('ft_team', team);
    closeModal();
    showToast(`Welcome to FanTakes, ${name}! 🔥`);
    setTimeout(() => showView('my-arena'), 400);
  });
}

/* ── COMMUNITY JOIN ──────────────────────────── */
function joinComm(id, card) {
  const btn = card?.querySelector('.comm-join-btn');
  if (btn) { btn.textContent = '✓ JOINED'; btn.classList.add('joined'); btn.disabled = true; }
  showToast('You joined the community! 🎉');
}

/* ── SUBSCRIBE ───────────────────────────────── */
function handleSubscribe(e) {
  e.preventDefault();
  const input = e.target.querySelector('input');
  if (input?.value) { showToast("You're in the arena! 🏟️"); input.value = ''; }
}

/* ── DEBATE TABS ─────────────────────────────── */
function switchDebateTab(tab, btn) {
  document.querySelectorAll('.dc-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* ── GAME ROOM TABS ──────────────────────────── */
function switchGRTab(tab, btn) {
  document.querySelectorAll('.gr-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.gr-tab').forEach(b => b.classList.remove('active'));
  const el = document.getElementById('gr-tab-' + tab);
  if (el) el.style.display = 'block';
  if (btn) btn.classList.add('active');
}

/* ── COMMUNITY TABS ──────────────────────────── */
function switchCommTab(tab, btn) {
  document.querySelectorAll('.cm-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* ── PROFILE TABS ────────────────────────────── */
function switchProfileTab(tab, btn) {
  document.querySelectorAll('.fp-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

/* ── GAME ROOM POST ──────────────────────────── */
function postGameTake(inputId) {
  const input = document.getElementById(inputId);
  if (!input?.value?.trim()) return;
  showToast('Take dropped! 🔥');
  input.value = '';
}

/* ── VOTE TAKE ───────────────────────────────── */
function voteTake(takeId, type, btn) {
  if (btn.dataset.voted) return;
  btn.dataset.voted = '1';
  if (type === 'fire') { btn.style.background = 'var(--red)'; btn.style.color = 'white'; }
  else { btn.style.background = 'rgba(22,137,201,.4)'; btn.style.color = '#46b5ea'; }
  showToast(type === 'fire' ? '🔥 Fire!' : '🧊 Ice cold!');
}

/* ── STREAK ──────────────────────────────────── */
function updateStreak() {
  const badge = document.getElementById('streak-badge');
  const num = document.getElementById('streak-num');
  if (!badge || !num) return;
  const today = new Date().toDateString();
  const last = localStorage.getItem('ft_last');
  let streak = parseInt(localStorage.getItem('ft_streak') || '0');
  if (last !== today) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    streak = last === yesterday.toDateString() ? streak+1 : 1;
    localStorage.setItem('ft_last', today);
    localStorage.setItem('ft_streak', streak);
  }
  if (streak >= 2) { badge.style.display = 'flex'; num.textContent = streak; }
}

/* ── LIVE SCORES ─────────────────────────────── */
async function loadLiveScores() {
  try {
    const res = await fetch('/api/agent-pulse');
    if (!res.ok) return;
    const data = await res.json();
    const scores = data.scores || data.games || [];
    const live = scores.filter(g => {
      const s = (g.status||'').toLowerCase();
      return s.includes('progress')||s.includes('live')||s.match(/q\d/i)||s.match(/\d+'/);
    });
    if (live.length && live[0]) {
      const g = live[0];
      const set = (id,v) => { const el=document.getElementById(id); if(el&&v!=null) el.textContent=v; };
      set('g-nfl-home', g.homeScore ?? '');
      set('g-nfl-away', g.awayScore ?? '');
      set('g-nfl-clock', g.status || 'LIVE');
    }
  } catch {}
}

/* ── TRENDING TAKES ──────────────────────────── */
async function loadTrendingTakes() {
  try {
    const res = await fetch('/api/fan-takes?sort=fire&limit=4');
    if (!res.ok) return;
    const { takes } = await res.json();
    if (!takes?.length) return;
    const list = document.getElementById('trending-takes-list');
    if (!list) return;
    const fmt = n => n>=1000?(n/1000).toFixed(1)+'K':n;
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    list.innerHTML = takes.map(t => `
      <div class="trending-take-row" onclick="showView('hall-of-flame')">
        <span class="take-fire-icon">🔥</span>
        <div class="take-row-body">
          <div class="take-row-text">${esc(t.text||'')}</div>
          <div class="take-row-tag">${esc(t.sport||'Sports')}</div>
        </div>
        <div class="take-row-counts">
          <span>👍 ${fmt(t.fireCount||0)}</span>
          <span>💬 ${fmt(t.replyCount||0)}</span>
        </div>
      </div>`).join('');
  } catch {}
}

/* ── HALL OF FLAME ───────────────────────────── */
async function loadHallOfFlame() {
  try {
    const res = await fetch('/api/fan-takes?sort=fire&limit=5');
    if (!res.ok) return;
    const { takes } = await res.json();
    if (!takes?.length) return;
    const list = document.getElementById('hof-takes-list');
    if (!list) return;
    const fmt = n => n>=1000?(n/1000).toFixed(1)+'K':n;
    const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    list.innerHTML = takes.map((t,i) => `
      <div class="hof-item">
        <div class="hof-rank">${['🔥','🔥','🔥','4','5'][i]}</div>
        <div class="hof-item-body">
          <div class="hof-quote">"${esc(t.text||'')}"</div>
          <div class="hof-meta">${esc(t.sport||'Sports')} · ${fmt(t.fireCount||0)} upvotes</div>
        </div>
        <div class="hof-thumb" style="background:linear-gradient(135deg,#1a0a0a,#050508)">🔥</div>
      </div>`).join('');
  } catch {}
}

/* ── ARENA INIT ──────────────────────────────── */
function initArena() {
  const name = window.userDisplayName || localStorage.getItem('ft_name') || 'Jordan';
  const el = document.getElementById('arena-welcome-name');
  if (el) el.textContent = name.split(' ')[0];
}

/* ── CLERK AUTH ──────────────────────────────── */
async function initClerk() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error();
    const { clerkKey } = await res.json();
    if (!clerkKey) throw new Error();
    const clerk = new window.Clerk(clerkKey);
    await clerk.load();
    window.clerk = clerk; window.clerkReady = true;
    if (clerk.user) {
      window.userDisplayName = clerk.user.firstName || '';
      document.getElementById('btn-login')?.style && (document.getElementById('btn-login').style.display = 'none');
      document.getElementById('btn-signup')?.style && (document.getElementById('btn-signup').style.display = 'none');
      const menu = document.getElementById('user-menu');
      const avatar = document.getElementById('user-avatar');
      if (menu) menu.style.display = 'flex';
      if (avatar) avatar.textContent = (clerk.user.firstName?.[0] || 'U').toUpperCase();
      updateStreak();
    }
  } catch { window.clerkReady = false; updateStreak(); }
}

/* ── INIT ────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const hash = location.hash.replace('#','');
  const validView = VIEWS.includes(hash) ? hash : 'home';
  showView(validView);
  initClerk();
  updateStreak();
});
