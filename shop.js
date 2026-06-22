/* ============================================================
   AKTIV SHOP — shop.js
   ============================================================ */

/* ── CATALOGUE ── */
const ITEMS = [
  { id: 'BL1',          img: 'shop-BL1.png',          name: 'BL1',                  price: 60,   desc: 'Защита на чистке',                                             note: null },
  { id: 'doc',          img: 'shop-doc.png',           name: 'Документ',             price: 160,  desc: 'Документ вашего персонажа добавят на вики Хроник Urbanshade',  note: null },
  { id: 'medkit',       img: 'shop-medkit.png',        name: 'Аптечка',              price: 200,  desc: 'Рест без выполнения норм',                                     note: null },
  { id: 'revive',       img: 'shop-revive.png',        name: 'Жетон Лодочника',      price: 250,  desc: 'Снять все варны',                                              note: null },
  { id: 'scan',         img: 'shop-scan.png',          name: 'Сканнер Себастьяна',   price: 300,  desc: 'Личный ивент, созданный специально под вашего персонажа',      note: null },
  { id: 'toy-remote',   img: 'shop-toy-remote.png',    name: 'Игрушечный пульт',     price: 400,  desc: 'Второй персонаж без анкеты',                                   note: '🥹 Обязательное условие: вы должны провести в сетке минимум 3 месяца.' },
  { id: 'coctaile',     img: 'shop-coctaile.png',      name: 'Коктейль «Перитесен»', price: 400,  desc: 'Иконка вашего персонажа (как в диалогах в игре)',              note: null },
  { id: 'party-special',img: 'shop-party-special.png', name: 'Party Special',        price: 450,  desc: 'Вашего персонажа превратят в плюш',                            note: null },
  { id: 'early-birds',  img: 'shop-early-birds.png',   name: 'Early Birds',          price: 600, desc: 'Бейдж-достижение при встрече с вашим персонажем',              note: null },
  { id: 'necroblox',    img: 'shop-necroblox.png',     name: 'Некроблоксикон',       price: 700, desc: 'Чиби скетч от @Koza_Ruina',                                    note: null },
  { id: 'defibrl',      img: 'shop-defibrl.png',       name: 'Дефибриллятор',        price: 750, desc: 'Чиби арт от @HeadQuartersIrl',                                 note: null },
  { id: 'chibi',        img: 'shop-chibi.png',         name: 'Чиби брелок',          price: 1000, desc: 'Мы превратим вашего персонажа в чиби брелок',                  note: null },
];

/* ── STATE ── */
let currentUser = null;

/* ── DOM refs ── */
const authScreen     = document.getElementById('auth-screen');
const authUsername   = document.getElementById('auth-username');
const authBtn        = document.getElementById('auth-btn');
const authError      = document.getElementById('auth-error');
const app            = document.getElementById('app');

const hdrName        = document.getElementById('hdr-name');
const hdrCronaVal    = document.getElementById('hdr-crona-val');
const hdrBonusVal    = document.getElementById('hdr-bonus-val');

const shopGrid       = document.getElementById('shop-grid');

const itemModal      = document.getElementById('item-modal');
const modalClose     = document.getElementById('modal-close');
const modalImg       = document.getElementById('modal-img');
const modalName      = document.getElementById('modal-name');
const modalPrice     = document.getElementById('modal-price');
const modalDesc      = document.getElementById('modal-desc');
const modalNote      = document.getElementById('modal-note');
const modalBuyBtn    = document.getElementById('modal-buy-btn');

const exchangeModal  = document.getElementById('exchange-modal');
const exchangeClose  = document.getElementById('exchange-close');
const openExchangeBtn= document.getElementById('open-exchange');
const exBonusCount   = document.getElementById('ex-bonus-count');
const exCronaCount   = document.getElementById('ex-crona-count');
const btnBonusToC    = document.getElementById('btn-bonus-to-crona');
const btnCToBonus    = document.getElementById('btn-crona-to-bonus');

const logoutBtn      = document.getElementById('logout-btn');
const toast          = document.getElementById('toast');

const tabBtns        = document.querySelectorAll('.tab-btn');
const tabContents    = document.querySelectorAll('.tab-content');

async function buyItem(userId, username, item) {
  const { data: user } = await supabase
    .from('users')
    .select('crona')
    .eq('id', userId)
    .single();

  if (user.crona < item.price) {
    alert('Недостаточно крон!');
    return;
  }

  await supabase
    .from('users')
    .update({ crona: user.crona - item.price })
    .eq('id', userId);

  await supabase.from('orders').insert({
    user_id: userId,
    username: username,
    item_id: item.id,
    item_name: item.name,
    item_price: item.price
  });

  alert(`Вы купили ${item.name}!`);
}

/* ============================================================
   AUTH
   ============================================================ */
authBtn.addEventListener('click', doLogin);
authUsername.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

