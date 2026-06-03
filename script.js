const SUPABASE_URL = 'https://ytmwejebzkunzukuztvq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_gsHGImtWAi7pGLU0vKrwOA_S8r5EHgI';

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

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
  const user = await getCurrentUser();
  if (!user) {
    if (!window.location.pathname.includes('login.html')) {
      window.location.href = 'login.html';
    }
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
  if (!window.location.pathname.includes('login.html') &&
      !window.location.pathname.includes('confirm.html')) {
    fillSidebar();
  }
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
