const SUPABASE_URL = 'https://ytmwejebzkunzukuztvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bXdlamViemt1bnp1a3V6dHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODEzMDksImV4cCI6MjA5NjA1NzMwOX0.nW1zgIFphXNF60p7vRd4hOV39n4my3ljKF9mCBqOH_E';

const supa = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const CLEARANCE_LEVELS = {
  'базовый': 1,
  'смежный': 2,
  'оперативный': 3,
  'высший': 4,
  'расширенный': 5,
  'директорский': 6
};

const translations = {
  ru: {
    welcome: 'Добро пожаловать в закрытую базу данных Тайного Хадального Объекта!',
    nav_personnel: 'Персоналии',
    nav_prisoners: 'Заключённые',
    nav_zobjects: 'Z-объекты',
    nav_docs: 'Документация'
  },
  en: {
    welcome: 'Welcome to the restricted database of the Secret Hadal Facility!',
    nav_personnel: 'Personnel',
    nav_prisoners: 'Prisoners',
    nav_zobjects: 'Z-Objects',
    nav_docs: 'Documentation'
  },
  es: {
    welcome: '¡Bienvenido a la base de datos restringida de la Instalación Hadal Secreta!',
    nav_personnel: 'Personal',
    nav_prisoners: 'Prisioneros',
    nav_zobjects: 'Objetos Z',
    nav_docs: 'Documentación'
  }
};

async function getCurrentUser() {
  if (!supa) return null;
  const { data } = await supa.auth.getUser();
  return data ? data.user : null;
}

function applyLanguage(lang) {
  const dict = translations[lang] || translations.ru;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('.sidebar__lang button').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.lang === lang);
  });
}

function initLanguageSwitch() {
  document.querySelectorAll('.sidebar__lang button').forEach((btn) => {
    btn.addEventListener('click', () => applyLanguage(btn.dataset.lang));
  });
}

function initSidebarToggle() {
  const toggle = document.querySelector('.sidebar__toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;
  toggle.addEventListener('click', () => sidebar.classList.toggle('is-open'));
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 1024) return;
    if (!sidebar.classList.contains('is-open')) return;
    if (sidebar.contains(e.target) || toggle.contains(e.target)) return;
    sidebar.classList.remove('is-open');
  });
}

function initCarousels() {
  document.querySelectorAll('.carousel').forEach((carousel) => {
    const slides = Array.from(carousel.querySelectorAll('.carousel__slide'));
    const dotsWrap = carousel.querySelector('.carousel__dots');
    let index = 0;
    let timer = null;

    function show(i) {
      slides.forEach((s, si) => s.classList.toggle('is-active', si === i));
      if (dotsWrap) {
        Array.from(dotsWrap.children).forEach((d, di) => d.classList.toggle('is-active', di === i));
      }
      index = i;
    }

    function restart() {
      if (timer) clearInterval(timer);
      timer = setInterval(() => show((index + 1) % slides.length), 6000);
    }

    if (dotsWrap) {
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.addEventListener('click', () => {
          show(i);
          restart();
        });
        dotsWrap.appendChild(dot);
      });
    }

    if (slides.length) {
      show(0);
      restart();
    }

    carousel.addEventListener('mouseenter', () => timer && clearInterval(timer));
    carousel.addEventListener('mouseleave', restart);
  });
}

function initRatingWidgets() {
  document.querySelectorAll('.rating').forEach((widget) => {
    const up = widget.querySelector('.rating__btn--up');
    const down = widget.querySelector('.rating__btn--down');
    const countEl = widget.querySelector('.rating__count');
    const targetType = widget.dataset.targetType;
    const targetId = widget.dataset.targetId;

    async function vote(value) {
      const user = await getCurrentUser();
      if (!user) {
        window.dispatchEvent(new CustomEvent('urbanshade:auth-required'));
        return;
      }
      const current = widget.dataset.userVote ? Number(widget.dataset.userVote) : 0;
      const nextValue = current === value ? 0 : value;
      const delta = nextValue - current;
      const count = Number(countEl.textContent) + delta;
      countEl.textContent = count;
      countEl.classList.toggle('is-positive', count > 0);
      countEl.classList.toggle('is-negative', count < 0);
      up && up.classList.toggle('is-active-up', nextValue === 1);
      down && down.classList.toggle('is-active-down', nextValue === -1);
      widget.dataset.userVote = String(nextValue);
      if (supa && targetType && targetId) {
        await supa.from('votes').upsert(
          { user_id: user.id, target_type: targetType, target_id: targetId, value: nextValue },
          { onConflict: 'user_id,target_type,target_id' }
        );
      }
    }

    up && up.addEventListener('click', () => vote(1));
    down && down.addEventListener('click', () => vote(-1));
  });
}

