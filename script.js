import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ytmwejebzkunzukuztvq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0bXdlamViemt1bnp1a3V6dHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0ODEzMDksImV4cCI6MjA5NjA1NzMwOX0.nW1zgIFphXNF60p7vRd4hOV39n4my3ljKF9mCBqOH_E';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function initCarousel(root) {
  const track = root.querySelector('.carousel__track');
  const slides = Array.from(root.querySelectorAll('.carousel__slide'));
  const prev = root.querySelector('.carousel__arrow--prev');
  const next = root.querySelector('.carousel__arrow--next');
  let index = 0;
  let timer = null;

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
  }

  function go(delta) {
    index = (index + delta + slides.length) % slides.length;
    render();
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(() => go(1), 6000);
  }

  prev?.addEventListener('click', () => { go(-1); restart(); });
  next?.addEventListener('click', () => { go(1); restart(); });
  restart();
}

function initSideNavLang(root) {
  const buttons = root.querySelectorAll('.side-nav__lang button');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      document.documentElement.setAttribute('lang', btn.dataset.lang);
      document.dispatchEvent(new CustomEvent('language:change', { detail: btn.dataset.lang }));
    });
  });
}

async function castVote(targetTable, targetId, direction) {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) return null;
  const userId = session.session.user.id;
  const { data, error } = await supabase
    .from(`${targetTable}_votes`)
    .upsert({ target_id: targetId, user_id: userId, value: direction }, { onConflict: 'target_id,user_id' })
    .select();
  if (error) return null;
  return data;
}

function initRatingWidgets(root) {
  root.querySelectorAll('.rating').forEach((widget) => {
    const scoreEl = widget.querySelector('.rating__score');
    const upBtn = widget.querySelector('[data-vote="up"]');
    const downBtn = widget.querySelector('[data-vote="down"]');
    const targetTable = widget.dataset.table;
    const targetId = widget.dataset.id;
    let current = parseInt(scoreEl.textContent, 10) || 0;
    let userVote = 0;

    function apply(direction) {
      const previous = userVote;
      if (direction === previous) {
        current -= direction;
        userVote = 0;
      } else {
        current += direction - previous;
        userVote = direction;
      }
      scoreEl.textContent = current;
      upBtn.classList.toggle('active', userVote === 1);
      downBtn.classList.toggle('active', userVote === -1);
    }

    upBtn?.addEventListener('click', () => {
      apply(1);
      castVote(targetTable, targetId, userVote);
    });
    downBtn?.addEventListener('click', () => {
      apply(-1);
      castVote(targetTable, targetId, userVote);
    });
  });
}

function initComments(root) {
  root.querySelectorAll('.comment__toggle').forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const comment = toggle.closest('.comment');
      comment.classList.toggle('collapsed');
      toggle.textContent = comment.classList.contains('collapsed') ? '+' : '−';
    });
  });

  const preview = document.createElement('div');
  preview.className = 'account-preview';
  preview.innerHTML = `
    <div class="account-preview__avatar"><img src="" alt=""></div>
    <div class="account-preview__name"></div>
    <div class="account-preview__username"></div>
    <div class="account-preview__desc"></div>
    <div class="account-preview__actions">
      <button data-action="friend"><img src="assets/add_friend.png" alt=""></button>
      <button data-action="view"><img src="assets/account_see.png" alt=""></button>
      <button data-action="block"><img src="assets/block.png" alt=""></button>
    </div>
  `;
  document.body.appendChild(preview);

  let hideTimer = null;

  function showPreview(trigger) {
    clearTimeout(hideTimer);
    const rect = trigger.getBoundingClientRect();
    preview.querySelector('.account-preview__avatar img').src = trigger.dataset.avatar || '';
    preview.querySelector('.account-preview__name').textContent = trigger.dataset.name || '';
    preview.querySelector('.account-preview__username').textContent = trigger.dataset.username || '';
    preview.querySelector('.account-preview__desc').textContent = trigger.dataset.desc || '';
    preview.style.top = `${window.scrollY + rect.bottom + 8}px`;
    preview.style.left = `${rect.left}px`;
    preview.classList.add('visible');
  }

  function scheduleHide() {
    hideTimer = setTimeout(() => preview.classList.remove('visible'), 200);
  }

  root.querySelectorAll('.comment__avatar, .comment__author').forEach((trigger) => {
    trigger.addEventListener('mouseenter', () => showPreview(trigger));
    trigger.addEventListener('mouseleave', scheduleHide);
  });
  preview.addEventListener('mouseenter', () => clearTimeout(hideTimer));
  preview.addEventListener('mouseleave', scheduleHide);
}

