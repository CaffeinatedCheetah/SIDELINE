'use strict';

// ── VIEW ROUTER ──────────────────────────────────────────
const VIEWS = ['public-home','my-arena','game-room','debate-center','communities','fan-profile','hall-of-flame','more-support'];

function showView(viewId) {
  // Hide all views
  VIEWS.forEach(id => {
    const el = document.getElementById('view-' + id);
    if (el) el.style.display = 'none';
  });

  // Show target view
  const target = document.getElementById('view-' + viewId);
  if (target) {
    target.style.display = 'block';
    window.scrollTo(0, 0);
  }

  // Update nav active state
  document.querySelectorAll('[data-view]').forEach(link => {
    link.classList.toggle('active', link.dataset.view === viewId);
  });

  // Update URL without reload
  history.pushState({ view: viewId }, '', '#' + viewId);

  // Run view-specific init
  initView(viewId);
}

function initView(viewId) {
  switch(viewId) {
    case 'public-home': loadLiveScores(); loadTrendingTakes(); break;
    case 'my-arena': initArena(); break;
    case 'game-room': initGameRoom(); break;
    case 'debate-center': break;
    case 'communities': break;
    case 'fan-profile': initProfile(); break;
    case 'hall-of-flame': loadHallOfFlame(); break;
  }
}

// Handle browser back/forward
window.addEventListener('popstate', e => {
  const view = e.state?.view || 'public-home';
  showView(view);
});

// ── TOAST ────────────────────────────────────────────────
const toast = document.getElementById('toast');
function showToast(msg, duration = 2400) {
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

// ── FOOTER YEAR ──────────────────────────────────────────
const fy = document.getElementById('footer-year');
if (fy) fy.textContent = new Date().getFullYear();

// ── MODAL ────────────────────────────────────────────────
const backdrop = document.getElementById('modalBackdrop');
const closeModalBtn = document.getElementById('closeModal');

function openModal(mode) {
  if (!backdrop) return;
  const title = document.getElementById('modalTitle');
  const subtitle = document.getElementById('modalSubtitle');
  if (title) title.textContent = mode === 'login' ? 'Welcome back to FanTakes' : 'Create your FanTakes profile';
  if (subtitle) subtitle.textContent = mode === 'login'
    ? 'Sign in to access your arena, takes & fan score.'
    : 'Pick your teams, join communities, and start building your reputation.';
  backdrop.hidden = false;
  document.body.style.overflow = 'hidden';

  const container = document.getElementById('clerk-auth-container');
  const form = document.getElementById('signupForm');

  if (window.clerkLoaded && window.clerk && container) {
    if (form) form.style.display = 'none';
    container.style.display = 'block';
    try {
      if (mode === 'login') window.clerk.mountSignIn(container, { afterSignInUrl: '#my-arena' });
      else window.clerk.mountSignUp(container, { afterSignUpUrl: '/onboarding.html' });
    } catch { container.style.display = 'none'; if (form) form.style.display = 'grid'; }
  } else {
    if (container) container.style.display = 'none';
    if (form) form.style.display = 'grid';
  }
}

function closeModal() {
  if (backdrop) backdrop.hidden = true;
  document.body.style.overflow = '';
}

if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
if (backdrop) backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// ── SIGNUP FORM ──────────────────────────────────────────
const signupForm = document.getElementById('signupForm');
if (signupForm) {
  signupForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('signup-name')?.value;
    const team = document.getElementById('signup-team')?.value;
    if (!name || !team) return;
    localStorage.setItem('ft_guest_name', name);
    localStorage.setItem('ft_guest_team', team);
    closeModal();
    showToast(`Welcome to FanTakes, ${name}! 🔥`);
    setTimeout(() => showView('my-arena'), 300);
  });
}

