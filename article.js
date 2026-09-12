import { supabase, initRatingWidgets, RANK_TIER_LABELS, formatUserId } from './script.js';
import { renderArticle } from './article-renderer.js';

const DEPARTMENT_LABELS = {
  G: 'Гвардеец',
  R: 'Исследователь',
  S: 'Учёный',
  A: 'Управленческий персонал',
  C: 'Технический и вспомогательный персонал',
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getFullYear()}`;
}

async function fetchArticleMeta(slug) {
  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, title, description, section, author_id, required_clearance, score, status, created_at')
    .eq('slug', slug)
    .single();
  if (error) {
    console.error('article.js: не удалось получить метаданные статьи', error);
    return null;
  }
  return data;
}

async function fetchAuthor(authorId) {
  if (!authorId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, name, surname')
    .eq('id', authorId)
    .single();
  if (error) return null;
  return data;
}

function renderRatingWidget(article) {
  const container = document.querySelector('[data-field="ratingbar"]');
  container.innerHTML = `
    <span>Рейтинг статьи</span>
    <div class="rating" data-table="articles" data-id="${article.id}">
      <div class="rating__controls">
        <button class="rating__btn" data-vote="up">▲</button>
        <span class="rating__score">${article.score || 0}</span>
        <button class="rating__btn" data-vote="down">▼</button>
      </div>
    </div>
  `;
  // Виджет создан уже с настоящим id статьи, поэтому initRatingWidgets
  // можно спокойно вызывать именно сейчас — а не полагаться на глобальный
  // вызов в script.js при загрузке страницы (тогда id ещё не был бы известен).
  initRatingWidgets(container);
}

function renderMeta(article, author) {
  const authorEl = document.querySelector('[data-field="meta-author"]');
  if (author) {
    const displayName = `${author.name || ''} ${author.surname || ''}`.trim() || author.username;
    authorEl.innerHTML = `Автор: <a href="account.html?id=${author.id}">${escapeHtml(displayName)}</a>`;
  } else {
    authorEl.textContent = 'Автор неизвестен';
  }

  document.querySelector('[data-field="meta-date"]').textContent =
    `Опубликовано: ${formatDate(article.created_at)}`;
  document.querySelector('[data-field="meta-section"]').textContent =
    article.section ? `Раздел: ${article.section}` : '';
  document.querySelector('[data-field="meta-clearance"]').textContent =
    article.required_clearance > 0 ? `Требуемый допуск: ${article.required_clearance}` : '';
}

async function initArticlePage() {
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) {
    document.querySelector('[data-field="title"]').textContent = 'Статья не указана';
    return;
  }

  const article = await fetchArticleMeta(slug);
  if (!article) {
    document.querySelector('[data-field="title"]').textContent = 'Статья не найдена';
    return;
  }

  document.title = `${article.title} — Urbanshade Chronicles`;
  document.querySelector('[data-field="title"]').textContent = article.title;
  document.querySelector('[data-article-modal]').dataset.articleId = article.id;

  const author = await fetchAuthor(article.author_id);
  renderMeta(article, author);
  renderRatingWidget(article);

  await renderArticle(document.querySelector('[data-article-body]'), slug);
}

// initRedactedText навешивается на .article__redacted при каждой отрисовке
// содержимого — content вставляется асинхронно уже после первой загрузки
// страницы, поэтому обычный boot() в script.js его не подхватывает сам.
document.addEventListener('article:rendered', async (event) => {
  const { initRedactedText } = await import('./script.js');
  initRedactedText(event.detail.root);
});

document.addEventListener('DOMContentLoaded', initArticlePage);
