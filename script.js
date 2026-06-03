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

  // На этих страницах sidebar не нужен — выходим
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

  // Если специализации нет и мы не на странице квиза — редиректим на квиз
  if (!profile.specialization && !path.includes('personelquiz.html')) {
    window.location.href = 'personelquiz.html';
    return;
  }

  // Если специализация уже есть и пользователь зачем-то открыл квиз — на главную
  if (profile.specialization && path.includes('personelquiz.html')) {
    window.location.href = 'index.html';
    return;
  }

  // Заполняем sidebar
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

async function requireAccess(requiredLevel) {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = 'login.html';
    return false;
  }
  const profile = await getProfile(user.id);
  const level = profile?.access_level ?? 0;
  if (level < requiredLevel) {
    showAccessDeniedPermanent(level, requiredLevel);
    return false;
  }
  return true;
}

function showAccessDeniedPermanent(currentLevel, requiredLevel) {
  const overlay = document.getElementById('accessOverlay');
  if (!overlay) return;
  const title = overlay.querySelector('.access-overlay-title');
  const sub   = overlay.querySelector('.access-overlay-sub');
  const bar   = overlay.querySelector('.access-overlay-bar-wrap');
  if (title) title.textContent = 'Доступ запрещён.';
  if (sub) sub.innerHTML = `Ваш уровень допуска: <strong style="color:var(--red)">${currentLevel}</strong><br>
    Для просмотра требуется уровень <strong style="color:var(--accent2)">${requiredLevel}</strong>.<br>
    Пройдите тест для повышения допуска.`;
  if (bar) bar.style.display = 'none';
  overlay.style.display = 'flex';
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

(function() {
  var overlay = document.getElementById('accessOverlay');
  if (!overlay) return;
  var bar = overlay.querySelector('.access-overlay-bar');
  if (!bar) return;
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      bar.style.width = '100%';
    });
  });
  setTimeout(function() {
    overlay.classList.add('hiding');
    setTimeout(function() {
      overlay.remove();
    }, 650);
  }, 5000);
})();