// ── GAME TAB SWITCHING ───────────────────────────────────
function switchGameTab(tab, btn) {
  // Hide all game tab contents
  document.querySelectorAll('.game-tab-content').forEach(el => el.style.display = 'none');
  // Show selected
  const el = document.getElementById('game-tab-' + tab);
  if (el) el.style.display = 'block';
  // Update button states
  document.querySelectorAll('.game-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── DEBATE TABS ──────────────────────────────────────────
function switchDebateTab(tab, btn) {
  document.querySelectorAll('.debate-tab-content').forEach(el => el.style.display = 'none');
  const el = document.getElementById('debate-tab-' + tab);
  if (el) el.style.display = 'block';
  document.querySelectorAll('.debate-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── COMMUNITY TABS ───────────────────────────────────────
function switchCommunityTab(tab, btn) {
  document.querySelectorAll('.comm-tab-content').forEach(el => el.style.display = 'none');
  const el = document.getElementById('comm-tab-' + tab);
  if (el) el.style.display = 'block';
  document.querySelectorAll('.comm-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── PROFILE TABS ─────────────────────────────────────────
function switchProfileTab(tab, btn) {
  document.querySelectorAll('.profile-tab-content').forEach(el => el.style.display = 'none');
  const el = document.getElementById('profile-tab-' + tab);
  if (el) el.style.display = 'block';
  document.querySelectorAll('.profile-tabs .tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── VOTING ───────────────────────────────────────────────
function voteOnDebate(debateId, side, btn) {
  if (btn.classList.contains('voted')) return;
  btn.classList.add('voted');
  const yesEl = document.getElementById('debate-yes-' + debateId);
  const noEl = document.getElementById('debate-no-' + debateId);
  showToast('Vote locked in! 🔥');
  openModal('signup');
}

function voteOnTake(takeId, type, btn) {
  btn.style.background = type === 'fire'
    ? 'linear-gradient(135deg,#ef1f2f,#c10916)'
    : 'rgba(22,137,201,.4)';
  btn.style.color = 'white';
  showToast(type === 'fire' ? '🔥 Fire!' : '🧊 Ice cold!');
  fetch('/api/fan-takes', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ id: takeId, vote: type })
  }).catch(() => {});
}

// ── JOIN COMMUNITY ───────────────────────────────────────
function joinCommunity(id, btn) {
  if (btn) {
    btn.textContent = '✓ JOINED';
    btn.style.background = 'rgba(34,197,94,.2)';
    btn.style.color = '#22c55e';
    btn.disabled = true;
  }
  showToast('You joined the community! 🎉');
}

// ── POST TAKE ────────────────────────────────────────────
async function postTake(inputId, sport) {
  const input = document.getElementById(inputId);
  if (!input || !input.value.trim()) return;
  const text = input.value.trim();
  try {
    const res = await fetch('/api/fan-takes', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ text, sport: sport || 'general' })
    });
    if (res.ok) {
      showToast('Take dropped! 🔥 The arena sees it.');
      input.value = '';
    }
  } catch { showToast('Take dropped! 🔥'); input.value = ''; }
}

// ── SUBSCRIBE ────────────────────────────────────────────
function handleSubscribe(e) {
  e.preventDefault();
  const input = e.target.querySelector('input[type="email"]');
  if (input?.value) {
    showToast('You\'re in the arena! 🏟️');
    input.value = '';
  }
}

// ── SCROLL TO ────────────────────────────────────────────
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}

// ── HELPERS ──────────────────────────────────────────────
function fmt(n) {
  n = parseInt(n) || 0;
  return n >= 1000000 ? (n/1000000).toFixed(1) + 'M' : n >= 1000 ? (n/1000).toFixed(1) + 'K' : n;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── LIVE SCORES ──────────────────────────────────────────
async function loadLiveScores() {
  try {
    const res = await fetch('/api/agent-pulse');
    if (!res.ok) return;
    const data = await res.json();
    const scores = data.scores || data.games || [];
    if (!scores.length) return;
    updateGameCards(scores);
  } catch {}
}

function updateGameCards(scores) {
  const live = scores.filter(g => {
    const s = (g.status||'').toLowerCase();
    return s.includes('progress')||s.includes('live')||s.match(/q\d/i)||s.match(/\d+'/);
  });
  if (!live.length) return;
  const g = live[0];
  const set = (id, val) => { const el = document.getElementById(id); if(el&&val!=null) el.textContent = val; };
  set('g1-home-score', g.homeScore ?? '');
  set('g1-away-score', g.awayScore ?? '');
  set('g1-clock', g.status || 'LIVE');
}

// ── TRENDING TAKES ───────────────────────────────────────
async function loadTrendingTakes() {
  try {
    const res = await fetch('/api/fan-takes?sort=fire&limit=4');
    if (!res.ok) return;
    const { takes } = await res.json();
    if (!takes?.length) return;
    const list = document.getElementById('trending-takes-list');
    if (!list) return;
    list.innerHTML = takes.map(t => `
      <div class="ft-take-row" onclick="openModal('signup')">
        <div class="ft-take-fire">🔥</div>
        <div class="ft-take-body">
          <div class="ft-take-text">${escHtml(t.text||'')}</div>
          <div class="ft-take-tag">${escHtml(t.sport||'Sports')}</div>
        </div>
        <div class="ft-take-counts">
          <span>👍 ${fmt(t.fireCount||0)}</span>
          <span>💬 ${fmt(t.replyCount||0)}</span>
        </div>
      </div>`).join('');
  } catch {}
}

// ── HALL OF FLAME ────────────────────────────────────────
async function loadHallOfFlame() {
  try {
    const res = await fetch('/api/fan-takes?sort=fire&limit=10');
    if (!res.ok) return;
    const { takes } = await res.json();
    if (!takes?.length) return;
    const list = document.getElementById('hof-takes-list');
    if (!list) return;
    list.innerHTML = takes.map((t, i) => `
      <div class="ft-hof-item">
        <div class="ft-hof-rank">${i < 3 ? '🔥' : (i+1)}</div>
        <div class="ft-hof-body">
          <div class="ft-hof-quote">"${escHtml(t.text||'')}"</div>
          <div class="ft-hof-meta">${escHtml(t.sport||'Sports')} · ${fmt(t.fireCount||0)} upvotes</div>
        </div>
        <div class="ft-hof-img" style="background:linear-gradient(135deg,#1a0a0a,#0a0a0c)">🔥</div>
      </div>`).join('');
  } catch {}
}

// ── ARENA INIT ───────────────────────────────────────────
function initArena() {
  const prefs = window.sidelineUserPrefs;
  const name = prefs?.display_name || localStorage.getItem('ft_guest_name') || 'Jordan';
  const el = document.getElementById('arena-welcome-name');
  if (el) el.textContent = name.split(' ')[0];
  loadLiveScores();
}

// ── ARENA SIDEBAR SECTION SWITCH ──────────────────────────
function showArenaSection(section, btn) {
  document.querySelectorAll('.arena-nav-item').forEach(item => item.classList.remove('active'));
  const target = btn || Array.from(document.querySelectorAll('.arena-nav-item'))
    .find(item => item.getAttribute('onclick')?.includes(`showArenaSection('${section}')`));
  if (target) target.classList.add('active');
}

// ── GAME ROOM INIT ───────────────────────────────────────
function initGameRoom() {
  loadLiveScores();
}

// ── PROFILE INIT ─────────────────────────────────────────
function initProfile() {
  const prefs = window.sidelineUserPrefs;
  if (!prefs) return;
  const set = (id, val) => { const el = document.getElementById(id); if(el&&val) el.textContent = val; };
  set('profile-display-name', prefs.display_name || 'Jordan23');
  if (prefs.fanScore) set('profile-fan-score', prefs.fanScore.toLocaleString());
}

// ── STREAK ───────────────────────────────────────────────
function updateStreak() {
  const badge = document.getElementById('streak-badge');
  const count = document.getElementById('streak-count');
  if (!badge || !count) return;
  const today = new Date().toDateString();
  const last = localStorage.getItem('ft_last_visit');
  let streak = parseInt(localStorage.getItem('ft_streak') || '0');
  if (last !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    streak = last === yesterday.toDateString() ? streak + 1 : 1;
    localStorage.setItem('ft_last_visit', today);
    localStorage.setItem('ft_streak', streak);
  }
  if (streak >= 2) { badge.style.display = 'flex'; count.textContent = streak; }
}

// ── CLERK AUTH ───────────────────────────────────────────
async function initClerk() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error();
    const { clerkKey } = await res.json();
    if (!clerkKey) throw new Error();
    const clerk = new window.Clerk(clerkKey);
    await clerk.load();
    window.clerk = clerk;
    window.clerkLoaded = true;
    if (clerk.user) {
      updateAuthUILoggedIn(clerk.user);
      loadUserPrefs(clerk.user.id);
    }
  } catch { window.clerkLoaded = false; updateStreak(); }
}

function updateAuthUILoggedIn(user) {
  const loginBtn = document.getElementById('auth-login-btn');
  const signupBtn = document.getElementById('auth-signup-btn');
  const menu = document.getElementById('auth-user-menu');
  const avatar = document.getElementById('auth-user-avatar');
  if (loginBtn) loginBtn.style.display = 'none';
  if (signupBtn) signupBtn.style.display = 'none';
  if (menu) menu.style.display = 'flex';
  if (avatar) avatar.textContent = user.firstName?.[0] || 'U';
  updateStreak();
}

async function loadUserPrefs(userId) {
  try {
    const res = await fetch('/api/user-prefs?userId=' + userId);
    if (!res.ok) return;
    const prefs = await res.json();
    if (prefs?.onboarding_complete) {
      window.sidelineUserPrefs = prefs;
      const avatar = document.getElementById('auth-user-avatar');
      if (avatar && prefs.display_name) avatar.textContent = prefs.display_name[0].toUpperCase();
    }
  } catch {}
}

// ── SPORT CHIPS ──────────────────────────────────────────
document.querySelectorAll('.sport-chip').forEach(chip => {
  chip.addEventListener('click', function() {
    this.closest('.sports-row')?.querySelectorAll('.sport-chip')
      .forEach(c => c.classList.remove('active'));
    this.classList.add('active');
  });
});

// ── INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Check URL hash for initial view
  const hash = location.hash.replace('#', '') || 'public-home';
  const validView = VIEWS.includes(hash) ? hash : 'public-home';

  initClerk();
  showView(validView);
});