function initComments() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.comment__collapse');
    if (!btn) return;
    const comment = btn.closest('.comment');
    const collapsed = comment.classList.toggle('is-collapsed');
    btn.textContent = collapsed ? '+' : '−';
  });
}

let previewHideTimer = null;

function createPreviewPanel() {
  const panel = document.createElement('div');
  panel.className = 'account-preview';
  panel.innerHTML =
    '<img class="account-preview__avatar" alt="">' +
    '<div class="account-preview__name"></div>' +
    '<div class="account-preview__username"></div>' +
    '<div class="divider-h"></div>' +
    '<p class="account-preview__bio"></p>' +
    '<div class="account-preview__actions">' +
    '<button type="button" data-action="friend"><img src="img/add_friend.png" alt="">Добавить</button>' +
    '<button type="button" data-action="view"><img src="img/account_see.png" alt="">Профиль</button>' +
    '<button type="button" data-action="block"><img src="img/block.png" alt="">Блок</button>' +
    '</div>';
  document.body.appendChild(panel);
  panel.addEventListener('mouseenter', () => clearTimeout(previewHideTimer));
  panel.addEventListener('mouseleave', hidePreview);
  panel.addEventListener('click', handlePreviewAction);
  return panel;
}

function showPreview(trigger) {
  const panel = document.querySelector('.account-preview') || createPreviewPanel();
  panel.querySelector('.account-preview__avatar').src = trigger.dataset.previewAvatar || '';
  panel.querySelector('.account-preview__name').textContent = trigger.dataset.previewName || '';
  panel.querySelector('.account-preview__username').textContent = '@' + (trigger.dataset.previewUsername || '');
  panel.querySelector('.account-preview__bio').textContent = trigger.dataset.previewBio || '';
  panel.dataset.userId = trigger.dataset.previewUserid || '';
  const rect = trigger.getBoundingClientRect();
  panel.style.top = window.scrollY + rect.bottom + 8 + 'px';
  panel.style.left = window.scrollX + rect.left + 'px';
  panel.classList.add('is-visible');
}

function hidePreview() {
  const panel = document.querySelector('.account-preview');
  if (panel) panel.classList.remove('is-visible');
}

async function handlePreviewAction(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const panel = btn.closest('.account-preview');
  const targetId = panel.dataset.userId;
  const action = btn.dataset.action;
  if (action === 'view') {
    const username = panel.querySelector('.account-preview__username').textContent.replace('@', '');
    window.location.href = '/u/' + username;
    return;
  }
  const user = await getCurrentUser();
  if (!user) {
    window.dispatchEvent(new CustomEvent('urbanshade:auth-required'));
    return;
  }
  if (action === 'friend' && supa) {
    await supa.from('friend_requests').insert({ from_user: user.id, to_user: targetId });
  }
  if (action === 'block' && supa) {
    await supa.from('blocks').insert({ user_id: user.id, blocked_user: targetId });
  }
  hidePreview();
}

function initAccountPreviews() {
  document.addEventListener('mouseover', (e) => {
    const trigger = e.target.closest('[data-preview-user]');
    if (!trigger) return;
    clearTimeout(previewHideTimer);
    showPreview(trigger);
  });
  document.addEventListener('mouseout', (e) => {
    const trigger = e.target.closest('[data-preview-user]');
    const preview = e.target.closest('.account-preview');
    if (!trigger && !preview) return;
    previewHideTimer = setTimeout(hidePreview, 200);
  });
}

async function initRedactedContent() {
  const blocks = document.querySelectorAll('.redacted[data-required-clearance]');
  if (!blocks.length) return;
  const user = await getCurrentUser();
  let clearance = 0;
  if (user && supa) {
    const { data } = await supa.from('profiles').select('clearance_level').eq('id', user.id).single();
    clearance = data ? data.clearance_level : 0;
  }
  blocks.forEach((block) => {
    const required = Number(block.dataset.requiredClearance);
    if (clearance >= required) block.classList.add('is-revealed');
  });
}

function openModalById(id, articleId) {
  const modal = document.getElementById(id);
  if (!modal) return;
  if (articleId) modal.dataset.articleId = articleId;
  modal.classList.add('is-open');
}

function closeModalById(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('is-open');
}

function initModalTriggers() {
  document.addEventListener('click', (e) => {
    const opener = e.target.closest('[data-open-modal]');
    if (opener) {
      openModalById(opener.dataset.openModal, opener.dataset.articleId);
    }
    const closer = e.target.closest('[data-close-modal]');
    if (closer) {
      const overlay = closer.closest('.modal-overlay');
      if (overlay) overlay.classList.remove('is-open');
    }
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('is-open');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    document.querySelectorAll('.modal-overlay.is-open').forEach((m) => m.classList.remove('is-open'));
  });
}

