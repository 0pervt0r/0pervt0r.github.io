import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://ytmwejebzkunzukuztvq.supabase.co';
const SUPABASE_ANON_KEY = 'REPLACE_WITH_ANON_KEY';

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

function boot() {
  document.querySelectorAll('.carousel').forEach(initCarousel);
  document.querySelectorAll('.side-nav').forEach(initSideNavLang);
  initRatingWidgets(document);
  initComments(document);
  document.querySelectorAll('[data-article-modal]').forEach(initAccessModal);
  initTabs(document);
  initRedactedText(document);
}

document.addEventListener('DOMContentLoaded', boot);
