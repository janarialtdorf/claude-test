/* =====================================================================
   LOOM admin panel
   All write operations go to /api/admin/* with a Bearer token obtained
   from POST /api/admin/login.
   ===================================================================== */
'use strict';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const dt = (t, opts = { dateStyle: 'medium', timeStyle: 'short' }) => new Date(t).toLocaleString('en-GB', opts);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const CAT = { tshirts: 'T-shirts & tops', shirts: 'Shirts', knitwear: 'Knitwear', hoodies: 'Hoodies & sweats', jackets: 'Jackets & coats', pants: 'Trousers & jeans', dresses: 'Dresses', skirts: 'Skirts', accessories: 'Accessories' };
const I = {
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3Z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12V3h9l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="m3 7 9 6 9-6"/></svg>',
  cog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 20h4L19 9l-4-4L4 16v4Z"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="8" y="8" width="12" height="12" rx="1"/><path d="M16 8V4H4v12h4"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h18M3 12h18M3 17h18"/></svg>',
};

/* ---------------- auth/session ---------------- */
const session = {
  get() {
    try { return JSON.parse(sessionStorage.getItem('loom.admin') || localStorage.getItem('loom.admin') || 'null'); } catch { return null; }
  },
  set(s, remember) {
    try {
      const v = JSON.stringify(s);
      if (remember) localStorage.setItem('loom.admin', v); else sessionStorage.setItem('loom.admin', v);
    } catch { /* ignore */ }
  },
  clear() { try { sessionStorage.removeItem('loom.admin'); localStorage.removeItem('loom.admin'); } catch { /* ignore */ } },
};
let auth = session.get();
let expiryTimer = null;

async function api(path, opts = {}) {
  const headers = {};
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (auth?.token) headers.Authorization = 'Bearer ' + auth.token;
  const res = await fetch(path, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/admin/login') { logout('Your session has expired — please sign in again.'); throw new Error('Session expired'); }
  if (!res.ok) { const e = new Error(data.error || 'Request failed'); e.details = data.details; e.status = res.status; throw e; }
  return data;
}

function logout(msg) {
  auth = null; session.clear(); clearTimeout(expiryTimer);
  dirty = false;
  renderLogin(msg);
}
function scheduleExpiry() {
  clearTimeout(expiryTimer);
  if (!auth) return;
  const ms = auth.expiresAt - Date.now();
  if (ms <= 0) return logout('Your session has expired.');
  expiryTimer = setTimeout(() => logout('Your session has expired.'), Math.min(ms, 2 ** 31 - 1));
}

/* ---------------- toast / modal / confirm ---------------- */
function toast(msg, err) {
  const el = document.createElement('div');
  el.className = 'toast' + (err ? ' err' : '');
  el.innerHTML = `<span>${msg}</span>`;
  $('#toasts').append(el);
  setTimeout(() => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); }, 3200);
}
function openModal(html, w = 640) {
  $('#modalContent').innerHTML = html;
  $('#modal .box').style.setProperty('--w', w + 'px');
  $('#modal').classList.add('open'); $('#overlay').classList.add('open');
  setTimeout(() => $('#modalContent input, #modalContent select, #modalContent button')?.focus(), 50);
  return $('#modalContent');
}
function closeModal() { $('#modal').classList.remove('open'); $('#overlay').classList.remove('open'); $('.side')?.classList.remove('open'); }
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === $('#overlay') || e.target === $('#modal')) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
function confirmBox(title, body, okLabel = 'Delete', danger = true) {
  return new Promise((resolve) => {
    const m = openModal(`<div class="inner" style="display:grid;gap:14px"><h2 style="font-size:34px">${esc(title)}</h2><p class="muted" style="margin:0">${body}</p>
      <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" data-no>Cancel</button><button class="btn ${danger ? 'danger' : ''}" data-yes>${esc(okLabel)}</button></div></div>`, 440);
    $('[data-yes]', m).onclick = () => { closeModal(); resolve(true); };
    $('[data-no]', m).onclick = () => { closeModal(); resolve(false); };
    const obs = new MutationObserver(() => { if (!$('#modal').classList.contains('open')) { obs.disconnect(); resolve(false); } });
    obs.observe($('#modal'), { attributes: true });
  });
}
function downloadCSV(name, rows) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function thumb(p, cls = 'pthumb') {
  return `<div class="${cls}">${p.images?.length ? `<img src="${esc(p.images[0])}" alt="">` : garmentSVG(p.category, p.colors?.[0]?.hex || '#999')}</div>`;
}

/* ---------------- login ---------------- */
function renderLogin(msg) {
  document.title = 'Sign in — LOOM Admin';
  $('#root').innerHTML = `
    <div class="login">
      <form id="loginForm" novalidate>
        <a href="/" class="logo" style="font-size:28px">LO<em>O</em>M</a>
        <div><div class="eyebrow">Store admin</div><h1>Sign in</h1></div>
        ${msg ? `<div class="applied" style="background:var(--warn-soft);color:var(--warn)">${esc(msg)}</div>` : ''}
        <label class="field"><span>Username</span><input class="input" name="username" autocomplete="username" required autofocus></label>
        <label class="field"><span>Password</span><div class="pw-wrap"><input class="input" type="password" name="password" autocomplete="current-password" required><button type="button" id="showPw">Show</button></div></label>
        <label class="check"><input type="checkbox" name="remember">Keep me signed in on this device</label>
        <div class="form-msg err" id="loginMsg" role="alert"></div>
        <button class="btn block" id="loginBtn">Sign in</button>
        <a href="/" class="link-btn" style="justify-self:center">← Back to store</a>
      </form>
    </div>`;
  $('#showPw').onclick = () => { const i = $('input[name=password]'); i.type = i.type === 'password' ? 'text' : 'password'; $('#showPw').textContent = i.type === 'password' ? 'Show' : 'Hide'; };
  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('#loginBtn');
    if (!f.username.value || !f.password.value) { $('#loginMsg').textContent = 'Enter your username and password.'; return; }
    btn.disabled = true; btn.textContent = 'Signing in…';
    try {
      const r = await api('/api/admin/login', { method: 'POST', body: { username: f.username.value, password: f.password.value } });
      auth = { token: r.token, expiresAt: r.expiresAt, username: r.username, mustChangePassword: r.mustChangePassword };
      session.set(auth, f.remember.checked);
      scheduleExpiry();
      if (!location.hash) location.hash = '#dashboard';
      renderShell();
    } catch (err) {
      $('#loginMsg').textContent = err.message;
      f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
      btn.disabled = false; btn.textContent = 'Sign in';
      f.password.select();
    }
  };
}