function initAccessRequestModal() {
  const modal = document.getElementById('access-request-modal');
  if (!modal) return;
  const checkbox = modal.querySelector('input[type="checkbox"]');
  const denied = modal.querySelector('.modal__denied');
  const confirmBtn = modal.querySelector('[data-action="confirm"]');
  const cancelBtn = modal.querySelector('[data-action="cancel"]');

  confirmBtn.addEventListener('click', async () => {
    if (!checkbox.checked) {
      denied.textContent = 'Запрос отклонён: необходимо предоставить персональные данные.';
      denied.classList.add('is-visible');
      return;
    }
    denied.classList.remove('is-visible');
    const articleId = modal.dataset.articleId;
    const user = await getCurrentUser();
    if (user && supa) {
      await supa.from('access_requests').insert({
        user_id: user.id,
        article_id: articleId,
        shared_personal_data: true
      });
    }
    document.querySelectorAll('.redacted[data-article-id="' + articleId + '"]').forEach((b) => {
      b.classList.add('is-revealed');
    });
    checkbox.checked = false;
    closeModalById('access-request-modal');
  });

  cancelBtn.addEventListener('click', () => {
    denied.classList.remove('is-visible');
    checkbox.checked = false;
    closeModalById('access-request-modal');
  });
}

function initPasswordModal() {
  const modal = document.getElementById('password-modal');
  if (!modal) return;
  const input = modal.querySelector('input[type="text"]');
  const feedback = modal.querySelector('.modal__denied');
  const confirmBtn = modal.querySelector('[data-action="confirm"]');

  confirmBtn.addEventListener('click', async () => {
    const code = input.value.trim();
    if (!code || !supa) return;
    const { data, error } = await supa.rpc('redeem_access_password', { code_input: code });
    if (error || !data || !data.granted) {
      feedback.textContent = 'Пароль недействителен или уже использован.';
      feedback.classList.add('is-visible');
      return;
    }
    feedback.classList.remove('is-visible');
    const articleId = modal.dataset.articleId;
    document.querySelectorAll('.redacted[data-article-id="' + articleId + '"]').forEach((b) => {
      b.classList.add('is-revealed');
    });
    if (data.expires_in) {
      setTimeout(() => {
        document.querySelectorAll('.redacted[data-article-id="' + articleId + '"]').forEach((b) => {
          b.classList.remove('is-revealed');
        });
      }, data.expires_in * 1000);
    }
    input.value = '';
    closeModalById('password-modal');
  });
}

function initTerminal() {
  const terminal = document.querySelector('.terminal');
  if (!terminal) return;
  const log = terminal.querySelector('.terminal__log');
  const input = terminal.querySelector('input');

  function print(text, cls) {
    const line = document.createElement('div');
    if (cls) line.className = cls;
    line.textContent = text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
  }

  const commands = {
    help: async () => 'Доступные команды: help, whoami, access [id], clear',
    whoami: async () => {
      const user = await getCurrentUser();
      return user ? 'Пользователь: ' + user.email : 'Гостевой доступ';
    },
    clear: async () => {
      log.textContent = '';
      return null;
    }
  };

  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const raw = input.value.trim();
    input.value = '';
    if (!raw) return;
    print('> ' + raw);
    const [cmd, ...args] = raw.split(' ');
    if (cmd === 'access') {
      const target = args[0];
      if (!target) {
        print('Укажите идентификатор документа.', 'is-error');
        return;
      }
      if (!supa) {
        print('Нет соединения с базой.', 'is-error');
        return;
      }
      const { data, error } = await supa.rpc('redeem_console_access', { document_id: target });
      if (error || !data || !data.granted) {
        print('Доступ отказан.', 'is-error');
        return;
      }
      print('Доступ предоставлен: ' + target, 'is-ok');
      return;
    }
    const handler = commands[cmd];
    if (!handler) {
      print('Неизвестная команда: ' + cmd, 'is-error');
      return;
    }
    const result = await handler(args);
    if (result) print(result);
  });
}

function renderAchievements(container, achievements) {
  container.innerHTML = '';
  achievements.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'achievement-card' + (item.unlocked ? ' is-unlocked' : '');
    card.innerHTML =
      '<img src="' + (item.icon || 'img/achievement_default.png') + '" alt="">' +
      '<div class="achievement-card__title">' + item.title + '</div>';
    container.appendChild(card);
  });
}

async function initAchievements() {
  const container = document.querySelector('.achievements');
  if (!container || !supa) return;
  const user = await getCurrentUser();
  if (!user) return;
  const { data } = await supa.from('user_achievements').select('achievement_id, title, icon, unlocked');
  if (data) renderAchievements(container, data);
}

