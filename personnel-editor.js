// personnel-editor.js
//
// Редактор для персоналий и заключённых. Отличается от обычного
// article-editor.js только набором структурных полей сверху (отдел,
// ранг, рост/вес и т.д.) — сами блоки текста/картинок переиспользуются
// оттуда же, чтобы не дублировать логику.

import { supabase } from './script.js';
import {
  nextId,
  emptyTextBlock,
  emptyImageBlock,
  renderTextBlockEditor,
  renderImageBlockEditor,
} from './article-editor.js';

const DEPARTMENTS = [
  { value: 'G', label: 'Гвардеец' },
  { value: 'R', label: 'Исследователь' },
  { value: 'S', label: 'Учёный' },
  { value: 'A', label: 'Управленческий персонал' },
  { value: 'C', label: 'Технический и вспомогательный персонал' },
];
const RANK_TIERS = [
  { value: 'low', label: 'Low-rank' },
  { value: 'middle', label: 'Middle-rank' },
  { value: 'high', label: 'High-rank' },
  { value: 'elite', label: 'Elite-rank' },
];

export function mountPersonnelEditor(root, { slug: initialSlug = '', kind = 'personnel' } = {}) {
  const isPrisoner = kind === 'prisoners';
  let blocks = [];
  let slug = initialSlug;

  root.innerHTML = `
    <div class="editor">
      <div class="form__group">
        <label class="form__label">Имя</label>
        <input type="text" class="form__input editor__title">
      </div>
      <div class="form__group">
        <label class="form__label">Позывной / краткое описание (для списков)</label>
        <input type="text" class="form__input editor__description">
      </div>

      ${isPrisoner ? '' : `
      <div class="form__group">
        <label class="form__label">Отдел</label>
        <select class="form__input editor__department">
          ${DEPARTMENTS.map((d) => `<option value="${d.value}">${d.label}</option>`).join('')}
        </select>
      </div>`}

      <div class="form__group">
        <label class="form__label">Уровень должности (ранг)</label>
        <select class="form__input editor__rank">
          ${RANK_TIERS.map((r) => `<option value="${r.value}">${r.label}</option>`).join('')}
        </select>
      </div>

      <div class="form__group">
        <label class="form__label">Пол / гендер</label>
        <input type="text" class="form__input editor__gender">
      </div>

      <div class="form__group" style="display:flex; gap: var(--gap-md);">
        <div style="flex:1">
          <label class="form__label">Рост (см)</label>
          <input type="number" class="form__input editor__height">
        </div>
        <div style="flex:1">
          <label class="form__label">Вес (кг)</label>
          <input type="number" class="form__input editor__weight">
        </div>
      </div>

      <div class="form__group">
        <label class="form__label">Дата рождения</label>
        <input type="date" class="form__input editor__birthdate">
      </div>

      ${isPrisoner ? `
      <div class="form__group">
        <label class="form__label">Список преступлений</label>
        <textarea class="form__textarea editor__crimes" rows="3"></textarea>
      </div>` : ''}

      <div class="form__group">
        <label class="form__label">Ссылка на аватар/фото</label>
        <input type="text" class="form__input editor__avatar">
      </div>

      <div class="form__group">
        <label class="form__label">Статус</label>
        <select class="form__input editor__status">
          <option value="active">Активен</option>
          <option value="missing">Пропавший без вести</option>
        </select>
      </div>

      <div class="form__group">
        <label class="form__label">Требуемый уровень допуска для полного документа</label>
        <input type="number" class="form__input editor__clearance" min="0" value="0">
      </div>

      <h3>Биография / личность / связанные материалы</h3>
      <div class="editor__blocks"></div>
      <div class="editor__add-buttons">
        <button type="button" class="btn editor__add-text">+ Текст</button>
        <button type="button" class="btn editor__add-image">+ Изображение</button>
      </div>

      <button type="button" class="btn btn-accent editor__save">Сохранить</button>
      <div class="form__status editor__status"></div>
    </div>
  `;

  const titleInput = root.querySelector('.editor__title');
  const descInput = root.querySelector('.editor__description');
  const deptSelect = root.querySelector('.editor__department');
  const rankSelect = root.querySelector('.editor__rank');
  const genderInput = root.querySelector('.editor__gender');
  const heightInput = root.querySelector('.editor__height');
  const weightInput = root.querySelector('.editor__weight');
  const birthdateInput = root.querySelector('.editor__birthdate');
  const crimesInput = root.querySelector('.editor__crimes');
  const avatarInput = root.querySelector('.editor__avatar');
  const statusSelect = root.querySelector('.editor__status');
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
        section: kind, // 'personnel' | 'prisoners'
        requiredClearance: Number(clearanceInput.value) || 0,
        blocks: blocks.map(({ id, ...rest }) => rest),
        personnel: {
          department: isPrisoner ? null : deptSelect.value,
          rankTier: rankSelect.value,
          gender: genderInput.value.trim() || null,
          heightCm: heightInput.value ? Number(heightInput.value) : null,
          weightKg: weightInput.value ? Number(weightInput.value) : null,
          birthDate: birthdateInput.value || null,
          crimes: isPrisoner ? (crimesInput.value.trim() || null) : null,
          avatarUrl: avatarInput.value.trim() || null,
          status: statusSelect.value,
        },
      },
    });

    if (error) {
      statusEl.textContent = `Ошибка: ${error.message}`;
      return;
    }
    slug = data.slug;
    statusEl.textContent = 'Сохранено.';
  });

  // Подгрузка существующей записи (текст — из GitHub, структурные поля — из Supabase)
  if (initialSlug) {
    fetch(`articles/${initialSlug}.json`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data) return;
        titleInput.value = data.title || '';
        blocks = (data.blocks || []).map((b) => ({ ...b, id: nextId() }));
        redraw();
      })
      .catch((err) => console.error('mountPersonnelEditor: не удалось загрузить статью', err));

    supabase
      .from('articles')
      .select('description, required_clearance, personnel_details(department, rank_tier, gender, height_cm, weight_kg, birth_date, crimes, avatar_url, status)')
      .eq('slug', initialSlug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) return;
        descInput.value = data.description || '';
        clearanceInput.value = data.required_clearance ?? 0;
        const p = data.personnel_details;
        if (!p) return;
        if (deptSelect) deptSelect.value = p.department || 'G';
        rankSelect.value = p.rank_tier || 'low';
        genderInput.value = p.gender || '';
        heightInput.value = p.height_cm ?? '';
        weightInput.value = p.weight_kg ?? '';
        birthdateInput.value = p.birth_date || '';
        if (crimesInput) crimesInput.value = p.crimes || '';
        avatarInput.value = p.avatar_url || '';
        statusSelect.value = p.status || 'active';
      });
  }

  redraw();
}