// Восстановить сессию при загрузке страницы
window.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('aktiv_user');
  if (saved) {
    try {
      currentUser = JSON.parse(saved);
      authScreen.classList.add('hidden');
      app.classList.remove('hidden');
      // Обновить данные с сервера (вдруг кроны изменились)
      sb.getUser(currentUser.username).then(user => {
        if (user) {
          currentUser.crona = user.crona ?? 0;
          currentUser.bonus = user.bonus ?? 0;
          updateHeader();
        }
      });
      initApp();
    } catch(e) {
      localStorage.removeItem('aktiv_user');
    }
  }
});

async function doLogin() {
  const name = authUsername.value.trim();
  if (!name) { authError.textContent = 'Введите ваш ник'; return; }
  authBtn.textContent = '...'; authBtn.disabled = true;
  authError.textContent = '';
  try {
    let user = await sb.getUser(name);
    
    // Если пользователя нет — создать нового
    if (!user) {
      const created = await sb.createUser(name);
      user = created?.[0] || { username: name, crona: 0, bonus: 0 };
    }
    
    currentUser = { username: user.username, crona: user.crona ?? 0, bonus: user.bonus ?? 0 };
    localStorage.setItem('aktiv_user', JSON.stringify(currentUser));
    authScreen.classList.add('hidden');
    app.classList.remove('hidden');
    initApp();
  } catch(e) {
    authError.textContent = 'Ошибка: ' + e.message;
  }
  authBtn.textContent = 'ВОЙТИ'; authBtn.disabled = false;
}

logoutBtn.addEventListener('click', () => {
  currentUser = null;
  localStorage.removeItem('aktiv_user'); // ← очищаем сессию
  app.classList.add('hidden');
  authScreen.classList.remove('hidden');
  authUsername.value = '';
  authError.textContent = '';
});

/* ============================================================
   INIT
   ============================================================ */
function initApp() {
  updateHeader();
  buildShopGrid();
  loadLeaders();
}

/* ── header ── */
function updateHeader() {
  hdrName.textContent = currentUser.username;
  hdrCronaVal.textContent = fmt(currentUser.crona);
  hdrBonusVal.textContent = fmt(currentUser.bonus);
}

function fmt(n) { return Number(n).toLocaleString('ru-RU'); }

/* ============================================================
   SHOP GRID
   ============================================================ */
function buildShopGrid() {
  shopGrid.innerHTML = '';
  ITEMS.forEach(item => {
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML = `
      <img class="shop-item-img" src="${item.img}" alt="${item.name}"
           onerror="this.outerHTML='<div class=\\'shop-item-img-placeholder\\'>NO IMG</div>'" />
      <div class="shop-item-name">${item.name}</div>
      <div class="shop-item-price">⬡ ${fmt(item.price)} кр.</div>
    `;
    el.addEventListener('click', () => openItemModal(item));
    shopGrid.appendChild(el);
  });
}

/* ============================================================
   ITEM MODAL
   ============================================================ */
let selectedItem = null;

function openItemModal(item) {
  selectedItem = item;
  modalImg.src  = item.img;
  modalImg.alt  = item.name;
  modalName.textContent  = item.name;
  modalPrice.textContent = `⬡ ${fmt(item.price)} крон`;
  modalDesc.textContent  = item.desc;
  modalNote.textContent  = item.note || '';
  modalNote.style.display = item.note ? 'block' : 'none';
  itemModal.classList.remove('hidden');
}

modalClose.addEventListener('click', () => itemModal.classList.add('hidden'));
itemModal.addEventListener('click', e => { if (e.target === itemModal) itemModal.classList.add('hidden'); });

modalBuyBtn.addEventListener('click', async () => {
  if (!selectedItem || !currentUser) return;
  if (currentUser.crona < selectedItem.price) {
    showToast('Недостаточно крон', true); return;
  }
  const newCrona = currentUser.crona - selectedItem.price;
  modalBuyBtn.textContent = '...'; modalBuyBtn.disabled = true;
  try {
    await sb.updateUser(currentUser.username, { crona: newCrona, bonus: currentUser.bonus });
    currentUser.crona = newCrona;
    await sb.createOrder(currentUser.username, selectedItem);
    updateHeader();
    itemModal.classList.add('hidden');
    showToast(`«${selectedItem.name}» куплено!`);
  } catch(e) {
    showToast('Ошибка: ' + e.message, true);
  }
  modalBuyBtn.textContent = 'КУПИТЬ'; modalBuyBtn.disabled = false;
});

/* ============================================================
   EXCHANGE MODAL
   ============================================================ */
