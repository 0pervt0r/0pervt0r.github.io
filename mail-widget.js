// ════════════════════════════════════════════════════════════
//  HADAL MAIL SYSTEM — ВИДЖЕТ
//  Подключи оба файла на КАЖДУЮ страницу (или в общий шаблон):
//    <script src="mail-data.js"></script>
//    <script src="mail-widget.js" defer></script>
// ════════════════════════════════════════════════════════════

(function () {
  'use strict';

  const STORAGE_KEY = 'hadal_mail_read';

  // ── Хранилище прочитанных писем ──────────────────────────
  function getReadSet() {
    try { return new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')); }
    catch { return new Set(); }
  }

  function markRead(id) {
    const s = getReadSet();
    s.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...s]));
  }

  // ── Получить письма (с учётом прочитанных) ───────────────
  function getMails() {
    const read = getReadSet();
    return (window.HADAL_MAIL || []).map(m => ({
      ...m,
      read: read.has(m.id) ? true : m.read
    }));
  }

  function unreadCount() {
    return getMails().filter(m => !m.read).length;
  }

  // ── Форматирование даты ───────────────────────────────────
  function fmtDate(str) {
    if (!str) return '';
    const d = new Date(str);
    return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  // ── Экранирование HTML ────────────────────────────────────
  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Инжект стилей ─────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('hadal-mail-styles')) return;
    const style = document.createElement('style');
    style.id = 'hadal-mail-styles';
    style.textContent = `
      /* ─── FAB-кнопка ─── */
      #hm-fab {
        position: fixed;
        bottom: 24px;
        right: 24px;
        width: 52px;
        height: 52px;
        border-radius: 50%;
        background: transparent;
        border: none;
        cursor: pointer;
        z-index: 100000;
        padding: 0;
        transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #hm-fab:hover { transform: scale(1.12); }
      #hm-fab img {
        width: 52px;
        height: 52px;
        display: block;
        border-radius: 50%;
        filter: drop-shadow(0 0 8px rgba(178,229,40,0.5));
      }
      #hm-fab-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        min-width: 18px;
        height: 18px;
        border-radius: 9px;
        background: #d94f5c;
        color: #fff;
        font-family: 'Orbitron', monospace;
        font-size: 9px;
        font-weight: 700;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 4px;
        border: 2px solid #141414;
        pointer-events: none;
        transition: opacity 0.2s;
      }
      #hm-fab-badge.hidden { opacity: 0; }

      /* ─── Оверлей ─── */
      #hm-overlay {
        position: fixed;
        inset: 0;
        background: rgba(10,12,10,0.7);
        z-index: 100001;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.22s ease;
        backdrop-filter: blur(2px);
      }
      #hm-overlay.open {
        opacity: 1;
        pointer-events: all;
      }

      /* ─── Окно почты ─── */
      #hm-window {
        width: min(860px, 96vw);
        height: min(560px, 88vh);
        background: #141414;
        border: 1px solid rgba(178,229,40,0.35);
        border-radius: 4px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.94) translateY(12px);
        transition: transform 0.22s cubic-bezier(.34,1.56,.64,1);
        box-shadow: 0 0 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(178,229,40,0.1);
        position: relative;
      }
      #hm-overlay.open #hm-window {
        transform: scale(1) translateY(0);
      }

      /* ─── Заголовок окна ─── */
      #hm-titlebar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 14px;
        background: #0e0e0e;
        border-bottom: 1px solid rgba(178,229,40,0.2);
        flex-shrink: 0;
      }
      #hm-titlebar-left {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #hm-titlebar-icon {
        width: 20px;
        height: 20px;
        border-radius: 50%;
      }
      #hm-titlebar-title {
        font-family: 'Orbitron', monospace;
        font-size: 10px;
        color: #c8f03a;
        letter-spacing: 0.14em;
      }
      #hm-close {
        width: 24px;
        height: 24px;
        background: transparent;
        border: 1px solid rgba(217,79,92,0.4);
        border-radius: 2px;
        color: #d94f5c;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: monospace;
        transition: all 0.15s;
        line-height: 1;
      }
      #hm-close:hover { background: rgba(217,79,92,0.15); border-color: #d94f5c; }

      /* ─── Тело почты ─── */
      #hm-body {
        display: flex;
        flex: 1;
        overflow: hidden;
      }

      /* ─── Список писем ─── */
      #hm-list-col {
        width: 260px;
        min-width: 260px;
        background: #111;
        border-right: 1px solid rgba(178,229,40,0.15);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      #hm-list-header {
        padding: 10px 14px;
        border-bottom: 1px solid rgba(178,229,40,0.12);
        font-family: 'Orbitron', monospace;
        font-size: 8px;
        color: #526652;
        letter-spacing: 0.14em;
        flex-shrink: 0;
      }
      #hm-list {
        flex: 1;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: rgba(178,229,40,0.2) transparent;
      }
      #hm-list::-webkit-scrollbar { width: 4px; }
      #hm-list::-webkit-scrollbar-thumb { background: rgba(178,229,40,0.2); border-radius: 2px; }

      .hm-item {
        padding: 11px 14px;
        border-bottom: 1px solid rgba(178,229,40,0.07);
        cursor: pointer;
        transition: background 0.12s;
        position: relative;
      }
      .hm-item:hover { background: rgba(178,229,40,0.04); }
      .hm-item.active {
        background: rgba(178,229,40,0.08);
        border-left: 2px solid #c8f03a;
      }
      .hm-item.active .hm-item-subject { color: #c8f03a; }

      .hm-item-subject {
        font-size: 11px;
        color: #dde4ec;
        letter-spacing: 0.03em;
        margin-bottom: 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .hm-item.unread .hm-item-subject {
        color: #fff;
        font-weight: bold;
      }
      .hm-item.unread::before {
        content: '';
        position: absolute;
        left: 4px;
        top: 50%;
        transform: translateY(-50%);
        width: 5px;
        height: 5px;
        border-radius: 50%;
        background: #c8f03a;
      }
      .hm-item.active::before { display: none; }

      .hm-item-from {
        font-size: 9px;
        color: #526652;
        letter-spacing: 0.04em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* ─── Просмотр письма ─── */
      #hm-view-col {
        flex: 1;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #0d0d0d;
      }
      #hm-view-empty {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Orbitron', monospace;
        font-size: 10px;
        color: #2a302a;
        letter-spacing: 0.1em;
      }
      #hm-view-content {
        display: none;
        flex-direction: column;
        height: 100%;
      }
      #hm-view-content.visible {
        display: flex;
      }
      #hm-view-header {
        padding: 18px 22px 14px;
        border-bottom: 1px solid rgba(178,229,40,0.1);
        flex-shrink: 0;
      }
      #hm-view-subject {
        font-family: 'Orbitron', monospace;
        font-size: 15px;
        font-weight: 900;
        color: #dde4ec;
        letter-spacing: 0.04em;
        margin-bottom: 8px;
        line-height: 1.2;
      }
      #hm-view-meta {
        display: flex;
        align-items: center;
        gap: 14px;
        flex-wrap: wrap;
      }
      #hm-view-from {
        font-family: 'Orbitron', monospace;
        font-size: 9px;
        color: #c8f03a;
        letter-spacing: 0.08em;
      }
      #hm-view-date {
        font-size: 9px;
        color: #526652;
        letter-spacing: 0.05em;
      }
      #hm-view-body {
        flex: 1;
        overflow-y: auto;
        padding: 20px 22px;
        font-family: 'Share Tech Mono', monospace;
        font-size: 11px;
        color: #b0b8c1;
        line-height: 1.8;
        letter-spacing: 0.03em;
        white-space: pre-wrap;
        scrollbar-width: thin;
        scrollbar-color: rgba(178,229,40,0.2) transparent;
      }
      #hm-view-body::-webkit-scrollbar { width: 4px; }
      #hm-view-body::-webkit-scrollbar-thumb { background: rgba(178,229,40,0.2); border-radius: 2px; }

      /* ─── Пусто ─── */
      #hm-empty-state {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 10px;
        color: #2a302a;
        font-family: 'Orbitron', monospace;
        font-size: 10px;
        letter-spacing: 0.1em;
      }

      /* ─── Сканлайн поверх окна ─── */
      #hm-window::after {
        content: '';
        position: absolute;
        inset: 0;
        background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.12) 2px, rgba(0,0,0,0.12) 4px);
        pointer-events: none;
        z-index: 10;
        opacity: 0.5;
      }

      /* ─── Мобильная версия ─── */
      @media (max-width: 600px) {
        #hm-fab {
          bottom: 16px;
          right: 16px;
          width: 44px;
          height: 44px;
        }
        #hm-fab img { width: 44px; height: 44px; }

        #hm-window {
          width: 100vw;
          height: 100dvh;
          border-radius: 0;
          border: none;
        }
        #hm-body { flex-direction: column; }

        #hm-list-col {
          width: 100%;
          min-width: unset;
          height: 220px;
          min-height: 220px;
          border-right: none;
          border-bottom: 1px solid rgba(178,229,40,0.15);
          flex-shrink: 0;
        }

        #hm-view-col { flex: 1; min-height: 0; }
        #hm-view-subject { font-size: 13px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── HTML виджета ──────────────────────────────────────────
  function buildHTML() {
    const fab = document.createElement('button');
    fab.id = 'hm-fab';
    fab.innerHTML = `
      <img src="MailIcon.png" alt="Почта">
      <span id="hm-fab-badge" class="hidden">0</span>
    `;
    document.body.appendChild(fab);

    const overlay = document.createElement('div');
    overlay.id = 'hm-overlay';
    overlay.innerHTML = `
      <div id="hm-window">
        <div id="hm-titlebar">
          <div id="hm-titlebar-left">
            <img id="hm-titlebar-icon" src="MailIcon.png" alt="">
            <span id="hm-titlebar-title">ВНУТРЕННЯЯ ПОЧТА · HTO</span>
          </div>
          <button id="hm-close">✕</button>
        </div>
        <div id="hm-body">
          <div id="hm-list-col">
            <div id="hm-list-header">ВХОДЯЩИЕ</div>
            <div id="hm-list"></div>
          </div>
          <div id="hm-view-col">
            <div id="hm-view-empty">ВЫБЕРИТЕ ПИСЬМО</div>
            <div id="hm-view-content">
              <div id="hm-view-header">
                <div id="hm-view-subject"></div>
                <div id="hm-view-meta">
                  <span id="hm-view-from"></span>
                  <span id="hm-view-date"></span>
                </div>
              </div>
              <div id="hm-view-body"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  // ── Рендер списка ─────────────────────────────────────────
  function renderList(activeId) {
    const list = document.getElementById('hm-list');
    const mails = getMails();
    if (!list) return;

    if (mails.length === 0) {
      list.innerHTML = `<div id="hm-empty-state">НЕТ ПИСЕМ</div>`;
      return;
    }

    list.innerHTML = mails.map(m => `
      <div class="hm-item ${m.read ? '' : 'unread'} ${activeId === m.id ? 'active' : ''}"
           data-id="${esc(m.id)}">
        <div class="hm-item-subject">${esc(m.subject)}</div>
        <div class="hm-item-from">${esc(m.from)}</div>
      </div>
    `).join('');

    list.querySelectorAll('.hm-item').forEach(el => {
      el.addEventListener('click', () => openMail(el.dataset.id));
    });
  }

  // ── Открыть письмо ────────────────────────────────────────
  function openMail(id) {
    const mail = getMails().find(m => m.id === id);
    if (!mail) return;

    markRead(id);

    document.getElementById('hm-view-empty').style.display = 'none';
    const content = document.getElementById('hm-view-content');
    content.classList.add('visible');

    document.getElementById('hm-view-subject').textContent = mail.subject;
    document.getElementById('hm-view-from').textContent = mail.from;
    document.getElementById('hm-view-date').textContent = fmtDate(mail.date);
    document.getElementById('hm-view-body').textContent = mail.body;

    renderList(id);
    updateBadge();
  }

  // ── Обновить бейдж ────────────────────────────────────────
  function updateBadge() {
    const badge = document.getElementById('hm-fab-badge');
    if (!badge) return;
    const n = unreadCount();
    badge.textContent = n;
    badge.classList.toggle('hidden', n === 0);
  }

  // ── Открыть/закрыть окно ─────────────────────────────────
  function openWindow() {
    document.getElementById('hm-overlay').classList.add('open');
    renderList(null);
  }

  function closeWindow() {
    document.getElementById('hm-overlay').classList.remove('open');
  }

  // ── Инициализация ─────────────────────────────────────────
  function init() {
    injectStyles();
    buildHTML();
    updateBadge();

    document.getElementById('hm-fab').addEventListener('click', openWindow);
    document.getElementById('hm-close').addEventListener('click', closeWindow);
    document.getElementById('hm-overlay').addEventListener('click', function (e) {
      if (e.target === this) closeWindow();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeWindow();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
