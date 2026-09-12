// article-editor.js
//
// Простой конструктор блоков для написания/редактирования статьи.
// Никакого contenteditable-WYSIWYG — каждый блок это либо текст, либо
// картинка, с отдельными полями настройки (выравнивание, выделение,
// позиция и т.д.). Так проще гарантировать, что итоговый JSON будет
// валидным и предсказуемым.
//
// Использование:
//   import { mountArticleEditor } from './article-editor.js';
//   mountArticleEditor(document.querySelector('#editor-root'), {
//     slug: 'existing-slug-or-empty-for-new',
//   });

import { supabase } from './script.js';

let blockCounter = 0;
function nextId() { return `b${++blockCounter}`; }

function emptyTextBlock() {
  return { id: nextId(), type: 'text', align: 'left', highlight: false, footnote: '', redacted: null, content: '' };
}

function emptyImageBlock() {
  return { id: nextId(), type: 'image', position: 'center', src: '', caption: '' };
}

function renderTextBlockEditor(block, onChange, onRemove) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-block';
  wrap.innerHTML = `
    <div class="editor-block__toolbar">
      <select class="editor-block__align">
        <option value="left">Слева</option>
        <option value="center">По центру</option>
        <option value="right">Справа</option>
      </select>
      <label><input type="checkbox" class="editor-block__highlight"> Выделить цветом</label>
      <input type="text" class="editor-block__footnote" placeholder="Текст сноски (необязательно)">
      <input type="number" class="editor-block__redacted" placeholder="Уровень допуска для скрытия" min="0">
      <button type="button" class="editor-block__remove">✕</button>
    </div>
    <textarea class="editor-block__content" rows="4" placeholder="Текст абзаца…"></textarea>
  `;

  const alignSel = wrap.querySelector('.editor-block__align');
  const highlightBox = wrap.querySelector('.editor-block__highlight');
  const footnoteInput = wrap.querySelector('.editor-block__footnote');
  const redactedInput = wrap.querySelector('.editor-block__redacted');
  const contentArea = wrap.querySelector('.editor-block__content');

  alignSel.value = block.align;
  highlightBox.checked = block.highlight;
  footnoteInput.value = block.footnote || '';
  redactedInput.value = block.redacted ?? '';
  contentArea.value = block.content;

  const emit = () => onChange({
    ...block,
    align: alignSel.value,
    highlight: highlightBox.checked,
    footnote: footnoteInput.value.trim() || null,
    redacted: redactedInput.value === '' ? null : Number(redactedInput.value),
    content: contentArea.value,
  });

  [alignSel, highlightBox, footnoteInput, redactedInput, contentArea].forEach((el) => {
    el.addEventListener('input', emit);
    el.addEventListener('change', emit);
  });
  wrap.querySelector('.editor-block__remove').addEventListener('click', onRemove);

  return wrap;
}

function renderImageBlockEditor(block, onChange, onRemove) {
  const wrap = document.createElement('div');
  wrap.className = 'editor-block';
  wrap.innerHTML = `
    <div class="editor-block__toolbar">
      <select class="editor-block__position">
        <option value="left">Слева</option>
        <option value="center">По центру</option>
        <option value="right">Справа</option>
      </select>
      <input type="text" class="editor-block__src" placeholder="Ссылка на изображение">
      <input type="text" class="editor-block__caption" placeholder="Подпись (необязательно)">
      <button type="button" class="editor-block__remove">✕</button>
    </div>
  `;

  const posSel = wrap.querySelector('.editor-block__position');
  const srcInput = wrap.querySelector('.editor-block__src');
  const captionInput = wrap.querySelector('.editor-block__caption');

  posSel.value = block.position;
  srcInput.value = block.src;
  captionInput.value = block.caption || '';

  const emit = () => onChange({
    ...block,
    position: posSel.value,
    src: srcInput.value.trim(),
    caption: captionInput.value.trim() || null,
  });

  [posSel, srcInput, captionInput].forEach((el) => {
    el.addEventListener('input', emit);
    el.addEventListener('change', emit);
  });
  wrap.querySelector('.editor-block__remove').addEventListener('click', onRemove);

  return wrap;
}

