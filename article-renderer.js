// article-renderer.js
//
// Загружает JSON статьи из GitHub Pages (тот же домен, что и сам сайт,
// поэтому никаких проблем с CORS) и превращает блоки в HTML.
//
// Ожидаемый формат файла articles/{slug}.json:
// {
//   "title": "Название",
//   "blocks": [
//     { "type": "text", "align": "left|center|right", "highlight": false,
//       "footnote": null, "redacted": null, "content": "..." },
//     { "type": "image", "position": "left|center|right", "src": "...",
//       "caption": "..." | null }
//   ]
// }
//
// redacted, если задан — это число (требуемый уровень допуска), при котором
// блок изначально закрыт чёрной плашкой (см. initRedactedText в script.js —
// она уже умеет снимать .unlocked с элементов .article__redacted).

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function renderTextBlock(block) {
  const alignClass = {
    left: 'align-left',
    center: 'align-center',
    right: 'align-right',
  }[block.align] || 'align-left';

  let inner = escapeHtml(block.content);

  if (block.highlight) {
    inner = `<span class="article__highlight">${inner}</span>`;
  }

  if (block.redacted != null) {
    inner = `<span class="article__redacted" data-clearance="${block.redacted}">${inner}</span>`;
  }

  if (block.footnote) {
    // Текст сноски кладём в title — по наведению браузер покажет тултип;
    // если нужен кастомный вид сноски, замени на data-атрибут + свой попап.
    return `<p class="${alignClass} article__footnote" title="${escapeHtml(block.footnote)}">${inner}</p>`;
  }

  return `<p class="${alignClass}">${inner}</p>`;
}

function renderImageBlock(block) {
  const posClass = {
    left: 'article__figure--left',
    center: 'article__figure--center',
    right: 'article__figure--right',
  }[block.position] || 'article__figure--center';

  const caption = block.caption
    ? `<figcaption>${escapeHtml(block.caption)}</figcaption>`
    : '';

  return `
    <figure class="article__figure ${posClass}">
      <img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.caption || '')}">
      ${caption}
    </figure>
  `;
}

function renderBlock(block) {
  if (block.type === 'text') return renderTextBlock(block);
  if (block.type === 'image') return renderImageBlock(block);
  return '';
}

export async function renderArticle(root, slug) {
  root.innerHTML = '<p class="article__loading">Загрузка статьи…</p>';

  let data;
  try {
    // Путь относительный — работает и на GitHub Pages, и локально.
    const res = await fetch(`articles/${slug}.json`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (err) {
    console.error('renderArticle: не удалось загрузить статью', err);
    root.innerHTML = '<p class="article__loading">Статья не найдена.</p>';
    return;
  }

  root.innerHTML = data.blocks.map(renderBlock).join('\n');

  // initRedactedText (из script.js) вешается на .article__redacted при
  // общей инициализации страницы, так что после вставки нового HTML
  // событие клика на редактированный текст нужно перепривязать —
  // проще всего повторно вызвать initRedactedText(root) отсюда:
  document.dispatchEvent(new CustomEvent('article:rendered', { detail: { root, slug } }));
}
