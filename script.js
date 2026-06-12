const SUPABASE_URL = 'https://ytmwejebzkunzukuztvq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bXdlamViemt1bnp1a3V6dHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODEzMDksImV4cCI6MjA5NjA1NzMwOX0.nW1zgIFphXNF60p7vRd4hOV39n4my3ljKF9mCBqOH_E';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let _userCache = undefined;
let _profileCache = {};

async function getCurrentUser() {
  if (_userCache !== undefined) return _userCache;
  const { data: { user } } = await db.auth.getUser();
  _userCache = user;
  return user;
}

async function getProfile(userId) {
  if (_profileCache[userId] !== undefined) return _profileCache[userId];
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  _profileCache[userId] = error ? null : data;
  return _profileCache[userId];
}


async function fillSidebar() {
  const path = window.location.pathname;
  if (path.includes('login.html') || path.includes('confirm.html')) return;

  const user = await getCurrentUser();

  if (!user) {
    window.location.href = 'login.html';
    return;
  }

  if (!user.email_confirmed_at) {
    window.location.href = 'confirm.html';
    return;
  }

  localStorage.setItem('hadal_reg_ts', new Date(user.created_at).getTime().toString());

  const profile = await getProfile(user.id);
  if (!profile) return;

  const nameEl = document.querySelector('.sidebar-username');
  if (nameEl) nameEl.textContent = profile.username || 'СОТРУДНИК';

  const rankEl = document.querySelector('.sidebar-rank');
  if (rankEl && profile.specialization) {
    rankEl.textContent = `${profile.rank || 'LR'}-${profile.specialization} · #${profile.serial_number || '0000000000'}`;
  }

  const roleEl = document.querySelector('.sidebar-role');
  if (roleEl) roleEl.textContent = `Уровень доступа: ${profile.access_level ?? 0}`;

  const avatarEl = document.querySelector('.sidebar-avatar');
  if (avatarEl && profile.avatar_url) {
    avatarEl.src = profile.avatar_url;
    avatarEl.style.display = 'block';
  }
}

async function signOut() {
  await db.auth.signOut();
  window.location.href = 'login.html';
}

document.addEventListener('DOMContentLoaded', fillSidebar);


function toggleAccordion(trigger) {
  const item = trigger.closest('.accordion-item');
  const body = item.querySelector('.accordion-body');
  const isOpen = item.classList.contains('open');

  if (isOpen) {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(() => { body.style.maxHeight = '0'; });
    item.classList.remove('open');
  } else {
    item.classList.add('open');
    body.style.maxHeight = body.scrollHeight + 'px';
    body.addEventListener('transitionend', function handler() {
      body.style.maxHeight = 'none';
      body.removeEventListener('transitionend', handler);
    });
  }
}


async function initRating(articleId) {
  const container = document.getElementById('ratingWidget');
  if (!container) return;

  const user = await getCurrentUser();

  const votesPromise = db.from('article_votes').select('vote').eq('article_id', articleId);
  const myVotePromise = user
    ? db.from('article_votes').select('vote').eq('article_id', articleId).eq('user_id', user.id).single()
    : Promise.resolve({ data: null });

  const [{ data: votes }, { data: myVote }] = await Promise.all([votesPromise, myVotePromise]);

  const total = votes ? votes.reduce((sum, v) => sum + v.vote, 0) : 0;
  const userVote = myVote?.vote ?? 0;

  renderRating(container, articleId, total, userVote, !!user);
}