function initAccessModal(root) {
  const modal = root.querySelector('.modal-overlay');
  if (!modal) return;
  const openTrigger = root.querySelector('[data-action="ask-access"]');
  const checkbox = modal.querySelector('input[type="checkbox"]');
  const confirmBtn = modal.querySelector('[data-action="confirm"]');
  const cancelBtn = modal.querySelector('[data-action="cancel"]');
  const denied = modal.querySelector('.modal__denied');
  const passwordInput = modal.querySelector('.modal__input');

  openTrigger?.addEventListener('click', () => modal.classList.add('open'));

  cancelBtn?.addEventListener('click', () => {
    modal.classList.remove('open');
    denied.classList.remove('visible');
  });

  confirmBtn?.addEventListener('click', async () => {
    if (checkbox && !checkbox.checked && !passwordInput?.value) {
      denied.textContent = 'В доступе отказано';
      denied.classList.add('visible');
      return;
    }
    denied.classList.remove('visible');
    if (passwordInput?.value) {
      await verifyAccessPassword(passwordInput.value, root.dataset.articleId);
    } else {
      await requestAccess(root.dataset.articleId);
    }
    modal.classList.remove('open');
  });
}

async function requestAccess(articleId) {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session) return;
  await supabase.from('access_requests').insert({
    article_id: articleId,
    user_id: session.session.user.id,
    status: 'pending',
  });
}

async function verifyAccessPassword(password, articleId) {
  const { data, error } = await supabase.rpc('redeem_access_password', {
    p_password: password,
    p_article_id: articleId,
  });
  return !error && data;
}

function initTabs(root) {
  root.querySelectorAll('.tabs').forEach((tabs) => {
    const items = tabs.querySelectorAll('.tabs__item');
    const panels = root.querySelectorAll('.tab-panel');
    items.forEach((item) => {
      item.addEventListener('click', () => {
        items.forEach((i) => i.classList.remove('active'));
        panels.forEach((p) => p.classList.remove('active'));
        item.classList.add('active');
        root.querySelector(`.tab-panel[data-tab="${item.dataset.tab}"]`)?.classList.add('active');
      });
    });
  });
}

function initRedactedText(root) {
  root.querySelectorAll('.article__redacted').forEach((span) => {
    span.addEventListener('click', async () => {
      const level = span.dataset.clearance;
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) return;
      const { data: profile } = await supabase
        .from('profiles')
        .select('clearance_level')
        .eq('id', session.session.user.id)
        .single();
      if (profile && profile.clearance_level >= Number(level)) {
        span.classList.add('unlocked');
      }
    });
  });
}

const RANK_TIERS = ['low', 'middle', 'high', 'elite'];
const ACCESS_CARDS = ['basic', 'adjacent', 'operational', 'high', 'extended', 'directorial'];
const RANK_TIER_LABELS = { low: 'Low-rank', middle: 'Middle-rank', high: 'High-rank', elite: 'Elite-rank' };
const RANK_TIER_ABBR = { low: 'LR', middle: 'MR', high: 'HR', elite: 'ER' };
const RANK_TIER_LETTER = { low: 'L', middle: 'M', high: 'H', elite: 'E' };
const ACCESS_CARD_LABELS = {
  basic: 'Базовый',
  adjacent: 'Смежный',
  operational: 'Оперативный',
  high: 'Высший',
  extended: 'Расширенный',
  directorial: 'Директорский',
};

function computeClearanceLevel(rankTier, accessCard) {
  const rankIndex = RANK_TIERS.indexOf(rankTier);
  const cardIndex = ACCESS_CARDS.indexOf(accessCard);
  if (rankIndex === -1 || cardIndex === -1) return 0;
  return rankIndex * ACCESS_CARDS.length + cardIndex + 1;
}

// Формат: (буква ранга: L/M/H/E)R-(буква должности) #(10-значный номер)
function formatUserId(profile) {
  const rankLetter = RANK_TIER_LETTER[profile.rank_tier] || '?';
  const dept = profile.department || '?';
  const number = profile.keycard_number || '0000000000';
  return `${rankLetter}R-${dept} #${number}`;
}