/* ---------------- shell + routing ---------------- */
let dirty = false; // unsaved editor changes
const NAV = [
  ['dashboard', 'Dashboard', I.dash], ['products', 'Products', I.box], ['orders', 'Orders', I.cart],
  ['discounts', 'Discounts', I.tag], ['reviews', 'Reviews', I.star], ['subscribers', 'Subscribers', I.mail], ['settings', 'Settings', I.cog],
];
function renderShell() {
  $('#root').innerHTML = `
    <div class="mobile-top"><button class="icon-btn" id="sideBtn" aria-label="Menu">${I.menu}</button><b>LOOM Admin</b><span style="width:40px"></span></div>
    <div class="shell">
      <aside class="side" id="side">
        <a href="/" class="logo" style="padding:0;background:none" title="View store">LO<em>O</em>M<small>ADMIN</small></a>
        ${NAV.map(([k, l, ic]) => `<a href="#${k}" data-nav="${k}">${ic}<span>${l}</span>${k === 'orders' ? '<span class="n" id="paidCount" hidden></span>' : ''}</a>`).join('')}
        <div class="foot">
          <span>Signed in as <b>${esc(auth.username)}</b></span>
          <button id="themeBtn">Toggle dark mode</button>
          <button id="logoutBtn">Sign out</button>
        </div>
      </aside>
      <main class="content" id="view"></main>
    </div>`;
  $('#logoutBtn').onclick = async () => { if (dirty && !(await confirmBox('Discard changes?', 'You have unsaved changes.', 'Discard'))) return; logout('You have been signed out.'); };
  $('#themeBtn').onclick = () => { const n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = n; try { localStorage.setItem('loom.theme', n); } catch { /* ignore */ } };
  $('#sideBtn').onclick = () => { $('#side').classList.add('open'); $('#overlay').classList.add('open'); };
  route();
}
let lastHash = location.hash;
addEventListener('hashchange', async () => {
  if (!auth) return;
  if (dirty) {
    const target = location.hash;
    history.replaceState(null, '', lastHash);
    if (!(await confirmBox('Discard changes?', 'You have unsaved changes to this product. Leave without saving?', 'Discard'))) return;
    dirty = false; history.replaceState(null, '', target);
  }
  route();
});
addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

async function route() {
  lastHash = location.hash;
  closeModal();
  const [page, sub, id] = (location.hash.slice(1) || 'dashboard').split('/');
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === page));
  const view = $('#view');
  view.classList.remove('page-enter'); void view.offsetWidth; view.classList.add('page-enter');
  view.innerHTML = '<div class="skel" style="height:56px;width:300px;margin-bottom:24px"></div><div class="skel" style="height:300px"></div>';
  const banner = auth.mustChangePassword ? `<div class="warn-banner"><span>You're using the default admin password. Please change it.</span><a class="btn sm" href="#settings">Change password</a></div>` : '';
  try {
    if (page === 'dashboard') await viewDashboard(view);
    else if (page === 'products' && sub === 'new') await viewEditor(view, null);
    else if (page === 'products' && sub === 'edit') await viewEditor(view, id);
    else if (page === 'products' && sub === 'duplicate') await viewEditor(view, id, true);
    else if (page === 'products') await viewProducts(view);
    else if (page === 'orders') await viewOrders(view);
    else if (page === 'discounts') await viewDiscounts(view);
    else if (page === 'reviews') await viewReviews(view);
    else if (page === 'subscribers') await viewSubscribers(view);
    else if (page === 'settings') viewSettings(view);
    else view.innerHTML = '<h1>Not found</h1>';
    if (banner && page !== 'settings') view.insertAdjacentHTML('afterbegin', banner);
  } catch (e) {
    if (e.message !== 'Session expired') view.innerHTML = `<div class="panel"><h3>Error</h3><p>${esc(e.message)}</p></div>`;
  }
  api('/api/admin/stats').then((s) => { const n = $('#paidCount'); if (n) { n.hidden = !s.byStatus.paid; n.textContent = s.byStatus.paid; } }).catch(() => {});
}