function parseArticleMarkup(source) {
  let html = source
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  html = html.replace(/\[align=(left|center|right)\]([\s\S]*?)\[\/align\]/g, (m, align, inner) => {
    const cls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left';
    return '<div class="' + cls + '">' + inner + '</div>';
  });

  html = html.replace(/\[color=(green|red|grey)\]([\s\S]*?)\[\/color\]/g, (m, color, inner) => {
    return '<span class="highlight highlight--' + color + '">' + inner + '</span>';
  });

  html = html.replace(/\[note=([^\]]*)\]([\s\S]*?)\[\/note\]/g, (m, note, inner) => {
    return (
      '<span class="annotation"><span class="annotation__mark">' +
      inner +
      '</span><span class="annotation__tooltip">' +
      note +
      '</span></span>'
    );
  });

  html = html.replace(/\[img=(left|center|right)(?:\|([^\]]*))?\]([^\[]*)\[\/img\]/g, (m, pos, caption, src) => {
    const cap = caption ? '<figcaption>' + caption + '</figcaption>' : '';
    return '<figure class="article-image article-image--' + pos + '"><img src="' + src.trim() + '" alt="">' + cap + '</figure>';
  });

  html = html.replace(/\n{2,}/g, '</p><p>');
  return '<p>' + html + '</p>';
}

function showFormError(form, message) {
  let box = form.querySelector('.form__error');
  if (!box) {
    box = document.createElement('div');
    box.className = 'form__error modal__denied is-visible';
    form.prepend(box);
  }
  box.textContent = message;
  box.classList.add('is-visible');
}

function initRegistrationForm() {
  const form = document.querySelector('.form[data-role="registration"]');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const email = data.get('email');
    const password = data.get('password');
    const name = data.get('name');
    const username = data.get('username');
    const birthdate = data.get('birthdate');
    const isAdult = data.get('is_adult');

    if (!isAdult) {
      showFormError(form, 'Требуется медицинское освидетельствование (мне есть 18 лет).');
      return;
    }
    if (!username || username.length < 4 || username.length > 20 || !/^[A-Za-z0-9_]+$/.test(username)) {
      showFormError(form, 'Позывной должен содержать 4-20 латинских символов.');
      return;
    }
    if (!supa) return;
    const { data: signUpData, error } = await supa.auth.signUp({ email, password });
    if (error) {
      showFormError(form, 'Не удалось передать заявку: ' + error.message);
      return;
    }
    await supa.from('profiles').insert({
      id: signUpData.user.id,
      display_name: name,
      username: username,
      birthdate: birthdate,
      clearance_level: CLEARANCE_LEVELS['базовый'],
      rank: 'low',
      reputation: 50
    });
    form.dispatchEvent(new CustomEvent('urbanshade:registered', { bubbles: true }));
  });
}

function initAssignmentTest(container, questions, onComplete) {
  let index = 0;
  const scores = {};

  function renderQuestion() {
    const q = questions[index];
    container.innerHTML =
      '<p>' +
      q.prompt +
      '</p><div class="list-divided-col">' +
      q.options
        .map((opt, i) => '<button type="button" class="btn btn--ghost assignment-option" data-i="' + i + '">' + opt.label + '</button>')
        .join('') +
      '</div>';
    Array.from(container.querySelectorAll('.assignment-option')).forEach((btn) => {
      btn.addEventListener('click', () => {
        const opt = q.options[Number(btn.dataset.i)];
        scores[opt.department] = (scores[opt.department] || 0) + 1;
        index += 1;
        if (index >= questions.length) {
          const department = Object.keys(scores).sort((a, b) => scores[b] - scores[a])[0];
          onComplete(department);
        } else {
          renderQuestion();
        }
      });
    });
  }

  renderQuestion();
}

window.addEventListener('urbanshade:auth-required', () => {
  const loginModal = document.getElementById('login-modal');
  if (loginModal) {
    loginModal.classList.add('is-open');
  } else {
    window.alert('Необходимо войти в систему.');
  }
});

window.Urbanshade = {
  supa,
  applyLanguage,
  parseArticleMarkup,
  renderAchievements,
  initAssignmentTest,
  openModalById,
  closeModalById,
  CLEARANCE_LEVELS
};

document.addEventListener('DOMContentLoaded', () => {
  initSidebarToggle();
  initLanguageSwitch();
  initCarousels();
  initRatingWidgets();
  initComments();
  initAccountPreviews();
  initRedactedContent();
  initModalTriggers();
  initAccessRequestModal();
  initPasswordModal();
  initTerminal();
  initAchievements();
  initRegistrationForm();
});