openExchangeBtn.addEventListener('click', () => {
  exBonusCount.textContent = fmt(currentUser.bonus);
  exCronaCount.textContent = fmt(currentUser.crona);
  exchangeModal.classList.remove('hidden');
});
exchangeClose.addEventListener('click', () => exchangeModal.classList.add('hidden'));
exchangeModal.addEventListener('click', e => { if (e.target === exchangeModal) exchangeModal.classList.add('hidden'); });

btnBonusToC.addEventListener('click', async () => {
  if (currentUser.bonus < 1) { showToast('Нет бонусов для обмена', true); return; }
  const newBonus = currentUser.bonus - 1;
  const newCrona = currentUser.crona + 25;
  await doExchange(newCrona, newBonus, '1 бонус → 25 крон');
});

btnCToBonus.addEventListener('click', async () => {
  if (currentUser.crona < 30) { showToast('Нужно минимум 30 крон', true); return; }
  const newCrona = currentUser.crona - 30;
  const newBonus = currentUser.bonus + 1;
  await doExchange(newCrona, newBonus, '30 крон → 1 бонус');
});

async function doExchange(newCrona, newBonus, label) {
  btnBonusToC.disabled = true; btnCToBonus.disabled = true;
  try {
    await sb.updateUser(currentUser.username, { crona: newCrona, bonus: newBonus });
    currentUser.crona = newCrona;
    currentUser.bonus = newBonus;
    updateHeader();
    exBonusCount.textContent = fmt(currentUser.bonus);
    exCronaCount.textContent = fmt(currentUser.crona);
    showToast(`Обмен выполнен: ${label}`);
  } catch(e) {
    showToast('Ошибка: ' + e.message, true);
  }
  btnBonusToC.disabled = false; btnCToBonus.disabled = false;
}

/* ============================================================
   LEADERS
   ============================================================ */
async function loadLeaders() {
  try {
    const [byCrona, byBonus] = await Promise.all([sb.topByCrona(), sb.topByBonus()]);
    fillTable('table-crona', byCrona, 'crona');
    fillTable('table-bonus', byBonus, 'bonus');
  } catch(e) {
    console.warn('Leaders load failed:', e.message);
  }
}

function fillTable(tableId, rows, field) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';
  if (!rows?.length) {
    tbody.innerHTML = '<tr><td colspan="3" style="color:var(--text-dim);font-size:12px;">Нет данных</td></tr>';
    return;
  }
  rows.forEach((row, i) => {
    const tr = document.createElement('tr');
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    tr.innerHTML = `
      <td><span class="rank-badge">${medal || (i + 1)}</span></td>
      <td>${row.username}</td>
      <td style="font-family:var(--font-mono)">${fmt(row[field])}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ============================================================
   TABS
   ============================================================ */
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.remove('hidden');
    if (tab === 'leaders') loadLeaders();
  });
});

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer = null;
function showToast(msg, isErr = false) {
  toast.textContent = msg;
  toast.className = 'toast' + (isErr ? ' toast-err' : '');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
}

/* ============================================================
   INVENTORY
   ============================================================ */
async function loadInventory() {
  const grid = document.getElementById('inventory-grid');
  grid.innerHTML = '<div style="color:var(--text-dim);padding:20px">Загрузка...</div>';
  try {
    const items = await sb.getInventory(currentUser.username);
    if (!items?.length) {
      grid.innerHTML = '<div style="color:var(--text-dim);padding:20px">Инвентарь пуст</div>';
      return;
    }
    grid.innerHTML = '';
    items.forEach(order => {
      const catalogItem = ITEMS.find(i => i.id === order.item_id);
      const el = document.createElement('div');
      el.className = 'shop-item' + (order.used ? ' item-used' : '');
      el.innerHTML = `
        <img class="shop-item-img" src="${catalogItem?.img || ''}" alt="${order.item_name}"
             onerror="this.outerHTML='<div class=\\'shop-item-img-placeholder\\'>NO IMG</div>'" />
        <div class="shop-item-name">${order.item_name}</div>
        <div class="shop-item-price">⬡ ${fmt(order.item_price)} кр.</div>
        <button class="modal-buy-btn" style="margin-top:8px;font-size:11px"
          ${order.used ? 'disabled' : ''}
          data-id="${order.id}">
          ${order.used ? '✓ ИСПОЛЬЗОВАН' : 'ИСПОЛЬЗОВАТЬ'}
        </button>
      `;
      if (!order.used) {
        el.querySelector('button').addEventListener('click', async (e) => {
          e.stopPropagation();
          if (!confirm(`Использовать «${order.item_name}»? Предмет исчезнет.`)) return;
          try {
            await sb.useItem(order.id);
            showToast(`«${order.item_name}» использован!`);
            loadInventory();
          } catch(err) {
            showToast('Ошибка: ' + err.message, true);
          }
        });
      }
      grid.appendChild(el);
    });
  } catch(e) {
    grid.innerHTML = `<div style="color:red;padding:20px">Ошибка: ${e.message}</div>`;
  }
}