export function mountArticleEditor(root, { slug: initialSlug = '' } = {}) {
  let blocks = [];
  let slug = initialSlug;

  root.innerHTML = `
    <div class="editor">
      <div class="form__group">
        <label class="form__label">Название статьи</label>
        <input type="text" class="form__input editor__title">
      </div>
      <div class="form__group">
        <label class="form__label">Краткое описание (для списков)</label>
        <input type="text" class="form__input editor__description">
      </div>
      <div class="form__group">
        <label class="form__label">Раздел (как в остальном коде сайта, например personnel/docs/zobjects)</label>
        <input type="text" class="form__input editor__section">
      </div>
      <div class="form__group">
        <label class="form__label">Требуемый уровень допуска для полного текста</label>
        <input type="number" class="form__input editor__clearance" min="0" value="0">
      </div>
      <div class="editor__blocks"></div>
      <div class="editor__add-buttons">
        <button type="button" class="btn editor__add-text">+ Текст</button>
        <button type="button" class="btn editor__add-image">+ Изображение</button>
      </div>
      <button type="button" class="btn btn-accent editor__save">Сохранить статью</button>
      <div class="form__status editor__status"></div>
    </div>
  `;

  const titleInput = root.querySelector('.editor__title');
  const descInput = root.querySelector('.editor__description');
  const sectionInput = root.querySelector('.editor__section');
  const clearanceInput = root.querySelector('.editor__clearance');
  const blocksRoot = root.querySelector('.editor__blocks');
  const statusEl = root.querySelector('.editor__status');

  function redraw() {
    blocksRoot.innerHTML = '';
    blocks.forEach((block, index) => {
      const onChange = (updated) => { blocks[index] = updated; };
      const onRemove = () => { blocks.splice(index, 1); redraw(); };
      const el = block.type === 'text'
        ? renderTextBlockEditor(block, onChange, onRemove)
        : renderImageBlockEditor(block, onChange, onRemove);
      blocksRoot.appendChild(el);
    });
  }

  root.querySelector('.editor__add-text').addEventListener('click', () => {
    blocks.push(emptyTextBlock());
    redraw();
  });
  root.querySelector('.editor__add-image').addEventListener('click', () => {
    blocks.push(emptyImageBlock());
    redraw();
  });

  root.querySelector('.editor__save').addEventListener('click', async () => {
    statusEl.textContent = 'Сохранение…';
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      statusEl.textContent = 'Нужно войти в аккаунт.';
      return;
    }

    const { data, error } = await supabase.functions.invoke('save-article', {
      body: {
        slug: slug || undefined,
        title: titleInput.value.trim(),
        description: descInput.value.trim(),
        section: sectionInput.value.trim() || undefined,
        requiredClearance: Number(clearanceInput.value) || 0,
        blocks: blocks.map(({ id, ...rest }) => rest), // id только для React-ключей в UI, в файл не идёт
      },
    });

    if (error) {
      statusEl.textContent = `Ошибка: ${error.message}`;
      return;
    }
    slug = data.slug;
    statusEl.textContent = 'Статья сохранена.';
  });

  // Если редактируем существующую статью — подгружаем текст из GitHub Pages
  // и метаданные (описание/раздел/допуск) из Supabase, чтобы предзаполнить форму.
  if (initialSlug) {
    fetch(`articles/${initialSlug}.json`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        titleInput.value = data.title || '';
        blocks = (data.blocks || []).map((b) => ({ ...b, id: nextId() }));
        redraw();
      })
      .catch((err) => console.error('mountArticleEditor: не удалось загрузить статью', err));

    supabase
      .from('articles')
      .select('description, section, required_clearance')
      .eq('slug', initialSlug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        descInput.value = data.description || '';
        sectionInput.value = data.section || '';
        clearanceInput.value = data.required_clearance ?? 0;
      });
  }

  redraw();
}
