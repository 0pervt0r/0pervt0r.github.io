// section-list.js
//
// Общий рендерер для страниц-списков раздела: и обычных
// (документация, Z-объекты — просто название + описание),
// и "персональских" (персоналии, заключённые — с аватаркой,
// форматом Имя • Ранг-Отдел #Номер и сортировкой).
//
// Использование на странице:
//   import { mountSectionList } from './section-list.js';
//   mountSectionList(document.querySelector('[data-section-list]'), {
//     section: 'docs',       // значение колонки articles.section
//     kind: 'plain',         // 'plain' | 'personnel'
//   });

import { supabase } from './script.js';

const PAGE_SIZE = 10;

const DEPARTMENT_LABELS = {
  G: 'Гвардеец',
  R: 'Исследователь',
  S: 'Учёный',
  A: 'Управленческий персонал',
  C: 'Технический и вспомогательный персонал',
};
const DEPARTMENT_ORDER = ['G', 'R', 'S', 'A', 'C'];
const RANK_ORDER = ['low', 'middle', 'high', 'elite'];
const RANK_LETTER = { low: 'L', middle: 'M', high: 'H', elite: 'E' };

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function formatPersonnelId(row) {
  const rankLetter = RANK_LETTER[row.rank_tier] || '?';
  const dept = row.department || '—';
  return `${rankLetter}R-${dept}`;
}

async function fetchPlainArticles(section) {
  const { data, error } = await supabase
    .from('articles')
    .select('slug, title, description, created_at')
    .eq('section', section)
    .eq('status', 'published')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('section-list.js: не удалось получить статьи', error);
    return [];
  }
  return data;
}

async function fetchPersonnelArticles(section) {
  // articles!inner гарантирует, что вернутся только строки personnel_details,
  // у которых есть связанная опубликованная статья нужного раздела.
  const { data, error } = await supabase
    .from('personnel_details')
    .select(`
      department, rank_tier, avatar_url, status,
      articles!inner(slug, title, description, section, status, created_at)
    `)
    .eq('articles.section', section)
    .eq('articles.status', 'published');
  if (error) {
    console.error('section-list.js: не удалось получить персоналии', error);
    return [];
  }
  return data.map((row) => ({
    slug: row.articles.slug,
    title: row.articles.title,
    description: row.articles.description,
    department: row.department,
    rank_tier: row.rank_tier,
    avatar_url: row.avatar_url,
    missing: row.status === 'missing',
  }));
}

function sortPersonnel(rows) {
  return [...rows].sort((a, b) => {
    const deptDiff = DEPARTMENT_ORDER.indexOf(a.department) - DEPARTMENT_ORDER.indexOf(b.department);
    if (deptDiff !== 0) return deptDiff;
    return RANK_ORDER.indexOf(a.rank_tier) - RANK_ORDER.indexOf(b.rank_tier);
  });
}

function renderPlainRow(article) {
  return `
    <a class="list__row" href="article.html?slug=${encodeURIComponent(article.slug)}">
      <div class="list__row-main">
        <div class="list__row-title">${escapeHtml(article.title)}</div>
        <div class="list__row-desc">${escapeHtml(article.description || '')}</div>
      </div>
      <div class="list__row-arrow">▶</div>
    </a>
  `;
}

function renderPersonnelRow(row) {
  const deptLabel = row.department ? DEPARTMENT_LABELS[row.department] || row.department : '';
  return `
    <a class="list__row" href="article.html?slug=${encodeURIComponent(row.slug)}">
      <div class="list__row-avatar">
        <img src="${row.avatar_url || 'assets/avatar_placeholder.png'}" alt="">
      </div>
      <div class="list__row-main">
        <div class="list__row-title">${escapeHtml(row.title)} · ${formatPersonnelId(row)}</div>
        <div class="list__row-desc">${escapeHtml(deptLabel)}${row.missing ? ' — пропавший без вести' : ''}</div>
      </div>
      <div class="list__row-arrow">▶</div>
    </a>
  `;
}

function renderPagination(root, page, totalPages, onChange) {
  const el = root.querySelector('[data-field="pagination"]');
  if (totalPages <= 1) { el.innerHTML = ''; return; }

  const buttons = [];
  buttons.push(`<button type="button" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>◀</button>`);
  for (let i = 1; i <= totalPages; i += 1) {
    buttons.push(`<button type="button" class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`);
  }
  buttons.push(`<button type="button" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>▶</button>`);

  el.innerHTML = buttons.join('');
  el.querySelectorAll('button[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = Number(btn.dataset.page);
      if (target >= 1 && target <= totalPages) onChange(target);
    });
  });
}

export async function mountSectionList(root, { section, kind = 'plain' } = {}) {
  const listEl = root.querySelector('[data-field="list"]');
  const emptyEl = root.querySelector('[data-field="empty"]');
  listEl.innerHTML = '<div class="list__empty">Загрузка…</div>';

  const rows = kind === 'personnel'
    ? sortPersonnel(await fetchPersonnelArticles(section))
    : await fetchPlainArticles(section);

  if (!rows.length) {
    listEl.innerHTML = '';
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  let page = 1;
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  function renderPage() {
    const start = (page - 1) * PAGE_SIZE;
    const slice = rows.slice(start, start + PAGE_SIZE);
    const renderRow = kind === 'personnel' ? renderPersonnelRow : renderPlainRow;
    listEl.innerHTML = slice.map(renderRow).join('');
    renderPagination(root, page, totalPages, (newPage) => { page = newPage; renderPage(); });
  }

  renderPage();
}