function validateRegistrationForm(form) {
  const errors = {};
  const contact = form.querySelector('[name="emergency_contact"]').value.trim();
  const code = form.querySelector('[name="access_code"]').value;
  const name = form.querySelector('[name="name"]').value.trim();
  const surname = form.querySelector('[name="surname"]').value.trim();
  const username = form.querySelector('[name="username"]').value.trim();
  const birthDate = form.querySelector('[name="birth_date"]').value;
  const ageCheck = form.querySelector('[name="age_confirm"]').checked;

  if (!/^[^\s@]+@gmail\.com$/i.test(contact)) errors.emergency_contact = 'Укажите адрес в домене @gmail.com';
  if (code.length < 8) errors.access_code = 'Код доступа должен быть не короче 8 символов';
  if (!name) errors.name = 'Укажите имя';
  if (!surname) errors.surname = 'Укажите фамилию';
  if (!/^[A-Za-z0-9_]{4,20}$/.test(username)) errors.username = 'Только латиница, цифры и "_", от 4 до 20 символов';
  if (!birthDate) errors.birth_date = 'Укажите дату рождения';

  let age = null;
  if (birthDate) {
    const birth = new Date(birthDate);
    const now = new Date();
    age = now.getFullYear() - birth.getFullYear() - (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    if (age < 18) errors.birth_date = 'Регистрация доступна только с 18 лет';
  }
  if (!ageCheck) errors.age_confirm = 'Подтвердите медицинское освидетельствование';

  return { valid: Object.keys(errors).length === 0, errors, values: { contact, code, name, surname, username, birthDate } };
}

function showFormErrors(form, errors) {
  form.querySelectorAll('.form__group').forEach((group) => {
    const field = group.querySelector('[name]');
    if (!field) return;
    const key = field.getAttribute('name');
    const errorEl = group.querySelector('.form__error');
    if (errors[key]) {
      group.classList.add('invalid');
      if (errorEl) errorEl.textContent = errors[key];
    } else {
      group.classList.remove('invalid');
    }
  });
}

async function checkUsernameAvailable(username) {
  const { data } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
  return !data;
}

function initRegistrationForm(form) {
  const submitBtn = form.querySelector('.form__submit');
  const statusEl = form.querySelector('.form__status');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { valid, errors, values } = validateRegistrationForm(form);
    showFormErrors(form, errors);
    if (!valid) return;

    submitBtn.disabled = true;
    statusEl.textContent = '';

    if (!(await checkUsernameAvailable(values.username))) {
      showFormErrors(form, { username: 'Позывной уже занят' });
      submitBtn.disabled = false;
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: values.contact,
      password: values.code,
    });
    if (authError) {
      statusEl.textContent = authError.message;
      submitBtn.disabled = false;
      return;
    }

    const clearanceLevel = computeClearanceLevel('low', 'basic');
    const { error: profileError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      name: values.name,
      surname: values.surname,
      username: values.username,
      birth_date: values.birthDate,
      rank_tier: 'low',
      access_card: 'basic',
      clearance_level: clearanceLevel,
      department: null,
      last_assignment_test: null,
    });
    if (profileError) {
      statusEl.textContent = profileError.message;
      submitBtn.disabled = false;
      return;
    }

    statusEl.textContent = 'Заявка передана в отдел кадров';
    if (authData.session) {
      // Сессия появляется сразу только если подтверждение почты отключено
      // (Authentication → Providers → Email → Confirm email). Если оно
      // включено, session будет null до перехода по ссылке из письма —
      // тогда шапка останется в состоянии "Войти в аккаунт", и это ожидаемо.
      await initAuthState();
    }
    window.dispatchEvent(new CustomEvent('registration:complete', { detail: { userId: authData.user.id } }));
  });
}

// ---------------------------------------------------------------------------
// Вход в существующий аккаунт
// ---------------------------------------------------------------------------

function validateLoginForm(form) {
  const errors = {};
  const contact = form.querySelector('[name="emergency_contact"]').value.trim();
  const code = form.querySelector('[name="access_code"]').value;

  if (!contact) errors.emergency_contact = 'Укажите экстренный контакт';
  if (!code) errors.access_code = 'Укажите код доступа';

  return { valid: Object.keys(errors).length === 0, errors, values: { contact, code } };
}

function initLoginForm(form) {
  const submitBtn = form.querySelector('.form__submit');
  const statusEl = form.querySelector('.form__status');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const { valid, errors, values } = validateLoginForm(form);
    showFormErrors(form, errors);
    if (!valid) return;

    submitBtn.disabled = true;
    statusEl.textContent = '';

    const { error } = await supabase.auth.signInWithPassword({
      email: values.contact,
      password: values.code,
    });

    if (error) {
      statusEl.textContent = 'Неверный контакт или код доступа';
      submitBtn.disabled = false;
      return;
    }

    statusEl.textContent = 'Доступ подтверждён';
    window.location.href = 'index.html';
  });
}