/* ---------------- dashboard ---------------- */
async function viewDashboard(view) {
  document.title = 'Dashboard — LOOM Admin';
  const s = await api('/api/admin/stats');
  const max = Math.max(...s.days.map((d) => d.revenue), 1);
  view.innerHTML = `
    <div class="page-title"><div><div class="eyebrow">${dt(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' })}</div><h1>Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, ${esc(auth.username)}</h1></div><a class="btn accent" href="#products/new">+ Add product</a></div>
    <div class="kpis">
      <div class="panel kpi"><div class="l">Revenue</div><div class="v">${money(s.revenue)}</div></div>
      <div class="panel kpi"><div class="l">Orders</div><div class="v">${s.orders}</div></div>
      <div class="panel kpi"><div class="l">Avg. order</div><div class="v">${money(s.avgOrder)}</div></div>
      <div class="panel kpi"><div class="l">Products · units</div><div class="v">${s.products} <span style="font-size:22px" class="muted">· ${s.units}</span></div></div>
      <div class="panel kpi"><div class="l">Subscribers</div><div class="v">${s.subscribers}</div></div>
    </div>
    <div class="dash">
      <div class="panel"><h3>Revenue · last 14 days</h3>
        <div class="chart">${s.days.map((d) => `<div class="col"><div class="tip">${dt(d.date, { day: 'numeric', month: 'short' })}: ${money(d.revenue)} · ${d.orders} order${d.orders === 1 ? '' : 's'}</div><div class="bar" style="height:0" data-h="${(d.revenue / max) * 100}"></div><span>${new Date(d.date).getDate()}</span></div>`).join('')}</div>
      </div>
      <div class="panel"><h3>Orders by status</h3>
        ${Object.entries(s.byStatus).map(([k, v]) => `<a href="#orders" data-status="${k}" style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line);text-decoration:none"><span class="pill ${k}">${k}</span><b>${v}</b></a>`).join('')}
      </div>
      <div class="panel"><h3>Recent orders</h3><div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th>Customer</th><th>Status</th><th style="text-align:right">Total</th></tr></thead><tbody>
        ${s.recentOrders.map((o) => `<tr style="cursor:pointer" data-order="${o.number}"><td><b>${o.number}</b><div class="muted" style="font-size:12px">${dt(o.createdAt)}</div></td><td>${esc(o.customer.name)}</td><td><span class="pill ${o.status}">${o.status}</span></td><td style="text-align:right">${money(o.total)}</td></tr>`).join('')}
      </tbody></table></div></div>
      <div style="display:grid;gap:16px;align-content:start">
        <div class="panel"><h3>Top sellers</h3>${s.top.length ? s.top.map((t, i) => `<div style="display:flex;justify-content:space-between;gap:8px;padding:6px 0;font-size:14px"><span><span class="muted">${i + 1}.</span> ${esc(t.name)}</span><span class="muted">${t.qty} sold · <b style="color:var(--ink)">${money(t.revenue)}</b></span></div>`).join('') : '<p class="muted">No sales yet.</p>'}</div>
        <div class="panel"><h3>Low stock ⚠</h3>${s.lowStock.length ? s.lowStock.map((l) => `<a href="#products/edit/${l.id}" style="display:flex;justify-content:space-between;padding:6px 0;font-size:14px;text-decoration:none"><span>${esc(l.name)} <span class="muted">· ${esc(l.size)}</span></span><b class="stock-cell ${l.stock ? 'low' : 'zero'}">${l.stock ? l.stock + ' left' : 'Sold out'}</b></a>`).join('') : '<p class="muted">All sizes well stocked.</p>'}</div>
      </div>
    </div>`;
  requestAnimationFrame(() => $$('.chart .bar').forEach((b) => (b.style.height = b.dataset.h + '%')));
  $$('[data-order]').forEach((r) => (r.onclick = async () => { const { items } = await api('/api/admin/orders'); orderModal(items.find((o) => o.number === r.dataset.order), () => viewDashboard(view)); }));
  $$('[data-status]').forEach((a) => a.addEventListener('click', () => sessionStorage.setItem('loom.orderFilter', a.dataset.status)));
}

/* ---------------- products list ---------------- */
async function viewProducts(view) {
  document.title = 'Products — LOOM Admin';
  const { items } = await api('/api/admin/products');
  const st = { q: '', cat: '', stock: '', sort: 'createdAt', dir: -1, sel: new Set() };
  view.innerHTML = `
    <div class="page-title"><div><div class="eyebrow">Catalogue</div><h1>Products</h1></div>
      <div style="display:flex;gap:8px"><button class="btn ghost" id="exportP">Export CSV</button><a class="btn accent" href="#products/new">+ New product</a></div></div>
    <div class="panel">
      <div class="bar-tools">
        <input class="input" id="pq" placeholder="Search name, tag, colour…" type="search">
        <select class="input" id="pcat"><option value="">All categories</option>${Object.entries(CAT).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
        <select class="input" id="pstock"><option value="">Any stock</option><option value="low">Low stock (≤ 2 in a size)</option><option value="out">Has sold-out sizes</option><option value="sale">On sale</option><option value="featured">Featured</option></select>
        <span class="muted" id="pcount" style="margin-left:auto;font-size:13px"></span>
      </div>
      <div id="bulk" hidden class="applied" style="margin-bottom:12px;background:var(--paper-2);color:var(--ink)"><span><b id="selN"></b> selected</span><span style="display:flex;gap:6px"><button class="btn sm ghost" data-bulk="feature">Feature</button><button class="btn sm ghost" data-bulk="unfeature">Unfeature</button><button class="btn sm danger" data-bulk="delete">Delete</button></span></div>
      <div class="table-wrap"><table class="t">
        <thead><tr><th style="width:30px"><input type="checkbox" id="selAll" aria-label="Select all"></th><th data-sort="name">Product</th><th data-sort="category">Category</th><th data-sort="price">Price</th><th data-sort="totalStock">Stock</th><th data-sort="sold">Sold</th><th>Featured</th><th></th></tr></thead>
        <tbody id="ptbody"></tbody></table></div>
    </div>`;
  const draw = () => {
    let rows = items.filter((p) => {
      if (st.q && ![p.name, p.category, ...p.tags, ...p.colors.map((c) => c.name)].join(' ').toLowerCase().includes(st.q)) return false;
      if (st.cat && p.category !== st.cat) return false;
      if (st.stock === 'low' && !Object.values(p.stock).some((n) => n > 0 && n <= 2)) return false;
      if (st.stock === 'out' && !Object.values(p.stock).some((n) => n === 0)) return false;
      if (st.stock === 'sale' && !p.onSale) return false;
      if (st.stock === 'featured' && !p.featured) return false;
      return true;
    });
    rows.sort((a, b) => (typeof a[st.sort] === 'string' ? a[st.sort].localeCompare(b[st.sort]) : a[st.sort] - b[st.sort]) * st.dir);
    $('#pcount').textContent = `${rows.length} of ${items.length}`;
    $$('th[data-sort]').forEach((th) => { th.textContent = th.textContent.replace(/ [↑↓]$/, '') + (th.dataset.sort === st.sort ? (st.dir > 0 ? ' ↑' : ' ↓') : ''); });
    $('#ptbody').innerHTML = rows.length ? rows.map((p) => {
      const sizes = p.sizes.map((s) => `<span class="stock-cell ${p.stock[s] === 0 ? 'zero' : p.stock[s] <= 2 ? 'low' : ''}" title="${esc(s)}">${esc(s)}:${p.stock[s]}</span>`).join(' ');
      return `<tr data-id="${p.id}">
        <td><input type="checkbox" class="sel" ${st.sel.has(p.id) ? 'checked' : ''} aria-label="Select ${esc(p.name)}"></td>
        <td><div style="display:flex;gap:12px;align-items:center">${thumb(p)}<div><a href="#products/edit/${p.id}" style="text-decoration:none;font-weight:600">${esc(p.name)}</a><div class="muted" style="font-size:12px">${p.colors.map((c) => `<i style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.hex};border:1px solid rgba(0,0,0,.15)"></i>`).join(' ')} ${p.rating.count ? `· ★ ${p.rating.avg} (${p.rating.count})` : ''}</div></div></div></td>
        <td style="text-transform:capitalize">${esc(CAT[p.category] || p.category)}<div class="muted" style="font-size:12px">${esc(p.gender)}</div></td>
        <td>${money(p.price)}${p.onSale ? `<div class="muted" style="font-size:12px"><s>${money(p.compareAt)}</s></div>` : ''}</td>
        <td><b>${p.totalStock}</b><div style="font-size:11px;display:flex;gap:6px;flex-wrap:wrap">${sizes}</div></td>
        <td>${p.sold}</td>
        <td><label class="toggle"><input type="checkbox" class="feat" ${p.featured ? 'checked' : ''} aria-label="Featured"><span></span></label></td>
        <td><div class="row-actions">
          <a class="icon-btn" href="/#/product/${esc(p.slug)}" target="_blank" title="View in store">${I.ext}</a>
          <a class="icon-btn" href="#products/edit/${p.id}" title="Edit">${I.edit}</a>
          <a class="icon-btn" href="#products/duplicate/${p.id}" title="Duplicate">${I.copy}</a>
          <button class="icon-btn del" title="Delete">${I.trash}</button></div></td></tr>`;
    }).join('') : '<tr><td colspan="8" class="muted" style="text-align:center;padding:40px">No products match.</td></tr>';
    $('#bulk').hidden = !st.sel.size; $('#selN').textContent = st.sel.size;
    $('#selAll').checked = rows.length && rows.every((p) => st.sel.has(p.id));
    $$('#ptbody tr[data-id]').forEach((tr) => {
      const p = items.find((x) => x.id === tr.dataset.id);
      $('.sel', tr).onchange = (e) => { e.target.checked ? st.sel.add(p.id) : st.sel.delete(p.id); draw(); };
      $('.feat', tr).onchange = async (e) => {
        try { await api(`/api/admin/products/${p.id}`, { method: 'PATCH', body: { featured: e.target.checked } }); p.featured = e.target.checked; toast(p.featured ? `“${esc(p.name)}” is now featured` : 'Removed from featured'); }
        catch (err) { e.target.checked = !e.target.checked; toast(err.message, true); }
      };
      $('.del', tr).onclick = async () => {
        if (!(await confirmBox('Delete product?', `“${esc(p.name)}” and its reviews will be permanently removed from the store.`))) return;
        try { await api(`/api/admin/products/${p.id}`, { method: 'DELETE' }); items.splice(items.indexOf(p), 1); st.sel.delete(p.id); draw(); toast('Product deleted'); }
        catch (err) { toast(err.message, true); }
      };
    });
    st.rows = rows;
  };
  $('#pq').oninput = debounce((e) => { st.q = e.target.value.toLowerCase().trim(); draw(); }, 150);
  $('#pcat').onchange = (e) => { st.cat = e.target.value; draw(); };
  $('#pstock').onchange = (e) => { st.stock = e.target.value; draw(); };
  $$('th[data-sort]').forEach((th) => (th.onclick = () => { st.dir = st.sort === th.dataset.sort ? -st.dir : 1; st.sort = th.dataset.sort; draw(); }));
  $('#selAll').onchange = (e) => { st.rows.forEach((p) => (e.target.checked ? st.sel.add(p.id) : st.sel.delete(p.id))); draw(); };
  $$('[data-bulk]').forEach((b) => (b.onclick = async () => {
    const ids = [...st.sel], act = b.dataset.bulk;
    if (act === 'delete' && !(await confirmBox(`Delete ${ids.length} products?`, 'This cannot be undone.'))) return;
    let ok = 0;
    for (const id of ids) {
      try {
        if (act === 'delete') { await api(`/api/admin/products/${id}`, { method: 'DELETE' }); items.splice(items.findIndex((x) => x.id === id), 1); }
        else { await api(`/api/admin/products/${id}`, { method: 'PATCH', body: { featured: act === 'feature' } }); items.find((x) => x.id === id).featured = act === 'feature'; }
        ok++;
      } catch { /* continue */ }
    }
    st.sel.clear(); draw(); toast(`Updated ${ok} product${ok === 1 ? '' : 's'}`);
  }));
  $('#exportP').onclick = () => downloadCSV('loom-products.csv', [['ID', 'Name', 'Category', 'Gender', 'Price', 'Compare at', 'Colours', 'Stock', 'Total stock', 'Sold', 'Featured', 'Tags'],
    ...items.map((p) => [p.id, p.name, p.category, p.gender, p.price, p.compareAt || '', p.colors.map((c) => c.name).join('|'), p.sizes.map((s) => `${s}:${p.stock[s]}`).join('|'), p.totalStock, p.sold, p.featured ? 'yes' : 'no', p.tags.join('|')])]);
  draw();
}

/* ---------------- product editor (create = POST, edit = PUT) ---------------- */
const SIZE_PRESETS = { 'XS–XL': ['XS', 'S', 'M', 'L', 'XL'], 'S–XXL': ['S', 'M', 'L', 'XL', 'XXL'], 'Waist 28–36': ['28', '30', '32', '34', '36'], 'EU 36–44': ['36', '38', '40', '42', '44'], 'One size': ['OS'] };
const COLOR_PRESETS = [['Black', '#1d1d1f'], ['Off-white', '#f1ede4'], ['Navy', '#24324a'], ['Sand', '#d4c3a3'], ['Olive', '#6b6b3f'], ['Rust', '#b3542f'], ['Sage', '#9fae8f'], ['Heather grey', '#a3a3a3'], ['Denim', '#4a6587'], ['Burgundy', '#6e2236'], ['Camel', '#b88a5a']];

function resizeImage(file, maxSide = 1600) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error(`${file.name}: use PNG, JPEG, WEBP or GIF`));
    if (file.size > 20 * 1024 * 1024) return reject(new Error(`${file.name} is larger than 20 MB`));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read ' + file.name));
    reader.onload = () => {
      if (file.type === 'image/gif') return resolve(reader.result); // keep animation
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        if (scale === 1 && file.size < 1.5 * 1024 * 1024) return resolve(reader.result);
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.86));
      };
      img.onerror = () => reject(new Error(file.name + ' is not a valid image'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

async function viewEditor(view, id, duplicate = false) {
  let p;
  if (id) {
    const { items } = await api('/api/admin/products');
    p = items.find((x) => x.id === id);
    if (!p) { view.innerHTML = '<div class="panel"><h3>Product not found</h3><a class="btn" href="#products">Back to products</a></div>'; return; }
    p = structuredClone(p);
    if (duplicate) { p.name += ' (copy)'; p.featured = false; id = null; }
  } else {
    p = { name: '', description: '', material: '', category: 'tshirts', gender: 'unisex', price: '', compareAt: '', colors: [{ name: 'Black', hex: '#1d1d1f' }], sizes: ['XS', 'S', 'M', 'L', 'XL'], stock: { XS: 5, S: 10, M: 10, L: 10, XL: 5 }, tags: [], featured: false, images: [] };
  }
  const isNew = !id;
  document.title = `${isNew ? 'New product' : 'Edit ' + p.name} — LOOM Admin`;
  view.innerHTML = `
    <div class="page-title"><div><nav class="crumbs"><a href="#products">Products</a><span>/</span><span>${isNew ? 'New' : 'Edit'}</span></nav><h1>${isNew ? (duplicate ? 'Duplicate product' : 'New product') : esc(p.name)}</h1></div>
      ${!isNew ? `<a class="btn ghost" href="/#/product/${esc(p.slug)}" target="_blank">View in store ↗</a>` : ''}</div>
    <form id="pform" novalidate>
      <div class="editor">
        <div class="stack">
          <div class="panel"><h3>Basics</h3><div class="form-grid">
            <label class="field full" data-f="name"><span>Product name *</span><input class="input" name="name" value="${esc(p.name)}" maxlength="120" required><small class="err"></small></label>
            <label class="field full" data-f="description"><span>Description</span><textarea class="input" name="description" maxlength="4000" rows="5">${esc(p.description)}</textarea><small class="muted" id="descCount" style="font-size:11px;text-align:right"></small></label>
            <label class="field" data-f="category"><span>Category *</span><select class="input" name="category">${Object.entries(CAT).map(([k, v]) => `<option value="${k}" ${p.category === k ? 'selected' : ''}>${v}</option>`).join('')}</select><small class="err"></small></label>
            <label class="field" data-f="gender"><span>Department *</span><select class="input" name="gender">${['women', 'men', 'unisex'].map((g) => `<option ${p.gender === g ? 'selected' : ''} value="${g}">${g[0].toUpperCase() + g.slice(1)}</option>`).join('')}</select><small class="err"></small></label>
            <label class="field full" data-f="material"><span>Material / composition</span><input class="input" name="material" value="${esc(p.material)}" placeholder="e.g. 100% organic cotton"><small class="err"></small></label>
          </div></div>
          <div class="panel"><h3>Images</h3>
            <div class="drop" id="drop" tabindex="0" role="button"><b>Drop images here</b> or click to browse<br><small>PNG, JPEG, WEBP or GIF · up to 8 images · large photos are resized automatically · drag to reorder, first is the cover</small></div>
            <input type="file" id="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden>
            <div class="imgs" id="imgs"></div>
            <small class="err" data-ferr="images" style="color:var(--danger)"></small>
            <p class="muted" style="font-size:12px;margin:10px 0 0">No photos? The store shows an illustration in each colour instead.</p>
          </div>
          <div class="panel"><h3>Colours *</h3><div class="color-rows" id="colors"></div>
            <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;align-items:center"><button type="button" class="btn ghost sm" id="addColor">+ Add colour</button><span class="muted" style="font-size:12px">Quick add:</span>${COLOR_PRESETS.map(([n, h]) => `<button type="button" class="swatch" data-preset="${n}|${h}" title="${n}" style="background:${h};width:20px;height:20px"></button>`).join('')}</div>
            <small class="err" data-ferr="colors" style="color:var(--danger)"></small></div>
          <div class="panel"><h3>Sizes & stock *</h3>
            <div class="size-rows" id="sizes"></div>
            <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center">
              <input class="input" id="newSize" placeholder="Add size" style="width:110px;min-height:34px"><button type="button" class="btn ghost sm" id="addSize">Add</button>
              <span class="muted" style="font-size:12px">Presets:</span>${Object.keys(SIZE_PRESETS).map((k) => `<button type="button" class="chip" data-sp="${k}">${k}</button>`).join('')}
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;align-items:center"><span class="muted" style="font-size:12px">Set all to</span><input class="input" type="number" min="0" id="allStock" style="width:80px;min-height:34px"><button type="button" class="btn ghost sm" id="applyAll">Apply</button><span class="muted" style="margin-left:auto;font-size:13px">Total: <b id="stockTotal"></b></span></div>
            <small class="err" data-ferr="sizes" style="color:var(--danger)"></small><small class="err" data-ferr="stock" style="color:var(--danger)"></small></div>
        </div>
        <div class="stack" style="position:sticky;top:20px">
          <div class="panel"><h3>Pricing</h3><div class="form-grid">
            <label class="field" data-f="price"><span>Price (€) *</span><input class="input" name="price" type="number" step="0.01" min="0" value="${p.price}"><small class="err"></small></label>
            <label class="field" data-f="compareAt"><span>Original price (€)</span><input class="input" name="compareAt" type="number" step="0.01" min="0" value="${p.compareAt || ''}" placeholder="for sales"><small class="err"></small></label>
            <div class="full muted" id="saleNote" style="font-size:13px"></div>
          </div></div>
          <div class="panel"><h3>Organisation</h3>
            <label class="field" data-f="tags"><span>Tags (comma-separated)</span><input class="input" name="tags" value="${esc(p.tags.join(', '))}" placeholder="wool, bestseller, outerwear"><small class="err"></small></label>
            <label class="check" style="margin-top:14px"><label class="toggle"><input type="checkbox" name="featured" ${p.featured ? 'checked' : ''}><span></span></label> Feature on homepage</label>
          </div>
          <div class="panel"><h3>Live preview</h3><div id="preview" class="preview-card"></div></div>
        </div>
      </div>
      <div class="sticky-save">
        <span class="muted" id="dirtyNote" style="margin-right:auto;align-self:center;font-size:13px"></span>
        ${!isNew ? '<button type="button" class="btn danger" id="delBtn">Delete</button>' : ''}
        <a class="btn ghost" href="#products">Cancel</a>
        <button class="btn accent" id="saveBtn">${isNew ? 'Publish product' : 'Save changes'}</button>
      </div>
    </form>`;

  const f = $('#pform');
  const markDirty = () => { dirty = true; $('#dirtyNote').textContent = '● Unsaved changes'; };

  /* images */
  const drawImgs = () => {
    $('#imgs').innerHTML = p.images.map((src, i) => `<div class="im" draggable="true" data-i="${i}"><img src="${esc(src)}" alt="">${i === 0 ? '<span class="cover">Cover</span>' : ''}<button type="button" class="x" aria-label="Remove image">×</button></div>`).join('');
    let dragI = null;
    $$('#imgs .im').forEach((el) => {
      const i = +el.dataset.i;
      $('.x', el).onclick = () => { p.images.splice(i, 1); drawImgs(); preview(); markDirty(); };
      el.ondragstart = () => { dragI = i; el.classList.add('dragging'); };
      el.ondragend = () => el.classList.remove('dragging');
      el.ondragover = (e) => e.preventDefault();
      el.ondrop = (e) => { e.preventDefault(); e.stopPropagation(); if (dragI === null || dragI === i) return; const [m] = p.images.splice(dragI, 1); p.images.splice(i, 0, m); drawImgs(); preview(); markDirty(); };
    });
  };
  const addFiles = async (files) => {
    for (const file of files) {
      if (p.images.length >= 8) { toast('Maximum 8 images', true); break; }
      try { p.images.push(await resizeImage(file)); } catch (e) { toast(e.message, true); }
    }
    drawImgs(); preview(); markDirty();
  };
  const drop = $('#drop');
  drop.onclick = () => $('#file').click();
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#file').click(); } };
  $('#file').onchange = (e) => { addFiles([...e.target.files]); e.target.value = ''; };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); };
  // paste images from clipboard
  const onPaste = (e) => { if (!document.body.contains(f)) return removeEventListener('paste', onPaste); const files = [...(e.clipboardData?.files || [])].filter((x) => x.type.startsWith('image/')); if (files.length) addFiles(files); };
  addEventListener('paste', onPaste);

  /* colours */
  const drawColors = () => {
    $('#colors').innerHTML = p.colors.map((c, i) => `<div class="color-row" data-i="${i}"><input type="color" value="${esc(c.hex)}" aria-label="Colour value"><input class="input" value="${esc(c.name)}" placeholder="Colour name" aria-label="Colour name" style="min-height:40px"><input class="input hex" value="${esc(c.hex)}" maxlength="7" aria-label="Hex" style="min-height:40px;font-family:monospace"><button type="button" class="icon-btn" aria-label="Remove colour">${I.trash}</button></div>`).join('');
    $$('#colors .color-row').forEach((row) => {
      const i = +row.dataset.i, [picker, name, hex] = $$('input', row);
      picker.oninput = () => { p.colors[i].hex = hex.value = picker.value; preview(); markDirty(); };
      hex.oninput = () => { if (/^#[0-9a-f]{6}$/i.test(hex.value)) { p.colors[i].hex = picker.value = hex.value.toLowerCase(); preview(); } markDirty(); };
      name.oninput = () => { p.colors[i].name = name.value; markDirty(); };
      $('button', row).onclick = () => { p.colors.splice(i, 1); drawColors(); preview(); markDirty(); };
    });
  };
  $('#addColor').onclick = () => { p.colors.push({ name: '', hex: '#888888' }); drawColors(); $$('#colors .color-row:last-child input')[1].focus(); markDirty(); };
  $$('[data-preset]').forEach((b) => (b.onclick = () => { const [n, h] = b.dataset.preset.split('|'); if (p.colors.some((c) => c.name === n)) return toast(n + ' already added', true); p.colors.push({ name: n, hex: h }); drawColors(); preview(); markDirty(); }));

  /* sizes */
  const drawSizes = () => {
    $('#sizes').innerHTML = p.sizes.map((s) => `<div class="size-row" data-s="${esc(s)}"><label><b>${esc(s)}</b><input type="number" min="0" value="${p.stock[s] ?? 0}" aria-label="Stock for ${esc(s)}"></label><button type="button" aria-label="Remove size ${esc(s)}">×</button></div>`).join('');
    $$('#sizes .size-row').forEach((row) => {
      const s = row.dataset.s;
      $('input', row).oninput = (e) => { p.stock[s] = Math.max(0, parseInt(e.target.value, 10) || 0); total(); markDirty(); };
      $('button', row).onclick = () => { p.sizes = p.sizes.filter((x) => x !== s); delete p.stock[s]; drawSizes(); markDirty(); };
    });
    total();
  };
  const total = () => ($('#stockTotal').textContent = p.sizes.reduce((a, s) => a + (p.stock[s] || 0), 0));
  const addSize = () => { const v = $('#newSize').value.trim().toUpperCase(); if (!v) return; if (p.sizes.includes(v)) return toast('Size exists', true); p.sizes.push(v); p.stock[v] = 0; $('#newSize').value = ''; drawSizes(); markDirty(); };
  $('#addSize').onclick = addSize;
  $('#newSize').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addSize(); } };
  $$('[data-sp]').forEach((b) => (b.onclick = () => { const old = p.stock; p.sizes = [...SIZE_PRESETS[b.dataset.sp]]; p.stock = Object.fromEntries(p.sizes.map((s) => [s, old[s] ?? 5])); drawSizes(); markDirty(); }));
  $('#applyAll').onclick = () => { const n = Math.max(0, parseInt($('#allStock').value, 10) || 0); p.sizes.forEach((s) => (p.stock[s] = n)); drawSizes(); markDirty(); };

  /* preview + misc */
  const preview = () => {
    const fd = new FormData(f);
    const price = +fd.get('price') || 0, cmp = +fd.get('compareAt') || 0;
    const hex = p.colors[0]?.hex || '#999';
    $('#preview').innerHTML = `<div style="aspect-ratio:4/5;border-radius:4px;overflow:hidden;position:relative">${p.images.length ? `<img src="${esc(p.images[0])}" style="width:100%;height:100%;object-fit:cover">` : garmentSVG(fd.get('category'), hex)}${cmp > price && price ? `<span class="flag sale" style="position:absolute;top:10px;left:10px">−${Math.round((1 - price / cmp) * 100)}%</span>` : ''}</div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:10px;font-size:14px"><div><b style="font-weight:500">${esc(fd.get('name') || 'Product name')}</b><div class="muted" style="font-size:12px">${esc(CAT[fd.get('category')])}</div></div><span class="price">${cmp > price && price ? `<span class="now sale">${money(price)}</span><s>${money(cmp)}</s>` : money(price)}</span></div>
      <div class="swatches" style="margin-top:8px">${p.colors.map((c) => `<span class="swatch" style="background:${esc(c.hex)}"></span>`).join('')}</div>`;
    $('#saleNote').textContent = cmp > price && price ? `Shown as on sale: ${Math.round((1 - price / cmp) * 100)}% off, customer saves ${money(cmp - price)}.` : 'Set an original price higher than the price to show this item as on sale.';
    $('#descCount').textContent = `${(fd.get('description') || '').length} / 4000`;
  };
  f.addEventListener('input', (e) => { if (e.target.name) markDirty(); preview(); });
  f.addEventListener('change', preview);

  const showErrors = (errs = {}) => {
    $$('[data-f]', f).forEach((el) => { const m = errs[el.dataset.f]; el.classList.toggle('invalid', !!m); const s = $('.err', el); if (s) s.textContent = m || ''; });
    $$('[data-ferr]', f).forEach((el) => (el.textContent = errs[el.dataset.ferr] || ''));
    const first = $('.invalid input, .invalid select', f) || $$('[data-ferr]', f).find((x) => x.textContent);
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(f);
    const body = {
      name: fd.get('name'), description: fd.get('description'), material: fd.get('material'),
      category: fd.get('category'), gender: fd.get('gender'), price: fd.get('price'), compareAt: fd.get('compareAt') || null,
      colors: p.colors.map((c) => ({ name: c.name.trim(), hex: c.hex })), sizes: p.sizes, stock: p.stock,
      tags: String(fd.get('tags') || '').split(',').map((t) => t.trim()).filter(Boolean), featured: !!fd.get('featured'), images: p.images,
    };
    // client-side checks for instant feedback (the server validates again)
    const errs = {};
    if (!body.name.trim()) errs.name = 'Name is required';
    if (!(+body.price > 0)) errs.price = 'Enter a price';
    if (body.compareAt && +body.compareAt <= +body.price) errs.compareAt = 'Must be higher than price';
    if (!body.colors.length) errs.colors = 'Add at least one colour';
    else if (body.colors.some((c) => !c.name)) errs.colors = 'Every colour needs a name';
    if (!body.sizes.length) errs.sizes = 'Add at least one size';
    if (Object.keys(errs).length) { showErrors(errs); toast('Please fix the highlighted fields', true); return; }
    showErrors();
    const btn = $('#saveBtn'); btn.disabled = true; btn.textContent = isNew ? 'Publishing…' : 'Saving…';
    try {
      const r = isNew
        ? await api('/api/admin/products', { method: 'POST', body })
        : await api(`/api/admin/products/${id}`, { method: 'PUT', body });
      dirty = false;
      toast(isNew ? `“${esc(r.product.name)}” is live in the store ✓` : 'Changes saved ✓');
      location.hash = isNew ? '#products' : '#products/edit/' + r.product.id;
      if (!isNew) route();
    } catch (err) {
      btn.disabled = false; btn.textContent = isNew ? 'Publish product' : 'Save changes';
      showErrors(err.details); toast(err.message, true);
    }
  };
  const del = $('#delBtn');
  if (del) del.onclick = async () => {
    if (!(await confirmBox('Delete product?', `“${esc(p.name)}” will be permanently removed.`))) return;
    await api(`/api/admin/products/${id}`, { method: 'DELETE' });
    dirty = false; toast('Product deleted'); location.hash = '#products';
  };
  // Ctrl/Cmd+S saves
  const onKey = (e) => { if (!document.body.contains(f)) return removeEventListener('keydown', onKey); if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); f.requestSubmit(); } };
  addEventListener('keydown', onKey);

  drawImgs(); drawColors(); drawSizes(); preview();
  dirty = duplicate; // a duplicate is unsaved by definition
  if (duplicate) $('#dirtyNote').textContent = '● Not saved yet';
}

/* ---------------- orders ---------------- */
async function viewOrders(view) {
  document.title = 'Orders — LOOM Admin';
  const meta = await api('/api/meta');
  const st = { status: sessionStorage.getItem('loom.orderFilter') || '', q: '' };
  sessionStorage.removeItem('loom.orderFilter');
  view.innerHTML = `
    <div class="page-title"><div><div class="eyebrow">Sales</div><h1>Orders</h1></div><button class="btn ghost" id="exportO">Export CSV</button></div>
    <div class="panel">
      <div class="bar-tools">
        <input class="input" type="search" id="oq" placeholder="Order #, name or email">
        <div style="display:flex;gap:6px;flex-wrap:wrap">${['', ...meta.orderStatuses].map((s) => `<button class="chip ${st.status === s ? 'on' : ''}" data-st="${s}" style="text-transform:capitalize">${s || 'All'}</button>`).join('')}</div>
      </div>
      <div class="table-wrap"><table class="t"><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Items</th><th>Delivery</th><th>Status</th><th style="text-align:right">Total</th></tr></thead><tbody id="otbody"></tbody></table></div>
    </div>`;
  let items = [];
  const load = async () => {
    const q = new URLSearchParams(); if (st.status) q.set('status', st.status); if (st.q) q.set('q', st.q);
    items = (await api('/api/admin/orders?' + q)).items;
    $('#otbody').innerHTML = items.length ? items.map((o) => `<tr style="cursor:pointer" data-n="${o.number}">
      <td><b>${o.number}</b></td><td>${dt(o.createdAt)}</td><td>${esc(o.customer.name)}<div class="muted" style="font-size:12px">${esc(o.customer.email)}</div></td>
      <td>${o.items.reduce((s, i) => s + i.qty, 0)}</td><td style="text-transform:capitalize">${esc(o.shippingMethod)}</td>
      <td><span class="pill ${o.status}">${o.status}</span></td><td style="text-align:right"><b>${money(o.total)}</b></td></tr>`).join('')
      : '<tr><td colspan="7" class="muted" style="text-align:center;padding:40px">No orders found.</td></tr>';
    $$('#otbody tr[data-n]').forEach((tr) => (tr.onclick = () => orderModal(items.find((o) => o.number === tr.dataset.n), load)));
  };
  $('#oq').oninput = debounce((e) => { st.q = e.target.value.trim(); load(); }, 200);
  $$('[data-st]').forEach((b) => (b.onclick = () => { st.status = b.dataset.st; $$('[data-st]').forEach((x) => x.classList.toggle('on', x === b)); load(); }));
  $('#exportO').onclick = () => downloadCSV('loom-orders.csv', [['Order', 'Date', 'Status', 'Name', 'Email', 'Address', 'City', 'Zip', 'Country', 'Items', 'Subtotal', 'Discount', 'Code', 'Shipping', 'Total', 'VAT'],
    ...items.map((o) => [o.number, new Date(o.createdAt).toISOString(), o.status, o.customer.name, o.customer.email, o.customer.address, o.customer.city, o.customer.zip, o.customer.country, o.items.map((i) => `${i.qty}x ${i.name} (${i.color}/${i.size})`).join('; '), o.subtotal, o.discount, o.discountCode || '', o.shipping, o.total, o.vat])]);
  await load();
}
function orderModal(o, onChange) {
  if (!o) return;
  const statuses = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];
  const m = openModal(`<div class="inner order-detail">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;padding-right:40px"><div><div class="eyebrow">${dt(o.createdAt)}</div><h2 style="font-size:40px">Order ${o.number}</h2></div><span class="pill ${o.status}" style="font-size:13px">${o.status}</span></div>
    <div class="grid2">
      <div class="panel"><h3>Customer</h3><b>${esc(o.customer.name)}</b><br><a href="mailto:${esc(o.customer.email)}">${esc(o.customer.email)}</a>${o.customer.phone ? '<br>' + esc(o.customer.phone) : ''}</div>
      <div class="panel"><h3>${o.shippingMethod === 'pickup' ? 'Pickup' : 'Ship to'}</h3>${o.shippingMethod === 'pickup' ? 'Store pickup' : `${esc(o.customer.address)}<br>${esc(o.customer.zip)} ${esc(o.customer.city)}<br>${esc(o.customer.country)}`}<div class="muted" style="font-size:12px;margin-top:6px;text-transform:capitalize">${esc(o.shippingMethod)}</div></div>
    </div>
    ${o.note ? `<div class="applied" style="background:var(--paper-2);color:var(--ink)"><span><b>Note:</b> ${esc(o.note)}</span></div>` : ''}
    <div class="panel"><table class="t"><thead><tr><th>Item</th><th>Options</th><th>Qty</th><th style="text-align:right">Price</th></tr></thead><tbody>
      ${o.items.map((i) => `<tr><td>${esc(i.name)}</td><td>${esc(i.color)} / ${esc(i.size)}</td><td>${i.qty}</td><td style="text-align:right">${money(i.price * i.qty)}</td></tr>`).join('')}
    </tbody></table>
    <div style="display:grid;gap:4px;margin-top:12px;font-size:14px">
      <div class="sum-row"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
      ${o.discount ? `<div class="sum-row disc"><span>Discount ${o.discountCode ? `(${esc(o.discountCode)})` : ''}</span><span>−${money(o.discount)}</span></div>` : ''}
      <div class="sum-row"><span>Shipping</span><span>${money(o.shipping)}</span></div>
      <div class="sum-row total"><span>Total</span><span>${money(o.total)}</span></div>
      <div class="muted" style="font-size:12px">incl. VAT ${money(o.vat)} · ${esc(o.payment.brand)} •••• ${esc(o.payment.last4)}</div></div></div>
    <div class="panel"><h3>Update status</h3>
      ${o.status === 'cancelled' ? '<p class="muted">This order is cancelled; stock has been returned.</p>' : `
      <div class="form-grid">
        <label class="field"><span>Status</span><select class="input" id="ost">${statuses.map((s) => `<option ${o.status === s ? 'selected' : ''} value="${s}">${s[0].toUpperCase() + s.slice(1)}</option>`).join('')}</select></label>
        <label class="field"><span>Tracking number</span><input class="input" id="otr" value="${esc(o.tracking || '')}" placeholder="optional"></label>
      </div>
      <p class="muted" style="font-size:12px">Cancelling an order returns its items to stock.</p>
      <button class="btn" id="osave" style="margin-top:8px">Update order</button>`}
      ${o.history?.length ? `<div style="margin-top:14px;font-size:13px">${o.history.map((h) => `<div class="muted">${dt(h.at)} — <span style="text-transform:capitalize">${esc(h.status)}</span></div>`).join('')}</div>` : ''}
    </div></div>`, 760);
  const save = $('#osave', m);
  if (save) save.onclick = async () => {
    const status = $('#ost', m).value;
    if (status === 'cancelled' && !(await confirmBox('Cancel order?', `Order ${o.number} will be cancelled and its items returned to stock. This cannot be reopened.`, 'Cancel order'))) return;
    try {
      await api(`/api/admin/orders/${o.number}`, { method: 'PATCH', body: { status, tracking: $('#otr', m)?.value ?? undefined } });
      closeModal(); toast(`Order ${o.number} → ${status}`); onChange && onChange();
    } catch (err) { toast(err.message, true); }
  };
}

/* ---------------- discounts ---------------- */
async function viewDiscounts(view) {
  document.title = 'Discounts — LOOM Admin';
  view.innerHTML = `
    <div class="page-title"><div><div class="eyebrow">Marketing</div><h1>Discount codes</h1></div></div>
    <div class="dash">
      <div class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Code</th><th>Discount</th><th>Min. order</th><th>Expires</th><th>Uses</th><th>Active</th><th></th></tr></thead><tbody id="dtbody"></tbody></table></div></div>
      <form class="panel" id="dform" novalidate style="display:grid;gap:12px;align-content:start"><h3>Create code</h3>
        <label class="field" data-f="code"><span>Code</span><div style="display:flex;gap:6px"><input class="input" name="code" placeholder="SUMMER20" style="text-transform:uppercase"><button type="button" class="btn ghost sm" id="gen">Generate</button></div><small class="err"></small></label>
        <div class="form-grid">
          <label class="field"><span>Type</span><select class="input" name="type"><option value="percent">Percentage</option><option value="fixed">Fixed amount (€)</option></select></label>
          <label class="field" data-f="value"><span>Value</span><input class="input" name="value" type="number" min="0" step="0.01" placeholder="10"><small class="err"></small></label>
          <label class="field"><span>Minimum order (€)</span><input class="input" name="minSubtotal" type="number" min="0" step="1" placeholder="0"></label>
          <label class="field" data-f="expiresAt"><span>Expires</span><input class="input" name="expiresAt" type="date"><small class="err"></small></label>
        </div>
        <button class="btn accent">Create code</button>
      </form>
    </div>`;
  const load = async () => {
    const { items } = await api('/api/admin/discounts');
    $('#dtbody').innerHTML = items.length ? items.map((d) => {
      const expired = d.expiresAt && d.expiresAt < Date.now();
      return `<tr data-c="${esc(d.code)}"><td><span class="code-tag">${esc(d.code)}</span></td><td>${d.type === 'percent' ? d.value + '%' : money(d.value)}</td><td>${d.minSubtotal ? money(d.minSubtotal) : '—'}</td>
        <td>${d.expiresAt ? `<span class="${expired ? 'stock-cell zero' : ''}">${dt(d.expiresAt, { dateStyle: 'medium' })}${expired ? ' (expired)' : ''}</span>` : 'Never'}</td><td>${d.uses || 0}</td>
        <td><label class="toggle"><input type="checkbox" ${d.active ? 'checked' : ''}><span></span></label></td>
        <td><div class="row-actions"><button class="icon-btn" data-copy title="Copy">${I.copy}</button><button class="icon-btn" data-del title="Delete">${I.trash}</button></div></td></tr>`;
    }).join('') : '<tr><td colspan="7" class="muted" style="text-align:center;padding:30px">No codes yet.</td></tr>';
    $$('#dtbody tr[data-c]').forEach((tr) => {
      const code = tr.dataset.c;
      $('input', tr).onchange = async (e) => { await api(`/api/admin/discounts/${encodeURIComponent(code)}`, { method: 'PATCH', body: { active: e.target.checked } }); toast(`${code} ${e.target.checked ? 'activated' : 'paused'}`); };
      $('[data-del]', tr).onclick = async () => { if (await confirmBox('Delete code?', `<b>${esc(code)}</b> will stop working immediately.`)) { await api(`/api/admin/discounts/${encodeURIComponent(code)}`, { method: 'DELETE' }); toast('Code deleted'); load(); } };
      $('[data-copy]', tr).onclick = () => navigator.clipboard?.writeText(code).then(() => toast('Copied ' + code));
    });
  };
  $('#gen').onclick = () => { $('#dform').code.value = 'LOOM' + Math.random().toString(36).slice(2, 7).toUpperCase(); };
  $('#dform').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    $$('[data-f]', f).forEach((x) => { x.classList.remove('invalid'); $('.err', x).textContent = ''; });
    try {
      await api('/api/admin/discounts', { method: 'POST', body: { code: f.code.value, type: f.type.value, value: f.value.value, minSubtotal: f.minSubtotal.value, expiresAt: f.expiresAt.value ? f.expiresAt.value + 'T23:59:59' : null } });
      toast(`Code ${esc(f.code.value.toUpperCase())} created`); f.reset(); load();
    } catch (err) {
      Object.entries(err.details || {}).forEach(([k, v]) => { const x = $(`[data-f="${k}"]`, f); if (x) { x.classList.add('invalid'); $('.err', x).textContent = v; } });
      toast(err.message, true);
    }
  };
  await load();
}

/* ---------------- reviews ---------------- */
async function viewReviews(view) {
  document.title = 'Reviews — LOOM Admin';
  const { items } = await api('/api/admin/reviews');
  let filter = 0;
  view.innerHTML = `<div class="page-title"><div><div class="eyebrow">Moderation</div><h1>Reviews</h1></div></div>
    <div class="panel"><div class="bar-tools"><span class="muted" style="font-size:13px">Filter:</span>${[0, 5, 4, 3, 2, 1].map((r) => `<button class="chip ${r ? '' : 'on'}" data-r="${r}">${r ? r + '★' : 'All'}</button>`).join('')}</div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Rating</th><th>Review</th><th>Product</th><th>Date</th><th></th></tr></thead><tbody id="rtbody"></tbody></table></div></div>`;
  const draw = () => {
    const rows = items.filter((r) => !filter || r.rating === filter);
    $('#rtbody').innerHTML = rows.length ? rows.map((r) => `<tr data-id="${r.id}"><td style="color:var(--accent);white-space:nowrap">${'★'.repeat(r.rating)}<span style="color:var(--line)">${'★'.repeat(5 - r.rating)}</span></td><td><b>${esc(r.name)}</b><div style="max-width:460px">${esc(r.text)}</div></td><td>${esc(r.productName)}</td><td style="white-space:nowrap">${dt(r.createdAt, { dateStyle: 'medium' })}</td><td><div class="row-actions"><button class="icon-btn" title="Delete">${I.trash}</button></div></td></tr>`).join('')
      : '<tr><td colspan="5" class="muted" style="text-align:center;padding:30px">No reviews.</td></tr>';
    $$('#rtbody tr[data-id]').forEach((tr) => ($('button', tr).onclick = async () => {
      if (!(await confirmBox('Delete review?', 'The review will be removed from the product page.'))) return;
      await api('/api/admin/reviews/' + tr.dataset.id, { method: 'DELETE' });
      items.splice(items.findIndex((x) => x.id === tr.dataset.id), 1); draw(); toast('Review deleted');
    }));
  };
  $$('[data-r]').forEach((b) => (b.onclick = () => { filter = +b.dataset.r; $$('[data-r]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }));
  draw();
}

/* ---------------- subscribers ---------------- */
async function viewSubscribers(view) {
  document.title = 'Subscribers — LOOM Admin';
  const { items } = await api('/api/admin/subscribers');
  view.innerHTML = `<div class="page-title"><div><div class="eyebrow">Newsletter</div><h1>Subscribers</h1></div>${items.length ? '<button class="btn ghost" id="exportS">Export CSV</button>' : ''}</div>
    <div class="panel"><div class="table-wrap"><table class="t"><thead><tr><th>Email</th><th>Signed up</th></tr></thead><tbody>
    ${items.length ? [...items].reverse().map((s) => `<tr><td>${esc(s.email)}</td><td>${dt(s.createdAt)}</td></tr>`).join('') : '<tr><td colspan="2" class="muted" style="text-align:center;padding:30px">No subscribers yet — the signup form is in the store footer.</td></tr>'}
    </tbody></table></div></div>`;
  const ex = $('#exportS'); if (ex) ex.onclick = () => downloadCSV('loom-subscribers.csv', [['Email', 'Signed up'], ...items.map((s) => [s.email, new Date(s.createdAt).toISOString()])]);
}

/* ---------------- settings ---------------- */
function viewSettings(view) {
  document.title = 'Settings — LOOM Admin';
  view.innerHTML = `<div class="page-title"><div><div class="eyebrow">Account</div><h1>Settings</h1></div></div>
    ${auth.mustChangePassword ? '<div class="warn-banner">You are still using the default password. Choose a new one below.</div>' : ''}
    <div class="dash">
      <form class="panel" id="pwForm" novalidate style="display:grid;gap:12px;max-width:520px"><h3>Change login</h3>
        <label class="field"><span>Username</span><input class="input" name="username" value="${esc(auth.username)}" autocomplete="username"></label>
        <label class="field" data-f="current"><span>Current password</span><input class="input" type="password" name="current" autocomplete="current-password"><small class="err"></small></label>
        <label class="field" data-f="next"><span>New password</span><input class="input" type="password" name="next" autocomplete="new-password" minlength="8"><small class="err"></small></label>
        <div style="height:4px;background:var(--line);border-radius:2px;overflow:hidden"><div id="pwStrength" style="height:100%;width:0;transition:width .3s,background .3s"></div></div>
        <small class="muted" id="pwHint">At least 8 characters. Longer is stronger.</small>
        <label class="field" data-f="confirm"><span>Confirm new password</span><input class="input" type="password" name="confirm" autocomplete="new-password"><small class="err"></small></label>
        <button class="btn accent" style="justify-self:start">Update login</button>
        <small class="muted">Changing your password signs out every other session.</small>
      </form>
      <div class="panel" style="display:grid;gap:12px;align-content:start"><h3>Sessions</h3>
        <p class="muted" style="margin:0;font-size:14px">This session expires ${dt(auth.expiresAt)}.</p>
        <button class="btn danger" id="logoutAll" style="justify-self:start">Sign out everywhere</button>
        <h3 style="margin-top:12px">API</h3>
        <p class="muted" style="margin:0;font-size:13px">Admin endpoints accept <code>Authorization: Bearer &lt;token&gt;</code>. Get a token with <code>POST /api/admin/login</code>. See README.md for curl examples.</p>
      </div>
    </div>`;
  const f = $('#pwForm');
  f.next.oninput = () => {
    const v = f.next.value; let s = 0;
    if (v.length >= 8) s++; if (v.length >= 12) s++; if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++; if (/\d/.test(v)) s++; if (/[^\w]/.test(v)) s++;
    const colors = ['var(--danger)', 'var(--danger)', 'var(--warn)', 'var(--warn)', 'var(--ok)', 'var(--ok)'];
    $('#pwStrength').style.width = (s / 5) * 100 + '%'; $('#pwStrength').style.background = colors[s];
    $('#pwHint').textContent = ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][s];
  };
  f.onsubmit = async (e) => {
    e.preventDefault();
    $$('[data-f]', f).forEach((x) => { x.classList.remove('invalid'); $('.err', x).textContent = ''; });
    const err = (k, m) => { const x = $(`[data-f="${k}"]`, f); x.classList.add('invalid'); $('.err', x).textContent = m; };
    if (f.next.value.length < 8) return err('next', 'At least 8 characters');
    if (f.next.value !== f.confirm.value) return err('confirm', "Passwords don't match");
    try {
      const r = await api('/api/admin/password', { method: 'POST', body: { username: f.username.value, current: f.current.value, next: f.next.value } });
      const remember = !!localStorage.getItem('loom.admin');
      auth = { token: r.token, expiresAt: r.expiresAt, username: r.username, mustChangePassword: false };
      session.set(auth, remember); scheduleExpiry();
      toast('Login updated ✓'); renderShell();
    } catch (ex) { Object.entries(ex.details || {}).forEach(([k, v]) => err(k, v)); toast(ex.message, true); }
  };
  $('#logoutAll').onclick = async () => {
    if (!(await confirmBox('Sign out everywhere?', 'All admin sessions, including this one, will be signed out.', 'Sign out all'))) return;
    await api('/api/admin/logout-all', { method: 'POST' });
    logout('All sessions were signed out.');
  };
}

/* ---------------- boot ---------------- */
(async function boot() {
  if (!auth || auth.expiresAt < Date.now()) { session.clear(); auth = null; return renderLogin(); }
  try {
    const me = await api('/api/admin/me');
    auth.mustChangePassword = me.mustChangePassword;
    scheduleExpiry();
    renderShell();
  } catch { /* api() already showed the login screen on 401 */ }
})();