function renderRating(container, articleId, total, userVote, isLoggedIn) {
  const scoreColor = total > 0 ? 'var(--green)' : total < 0 ? 'var(--red)' : 'var(--text-dim)';
  const scoreSign = total > 0 ? '+' : '';
  const disabledAttr = isLoggedIn ? '' : 'disabled title="Войдите для голосования"';

  container.innerHTML = `
    <div class="rating-wrap">
      <span class="rating-label">Рейтинг статьи</span>
      <div class="rating-controls">
        <button class="rating-btn up ${userVote === 1 ? 'active' : ''}"
          onclick="castVote('${articleId}', 1)" ${disabledAttr}>▲</button>
        <span class="rating-score" style="color:${scoreColor}">${scoreSign}${total}</span>
        <button class="rating-btn down ${userVote === -1 ? 'active' : ''}"
          onclick="castVote('${articleId}', -1)" ${disabledAttr}>▼</button>
      </div>
      ${!isLoggedIn ? '<span class="rating-hint">Войдите, чтобы голосовать</span>' : ''}
    </div>
  `;
}

async function castVote(articleId, vote) {
  const user = await getCurrentUser();
  if (!user) return;

  const { data: existing } = await db
    .from('article_votes')
    .select('vote')
    .eq('article_id', articleId)
    .eq('user_id', user.id)
    .single();

  if (existing?.vote === vote) {
    // Повторный клик — снять голос
    await db.from('article_votes')
      .delete()
      .eq('article_id', articleId)
      .eq('user_id', user.id);
  } else {

    await db.from('article_votes')
      .upsert({ article_id: articleId, user_id: user.id, vote },
               { onConflict: 'article_id,user_id' });
  }

  initRating(articleId);
}


const BYPASS_PASSWORDS = {
  'Z-5':    'ILoveDrKepler6769',
  'Z5-002': 'ILoveDrKepler6769',
};
const BYPASS_DURATION = 30 * 60 * 1000;

function isBypassActive() {
  const ts = localStorage.getItem('access_bypass_ts');
  return ts ? (Date.now() - parseInt(ts)) < BYPASS_DURATION : false;
}

function activateBypass() {
  localStorage.setItem('access_bypass_ts', Date.now().toString());
}

async function requireAccess(requiredLevel) {
  if (isBypassActive()) return true;

  const user = await getCurrentUser();
  if (!user) { window.location.href = 'login.html'; return false; }

  const profile = await getProfile(user.id);
  const level = profile?.access_level ?? 0;

  if (level >= requiredLevel) return true;

  showAccessDeniedTimed(level, requiredLevel);
  return false;
}

function showAccessDeniedTimed(currentLevel, requiredLevel) {
  const overlay = document.getElementById('accessOverlay');
  if (!overlay) return;

  overlay.style.display = 'flex';

  const title   = overlay.querySelector('.access-overlay-title');
  const sub     = overlay.querySelector('.access-overlay-sub');
  const bar     = overlay.querySelector('.access-overlay-bar');
  const barWrap = overlay.querySelector('.access-overlay-bar-wrap');

  if (title) title.textContent = 'Доступ запрещён.';
  if (sub) sub.innerHTML = `
    Ваш уровень допуска: <strong style="color:var(--red)">${currentLevel}</strong><br>
    Требуется уровень: <strong style="color:var(--accent2)">${requiredLevel}</strong><br><br>
    <span style="color:var(--text-dim);font-size:9px;">Вы получите допуск 30 минут.</span>
  `;

  if (barWrap) barWrap.style.display = 'block';

  const startTime = Date.now();
  requestAnimationFrame(function tick() {
    const elapsed = Date.now() - startTime;
    const pct = Math.min((elapsed / BYPASS_DURATION) * 100, 100);
    if (bar) bar.style.width = pct + '%';

    if (elapsed < BYPASS_DURATION) {
      requestAnimationFrame(tick);
    } else {
      overlay.classList.add('hiding');
      setTimeout(() => overlay.remove(), 650);
    }
  });

  if (!overlay.querySelector('.bypass-input-wrap')) {
    const wrap = document.createElement('div');
    wrap.className = 'bypass-input-wrap';
    wrap.innerHTML = `
      <input id="bypassInput" type="password" placeholder="Экстренный пароль доступа">
      <button onclick="tryBypass()">ВВЕСТИ</button>
    `;
    overlay.appendChild(wrap);
    wrap.querySelector('#bypassInput').addEventListener('keydown', e => {
      if (e.key === 'Enter') tryBypass();
    });
  }
}