async function logout() {
  await supabase.auth.signOut();
  window.location.href = 'index.html';
}

// ---------------------------------------------------------------------------
// Состояние аккаунта в шапке / боковой навигации
// ---------------------------------------------------------------------------

async function initAuthState() {
  const profileLinks = document.querySelectorAll('.side-nav__profile');
  const headerAccounts = document.querySelectorAll('.site-header__account');
  if (!profileLinks.length && !headerAccounts.length) return;

  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  if (!session) {
    document.querySelectorAll('[data-action="logout"]').forEach((btn) => { btn.hidden = true; });
    return;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username, name, surname, rank_tier, department, keycard_number')
    .eq('id', session.user.id)
    .single();
  if (profileError) {
    console.error('initAuthState: не удалось получить профиль', profileError);
    return;
  }
  if (!profile) return;

  const idLabel = formatUserId(profile);

  profileLinks.forEach((link) => {
    link.href = 'account.html';
    const avatarImg = link.querySelector('.side-nav__avatar img');
    if (avatarImg && profile.avatar_url) avatarImg.src = profile.avatar_url;

    let info = link.querySelector('.side-nav__info');
    if (!info) {
      // старая разметка: name лежит прямо в .side-nav__profile — оборачиваем
      const nameEl = link.querySelector('.side-nav__name');
      info = document.createElement('div');
      info.className = 'side-nav__info';
      if (nameEl) {
        link.insertBefore(info, nameEl);
        info.appendChild(nameEl);
      } else {
        link.appendChild(info);
      }
    }

    let nameEl = info.querySelector('.side-nav__name');
    if (!nameEl) {
      nameEl = document.createElement('div');
      nameEl.className = 'side-nav__name';
      info.appendChild(nameEl);
    }
    nameEl.textContent = profile.username;

    let dividerEl = info.querySelector('.side-nav__divider');
    if (!dividerEl) {
      dividerEl = document.createElement('div');
      dividerEl.className = 'side-nav__divider';
      info.insertBefore(dividerEl, nameEl.nextSibling);
    }

    let rankEl = info.querySelector('.side-nav__rank');
    if (!rankEl) {
      rankEl = document.createElement('div');
      rankEl.className = 'side-nav__rank';
      info.appendChild(rankEl);
    }
    rankEl.textContent = `${profile.name || ''} ${profile.surname || ''}`.trim();
    rankEl.hidden = false;

    let idEl = info.querySelector('.side-nav__id');
    if (!idEl) {
      idEl = document.createElement('div');
      idEl.className = 'side-nav__id';
      info.appendChild(idEl);
    }
    idEl.textContent = idLabel;
    idEl.hidden = false;
  });

  headerAccounts.forEach((el) => { el.textContent = idLabel; });

  document.querySelectorAll('[data-action="logout"]').forEach((btn) => {
    btn.hidden = false;
    btn.addEventListener('click', logout);
  });

  document.dispatchEvent(new CustomEvent('auth:ready', { detail: profile }));
}

const DEPARTMENT_QUESTIONS = [
  { text: 'Что вас привлекает в работе больше всего?', options: [
    { text: 'Обеспечение порядка и защита объекта', dept: 'G' },
    { text: 'Изучение аномалий и сбор данных', dept: 'R' },
    { text: 'Эксперименты и построение теорий', dept: 'S' },
    { text: 'Организация процессов и людей', dept: 'A' },
    { text: 'Обслуживание систем объекта', dept: 'C' },
  ] },
  { text: 'Как вы поступите при нештатной ситуации?', options: [
    { text: 'Немедленно займу позицию и буду сдерживать угрозу', dept: 'G' },
    { text: 'Задокументирую происходящее для отчёта', dept: 'R' },
    { text: 'Проанализирую причину и предложу гипотезу', dept: 'S' },
    { text: 'Скоординирую действия персонала', dept: 'A' },
    { text: 'Проверю и восстановлю работу оборудования', dept: 'C' },
  ] },
  { text: 'Какой предмет вы бы взяли на смену?', options: [
    { text: 'Табельное оружие', dept: 'G' },
    { text: 'Блокнот для наблюдений', dept: 'R' },
    { text: 'Набор для лабораторных проб', dept: 'S' },
    { text: 'Планшет с расписанием смен', dept: 'A' },
    { text: 'Универсальный инструмент', dept: 'C' },
  ] },
];

const TEST_COOLDOWN_DAYS = 7;

function canRetakeTest(lastTestDate) {
  if (!lastTestDate) return true;
  const diff = Date.now() - new Date(lastTestDate).getTime();
  return diff >= TEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

function formatCooldownRemaining(lastTestDate) {
  const diffMs = TEST_COOLDOWN_DAYS * 24 * 60 * 60 * 1000 - (Date.now() - new Date(lastTestDate).getTime());
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  return `${days} дн. ${hours} ч.`;
}

async function generateUniqueKeycardNumber() {
  let candidate;
  let exists = true;
  while (exists) {
    candidate = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
    const { data } = await supabase.from('profiles').select('id').eq('keycard_number', candidate).maybeSingle();
    exists = !!data;
  }
  return candidate;
}

function renderKeycard(root, { username, department, keycardNumber }) {
  const reveal = root.querySelector('.keycard-reveal');
  const status = reveal.querySelector('.keycard-reveal__status');
  status.textContent = 'Генерация карты допуска…';

  setTimeout(() => {
    const card = document.createElement('div');
    card.className = 'keycard';
    card.innerHTML = `
      <div class="keycard__top">
        <img class="keycard__icon" src="assets/keycard_background.png" alt="">
        <div>
          <div class="keycard__username">${username}</div>
          <div class="keycard__rank">LR-${department}</div>
          <div class="keycard__id">#${keycardNumber}</div>
        </div>
      </div>
      <div class="keycard__strip"></div>
      <div class="keycard__footer"></div>
    `;
    reveal.appendChild(card);
    status.textContent = 'Карта допуска выдана';
    requestAnimationFrame(() => card.classList.add('visible'));
  }, 3000);
}

function tallyDepartment(answers) {
  const counts = { G: 0, R: 0, S: 0, A: 0, C: 0 };
  answers.forEach((dept) => { counts[dept] += 1; });
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function initAssignmentTest(root) {
  (async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session) return;
    const userId = session.session.user.id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, last_assignment_test')
      .eq('id', userId)
      .single();
    if (!profile) return;

    if (!canRetakeTest(profile.last_assignment_test)) {
      root.innerHTML = `<div class="test__cooldown">Повторное прохождение теста будет доступно через <strong>${formatCooldownRemaining(profile.last_assignment_test)}</strong></div>`;
      return;
    }

    let current = 0;
    const answers = [];
    const progressEl = root.querySelector('.test__progress');
    const questionEl = root.querySelector('.test__question');
    const optionsEl = root.querySelector('.test__options');

    function renderQuestion() {
      const q = DEPARTMENT_QUESTIONS[current];
      progressEl.textContent = `Вопрос ${current + 1} из ${DEPARTMENT_QUESTIONS.length}`;
      questionEl.textContent = q.text;
      optionsEl.innerHTML = '';
      q.options.forEach((opt) => {
        const btn = document.createElement('div');
        btn.className = 'test__option';
        btn.textContent = opt.text;
        btn.addEventListener('click', () => {
          answers.push(opt.dept);
          current += 1;
          if (current < DEPARTMENT_QUESTIONS.length) {
            renderQuestion();
          } else {
            finish();
          }
        });
        optionsEl.appendChild(btn);
      });
    }

    async function finish() {
      const department = tallyDepartment(answers);
      const keycardNumber = await generateUniqueKeycardNumber();
      await supabase.from('profiles').update({
        department,
        keycard_number: keycardNumber,
        last_assignment_test: new Date().toISOString(),
      }).eq('id', userId);

      root.innerHTML = `
        <div class="keycard-reveal">
          <div class="keycard-reveal__status">Тест завершён</div>
        </div>
      `;
      renderKeycard(root, { username: profile.username, department, keycardNumber });
    }

    renderQuestion();
  })();
}

function boot() {
  document.querySelectorAll('.carousel').forEach(initCarousel);
  document.querySelectorAll('.side-nav').forEach(initSideNavLang);
  initRatingWidgets(document);
  initComments(document);
  document.querySelectorAll('[data-article-modal]').forEach(initAccessModal);
  initTabs(document);
  initRedactedText(document);
  document.querySelectorAll('#register-form').forEach(initRegistrationForm);
  document.querySelectorAll('#login-form').forEach(initLoginForm);
  document.querySelectorAll('.test[data-role="assignment"]').forEach(initAssignmentTest);
  initAuthState();

  window.addEventListener('registration:complete', () => {
    document.querySelector('.form-page')?.setAttribute('hidden', '');
    const testPage = document.querySelector('.test-page');
    if (!testPage) return;
    testPage.hidden = false;
    initAssignmentTest(testPage.querySelector('.test'));
  });
}

document.addEventListener('DOMContentLoaded', boot);
