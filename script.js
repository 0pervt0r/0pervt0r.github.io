const SUPABASE_URL = 'https://ytmwejebzkunzukuztvq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bXdlamViemt1bnp1a3V6dHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODEzMDksImV4cCI6MjA5NjA1NzMwOX0.nW1zgIFphXNF60p7vRd4hOV39n4my3ljKF9mCBqOH_E';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

async function getCurrentUser() {
  const { data: { user } } = await db.auth.getUser();
  return user;
}

async function getProfile(userId) {
  const { data, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
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

  const profile = await getProfile(user.id);
  if (!profile) return;


  const nameEl = document.querySelector('.sidebar-username');
  if (nameEl) nameEl.textContent = profile.username || 'СОТРУДНИК';

  const rankEl = document.querySelector('.sidebar-rank');
  if (rankEl && profile.specialization) {
    const rank = profile.rank || 'LR';
    const spec = profile.specialization;
    const serial = profile.serial_number || '0000000000';
    rankEl.textContent = `${rank}-${spec} · #${serial}`;
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

document.addEventListener('DOMContentLoaded', function () {
  fillSidebar();
});

function toggleAccordion(trigger) {
  var item = trigger.closest('.accordion-item');
  var body = item.querySelector('.accordion-body');
  var isOpen = item.classList.contains('open');
  if (isOpen) {
    body.style.maxHeight = body.scrollHeight + 'px';
    requestAnimationFrame(function() {
      body.style.maxHeight = '0';
    });
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

// ════════════════════════════════════
// RATING SYSTEM
// ════════════════════════════════════

async function initRating(articleId) {
  const container = document.getElementById('ratingWidget');
  if (!container) return;

  const user = await getCurrentUser();

  // Получаем все голоса для статьи
  const { data: votes } = await db
    .from('article_votes')
    .select('vote')
    .eq('article_id', articleId);

  const total = votes ? votes.reduce((sum, v) => sum + v.vote, 0) : 0;

  // Голос текущего пользователя
  let userVote = 0;
  if (user) {
    const { data: myVote } = await db
      .from('article_votes')
      .select('vote')
      .eq('article_id', articleId)
      .eq('user_id', user.id)
      .single();
    userVote = myVote?.vote ?? 0;
  }

  renderRating(container, articleId, total, userVote, !!user);
}

function renderRating(container, articleId, total, userVote, isLoggedIn) {
  const scoreColor = total > 0 ? 'var(--green)' : total < 0 ? 'var(--red)' : 'var(--text-dim)';
  const scoreSign = total > 0 ? '+' : '';

  container.innerHTML = `
    <div class="rating-wrap">
      <span class="rating-label">Рейтинг статьи</span>
      <div class="rating-controls">
        <button class="rating-btn up ${userVote === 1 ? 'active' : ''}"
          onclick="castVote('${articleId}', 1)"
          ${!isLoggedIn ? 'disabled title="Войдите для голосования"' : ''}
        >▲</button>
        <span class="rating-score" style="color:${scoreColor}">${scoreSign}${total}</span>
        <button class="rating-btn down ${userVote === -1 ? 'active' : ''}"
          onclick="castVote('${articleId}', -1)"
          ${!isLoggedIn ? 'disabled title="Войдите для голосования"' : ''}
        >▼</button>
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

  if (existing) {
    if (existing.vote === vote) {

      await db.from('article_votes')
        .delete()
        .eq('article_id', articleId)
        .eq('user_id', user.id);
    } else {

      await db.from('article_votes')
        .update({ vote })
        .eq('article_id', articleId)
        .eq('user_id', user.id);
    }
  } else {

    await db.from('article_votes')
      .insert({ article_id: articleId, user_id: user.id, vote });
  }


  initRating(articleId);
}

// ════════════════════════════════════
// ACCESS CONTROL
// ════════════════════════════════════

const BYPASS_PASSWORD = 'ILoveDrKepler6769';
const BYPASS_DURATION = 30 * 60 * 1000;

function isBypassActive() {
  const ts = localStorage.getItem('access_bypass_ts');
  if (!ts) return false;
  return (Date.now() - parseInt(ts)) < BYPASS_DURATION;
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

  const title = overlay.querySelector('.access-overlay-title');
  const sub   = overlay.querySelector('.access-overlay-sub');
  const bar   = overlay.querySelector('.access-overlay-bar');
  const barWrap = overlay.querySelector('.access-overlay-bar-wrap');

  if (title) title.textContent = 'Доступ запрещён.';
  if (sub) sub.innerHTML = `
    Ваш уровень допуска: <strong style="color:var(--red)">${currentLevel}</strong><br>
    Требуется уровень: <strong style="color:var(--accent2)">${requiredLevel}</strong><br><br>
    <span style="color:var(--text-dim);font-size:9px;">Вы получите допуск 30 минут.</span>
  `;

  
  const TOTAL = 30 * 60 * 1000;
  const startTime = Date.now();

  if (barWrap) barWrap.style.display = 'block';

 
  requestAnimationFrame(function tick() {
    const elapsed = Date.now() - startTime;
    const pct = Math.min((elapsed / TOTAL) * 100, 100);
    if (bar) bar.style.width = pct + '%';

    if (elapsed < TOTAL) {
      requestAnimationFrame(tick);
    } else {
      overlay.classList.add('hiding');
      setTimeout(() => overlay.remove(), 650);
    }
  });

  
  if (!overlay.querySelector('.bypass-input-wrap')) {
    const wrap = document.createElement('div');
    wrap.className = 'bypass-input-wrap';
    wrap.style.cssText = 'display:flex;gap:8px;align-items:center;margin-top:4px;';
    wrap.innerHTML = `
      <input
        id="bypassInput"
        type="password"
        placeholder="Экстренный пароль доступа"
        style="
          background:var(--bg2);
          border:1px solid var(--border-grey);
          border-radius:2px;
          padding:5px 12px;
          font-family:'Share Tech Mono',monospace;
          font-size:11px;
          color:var(--text);
          outline:none;
          width:220px;
          letter-spacing:0.05em;
        "
      >
      <button
        onclick="tryBypass()"
        style="
          background:transparent;
          border:1px solid var(--border2);
          color:var(--accent2);
          font-family:'Share Tech Mono',monospace;
          font-size:10px;
          padding:5px 14px;
          border-radius:2px;
          cursor:pointer;
          letter-spacing:0.06em;
          transition:all 0.15s;
        "
      >ВВЕСТИ</button>
    `;
    overlay.appendChild(wrap);

    // Enter в поле
    wrap.querySelector('#bypassInput').addEventListener('keydown', function(e) {
      if (e.key === 'Enter') tryBypass();
    });
  }
}

function tryBypass() {
  const input = document.getElementById('bypassInput');
  if (!input) return;
  if (input.value === BYPASS_PASSWORD) {
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