function tryBypass() {
  const input = document.getElementById('bypassInput');
  if (!input) return;

  const validPasswords = Object.values(BYPASS_PASSWORDS);
  if (validPasswords.includes(input.value)) {
    activateBypass();
    const overlay = document.getElementById('accessOverlay');
    if (overlay) {
      overlay.classList.add('hiding');
      setTimeout(() => overlay.remove(), 650);
    }
  } else {
    input.style.borderColor = 'var(--red)';
    input.value = '';
    input.placeholder = 'Неверный пароль. Попробуйте снова.';
    setTimeout(() => {
      input.style.borderColor = 'var(--border-grey)';
      input.placeholder = 'Экстренный пароль доступа';
    }, 2000);
  }
}

// ════════════════════════════════════════════════════════════
//  HADAL MAIL SYSTEM — ВИДЖЕТ
// ════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const STORAGE_KEY = 'hadal_mail_read';

  const SENT_KEY = 'hadal_mail_sent';

function getSentMap() {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '{}'); }
  catch { return {}; }
}

function markSent(mailId, replyText) {
  const s = getSentMap();
  s[mailId] = replyText;
  localStorage.setItem(SENT_KEY, JSON.stringify(s));
}

  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
  }

  function markRead(id) {
    const s = getReadSet();
    s.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  }

  function getMails() {
    const read = getReadSet();
    const now = Date.now();
    const regTime = parseInt(localStorage.getItem('hadal_reg_ts')) || null;

    return (window.HADAL_MAIL || [])
      .filter(m => {
        if (m.send_after && now < new Date(m.send_after).getTime()) return false;
        if (m.delay_hours != null) {
          if (!regTime) return false;
          if (now < regTime + m.delay_hours * 3600000) return false;
        }
        return true;
      })
      .map(m => ({ ...m, read: read.has(m.id) || m.read }));
  }

  function unreadCount() {
    return getMails().filter(m => !m.read).length;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function injectStyles() {
    if (document.getElementById('hadal-mail-styles')) return;
    const style = document.createElement('style');
    style.id = 'hadal-mail-styles';
    style.textContent = `
      #hm-fab {
        position:fixed; bottom:24px; right:24px; width:52px; height:52px;
        border-radius:50%; background:transparent; border:none; cursor:pointer;
        z-index:100000; padding:0; display:flex; align-items:center; justify-content:center;
        transition:transform 0.2s cubic-bezier(.34,1.56,.64,1);
      }
      #hm-fab:hover { transform:scale(1.12); }
      #hm-fab img { width:52px; height:52px; display:block; border-radius:50%; filter:drop-shadow(0 0 8px rgba(178,229,40,0.5)); }
      #hm-fab-badge {
        position:absolute; top:2px; right:2px; min-width:18px; height:18px; border-radius:9px;
        background:#d94f5c; color:#fff; font-family:'Orbitron',monospace; font-size:9px; font-weight:700;
        display:flex; align-items:center; justify-content:center; padding:0 4px;
        border:2px solid #141414; pointer-events:none; transition:opacity 0.2s;
      }
      #hm-fab-badge.hidden { opacity:0; }

      #hm-overlay {
        position:fixed; inset:0; background:rgba(10,12,10,0.7); z-index:100001;
        display:flex; align-items:center; justify-content:center;
        opacity:0; pointer-events:none; transition:opacity 0.22s ease; backdrop-filter:blur(2px);
      }
      #hm-overlay.open { opacity:1; pointer-events:all; }

      #hm-window {
        width:min(860px,96vw); height:min(560px,88vh); background:#141414;
        border:1px solid rgba(178,229,40,0.35); border-radius:4px;
        display:flex; flex-direction:column; overflow:hidden;
        transform:scale(0.94) translateY(12px);
        transition:transform 0.22s cubic-bezier(.34,1.56,.64,1);
        box-shadow:0 0 60px rgba(0,0,0,0.8),0 0 0 1px rgba(178,229,40,0.1); position:relative;
      }
      #hm-overlay.open #hm-window { transform:scale(1) translateY(0); }

      #hm-titlebar {
        display:flex; align-items:center; justify-content:space-between;
        padding:8px 14px; background:#0e0e0e; border-bottom:1px solid rgba(178,229,40,0.2); flex-shrink:0;
      }
      #hm-titlebar-left { display:flex; align-items:center; gap:10px; }
      #hm-titlebar-icon { width:20px; height:20px; border-radius:50%; }
      #hm-titlebar-title { font-family:'Orbitron',monospace; font-size:10px; color:#c8f03a; letter-spacing:0.14em; }
      #hm-close {
        width:24px; height:24px; background:transparent; border:1px solid rgba(217,79,92,0.4);
        border-radius:2px; color:#d94f5c; font-size:12px; cursor:pointer;
        display:flex; align-items:center; justify-content:center; font-family:monospace;
        transition:all 0.15s; line-height:1;
      }
      #hm-close:hover { background:rgba(217,79,92,0.15); border-color:#d94f5c; }

      #hm-body { display:flex; flex:1; overflow:hidden; }

      #hm-list-col {
        width:260px; min-width:260px; background:#111;
        border-right:1px solid rgba(178,229,40,0.15); display:flex; flex-direction:column; overflow:hidden;
      }
      #hm-list-header {
        padding:10px 14px; border-bottom:1px solid rgba(178,229,40,0.12);
        font-family:'Orbitron',monospace; font-size:8px; color:#526652; letter-spacing:0.14em; flex-shrink:0;
      }
      #hm-list { flex:1; overflow-y:auto; scrollbar-width:thin; scrollbar-color:rgba(178,229,40,0.2) transparent; }
      #hm-list::-webkit-scrollbar { width:4px; }
      #hm-list::-webkit-scrollbar-thumb { background:rgba(178,229,40,0.2); border-radius:2px; }

      .hm-item {
        padding:11px 14px; border-bottom:1px solid rgba(178,229,40,0.07);
        cursor:pointer; transition:background 0.12s; position:relative;
      }
      .hm-item:hover { background:rgba(178,229,40,0.04); }
      .hm-item.active { background:rgba(178,229,40,0.08); border-left:2px solid #c8f03a; }
      .hm-item.active .hm-item-subject { color:#c8f03a; }
      .hm-item-subject { font-size:11px; color:#dde4ec; letter-spacing:0.03em; margin-bottom:3px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .hm-item.unread .hm-item-subject { color:#fff; font-weight:bold; }
      .hm-item.unread::before {
        content:''; position:absolute; left:4px; top:50%; transform:translateY(-50%);
        width:5px; height:5px; border-radius:50%; background:#c8f03a;
      }
      .hm-item.active::before { display:none; }
      .hm-item-from { font-size:9px; color:#526652; letter-spacing:0.04em; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

      #hm-view-col { flex:1; display:flex; flex-direction:column; overflow:hidden; background:#0d0d0d; }
      #hm-view-empty { flex:1; display:flex; align-items:center; justify-content:center; font-family:'Orbitron',monospace; font-size:10px; color:#2a302a; letter-spacing:0.1em; }
      #hm-view-content { display:none; flex-direction:column; height:100%; }
      #hm-view-content.visible { display:flex; }
      #hm-view-header { padding:18px 22px 14px; border-bottom:1px solid rgba(178,229,40,0.1); flex-shrink:0; }
      #hm-view-subject { font-family:'Orbitron',monospace; font-size:15px; font-weight:900; color:#dde4ec; letter-spacing:0.04em; margin-bottom:8px; line-height:1.2; }
      #hm-view-meta { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
      #hm-view-from { font-family:'Orbitron',monospace; font-size:9px; color:#c8f03a; letter-spacing:0.08em; }
      #hm-view-body {
        flex:1; overflow-y:auto; padding:20px 22px;
        font-family:'Share Tech Mono',monospace; font-size:11px; color:#b0b8c1;
        line-height:1.8; letter-spacing:0.03em; white-space:pre-wrap;
        scrollbar-width:thin; scrollbar-color:rgba(178,229,40,0.2) transparent;
      }
      #hm-view-body::-webkit-scrollbar { width:4px; }
      #hm-view-body::-webkit-scrollbar-thumb { background:rgba(178,229,40,0.2); border-radius:2px; }

      #hm-empty-state { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; color:#2a302a; font-family:'Orbitron',monospace; font-size:10px; letter-spacing:0.1em; }

      #hm-window::after {
        content:''; position:absolute; inset:0;
        background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.12) 2px,rgba(0,0,0,0.12) 4px);
        pointer-events:none; z-index:10; opacity:0.5;
      }

      /* bypass input — стили вынесены из JS */
      .bypass-input-wrap { display:flex; gap:8px; align-items:center; margin-top:4px; }
      .bypass-input-wrap input {
        background:var(--bg2); border:1px solid var(--border-grey); border-radius:2px;
        padding:5px 12px; font-family:'Share Tech Mono',monospace; font-size:11px;
        color:var(--text); outline:none; width:220px; letter-spacing:0.05em;
      }
      .bypass-input-wrap button {
        background:transparent; border:1px solid var(--border2); color:var(--accent2);
        font-family:'Share Tech Mono',monospace; font-size:10px; padding:5px 14px;
        border-radius:2px; cursor:pointer; letter-spacing:0.06em; transition:all 0.15s;
      }

      @media (max-width:600px) {
        #hm-fab { bottom:16px; right:16px; width:44px; height:44px; }
        #hm-fab img { width:44px; height:44px; }
        #hm-window { width:100vw; height:100dvh; border-radius:0; border:none; }
        #hm-body { flex-direction:column; }
        #hm-list-col { width:100%; min-width:unset; height:220px; min-height:220px; border-right:none; border-bottom:1px solid rgba(178,229,40,0.15); flex-shrink:0; }
        #hm-view-col { flex:1; min-height:0; }
        #hm-view-subject { font-size:13px; }
      }
      #hm-reply-area {
  flex-shrink: 0;
  border-top: 1px solid rgba(178,229,40,0.12);
  padding: 10px 16px 14px;
  background: #0e0e0e;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.hm-reply-label {
  font-family: 'Orbitron', monospace;
  font-size: 8px;
  color: #526652;
  letter-spacing: 0.14em;
}
.hm-reply-buttons { display: flex; gap: 6px; flex-wrap: wrap; }
.hm-reply-btn {
  background: transparent;
  border: 1px solid rgba(178,229,40,0.3);
  color: #c8f03a;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  padding: 5px 12px;
  border-radius: 2px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  letter-spacing: 0.04em;
}
.hm-reply-btn:hover { background: rgba(178,229,40,0.08); border-color: #c8f03a; }
.hm-reply-sent {
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: 'Share Tech Mono', monospace;
  font-size: 10px;
  color: #c8f03a;
  letter-spacing: 0.05em;
}
.hm-reply-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #c8f03a;
  flex-shrink: 0;
}
    `;
    document.head.appendChild(style);
  }

  function buildHTML() {
    const fab = document.createElement('button');
    fab.id = 'hm-fab';
    fab.innerHTML = `
      <img src="MailIcon.png" alt="Почта">
      <span id="hm-fab-badge" class="hidden">0</span>
    `;
    document.body.appendChild(fab);

    const overlay = document.createElement('div');
    overlay.id = 'hm-overlay';
    overlay.innerHTML = `
      <div id="hm-window">
        <div id="hm-titlebar">
          <div id="hm-titlebar-left">
            <img id="hm-titlebar-icon" src="MailIcon.png">
            <span id="hm-titlebar-title">ВНУТРЕННЯЯ ПОЧТА</span>
          </div>
          <button id="hm-close">✕</button>
        </div>
        <div id="hm-body">
          <div id="hm-list-col">
            <div id="hm-list-header">ВХОДЯЩИЕ</div>
            <div id="hm-list"></div>
          </div>
          <div id="hm-view-col">
            <div id="hm-view-empty">ВЫБЕРИТЕ ПИСЬМО</div>
            <div id="hm-view-content">
              <div id="hm-view-header">
                <div id="hm-view-subject"></div>
                <div id="hm-view-meta">
                  <span id="hm-view-from"></span>
                </div>
              </div>
              <div id="hm-view-body"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  function renderList(activeId) {
    const list = document.getElementById('hm-list');
    const mails = getMails();
    if (!list) return;

    if (mails.length === 0) {
      list.innerHTML = `<div id="hm-empty-state">НЕТ ПИСЕМ</div>`;
      return;
    }

    list.innerHTML = mails.map(m => `
      <div class="hm-item ${m.read ? '' : 'unread'} ${activeId === m.id ? 'active' : ''}" data-id="${esc(m.id)}">
        <div class="hm-item-subject">${esc(m.subject)}</div>
        <div class="hm-item-from">${esc(m.from)}</div>
      </div>
    `).join('');

    list.querySelectorAll('.hm-item').forEach(el => {
      el.addEventListener('click', () => openMail(el.dataset.id));
    });
  }

function openMail(id) {
  const mail = getMails().find(m => m.id === id);
  if (!mail) return;

  markRead(id);

  document.getElementById('hm-view-empty').style.display = 'none';
  document.getElementById('hm-view-content').classList.add('visible');
  document.getElementById('hm-view-subject').textContent = mail.subject;
  document.getElementById('hm-view-from').textContent = mail.from;
  document.getElementById('hm-view-body').textContent = mail.body;

  // — блок ответов —
  let replyArea = document.getElementById('hm-reply-area');
  if (replyArea) replyArea.remove();

  if (mail.replies && mail.replies.length) {
    replyArea = document.createElement('div');
    replyArea.id = 'hm-reply-area';

    const sentMap = getSentMap();
    const sentText = sentMap[id];

    if (sentText) {
      replyArea.innerHTML = `
        <div class="hm-reply-label">ОТВЕТ ОТПРАВЛЕН</div>
        <div class="hm-reply-sent">
          <span class="hm-reply-dot"></span>
          <span>${esc(sentText)}</span>
        </div>`;
    } else {
      replyArea.innerHTML = `
        <div class="hm-reply-label">ОТВЕТИТЬ</div>
        <div class="hm-reply-buttons">
          ${mail.replies.map((r, i) =>
            `<button class="hm-reply-btn" data-idx="${i}">${esc(r.label)}</button>`
          ).join('')}
        </div>`;

      replyArea.querySelectorAll('.hm-reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const reply = mail.replies[+btn.dataset.idx];
          markSent(id, reply.text);
          openMail(id); // перерисовать с состоянием «отправлено»
        });
      });
    }

    document.getElementById('hm-view-content').appendChild(replyArea);
  }

  renderList(id);
  updateBadge();
}

  function updateBadge() {
    const badge = document.getElementById('hm-fab-badge');
    if (!badge) return;
    const n = unreadCount();
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  }

  function openWindow() {
    document.getElementById('hm-overlay').classList.add('open');
    renderList(null);
  }

  function closeWindow() {
    document.getElementById('hm-overlay').classList.remove('open');
  }

  function init() {
    injectStyles();
    buildHTML();
    updateBadge();

    document.getElementById('hm-fab').addEventListener('click', openWindow);
    document.getElementById('hm-close').addEventListener('click', closeWindow);
    document.getElementById('hm-overlay').addEventListener('click', function (e) {
      if (e.target === this) closeWindow();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeWindow(); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
