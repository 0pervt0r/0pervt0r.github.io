import { supabase, initRatingWidgets, initTabs, RANK_TIER_LETTER, formatUserId, logout } from './script.js';

/*
 * Ожидаемые таблицы Supabase для этой страницы (создать при необходимости):
 *
 * profiles
 *   ...существующие поля (username, name, surname, rank_tier, department,
 *   keycard_number, avatar_url, clearance_level, birth_date)
 *   + bio            text        — описание в шапке профиля
 *   + gallery_urls   jsonb       — массив ссылок на изображения профиля
 *
 * blog_posts
 *   id, author_id (-> profiles.id), content, created_at, score (int, default 0)
 * blog_posts_votes
 *   target_id (-> blog_posts.id), user_id (-> profiles.id), value (int: -1/0/1)
 *   unique (target_id, user_id)
 *
 * articles
 *   id, author_id (-> profiles.id), title, description, slug, created_at
 *
 * friendships
 *   id, user_id, friend_id, status ('pending' | 'accepted'), created_at
 */

const params = new URLSearchParams(window.location.search);
const viewedId = params.get('id');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн. назад`;
}

async function getCurrentUserId() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.user?.id ?? null;
}

async function fetchProfile(id) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, name, surname, rank_tier, department, keycard_number, avatar_url, bio, gallery_urls')
    .eq('id', id)
    .single();
  if (error) {
    console.error('account.js: не удалось получить профиль', error);
    return null;
  }
  return data;
}

function renderHeader(profile, isOwn) {
  const displayName = `${profile.name || ''} ${profile.surname || ''}`.trim() || profile.username;
  document.querySelector('[data-field="display-name"]').textContent = displayName;
  document.querySelector('[data-field="id-label"]').textContent =
    `@${profile.username} · ${formatUserId(profile)}`;

  const avatarImg = document.querySelector('.profile-header__avatar img');
  if (avatarImg && profile.avatar_url) avatarImg.src = profile.avatar_url;

  const descEl = document.querySelector('[data-field="description"]');
  descEl.textContent = profile.bio || 'Описание пока не заполнено.';

  const otherActions = document.querySelector('[data-field="actions"]');
  const ownActions = document.querySelector('[data-field="own-actions"]');

  if (isOwn) {
    ownActions.hidden = false;
    const logoutBtn = ownActions.querySelector('[data-action="logout"]');
    logoutBtn.hidden = false;
    logoutBtn.addEventListener('click', logout);
    ownActions.querySelector('[data-action="edit-profile"]').addEventListener('click', () => {
      window.location.href = 'account-edit.html';
    });
  } else {
    otherActions.hidden = false;
    wireOtherProfileActions(profile);
  }
}

function wireOtherProfileActions(profile) {
  const root = document.querySelector('[data-field="actions"]');
  root.querySelector('[data-action="add-friend"]')?.addEventListener('click', async () => {
    const myId = await getCurrentUserId();
    if (!myId) { window.location.href = 'login.html'; return; }
    await supabase.from('friendships').insert({ user_id: myId, friend_id: profile.id, status: 'pending' });
  });
  root.querySelector('[data-action="message"]')?.addEventListener('click', () => {
    window.location.href = `mail.html?to=${profile.id}`;
  });
  root.querySelector('[data-action="block"]')?.addEventListener('click', async () => {
    const myId = await getCurrentUserId();
    if (!myId) return;
    await supabase.from('blocks').insert({ user_id: myId, blocked_id: profile.id });
  });
}

function renderGallery(urls) {
  const root = document.querySelector('[data-profile-gallery]');
  if (!urls || !urls.length) return;
  root.hidden = false;

  let index = 0;
  const mainImg = root.querySelector('.profile-gallery__main img');
  const prevThumbImg = root.querySelector('.profile-gallery__thumb--prev img');
  const nextThumbImg = root.querySelector('.profile-gallery__thumb--next img');

  function render() {
    const prevIndex = (index - 1 + urls.length) % urls.length;
    const nextIndex = (index + 1) % urls.length;
    mainImg.src = urls[index];
    prevThumbImg.src = urls[prevIndex];
    nextThumbImg.src = urls[nextIndex];
  }

  root.querySelector('.profile-gallery__arrow--prev').addEventListener('click', () => {
    index = (index - 1 + urls.length) % urls.length;
    render();
  });
  root.querySelector('.profile-gallery__arrow--next').addEventListener('click', () => {
    index = (index + 1) % urls.length;
    render();
  });
  root.querySelector('.profile-gallery__thumb--prev').addEventListener('click', () => {
    index = (index - 1 + urls.length) % urls.length;
    render();
  });
  root.querySelector('.profile-gallery__thumb--next').addEventListener('click', () => {
    index = (index + 1) % urls.length;
    render();
  });

  render();
}

async function renderBlogTab(profile) {
  const list = document.querySelector('[data-field="blog-list"]');
  const empty = document.querySelector('[data-field="blog-empty"]');
  const { data: posts, error } = await supabase
    .from('blog_posts')
    .select('id, content, created_at, score')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false });

  if (error || !posts || !posts.length) {
    empty.hidden = false;
    return;
  }

  const displayName = `${profile.name || ''} ${profile.surname || ''}`.trim() || profile.username;
  posts.forEach((post) => {
    const el = document.createElement('article');
    el.className = 'blog-post';
    el.innerHTML = `
      <div class="blog-post__avatar"><img src="${profile.avatar_url || 'assets/avatar_placeholder.png'}" alt=""></div>
      <div class="blog-post__body">
        <div class="blog-post__author">${escapeHtml(profile.username)}</div>
        <p class="blog-post__text">${escapeHtml(post.content)}</p>
        <div class="blog-post__footer">
          <div class="rating" data-table="blog_posts" data-id="${post.id}">
            <div class="rating__controls">
              <button class="rating__btn" data-vote="up">▲</button>
              <span class="rating__score">${post.score || 0}</span>
              <button class="rating__btn" data-vote="down">▼</button>
            </div>
          </div>
          <span class="blog-post__time">${timeAgo(post.created_at)}</span>
        </div>
      </div>
    `;
    list.appendChild(el);
  });

  initRatingWidgets(list);
}

async function renderPostsTab(profile) {
  const list = document.querySelector('[data-field="posts-list"]');
  const empty = document.querySelector('[data-field="posts-empty"]');
  const { data: articles, error } = await supabase
    .from('articles')
    .select('id, title, description, slug, created_at')
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false });

  if (error || !articles || !articles.length) {
    empty.hidden = false;
    return;
  }

  articles.forEach((article) => {
    const row = document.createElement('a');
    row.className = 'list__row';
    row.href = `article.html?slug=${encodeURIComponent(article.slug)}`;
    row.innerHTML = `
      <div class="list__row-main">
        <div class="list__row-title">${escapeHtml(article.title)}</div>
        <div class="list__row-desc">${escapeHtml(article.description || '')}</div>
      </div>
      <div class="list__row-arrow">▶</div>
    `;
    list.appendChild(row);
  });
}

async function renderFriendsTab(profile) {
  const list = document.querySelector('[data-field="friends-list"]');
  const empty = document.querySelector('[data-field="friends-empty"]');

  const { data: rows, error } = await supabase
    .from('friendships')
    .select('user_id, friend_id, profiles_friend:profiles!friendships_friend_id_fkey(id, username, name, surname, avatar_url), profiles_user:profiles!friendships_user_id_fkey(id, username, name, surname, avatar_url)')
    .eq('status', 'accepted')
    .or(`user_id.eq.${profile.id},friend_id.eq.${profile.id}`);

  if (error || !rows || !rows.length) {
    empty.hidden = false;
    return;
  }

  const myId = await getCurrentUserId();

  rows.forEach((row) => {
    const friend = row.user_id === profile.id ? row.profiles_friend : row.profiles_user;
    if (!friend) return;
    const displayName = `${friend.name || ''} ${friend.surname || ''}`.trim() || friend.username;
    const el = document.createElement('div');
    el.className = 'friend-row';
    el.innerHTML = `
      <a class="friend-row__avatar" href="account.html?id=${friend.id}">
        <img src="${friend.avatar_url || 'assets/avatar_placeholder.png'}" alt="">
      </a>
      <div>
        <a class="friend-row__name" href="account.html?id=${friend.id}">${escapeHtml(displayName)}</a>
        <div class="friend-row__username">@${escapeHtml(friend.username)}</div>
      </div>
      <div class="friend-row__actions" ${myId === profile.id ? '' : 'hidden'}>
        <button type="button" data-action="message" title="Написать сообщение">
          <img src="assets/account_see.png" alt="">
        </button>
        <button type="button" data-action="remove" title="Удалить из друзей">
          <img src="assets/block.png" alt="">
        </button>
      </div>
    `;
    list.appendChild(el);
  });
}

async function initAccountPage() {
  const myId = await getCurrentUserId();
  const targetId = viewedId || myId;

  if (!targetId) {
    window.location.href = 'login.html';
    return;
  }

  const profile = await fetchProfile(targetId);
  if (!profile) return;

  const isOwn = !!myId && myId === profile.id;

  renderHeader(profile, isOwn);
  renderGallery(profile.gallery_urls);
  await renderBlogTab(profile);
  await renderPostsTab(profile);
  await renderFriendsTab(profile);

  initTabs(document);
}

document.addEventListener('DOMContentLoaded', initAccountPage);
