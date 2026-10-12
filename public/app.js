/* =====================================================================
   LOOM storefront — vanilla JS single-page app (hash routing)
   ===================================================================== */
'use strict';

/* ---------------- utilities ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(n || 0);
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = {
  get(k, d) { try { const v = localStorage.getItem('loom.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('loom.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};
const CAT = { tshirts: 'T-shirts & tops', shirts: 'Shirts', knitwear: 'Knitwear', hoodies: 'Hoodies & sweats', jackets: 'Jackets & coats', pants: 'Trousers & jeans', dresses: 'Dresses', skirts: 'Skirts', accessories: 'Accessories' };
const ICON = {
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 20s-7-4.4-9.2-9A5 5 0 0 1 12 6a5 5 0 0 1 9.2 5c-2.2 4.6-9.2 9-9.2 9Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  ret: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 9h12a4 4 0 0 1 0 8H8"/><path d="m8 5-4 4 4 4"/></svg>',
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19 13 11"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8"/><rect x="13" y="3" width="8" height="8"/><rect x="3" y="13" width="8" height="8"/><rect x="13" y="13" width="8" height="8"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="4" width="7" height="7"/><rect x="12" y="5" width="9" height="2"/><rect x="3" y="13" width="7" height="7"/><rect x="12" y="14" width="9" height="2"/></svg>',
  filter: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 6h16M7 12h10M10 18h4"/></svg>',
  left: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 6-6 6 6 6"/></svg>',
  right: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 6 6 6-6 6"/></svg>',
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error || 'Request failed'); e.details = data.details; e.status = res.status; throw e; }
  return data;
}

/* ---------------- state ---------------- */
const state = {
  meta: null,
  cart: store.get('cart', []),
  wish: store.get('wish', []),
  recent: store.get('recent', []),
  code: store.get('code', null),
  view: store.get('view', 'grid'),
  quote: null,
};
const saveCart = () => { store.set('cart', state.cart); updateBadges(); };

/* ---------------- media helpers ---------------- */
function mediaHTML(p, colorIdx = 0, imgIdx = 0, cls = '') {
  const color = p.colors[colorIdx] || p.colors[0] || { hex: '#999', name: '' };
  if (p.images && p.images.length) {
    const src = p.images[Math.min(imgIdx, p.images.length - 1)];
    return `<img class="${cls}" src="${esc(src)}" alt="${esc(p.name)}" loading="lazy">`;
  }
  return garmentSVG(p.category, color.hex, { label: `${p.name} in ${color.name}` }).replace('<svg ', `<svg class="${cls}" `);
}
function lineThumb(l) {
  return l.image ? `<img src="${esc(l.image)}" alt="">` : garmentSVG(l.category, l.hex, { label: l.name });
}
function stars(avg) {
  const full = Math.round(avg);
  return `<span class="stars" aria-label="${avg} out of 5">${'★'.repeat(full)}<span class="off">${'★'.repeat(5 - full)}</span></span>`;
}
function priceHTML(p) {
  return p.onSale ? `<span class="price"><span class="now sale">${money(p.price)}</span><s>${money(p.compareAt)}</s></span>` : `<span class="price"><span class="now">${money(p.price)}</span></span>`;
}

/* ---------------- toast ---------------- */
function toast(msg, opts = {}) {
  const el = document.createElement('div');
  el.className = 'toast' + (opts.error ? ' err' : '');
  el.innerHTML = `${opts.thumb ? `<div class="thumb">${opts.thumb}</div>` : ''}<span>${msg}</span>${opts.action ? `<button>${esc(opts.action)}</button>` : ''}`;
  if (opts.action) el.querySelector('button').onclick = () => { opts.onAction(); dismiss(); };
  $('#toasts').append(el);
  const dismiss = () => { el.classList.add('leaving'); setTimeout(() => el.remove(), 300); };
  setTimeout(dismiss, opts.duration || 3500);
  while ($('#toasts').children.length > 3) $('#toasts').firstChild.remove();
}

/* ---------------- badges ---------------- */
function bump(el, n) {
  el.textContent = n;
  el.classList.toggle('show', n > 0);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
}
function updateBadges() {
  bump($('#cartCount'), state.cart.reduce((s, l) => s + l.qty, 0));
  bump($('#wishCount'), state.wish.length);
}

/* ---------------- cart ---------------- */
function addToCart(p, color, size, qty = 1) {
  const avail = p.stock[size] || 0;
  const line = state.cart.find((l) => l.productId === p.id && l.size === size && l.color === color);
  const current = line ? line.qty : 0;
  if (current + qty > avail) {
    toast(avail ? `Only ${avail} left in size ${size}` : `Size ${size} is sold out`, { error: true });
    return false;
  }
  const hex = (p.colors.find((c) => c.name === color) || p.colors[0]).hex;
  if (line) line.qty += qty;
  else state.cart.push({ productId: p.id, slug: p.slug, name: p.name, price: p.price, size, color, hex, category: p.category, image: p.images[0] || null, qty, max: avail });
  saveCart();
  toast(`Added <b>${esc(p.name)}</b> · ${esc(color)} / ${esc(size)}`, {
    thumb: p.images[0] ? `<img src="${esc(p.images[0])}" alt="">` : garmentSVG(p.category, hex), action: 'View bag', onAction: openCart,
  });
  refreshQuote();
  return true;
}
function toggleWish(id, btn) {
  const i = state.wish.indexOf(id);
  if (i >= 0) state.wish.splice(i, 1); else state.wish.push(id);
  store.set('wish', state.wish);
  updateBadges();
  $$(`[data-wish="${id}"]`).forEach((b) => { b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', i < 0); });
  toast(i < 0 ? 'Saved to wishlist' : 'Removed from wishlist', i < 0 ? { action: 'View', onAction: () => (location.hash = '#/wishlist') } : {});
}

const refreshQuote = debounce(async () => {
  if (!state.cart.length) { state.quote = null; renderCart(); return; }
  try {
    state.quote = await api('/api/cart/quote', { method: 'POST', body: { items: state.cart, code: state.code, shippingMethod: 'standard' } });
    state.quote.error = null;
    // sync prices with the server in case they changed
    state.quote.lines.forEach((l, i) => { if (state.cart[i]) state.cart[i].price = l.price; });
    store.set('cart', state.cart);
  } catch (e) {
    if (state.code && /code|minimum|expired/i.test(e.message)) {
      toast(e.message, { error: true });
      state.code = null; store.set('code', null);
      return refreshQuote();
    }
    state.quote = { error: e.message };
  }
  renderCart();
}, 150);

function openCart() {
  renderCart(); refreshQuote();
  openLayer($('#cartDrawer'));
}
function renderCart() {
  const body = $('#cartBody'), foot = $('#cartFoot');
  if (!state.cart.length) {
    body.innerHTML = `<div class="empty"><h3>Your bag is empty</h3><p class="muted">Pieces you add will appear here.</p><a class="btn" href="#/shop" data-close>Start shopping</a></div>`;
    foot.innerHTML = '';
    return;
  }
  const subtotal = state.cart.reduce((s, l) => s + l.price * l.qty, 0);
  const free = state.meta ? state.meta.freeShippingOver : 75;
  const left = Math.max(0, free - (subtotal - (state.quote?.discount || 0)));
  body.innerHTML = `
    <div class="ship-meter">
      <span>${left > 0 ? `You're <b>${money(left)}</b> away from free shipping` : '🎉 You\'ve unlocked <b>free standard shipping</b>'}</span>
      <div class="bar"><div style="width:${Math.min(100, ((subtotal) / free) * 100)}%"></div></div>
    </div>
    ${state.cart.map((l, i) => `
      <div class="line-item" data-i="${i}">
        <a class="thumb" href="#/product/${esc(l.slug)}" data-close>${lineThumb(l)}</a>
        <div>
          <h4><a href="#/product/${esc(l.slug)}" data-close>${esc(l.name)}</a></h4>
          <div class="opts">${esc(l.color)} · Size ${esc(l.size)}</div>
          <div class="qty sm"><button data-dec aria-label="Decrease">−</button><input value="${l.qty}" inputmode="numeric" aria-label="Quantity"><button data-inc aria-label="Increase">+</button></div>
        </div>
        <div class="right">
          <b class="price">${money(l.price * l.qty)}</b>
          <div style="display:grid;gap:4px;justify-items:end">
            <button class="link-btn" data-save>Save for later</button>
            <button class="link-btn" data-remove>Remove</button>
          </div>
        </div>
      </div>`).join('')}
    ${state.quote?.error ? `<p class="form-msg err" style="padding:12px 0">${esc(state.quote.error)}</p>` : ''}`;

  const q = state.quote && !state.quote.error ? state.quote : null;
  foot.innerHTML = `
    ${state.code && q?.discountCode
      ? `<div class="applied"><span>Code <b>${esc(q.discountCode)}</b> applied</span><button class="link-btn" id="rmCode" style="color:inherit">Remove</button></div>`
      : `<form class="code-form" id="codeForm"><input class="input" name="code" placeholder="Discount code" aria-label="Discount code"><button class="btn ghost sm">Apply</button></form><div class="form-msg" id="codeMsg"></div>`}
    <div class="sum-row"><span>Subtotal</span><span class="price">${money(q ? q.subtotal : subtotal)}</span></div>
    ${q && q.discount ? `<div class="sum-row disc"><span>Discount</span><span class="price">−${money(q.discount)}</span></div>` : ''}
    <div class="sum-row"><span>Shipping</span><span class="muted">${q ? (q.shipping ? money(q.shipping) : 'Free') : '—'}</span></div>
    <div class="sum-row total"><span>Total</span><span class="price">${money(q ? q.total : subtotal)}</span></div>
    <a class="btn accent block" href="#/checkout" data-close ${state.quote?.error ? 'disabled' : ''}>Checkout</a>
    <button class="link-btn" data-close style="justify-self:center">Continue shopping</button>`;

  $$('.line-item', body).forEach((row) => {
    const i = +row.dataset.i, l = state.cart[i];
    const setQty = (n) => {
      n = Math.max(1, Math.min(20, n | 0));
      if (l.max && n > l.max) { toast(`Only ${l.max} available`, { error: true }); n = l.max; }
      l.qty = n; saveCart(); renderCart(); refreshQuote();
    };
    $('[data-dec]', row).onclick = () => (l.qty > 1 ? setQty(l.qty - 1) : remove());
    $('[data-inc]', row).onclick = () => setQty(l.qty + 1);
    $('input', row).onchange = (e) => setQty(+e.target.value);
    const remove = () => {
      row.classList.add('removing');
      setTimeout(() => {
        const [removed] = state.cart.splice(i, 1); saveCart(); renderCart(); refreshQuote();
        toast(`Removed ${esc(removed.name)}`, { action: 'Undo', onAction: () => { state.cart.splice(i, 0, removed); saveCart(); renderCart(); refreshQuote(); } });
      }, 280);
    };
    $('[data-remove]', row).onclick = remove;
    $('[data-save]', row).onclick = () => {
      if (!state.wish.includes(l.productId)) { state.wish.push(l.productId); store.set('wish', state.wish); }
      state.cart.splice(i, 1); saveCart(); renderCart(); refreshQuote();
      toast('Moved to wishlist');
    };
  });
  const cf = $('#codeForm');
  if (cf) cf.onsubmit = async (e) => {
    e.preventDefault();
    const code = cf.code.value.trim();
    if (!code) return;
    try {
      await api('/api/discounts/validate', { method: 'POST', body: { code, subtotal } });
      state.code = code.toUpperCase(); store.set('code', state.code);
      toast('Discount applied ✓');
      refreshQuote();
    } catch (err) { $('#codeMsg').className = 'form-msg err'; $('#codeMsg').textContent = err.message; cf.code.closest('form').classList.add('shake'); setTimeout(() => cf.classList.remove('shake'), 400); }
  };
  const rm = $('#rmCode');
  if (rm) rm.onclick = () => { state.code = null; store.set('code', null); refreshQuote(); };
}

/* ---------------- layers (drawer / modal) ---------------- */
let openEl = null, lastFocus = null;
function openLayer(el) {
  if (openEl && openEl !== el) closeLayer(true);
  lastFocus = document.activeElement;
  openEl = el;
  el.classList.add('open'); el.setAttribute('aria-hidden', 'false');
  $('#overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => { const f = el.querySelector('input, button:not(.close), a[href]'); f && f.focus({ preventScroll: true }); }, 50);
}
function closeLayer(silent) {
  if (!openEl) return;
  openEl.classList.remove('open'); openEl.setAttribute('aria-hidden', 'true');
  openEl = null;
  $('#overlay').classList.remove('open');
  $('#filters')?.classList.remove('open');
  document.body.style.overflow = '';
  if (!silent && lastFocus) lastFocus.focus?.({ preventScroll: true });
}
function openModal(html, width) {
  $('#modalContent').innerHTML = html;
  $('#modal .box').style.setProperty('--w', (width || 720) + 'px');
  openLayer($('#modal'));
  return $('#modalContent');
}
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]') || e.target === $('#overlay') || e.target === $('#modal')) closeLayer();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeLayer(); closeSearch(); $('#mobileNav').classList.remove('open'); }
  if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); openSearch(); }
  if (openEl && e.key === 'Tab') { // simple focus trap
    const f = $$('a[href], button:not([disabled]), input, select, textarea', openEl).filter((x) => x.offsetParent);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  }
});

/* ---------------- product card ---------------- */
function cardHTML(p) {
  const wished = state.wish.includes(p.id);
  const flags = [];
  if (p.totalStock === 0) flags.push('<span class="flag out">Sold out</span>');
  else if (p.onSale) flags.push(`<span class="flag sale">−${Math.round((1 - p.price / p.compareAt) * 100)}%</span>`);
  if (p.totalStock > 0 && p.totalStock <= 6) flags.push('<span class="flag low">Low stock</span>');
  if (Date.now() - p.createdAt < 7 * 86400000) flags.push('<span class="flag">New</span>');
  const alt = p.images.length > 1 ? mediaHTML(p, 0, 1, 'alt') : p.colors.length > 1 && !p.images.length ? mediaHTML(p, 1, 0, 'alt') : '';
  return `
  <article class="card" data-id="${p.id}">
    <div class="mwrap">
    <a class="media" href="#/product/${esc(p.slug)}" aria-label="${esc(p.name)}">
      ${mediaHTML(p, 0)}${alt}
    </a>
    <div class="flags">${flags.join('')}</div>
    <button class="icon-btn wish ${wished ? 'on' : ''}" data-wish="${p.id}" aria-pressed="${wished}" aria-label="Save ${esc(p.name)} to wishlist">${ICON.heart}</button>
    <button class="icon-btn wish" data-qv="${p.id}" style="top:52px" aria-label="Quick view">${ICON.eye}</button>
    ${p.totalStock ? `<div class="quick"><div class="lbl"><span>Quick add · <span data-qcolor>${esc(p.colors[0].name)}</span></span></div><div class="sizes">${p.sizes.map((s) => `<button data-qadd="${esc(s)}" ${p.stock[s] ? '' : 'disabled'}>${esc(s)}</button>`).join('')}</div></div>` : ''}
    </div>
    <div class="body">
      <div class="info">
        <div>
          <h3><a href="#/product/${esc(p.slug)}">${esc(p.name)}</a></h3>
          <div class="sub">${esc(CAT[p.category] || p.category)}${p.rating.count ? ` · ${stars(p.rating.avg)} <span class="muted">(${p.rating.count})</span>` : ''}</div>
        </div>
        ${priceHTML(p)}
      </div>
      <p class="desc">${esc(p.description)}</p>
      <div class="swatches" style="margin-top:8px">${p.colors.map((c, i) => `<button class="swatch ${i ? '' : 'on'}" data-sw="${i}" style="background:${c.hex}" aria-label="${esc(c.name)}" title="${esc(c.name)}"></button>`).join('')}</div>
    </div>
  </article>`;
}
const productCache = new Map();
function bindCards(root, products) {
  products.forEach((p) => productCache.set(p.id, p));
  $$('.card', root).forEach((card) => {
    if (card.dataset.bound) return;
    card.dataset.bound = 1;
    const p = productCache.get(card.dataset.id);
    let colorIdx = 0;
    $$('[data-sw]', card).forEach((b) => {
      const pick = () => {
        colorIdx = +b.dataset.sw;
        $$('[data-sw]', card).forEach((x) => x.classList.toggle('on', x === b));
        if (!p.images.length) {
          const media = $('.media', card);
          media.innerHTML = mediaHTML(p, colorIdx) + (p.colors.length > 1 ? mediaHTML(p, (colorIdx + 1) % p.colors.length, 0, 'alt') : '');
        }
        const qc = $('[data-qcolor]', card); if (qc) qc.textContent = p.colors[colorIdx].name;
      };
      b.onmouseenter = pick; b.onclick = pick;
    });
    $$('[data-qadd]', card).forEach((b) => (b.onclick = () => addToCart(p, p.colors[colorIdx].name, b.dataset.qadd)));
    $('[data-wish]', card).onclick = () => toggleWish(p.id);
    $('[data-qv]', card).onclick = () => quickView(p);
  });
}
function skeletonCards(n) {
  return Array.from({ length: n }, () => `<div class="card"><div class="media skel"></div><div class="skel" style="height:14px;width:70%"></div><div class="skel" style="height:12px;width:40%"></div></div>`).join('');
}

/* ---------------- quick view ---------------- */
function quickView(p) {
  const root = openModal(`<div class="quickview"><div class="media" id="qvMedia">${mediaHTML(p)}</div><div class="buybox" id="qvBox"></div></div>`, 900);
  buybox($('#qvBox', root), p, { compact: true, onColor: (i) => { if (!p.images.length) $('#qvMedia').innerHTML = mediaHTML(p, i); } });
}

/* ---------------- buy box (shared by PDP + quick view) ---------------- */
function buybox(el, p, opts = {}) {
  let colorIdx = opts.colorIdx || 0, size = null, qty = 1;
  const render = () => {
    const avail = size ? p.stock[size] || 0 : p.totalStock;
    el.innerHTML = `
      <div>
        <div class="eyebrow">${esc(CAT[p.category] || p.category)} · ${esc(p.gender)}</div>
        <h1 style="margin-top:8px">${opts.compact ? `<a href="#/product/${esc(p.slug)}" data-close style="text-decoration:none">${esc(p.name)}</a>` : esc(p.name)}</h1>
      </div>
      <div class="meta-row">
        ${priceHTML(p)}
        ${p.rating.count ? `<a href="${opts.compact ? `#/product/${esc(p.slug)}` : '#reviews'}" data-reviews ${opts.compact ? 'data-close' : ''}>${stars(p.rating.avg)} ${p.rating.avg.toFixed(1)} (${p.rating.count})</a>` : '<span class="muted">No reviews yet</span>'}
      </div>
      ${p.onSale ? `<div class="muted" style="font-size:13px;margin-top:-12px">You save ${money(p.compareAt - p.price)}</div>` : ''}
      <div>
        <div class="opt-label"><span>Colour: <b>${esc(p.colors[colorIdx].name)}</b></span></div>
        <div class="color-pick">${p.colors.map((c, i) => `<button class="${i === colorIdx ? 'on' : ''}" data-c="${i}" style="background:${c.hex}" aria-label="${esc(c.name)}" aria-pressed="${i === colorIdx}"></button>`).join('')}</div>
      </div>
      <div>
        <div class="opt-label"><span>Size: <b>${size ? esc(size) : 'Select a size'}</b></span><button data-sizeguide type="button">Size guide</button></div>
        <div class="size-pick" id="sizePick">${p.sizes.map((s) => {
          const n = p.stock[s] || 0;
          return `<button data-s="${esc(s)}" class="${s === size ? 'on' : ''}" ${n ? '' : 'disabled aria-label="' + esc(s) + ' sold out"'}>${esc(s)}${n && n <= 3 ? `<small>${n} left</small>` : ''}</button>`;
        }).join('')}</div>
      </div>
      <div class="stock-note ${avail === 0 ? 'out' : avail <= 3 ? 'low' : ''}">${p.totalStock === 0 ? 'Sold out — check back soon' : size ? (avail <= 3 ? `Hurry, only ${avail} left in ${esc(size)}` : 'In stock, ready to ship') : 'In stock'}</div>
      <div class="buy-row">
        <div class="qty"><button data-q="-1" aria-label="Decrease quantity">−</button><input id="qtyIn" value="${qty}" inputmode="numeric" aria-label="Quantity"><button data-q="1" aria-label="Increase quantity">+</button></div>
        <button class="btn accent" id="addBtn" ${p.totalStock ? '' : 'disabled'}>${p.totalStock ? 'Add to bag · ' + money(p.price * qty) : 'Sold out'}</button>
        <button class="icon-btn wish ${state.wish.includes(p.id) ? 'on' : ''}" data-wish="${p.id}" style="border:1px solid var(--line);width:46px;height:46px;border-radius:var(--radius)" aria-label="Save to wishlist">${ICON.heart}</button>
      </div>
      ${opts.compact ? `<a href="#/product/${esc(p.slug)}" data-close class="link-btn" style="font-size:13px">View full details →</a>` : `
      <div class="perks">
        <div>${ICON.truck}<span>Free standard shipping over ${money(state.meta?.freeShippingOver || 75)}</span></div>
        <div>${ICON.ret}<span>Free 30-day returns & exchanges</span></div>
        <div>${ICON.leaf}<span>${esc(p.material || 'Responsibly sourced materials')}</span></div>
      </div>`}`;
    $$('[data-c]', el).forEach((b) => (b.onclick = () => { colorIdx = +b.dataset.c; render(); opts.onColor && opts.onColor(colorIdx); }));
    $$('[data-s]', el).forEach((b) => (b.onclick = () => { size = b.dataset.s; qty = Math.min(qty, p.stock[size]); render(); }));
    $$('[data-q]', el).forEach((b) => (b.onclick = () => { setQty(qty + +b.dataset.q); }));
    $('#qtyIn', el).onchange = (e) => setQty(+e.target.value);
    $('[data-wish]', el).onclick = () => toggleWish(p.id);
    $('#addBtn', el).onclick = () => {
      if (!size) {
        const sp = $('#sizePick', el); sp.classList.remove('shake'); void sp.offsetWidth; sp.classList.add('shake');
        toast('Please choose a size first', { error: true });
        return;
      }
      if (addToCart(p, p.colors[colorIdx].name, size, qty) && opts.compact) closeLayer();
    };
    const rv = $('[data-reviews]', el);
    if (rv && !opts.compact) rv.onclick = (e) => { e.preventDefault(); opts.showReviews && opts.showReviews(); };
  };
  const setQty = (n) => {
    const max = size ? p.stock[size] : 20;
    qty = Math.max(1, Math.min(max || 1, n | 0 || 1));
    render();
  };
  render();
}

/* ---------------- search ---------------- */
let suggestIdx = -1;
function openSearch() {
  $('#searchPanel').classList.add('open');
  $('#searchInput').focus();
  if (!$('#popular').innerHTML) $('#popular').innerHTML = '<span class="muted" style="font-size:13px;align-self:center">Popular:</span>' + ['linen', 'merino', 'denim', 'hoodie', 'dress', 'coat'].map((t) => `<button class="chip" data-term="${t}">${t}</button>`).join('');
}
function closeSearch() { $('#searchPanel').classList.remove('open'); }
const runSuggest = debounce(async (q) => {
  if (!q.trim()) { $('#suggest').innerHTML = ''; return; }
  const { items, total } = await api(`/api/products?q=${encodeURIComponent(q)}&limit=6`);
  suggestIdx = -1;
  $('#suggest').innerHTML = items.length
    ? items.map((p) => `<a href="#/product/${esc(p.slug)}"><div class="thumb">${mediaHTML(p)}</div><div>${esc(p.name)}<small>${money(p.price)} · ${esc(CAT[p.category])}</small></div></a>`).join('') +
      (total > items.length ? `<a href="#/shop?q=${encodeURIComponent(q)}"><div>See all ${total} results →</div></a>` : '')
    : `<p class="muted">No results for “${esc(q)}”. Try “wool” or “shirt”.</p>`;
}, 180);

/* ---------------- router ---------------- */
const main = $('#main');
function parseHash() {
  const h = location.hash.slice(1) || '/';
  const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), params: new URLSearchParams(qs || '') };
}
async function router() {
  const { parts, params } = parseHash();
  closeSearch(); closeLayer(true); $('#mobileNav').classList.remove('open');
  window.scrollTo({ top: 0 });
  main.classList.remove('page-enter'); void main.offsetWidth; main.classList.add('page-enter');
  $$('#nav a').forEach((a) => a.classList.toggle('active',
    (parts[0] === 'shop') && ((a.dataset.nav === 'sale' && params.get('sale')) || (a.dataset.nav === params.get('gender')) || (a.dataset.nav === 'all' && !params.get('gender') && !params.get('sale')))));
  try {
    const page = parts[0] || 'home';
    if (page === 'home') await renderHome();
    else if (page === 'shop') await renderShop(params);
    else if (page === 'product') await renderProduct(decodeURIComponent(parts[1]));
    else if (page === 'checkout') await renderCheckout();
    else if (page === 'order') renderConfirmation(parts[1]);
    else if (page === 'track') renderTrack(params);
    else if (page === 'wishlist') await renderWishlist();
    else renderNotFound();
  } catch (e) {
    console.error(e);
    if (e.status === 404) renderNotFound(); else main.innerHTML = `<div class="wrap empty"><h3>Something went wrong</h3><p class="muted">${esc(e.message)}</p><a class="btn" href="#/">Back home</a></div>`;
  }
  main.focus({ preventScroll: true });
}
function renderNotFound() {
  document.title = 'Not found — LOOM';
  main.innerHTML = `<div class="wrap empty" style="padding:120px 20px"><div class="eyebrow">404</div><h3 style="font-size:64px">Lost the thread</h3><p class="muted">We couldn't find that page.</p><a class="btn" href="#/shop">Browse the shop</a></div>`;
}

/* ---------------- home ---------------- */
async function renderHome() {
  document.title = 'LOOM — Considered clothing';
  const [feat, best, fresh] = await Promise.all([
    api('/api/products?featured=1&limit=3&sort=popular'),
    api('/api/products?sort=popular&limit=8'),
    api('/api/products?sort=newest&limit=4'),
  ]);
  const tiles = ['knitwear', 'jackets', 'dresses', 'pants'];
  const tileColors = { knitwear: '#b88a5a', jackets: '#4a6587', dresses: '#6e2236', pants: '#d4c3a3' };
  const cats = Object.fromEntries((state.meta?.categories || []).map((c) => [c.id, c.count]));
  main.innerHTML = `
    <section class="hero">
      <div class="copy">
        <div class="eyebrow">Autumn / Winter 2026</div>
        <h1>Made to be <em>worn</em> in.</h1>
        <p>Natural fibres, honest construction and colours borrowed from the landscape. Clothes that get better the longer you keep them.</p>
        <div class="cta"><a class="btn" href="#/shop?sort=newest">Shop new arrivals</a><a class="btn ghost" href="#/shop?sale=1">Explore the sale</a></div>
      </div>
      <div class="visual">${feat.items.map((p) => `<a href="#/product/${esc(p.slug)}">${mediaHTML(p)}<span class="tag">${esc(p.name)} — ${money(p.price)}</span></a>`).join('')}</div>
    </section>
    <div class="marquee" aria-hidden="true"><div class="track">${Array(2).fill(['Organic cotton', 'Free returns', 'Italian wool', 'European linen', 'Repair service', 'Carbon-neutral shipping']).flat().map((t) => `<span>${t}</span>`).join('')}</div></div>
    <section class="section wrap">
      <div class="section-head"><h2>Shop by <em>category</em></h2><a href="#/shop">View all</a></div>
      <div class="cat-tiles">${tiles.map((c) => `<a class="cat-tile" href="#/shop?category=${c}">${garmentSVG(c, tileColors[c])}<span>${CAT[c].split(' ')[0]}</span><small>${cats[c] || 0} styles</small></a>`).join('')}</div>
    </section>
    <section class="section wrap" style="padding-top:0">
      <div class="section-head"><h2>Bestsellers</h2><a href="#/shop?sort=popular">Shop bestsellers</a></div>
      <div class="grid" id="bestGrid">${best.items.map(cardHTML).join('')}</div>
    </section>
    <section class="wrap">
      <div class="promo">
        <div class="txt"><div class="eyebrow" style="color:inherit;opacity:.8">Mid-season edit</div><h2>Up to 25% off<br><em>selected pieces</em></h2><p style="margin:0;opacity:.9">Wool coats, merino and tailoring — while sizes last.</p><a class="btn" href="#/shop?sale=1&sort=discount">Shop the sale</a></div>
        <div class="art">${garmentSVG('jackets', '#b88a5a', { bg: '#e9d8c8' })}${garmentSVG('knitwear', '#24324a', { bg: '#d8d2c6' })}</div>
      </div>
    </section>
    <section class="section wrap">
      <div class="section-head"><h2>Just <em>landed</em></h2><a href="#/shop?sort=newest">See what's new</a></div>
      <div class="grid" id="newGrid">${fresh.items.map(cardHTML).join('')}</div>
    </section>
    <div id="recentSlot"></div>`;
  bindCards(main, [...best.items, ...fresh.items]);
  renderRecent($('#recentSlot'));
}

async function renderRecent(slot, excludeId) {
  const ids = state.recent.filter((id) => id !== excludeId).slice(0, 4);
  if (!ids.length) return;
  const { items } = await api(`/api/products?ids=${ids.join(',')}&limit=4`);
  if (!items.length) return;
  items.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
  slot.innerHTML = `<section class="section wrap" style="padding-top:0"><div class="section-head"><h2>Recently <em>viewed</em></h2><button class="link-btn" id="clearRecent">Clear history</button></div><div class="grid">${items.map(cardHTML).join('')}</div></section>`;
  bindCards(slot, items);
  $('#clearRecent', slot).onclick = () => { state.recent = []; store.set('recent', []); slot.innerHTML = ''; };
}

/* ---------------- shop / listing ---------------- */
let shopState = null;
async function renderShop(params) {
  const meta = state.meta;
  const sel = (k) => (params.get(k) || '').split(',').filter(Boolean);
  shopState = { params, page: 1, items: [], total: 0 };
  const titleBits = [];
  if (params.get('q')) titleBits.push(`“${params.get('q')}”`);
  else if (params.get('sale')) titleBits.push('Sale');
  else if (sel('category').length === 1) titleBits.push(CAT[sel('category')[0]]);
  else if (sel('gender').length === 1) titleBits.push(sel('gender')[0] === 'women' ? 'Women' : sel('gender')[0] === 'men' ? 'Men' : 'Unisex');
  const title = titleBits[0] || 'Shop all';
  document.title = `${title} — LOOM`;
  const pmin = meta.price.min, pmax = meta.price.max;
  main.innerHTML = `
    <div class="wrap shop-head">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span><span>${esc(title)}</span></nav>
      <h1>${esc(title)}</h1>
    </div>
    <div class="wrap shop">
      <aside class="filters" id="filters" aria-label="Filters">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><b style="font-size:13px;letter-spacing:.06em">FILTERS</b><button class="link-btn" id="clearAll">Clear all</button></div>
        <details open><summary>Category</summary><div class="opts">${meta.categories.map((c) => `<label class="check"><input type="checkbox" name="category" value="${c.id}" ${sel('category').includes(c.id) ? 'checked' : ''}>${CAT[c.id]} <span class="muted">(${c.count})</span></label>`).join('')}</div></details>
        <details open><summary>Gender</summary><div class="opts">${meta.genders.map((g) => `<label class="check"><input type="checkbox" name="gender" value="${g}" ${sel('gender').includes(g) ? 'checked' : ''}>${g[0].toUpperCase() + g.slice(1)}</label>`).join('')}</div></details>
        <details open><summary>Size</summary><div class="opts row">${meta.sizes.map((s) => `<button type="button" class="size-opt ${sel('size').includes(s) ? 'on' : ''}" data-size="${esc(s)}" aria-pressed="${sel('size').includes(s)}">${esc(s)}</button>`).join('')}</div></details>
        <details open><summary>Colour</summary><div class="opts">${meta.colors.map((c) => `<button type="button" class="color-opt ${sel('color').map((x) => x.toLowerCase()).includes(c.name.toLowerCase()) ? 'on' : ''}" data-color="${esc(c.name)}"><i style="background:${c.hex}"></i>${esc(c.name)}</button>`).join('')}</div></details>
        <details open><summary>Price</summary>
          <div class="range"><div class="track"></div><div class="fill" id="rangeFill"></div>
            <input type="range" id="pMin" min="${pmin}" max="${pmax}" value="${params.get('min') || pmin}" aria-label="Minimum price">
            <input type="range" id="pMax" min="${pmin}" max="${pmax}" value="${params.get('max') || pmax}" aria-label="Maximum price"></div>
          <div class="price-vals"><span id="pMinV"></span><span id="pMaxV"></span></div>
        </details>
        <details open><summary>Availability</summary><div class="opts">
          <label class="check"><input type="checkbox" name="sale" ${params.get('sale') ? 'checked' : ''}>On sale</label>
          <label class="check"><input type="checkbox" name="instock" ${params.get('instock') ? 'checked' : ''}>In stock only</label></div></details>
        <button class="btn block filter-toggle" data-close style="margin-top:16px">Show results</button>
      </aside>
      <section>
        <div class="toolbar">
          <div class="left">
            <button class="btn ghost sm filter-toggle" id="openFilters">${ICON.filter} Filters</button>
            <span class="muted" id="count" aria-live="polite"></span>
          </div>
          <div class="right">
            <label class="sr-only" for="sort">Sort by</label>
            <select id="sort">
              ${[['', 'Recommended'], ['newest', 'Newest'], ['popular', 'Bestselling'], ['price-asc', 'Price: low to high'], ['price-desc', 'Price: high to low'], ['rating', 'Top rated'], ['discount', 'Biggest discount'], ['name', 'Name A–Z']].map(([v, l]) => `<option value="${v}" ${params.get('sort') === v ? 'selected' : ''}>${l}</option>`).join('')}
            </select>
            <div class="view-toggle" role="group" aria-label="Layout"><button data-view="grid" class="${state.view === 'grid' ? 'on' : ''}" aria-label="Grid view">${ICON.grid}</button><button data-view="list" class="${state.view === 'list' ? 'on' : ''}" aria-label="List view">${ICON.list}</button></div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:18px" id="activeChips"></div>
        <div class="grid ${state.view === 'list' ? 'list' : ''}" id="shopGrid">${skeletonCards(8)}</div>
        <div class="pager" id="pager"></div>
      </section>
    </div>`;

  const f = $('#filters');
  const setParam = (k, v) => { if (v === '' || v == null || (Array.isArray(v) && !v.length)) shopState.params.delete(k); else shopState.params.set(k, Array.isArray(v) ? v.join(',') : v); };
  const apply = () => {
    const p = shopState.params;
    setParam('category', $$('input[name=category]:checked', f).map((x) => x.value));
    setParam('gender', $$('input[name=gender]:checked', f).map((x) => x.value));
    setParam('size', $$('.size-opt.on', f).map((x) => x.dataset.size));
    setParam('color', $$('.color-opt.on', f).map((x) => x.dataset.color));
    setParam('sale', $('input[name=sale]', f).checked ? '1' : '');
    setParam('instock', $('input[name=instock]', f).checked ? '1' : '');
    const mn = +$('#pMin').value, mx = +$('#pMax').value;
    setParam('min', mn > pmin ? mn : ''); setParam('max', mx < pmax ? mx : '');
    setParam('sort', $('#sort').value);
    history.replaceState(null, '', '#/shop' + (p.toString() ? '?' + p.toString() : ''));
    loadResults(true);
  };
  const applyDebounced = debounce(apply, 250);
  $$('input[type=checkbox]', f).forEach((x) => (x.onchange = apply));
  $$('.size-opt', f).forEach((b) => (b.onclick = () => { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); apply(); }));
  $$('.color-opt', f).forEach((b) => (b.onclick = () => { b.classList.toggle('on'); apply(); }));
  const syncRange = () => {
    let a = +$('#pMin').value, b = +$('#pMax').value;
    if (a > b - 5) { if (document.activeElement === $('#pMin')) $('#pMin').value = a = b - 5; else $('#pMax').value = b = a + 5; }
    $('#pMinV').textContent = money(a); $('#pMaxV').textContent = money(b);
    $('#rangeFill').style.left = ((a - pmin) / (pmax - pmin)) * 100 + '%';
    $('#rangeFill').style.right = (100 - ((b - pmin) / (pmax - pmin)) * 100) + '%';
  };
  ['#pMin', '#pMax'].forEach((s) => ($(s).oninput = () => { syncRange(); applyDebounced(); }));
  syncRange();
  $('#sort').onchange = apply;
  $('#clearAll').onclick = () => {
    $$('input[type=checkbox]', f).forEach((x) => (x.checked = false));
    $$('.on', f).forEach((x) => x.classList.remove('on'));
    $('#pMin').value = pmin; $('#pMax').value = pmax; syncRange();
    shopState.params.delete('q'); apply();
  };
  $$('[data-view]').forEach((b) => (b.onclick = () => {
    state.view = b.dataset.view; store.set('view', state.view);
    $$('[data-view]').forEach((x) => x.classList.toggle('on', x === b));
    $('#shopGrid').classList.toggle('list', state.view === 'list');
  }));
  $('#openFilters').onclick = () => { f.classList.add('open'); openEl = f; $('#overlay').classList.add('open'); };
  shopState.apply = apply;
  await loadResults(true);
}

async function loadResults(reset) {
  const s = shopState;
  if (reset) { s.page = 1; s.items = []; $('#shopGrid').innerHTML = skeletonCards(8); }
  const q = new URLSearchParams(s.params); q.set('page', s.page); q.set('limit', 12);
  const token = (s.token = Math.random());
  const data = await api('/api/products?' + q);
  if (token !== s.token) return; // a newer request superseded this one
  s.total = data.total; s.items.push(...data.items);
  const grid = $('#shopGrid');
  if (reset) grid.innerHTML = '';
  if (!s.total) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><h3>Nothing matches — yet</h3><p class="muted">Try removing a filter or searching for something broader.</p><button class="btn ghost" onclick="document.getElementById('clearAll').click()">Clear filters</button></div>`;
  } else grid.insertAdjacentHTML('beforeend', data.items.map(cardHTML).join(''));
  bindCards(grid, data.items);
  $('#count').textContent = `${s.total} ${s.total === 1 ? 'piece' : 'pieces'}`;
  // active filter chips
  const chips = [];
  const label = { category: (v) => CAT[v], gender: (v) => v[0].toUpperCase() + v.slice(1), size: (v) => 'Size ' + v, color: (v) => v };
  for (const k of ['category', 'gender', 'size', 'color']) (s.params.get(k) || '').split(',').filter(Boolean).forEach((v) => chips.push([k, v, label[k](v)]));
  if (s.params.get('q')) chips.push(['q', s.params.get('q'), `“${s.params.get('q')}”`]);
  if (s.params.get('sale')) chips.push(['sale', '1', 'On sale']);
  if (s.params.get('instock')) chips.push(['instock', '1', 'In stock']);
  if (s.params.get('min') || s.params.get('max')) chips.push(['price', '', `${money(+s.params.get('min') || state.meta.price.min)} – ${money(+s.params.get('max') || state.meta.price.max)}`]);
  $('#activeChips').innerHTML = chips.map(([k, v, l]) => `<span class="chip on">${esc(l)}<button data-k="${k}" data-v="${esc(v)}" aria-label="Remove ${esc(l)}">×</button></span>`).join('');
  $$('#activeChips button').forEach((b) => (b.onclick = () => {
    const { k, v } = b.dataset, f = $('#filters');
    if (k === 'q') { s.params.delete('q'); }
    else if (k === 'sale' || k === 'instock') $(`input[name=${k}]`, f).checked = false;
    else if (k === 'price') { $('#pMin').value = state.meta.price.min; $('#pMax').value = state.meta.price.max; $('#pMin').oninput(); }
    else if (k === 'size') $(`.size-opt[data-size="${CSS.escape(v)}"]`, f)?.classList.remove('on');
    else if (k === 'color') $(`.color-opt[data-color="${CSS.escape(v)}"]`, f)?.classList.remove('on');
    else { const cb = $(`input[name=${k}][value="${CSS.escape(v)}"]`, f); if (cb) cb.checked = false; }
    s.apply();
  }));
  // pager
  const shown = s.items.length;
  $('#pager').innerHTML = s.total ? `<span class="muted" style="font-size:13px">Showing ${shown} of ${s.total}</span><div class="progress"><div style="width:${(shown / s.total) * 100}%"></div></div>${shown < s.total ? '<button class="btn ghost" id="more">Load more</button>' : ''}` : '';
  const more = $('#more');
  if (more) {
    more.onclick = () => { s.page++; more.disabled = true; loadResults(false); };
    // infinite scroll once the user has clicked "load more" at least once
    if (s.page > 1) new IntersectionObserver((ents, obs) => { if (ents[0].isIntersecting) { obs.disconnect(); more.click(); } }, { rootMargin: '300px' }).observe(more);
  }
}

/* ---------------- product page ---------------- */
async function renderProduct(slug) {
  main.innerHTML = `<div class="wrap pdp"><div class="skel" style="aspect-ratio:4/5"></div><div style="display:grid;gap:16px;align-content:start"><div class="skel" style="height:60px"></div><div class="skel" style="height:24px;width:40%"></div><div class="skel" style="height:160px"></div></div></div>`;
  const { product: p, reviews, related } = await api('/api/products/' + encodeURIComponent(slug));
  productCache.set(p.id, p);
  document.title = `${p.name} — LOOM`;
  state.recent = [p.id, ...state.recent.filter((x) => x !== p.id)].slice(0, 12);
  store.set('recent', state.recent);

  const slides = p.images.length ? p.images.map((_, i) => () => mediaHTML(p, 0, i)) : p.colors.map((_, i) => () => mediaHTML(p, i));
  let slide = 0;
  main.innerHTML = `
    <div class="wrap" style="padding-top:20px">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="#/">Home</a><span>/</span><a href="#/shop?gender=${p.gender}">${esc(p.gender[0].toUpperCase() + p.gender.slice(1))}</a><span>/</span><a href="#/shop?category=${p.category}">${esc(CAT[p.category])}</a><span>/</span><span>${esc(p.name)}</span></nav>
    </div>
    <div class="wrap pdp">
      <div class="gallery">
        <div class="thumbs" role="tablist" aria-label="Product images">${slides.map((s, i) => `<button role="tab" data-slide="${i}" class="${i ? '' : 'on'}" aria-label="Image ${i + 1}">${s()}</button>`).join('')}</div>
        <div class="main" id="mainImg" title="Click to zoom">${slides[0]()}
          ${slides.length > 1 ? `<div class="nav-arrows"><button class="icon-btn" data-step="-1" aria-label="Previous image">${ICON.left}</button><button class="icon-btn" data-step="1" aria-label="Next image">${ICON.right}</button></div>` : ''}
        </div>
      </div>
      <div>
        <div class="buybox" id="buybox"></div>
        <div style="margin-top:28px">
          <div class="tabs" role="tablist"><button data-tab="details" class="on">Details</button><button data-tab="care">Materials & care</button><button data-tab="reviews" id="reviewsTab">Reviews (${reviews.length})</button><button data-tab="ship">Shipping</button></div>
          <div class="tab-panel" id="tabPanel"></div>
          <button class="btn ghost sm" id="shareBtn">${ICON.share.replace('<svg', '<svg width="14" height="14"')} Share</button>
        </div>
      </div>
    </div>
    ${related.length ? `<section class="section wrap" style="padding-top:24px"><div class="section-head"><h2>You may also <em>like</em></h2></div><div class="grid">${related.map(cardHTML).join('')}</div></section>` : ''}
    <div id="recentSlot"></div>`;

  const mainImg = $('#mainImg');
  const go = (i) => {
    slide = (i + slides.length) % slides.length;
    mainImg.firstElementChild.outerHTML = slides[slide]();
    $$('[data-slide]').forEach((b, j) => b.classList.toggle('on', j === slide));
  };
  $$('[data-slide]').forEach((b) => (b.onclick = () => go(+b.dataset.slide)));
  $$('[data-step]').forEach((b) => (b.onclick = (e) => { e.stopPropagation(); go(slide + +b.dataset.step); }));
  mainImg.onclick = () => mainImg.classList.toggle('zoom');
  mainImg.onmousemove = (e) => { const r = mainImg.getBoundingClientRect(); mainImg.style.setProperty('--zx', ((e.clientX - r.left) / r.width) * 100 + '%'); mainImg.style.setProperty('--zy', ((e.clientY - r.top) / r.height) * 100 + '%'); };
  mainImg.onmouseleave = () => mainImg.classList.remove('zoom');
  let touchX = null;
  mainImg.ontouchstart = (e) => (touchX = e.touches[0].clientX);
  mainImg.ontouchend = (e) => { if (touchX == null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 40) go(slide + (dx < 0 ? 1 : -1)); touchX = null; };
  const onKey = (e) => { if (!document.body.contains(mainImg)) return document.removeEventListener('keydown', onKey); if (openEl || /input|textarea/i.test(document.activeElement.tagName)) return; if (e.key === 'ArrowRight') go(slide + 1); if (e.key === 'ArrowLeft') go(slide - 1); };
  document.addEventListener('keydown', onKey);

  let reviewList = reviews;
  const showTab = (t) => {
    $$('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === t));
    const panel = $('#tabPanel');
    if (t === 'details') panel.innerHTML = `<p>${esc(p.description)}</p>${p.tags.length ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">${p.tags.map((x) => `<a class="chip" href="#/shop?q=${encodeURIComponent(x)}">#${esc(x)}</a>`).join('')}</div>` : ''}`;
    if (t === 'care') panel.innerHTML = `<p><b>Composition:</b> ${esc(p.material || '—')}</p><p>Machine wash cold on a gentle cycle, inside out. Dry flat in the shade. Cool iron if needed. Never tumble dry wool.</p><p>Need a repair? Our free repair service covers seams and buttons for life.</p>`;
    if (t === 'ship') panel.innerHTML = `<p>Standard (3–5 working days): ${money(4.95)}, free over ${money(state.meta.freeShippingOver)}.<br>Express (1–2 working days): ${money(12.95)}.<br>Store pickup: free.</p><p>Free returns within 30 days — just use the prepaid label in your parcel.</p>`;
    if (t === 'reviews') renderReviews(panel);
  };
  const renderReviews = (panel) => {
    const n = reviewList.length, avg = n ? reviewList.reduce((s, r) => s + r.rating, 0) / n : 0;
    const dist = [5, 4, 3, 2, 1].map((k) => [k, reviewList.filter((r) => r.rating === k).length]);
    panel.innerHTML = `
      ${n ? `<div class="rating-summary"><div><div class="big">${avg.toFixed(1)}</div>${stars(avg)}<div class="muted" style="font-size:12px">${n} review${n === 1 ? '' : 's'}</div></div>
        <div class="bars">${dist.map(([k, c]) => `<div><span>${k}★</span><i><b style="width:${n ? (c / n) * 100 : 0}%"></b></i><span class="muted">${c}</span></div>`).join('')}</div></div>` : '<p>No reviews yet — be the first to share your thoughts.</p>'}
      ${reviewList.map((r) => `<div class="review"><header><b>${esc(r.name)}</b><span class="muted">${new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span></header>${stars(r.rating)}<p style="margin:6px 0 0">${esc(r.text)}</p></div>`).join('')}
      <form class="review-form" id="reviewForm" novalidate>
        <b style="color:var(--ink)">Write a review</b>
        <div class="star-input" role="radiogroup" aria-label="Rating">${[5, 4, 3, 2, 1].map((k) => `<input type="radio" name="rating" id="st${k}" value="${k}"><label for="st${k}" title="${k} star${k > 1 ? 's' : ''}">★</label>`).join('')}</div>
        <label class="field"><span>Name</span><input class="input" name="name" maxlength="40"></label>
        <label class="field"><span>Your review</span><textarea class="input" name="text" maxlength="1000" placeholder="How's the fit, the fabric, the colour?"></textarea></label>
        <div class="form-msg" id="revMsg"></div>
        <button class="btn" style="justify-self:start">Submit review</button>
      </form>`;
    $('#reviewForm').onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        const res = await api(`/api/products/${p.id}/reviews`, { method: 'POST', body: { name: fd.get('name'), rating: fd.get('rating'), text: fd.get('text') } });
        reviewList = [res.review, ...reviewList];
        $('#reviewsTab').textContent = `Reviews (${reviewList.length})`;
        renderReviews(panel);
        toast('Thanks for your review!');
      } catch (err) {
        $('#revMsg').className = 'form-msg err';
        $('#revMsg').textContent = err.details ? Object.values(err.details).join(' · ') : err.message;
      }
    };
  };
  $$('[data-tab]').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
  showTab('details');
  buybox($('#buybox'), p, {
    onColor: (i) => { if (!p.images.length) go(i); },
    showReviews: () => { showTab('reviews'); $('#tabPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
  });
  $('#shareBtn').onclick = async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.name, url });
      else { await navigator.clipboard.writeText(url); toast('Link copied to clipboard'); }
    } catch { /* user cancelled */ }
  };
  bindCards(main, related);
  renderRecent($('#recentSlot'), p.id);
}

/* ---------------- wishlist ---------------- */
async function renderWishlist() {
  document.title = 'Wishlist — LOOM';
  let items = [];
  if (state.wish.length) items = (await api(`/api/products?ids=${state.wish.join(',')}&limit=100`)).items;
  // drop ids of products that no longer exist
  if (items.length !== state.wish.length) { state.wish = items.map((p) => p.id); store.set('wish', state.wish); updateBadges(); }
  main.innerHTML = `
    <div class="wrap shop-head"><nav class="crumbs"><a href="#/">Home</a><span>/</span><span>Wishlist</span></nav><h1>Wishlist</h1>
      ${items.length ? `<p class="muted">${items.length} saved piece${items.length === 1 ? '' : 's'}. Hover a card to quick-add your size.</p>` : ''}</div>
    <div class="wrap" style="padding-bottom:80px">${items.length ? `<div class="grid">${items.map(cardHTML).join('')}</div>` : `<div class="empty"><h3>Nothing saved yet</h3><p class="muted">Tap the heart on any piece to keep it here.</p><a class="btn" href="#/shop">Browse the shop</a></div>`}</div>`;
  bindCards(main, items);
  // un-hearting on this page removes the card
  $$('[data-wish]', main).forEach((b) => b.addEventListener('click', () => { const c = b.closest('.card'); c.style.transition = 'opacity .3s'; c.style.opacity = 0; setTimeout(() => { c.remove(); if (!state.wish.length) renderWishlist(); }, 300); }));
}

/* ---------------- checkout ---------------- */
const COUNTRIES = ['Estonia', 'Finland', 'Latvia', 'Lithuania', 'Sweden', 'Germany', 'France', 'Netherlands', 'Denmark', 'Poland', 'Ireland', 'United Kingdom', 'Other'];
async function renderCheckout() {
  document.title = 'Checkout — LOOM';
  if (!state.cart.length) {
    main.innerHTML = `<div class="wrap empty" style="padding:120px 20px"><h3>Your bag is empty</h3><p class="muted">Add something you love, then come back here.</p><a class="btn" href="#/shop">Go shopping</a></div>`;
    return;
  }
  const saved = store.get('customer', {});
  const ck = { step: 1, shippingMethod: 'standard', customer: { country: 'Estonia', ...saved }, remember: !!saved.email, quote: null };
  main.innerHTML = `<div class="wrap checkout"><div id="ckMain"></div><aside class="summary" id="ckSummary"></aside></div>`;

  const summary = async () => {
    try {
      ck.quote = await api('/api/cart/quote', { method: 'POST', body: { items: state.cart, code: state.code, shippingMethod: ck.shippingMethod } });
      ck.error = null;
    } catch (e) { ck.error = e.message; }
    const q = ck.quote;
    $('#ckSummary').innerHTML = `
      <h3>Order summary</h3>
      ${state.cart.map((l) => `<div class="mini"><div class="thumb">${lineThumb(l)}<em>${l.qty}</em></div><div>${esc(l.name)}<div class="muted" style="font-size:12px">${esc(l.color)} · ${esc(l.size)}</div></div><span class="price">${money(l.price * l.qty)}</span></div>`).join('')}
      ${ck.error ? `<p class="form-msg err">${esc(ck.error)} <a href="#" data-opencart>Edit bag</a></p>` : ''}
      <hr style="border:0;border-top:1px solid var(--line);width:100%">
      ${q ? `
      <div class="sum-row"><span>Subtotal</span><span class="price">${money(q.subtotal)}</span></div>
      ${q.discount ? `<div class="sum-row disc"><span>Discount (${esc(q.discountCode)})</span><span class="price">−${money(q.discount)}</span></div>` : ''}
      <div class="sum-row"><span>Shipping · ${esc(state.meta.shipping[q.shippingMethod].label)}</span><span class="price">${q.shipping ? money(q.shipping) : 'Free'}</span></div>
      <div class="sum-row total"><span>Total</span><span class="price">${money(q.total)}</span></div>
      <div class="muted" style="font-size:12px">Includes ${money(q.vat)} VAT</div>` : ''}
      ${!state.code ? `<form class="code-form" id="ckCode"><input class="input" name="code" placeholder="Discount code"><button class="btn ghost sm">Apply</button></form><div class="form-msg err" id="ckCodeMsg"></div>` : ''}`;
    const f = $('#ckCode');
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api('/api/discounts/validate', { method: 'POST', body: { code: f.code.value, subtotal: q?.subtotal } }); state.code = f.code.value.trim().toUpperCase(); store.set('code', state.code); summary(); toast('Discount applied ✓'); }
      catch (err) { $('#ckCodeMsg').textContent = err.message; }
    };
    const oc = $('[data-opencart]'); if (oc) oc.onclick = (e) => { e.preventDefault(); openCart(); };
  };

  const stepsBar = () => `<div class="steps">${['Details', 'Delivery', 'Payment'].map((s, i) => `${i ? '<i></i>' : ''}<span class="${ck.step === i + 1 ? 'on' : ck.step > i + 1 ? 'done' : ''}"><b>${ck.step > i + 1 ? '✓' : i + 1}</b>${s}</span>`).join('')}</div>`;
  const fieldHTML = (name, label, attrs = '', cls = '') => `<label class="field ${cls}" data-f="${name}"><span>${label}</span><input class="input" name="${name}" value="${esc(ck.customer[name] || '')}" ${attrs}><small class="err"></small></label>`;
  const showErrors = (errs) => {
    $$('[data-f]').forEach((f) => { const m = errs[f.dataset.f]; f.classList.toggle('invalid', !!m); $('.err', f).textContent = m || ''; });
    const first = $('.field.invalid input'); if (first) first.focus();
  };
  const collect = () => $$('#ckMain input[name]').forEach((i) => { if (i.type !== 'radio' && i.type !== 'checkbox') ck.customer[i.name] = i.value.trim(); });

  const render = () => {
    const el = $('#ckMain');
    if (ck.step === 1) {
      el.innerHTML = `${stepsBar()}
        <form id="ckForm" novalidate>
          <fieldset class="fieldset"><legend>Contact</legend><div class="form-grid">
            ${fieldHTML('email', 'Email', 'type="email" autocomplete="email" required', 'full')}
            ${fieldHTML('name', 'Full name', 'autocomplete="name" required')}
            ${fieldHTML('phone', 'Phone (optional)', 'type="tel" autocomplete="tel"')}
          </div></fieldset>
          <fieldset class="fieldset"><legend>Shipping address</legend><div class="form-grid">
            ${fieldHTML('address', 'Street address', 'autocomplete="street-address"', 'full')}
            ${fieldHTML('city', 'City', 'autocomplete="address-level2"')}
            ${fieldHTML('zip', 'Postal code', 'autocomplete="postal-code"')}
            <label class="field full" data-f="country"><span>Country</span><select class="input" name="country">${COUNTRIES.map((c) => `<option ${ck.customer.country === c ? 'selected' : ''}>${c}</option>`).join('')}</select><small class="err"></small></label>
          </div></fieldset>
          <label class="check" style="margin-bottom:20px"><input type="checkbox" id="remember" ${ck.remember ? 'checked' : ''}>Save my details on this device for next time</label>
          <div style="display:flex;gap:10px;justify-content:space-between;flex-wrap:wrap"><a class="btn ghost" href="#/shop">← Continue shopping</a><button class="btn">Continue to delivery</button></div>
        </form>`;
      $('#ckForm').onsubmit = (e) => {
        e.preventDefault(); collect(); ck.customer.country = $('select[name=country]').value; ck.remember = $('#remember').checked;
        const c = ck.customer, errs = {};
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email || '')) errs.email = 'Enter a valid email address';
        if (!c.name) errs.name = 'Please enter your name';
        if (!c.address) errs.address = 'Required for delivery';
        if (!c.city) errs.city = 'Required';
        if (!c.zip) errs.zip = 'Required';
        if (Object.keys(errs).length) return showErrors(errs);
        if (ck.remember) store.set('customer', { email: c.email, name: c.name, phone: c.phone, address: c.address, city: c.city, zip: c.zip, country: c.country });
        else store.set('customer', {});
        ck.step = 2; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
      };
    } else if (ck.step === 2) {
      el.innerHTML = `${stepsBar()}
        <div class="order-box" style="width:100%;margin-bottom:24px;font-size:14px"><div class="sum-row"><span class="muted">Contact</span><span>${esc(ck.customer.email)}</span></div><div class="sum-row"><span class="muted">Ship to</span><span style="text-align:right">${esc(ck.customer.address)}, ${esc(ck.customer.zip)} ${esc(ck.customer.city)}, ${esc(ck.customer.country)}</span></div><button class="link-btn" data-back style="justify-self:start">Change</button></div>
        <fieldset class="fieldset"><legend>Delivery method</legend>
          ${Object.entries(state.meta.shipping).map(([k, m]) => `<label class="radio-card"><input type="radio" name="ship" value="${k}" ${ck.shippingMethod === k ? 'checked' : ''}><div class="grow">${esc(m.label)}<small>${k === 'pickup' ? 'LOOM Store, Telliskivi 60a, Tallinn' : k === 'express' ? 'Order before 14:00 for next-day dispatch' : `Free over ${money(state.meta.freeShippingOver)}`}</small></div><b data-shipprice="${k}"></b></label>`).join('')}
        </fieldset>
        <label class="field" style="margin-bottom:24px"><span>Order note (optional)</span><textarea class="input" id="note" maxlength="500" placeholder="Gift message, delivery instructions…">${esc(ck.note || '')}</textarea></label>
        <div style="display:flex;gap:10px;justify-content:space-between"><button class="btn ghost" data-back>← Back</button><button class="btn" id="toPay">Continue to payment</button></div>`;
      const priceShip = () => $$('[data-shipprice]').forEach(async (b) => {
        const q = await api('/api/cart/quote', { method: 'POST', body: { items: state.cart, code: state.code, shippingMethod: b.dataset.shipprice } }).catch(() => null);
        b.textContent = q ? (q.shipping ? money(q.shipping) : 'Free') : '';
      });
      priceShip();
      $$('input[name=ship]').forEach((r) => (r.onchange = () => { ck.shippingMethod = r.value; summary(); }));
      $$('[data-back]').forEach((b) => (b.onclick = () => { ck.step = 1; render(); }));
      $('#toPay').onclick = () => { ck.note = $('#note').value; ck.step = 3; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
    } else {
      el.innerHTML = `${stepsBar()}
        <form id="payForm" novalidate>
          <fieldset class="fieldset"><legend>Payment</legend>
            <p class="demo-note">Demo store — no real charge is made. Use test card <b>4242 4242 4242 4242</b>, any future expiry and any CVC.</p>
            <div class="form-grid" style="margin-top:16px">
              <label class="field full" data-f="cardNumber"><span>Card number</span><div class="card-input"><input class="input" name="cardNumber" inputmode="numeric" autocomplete="cc-number" placeholder="1234 5678 9012 3456" maxlength="23"><span class="brand" id="brand"></span></div><small class="err"></small></label>
              <label class="field" data-f="cardExpiry"><span>Expiry (MM/YY)</span><input class="input" name="cardExpiry" inputmode="numeric" autocomplete="cc-exp" placeholder="MM/YY" maxlength="5"><small class="err"></small></label>
              <label class="field" data-f="cardCvc"><span>CVC</span><input class="input" name="cardCvc" inputmode="numeric" autocomplete="cc-csc" placeholder="123" maxlength="4"><small class="err"></small></label>
              <label class="field full" data-f="cardName"><span>Name on card</span><input class="input" name="cardName" autocomplete="cc-name" value="${esc(ck.customer.name)}"><small class="err"></small></label>
            </div>
          </fieldset>
          <label class="check" style="margin-bottom:20px"><input type="checkbox" id="terms">I agree to the terms of sale and returns policy</label>
          <div class="form-msg err" id="payMsg" style="margin-bottom:12px"></div>
          <div style="display:flex;gap:10px;justify-content:space-between"><button type="button" class="btn ghost" data-back>← Back</button><button class="btn accent" id="placeBtn">Pay ${ck.quote ? money(ck.quote.total) : ''}</button></div>
        </form>`;
      const num = $('input[name=cardNumber]'), exp = $('input[name=cardExpiry]');
      num.oninput = () => {
        const d = num.value.replace(/\D/g, '').slice(0, 19);
        num.value = d.replace(/(.{4})/g, '$1 ').trim();
        $('#brand').textContent = /^4/.test(d) ? 'Visa' : /^5[1-5]|^2[2-7]/.test(d) ? 'Mastercard' : /^3[47]/.test(d) ? 'Amex' : '';
      };
      exp.oninput = (e) => {
        let d = exp.value.replace(/\D/g, '').slice(0, 4);
        if (d.length === 1 && +d > 1) d = '0' + d;
        exp.value = d.length > 2 || (d.length === 2 && e.inputType !== 'deleteContentBackward') ? d.slice(0, 2) + '/' + d.slice(2) : d;
      };
      $('[data-back]').onclick = () => { ck.step = 2; render(); };
      $('#payForm').onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target, errs = {};
        const card = f.cardNumber.value.replace(/\D/g, '');
        if (card.length < 13) errs.cardNumber = 'Enter your full card number';
        if (!/^\d{2}\/\d{2}$/.test(f.cardExpiry.value)) errs.cardExpiry = 'Use MM/YY';
        if (!/^\d{3,4}$/.test(f.cardCvc.value)) errs.cardCvc = '3 or 4 digits';
        if (!f.cardName.value.trim()) errs.cardName = 'Required';
        if (Object.keys(errs).length) return showErrors(errs);
        if (!$('#terms').checked) { $('#payMsg').textContent = 'Please accept the terms to continue.'; return; }
        showErrors({});
        const btn = $('#placeBtn'); btn.disabled = true; btn.textContent = 'Processing…';
        try {
          const { order } = await api('/api/orders', { method: 'POST', body: {
            customer: ck.customer, items: state.cart, code: state.code, shippingMethod: ck.shippingMethod, note: ck.note,
            payment: { number: card, expiry: f.cardExpiry.value, cvc: f.cardCvc.value },
          } });
          state.cart = []; state.code = null; store.set('code', null); saveCart();
          try { sessionStorage.setItem('loom.lastOrder', JSON.stringify(order)); } catch { /* ignore */ }
          location.hash = '#/order/' + order.number;
        } catch (err) {
          btn.disabled = false; btn.textContent = 'Pay ' + (ck.quote ? money(ck.quote.total) : '');
          if (err.details) showErrors(err.details);
          $('#payMsg').textContent = err.message + (err.details && (err.details.email || err.details.address) ? ' (check your details in step 1)' : '');
        }
      };
    }
  };
  render();
  summary();
}

/* ---------------- confirmation & tracking ---------------- */
function orderDetailHTML(o) {
  const flow = ['paid', 'shipped', 'delivered'];
  const idx = o.status === 'cancelled' ? -1 : Math.max(0, flow.indexOf(o.status));
  return `
    <div class="order-box">
      <div class="sum-row"><span class="muted">Order</span><b>${esc(o.number)}</b></div>
      <div class="sum-row"><span class="muted">Placed</span><span>${new Date(o.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
      ${o.status === 'cancelled' ? '<div class="applied" style="background:var(--danger-soft);color:var(--danger)">This order was cancelled and refunded.</div>' : `
      <div class="timeline"><div class="fill" style="width:calc(${(idx / (flow.length - 1)) * 100}% - 20px)"></div>${['Confirmed', 'Shipped', 'Delivered'].map((s, i) => `<div class="${i <= idx ? 'done' : ''}"><i></i>${s}</div>`).join('')}</div>`}
      ${o.tracking ? `<div class="sum-row"><span class="muted">Tracking no.</span><b>${esc(o.tracking)}</b></div>` : ''}
      <hr style="border:0;border-top:1px solid var(--line);width:100%">
      ${o.items.map((it) => `<div class="sum-row"><span>${it.qty} × ${esc(it.name)} <span class="muted">(${esc(it.color)}, ${esc(it.size)})</span></span><span class="price">${money(it.price * it.qty)}</span></div>`).join('')}
      <hr style="border:0;border-top:1px solid var(--line);width:100%">
      ${o.discount ? `<div class="sum-row disc"><span>Discount ${o.discountCode ? '(' + esc(o.discountCode) + ')' : ''}</span><span>−${money(o.discount)}</span></div>` : ''}
      <div class="sum-row"><span>Shipping</span><span>${o.shipping ? money(o.shipping) : 'Free'}</span></div>
      <div class="sum-row total"><span>Total paid</span><span class="price">${money(o.total)}</span></div>
      <div class="muted" style="font-size:12px">Paid with ${esc(o.payment.brand)} ending ${esc(o.payment.last4)}</div>
    </div>`;
}
function renderConfirmation(num) {
  let o = null;
  try { o = JSON.parse(sessionStorage.getItem('loom.lastOrder')); } catch { /* ignore */ }
  if (!o || o.number !== num) { location.hash = '#/track?order=' + encodeURIComponent(num); return; }
  document.title = 'Thank you — LOOM';
  main.innerHTML = `<div class="wrap confirm">
    <svg class="check-anim" viewBox="0 0 80 80" fill="none" stroke="var(--ok)" stroke-width="3"><circle cx="40" cy="40" r="37"/><path d="M24 41l11 11 22-24" stroke-linecap="round" stroke-linejoin="round"/></svg>
    <div class="eyebrow">Order confirmed</div>
    <h1>Thank you, ${esc(o.customer.name.split(' ')[0])}.</h1>
    <p class="muted" style="max-width:46ch">We've received your order and sent a confirmation to <b>${esc(o.customer.email)}</b>. Keep your order number to track it anytime.</p>
    ${orderDetailHTML(o)}
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center"><a class="btn" href="#/shop">Keep shopping</a><a class="btn ghost" href="#/track?order=${esc(o.number)}&email=${encodeURIComponent(o.customer.email)}">Track this order</a><button class="btn ghost" onclick="window.print()">Print receipt</button></div>
  </div>`;
  confetti();
}
function renderTrack(params) {
  document.title = 'Track your order — LOOM';
  main.innerHTML = `<div class="wrap" style="padding:48px 0 96px;display:grid;gap:28px;justify-items:center">
    <div style="text-align:center"><div class="eyebrow">Order status</div><h1 style="font-size:clamp(44px,6vw,80px);margin-top:8px">Track your order</h1></div>
    <form id="trackForm" class="order-box" novalidate>
      <label class="field"><span>Order number</span><input class="input" name="order" placeholder="LM10240" value="${esc(params.get('order') || '')}" required></label>
      <label class="field"><span>Email used at checkout</span><input class="input" type="email" name="email" value="${esc(params.get('email') || '')}" required></label>
      <div class="form-msg err" id="trackMsg"></div>
      <button class="btn">Find order</button>
    </form>
    <div id="trackResult" style="width:min(560px,100%)"></div>
  </div>`;
  const f = $('#trackForm');
  f.onsubmit = async (e) => {
    e.preventDefault();
    $('#trackMsg').textContent = '';
    try {
      const { order } = await api(`/api/orders/${encodeURIComponent(f.order.value.trim())}?email=${encodeURIComponent(f.email.value.trim())}`);
      $('#trackResult').innerHTML = `<div style="display:grid;gap:12px;justify-items:center"><span class="chip on" style="text-transform:capitalize">Status: ${esc(order.status)}</span>${orderDetailHTML(order)}</div>`;
    } catch (err) { $('#trackMsg').textContent = err.message; $('#trackResult').innerHTML = ''; }
  };
  if (params.get('order') && params.get('email')) f.requestSubmit();
}

function confetti() {
  const colors = ['#b4532a', '#1a1815', '#d4c3a3', '#9fae8f', '#24324a'];
  const c = document.createElement('canvas');
  Object.assign(c.style, { position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 200 });
  c.width = innerWidth; c.height = innerHeight; document.body.append(c);
  const ctx = c.getContext('2d');
  const ps = Array.from({ length: 120 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: (Math.random() - .5) * 14, vy: Math.random() * -12 - 4, r: Math.random() * 6 + 3, c: colors[(Math.random() * colors.length) | 0], a: Math.random() * 6 }));
  let t = 0;
  (function tick() {
    ctx.clearRect(0, 0, c.width, c.height);
    ps.forEach((p) => { p.x += p.vx; p.y += p.vy; p.vy += .35; p.vx *= .99; p.a += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.fillStyle = p.c; ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); ctx.restore(); });
    if (++t < 160) requestAnimationFrame(tick); else c.remove();
  })();
}

/* ---------------- info modals ---------------- */
function sizeGuide() {
  openModal(`<div class="inner"><div class="eyebrow">Fit help</div><h2 style="font-size:44px;margin:6px 0 4px">Size guide</h2><p class="muted">Body measurements in centimetres. Between sizes? Our cuts are relaxed — size down for a closer fit.</p>
    <table class="sizes"><thead><tr><th>Size</th><th>Chest</th><th>Waist</th><th>Hip</th><th>EU</th></tr></thead><tbody>
    ${[['XS', '82–86', '66–70', '88–92', '34'], ['S', '87–92', '71–76', '93–97', '36'], ['M', '93–99', '77–83', '98–103', '38–40'], ['L', '100–106', '84–90', '104–109', '42'], ['XL', '107–114', '91–98', '110–116', '44']].map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<td><b>${c}</b></td>`)).join('')}</tr>`).join('')}
    </tbody></table><h3 style="font-size:28px;margin:24px 0 4px">Trousers (waist)</h3>
    <table class="sizes"><thead><tr><th>Size</th><th>Waist cm</th><th>Inseam cm</th></tr></thead><tbody>${[28, 30, 32, 34, 36].map((s) => `<tr><td><b>${s}</b></td><td>${Math.round(s * 2.54)}</td><td>81</td></tr>`).join('')}</tbody></table></div>`, 640);
}
const INFO = {
  shipping: ['Shipping & returns', `<p>Standard delivery takes 3–5 working days and costs €4.95 — free on orders over €75. Express delivery (1–2 days) is €12.95. Store pickup is always free.</p><p>Changed your mind? Return anything unworn within 30 days for a full refund. Exchanges are free.</p>`],
  care: ['Garment care', `<p>Wash less, air more. Most knitwear only needs a wash every few wears — hang it outside overnight instead.</p><p>Wash cold, inside out, and dry flat. Use a wool-specific detergent for merino and lambswool, and store knits folded, never hung.</p>`],
  about: ['Our story', `<p>LOOM started in a small Tallinn workshop with a simple belief: fewer, better clothes. We work with family-run mills in Portugal, Italy and the Baltics, choose natural and recycled fibres, and design pieces to be repaired rather than replaced.</p><p>Every garment comes with free lifetime repairs on seams and buttons.</p>`],
};

/* ---------------- global wiring ---------------- */
function initChrome() {
  $('#year').textContent = new Date().getFullYear();
  // rotating announcement bar
  const msgs = [`Free shipping on orders over ${money(state.meta.freeShippingOver)}`, 'Free 30-day returns & exchanges', 'Sign up for 10% off your first order', 'Lifetime repairs on every piece'];
  let mi = 0;
  const ann = $('#announce');
  ann.innerHTML = `<div>${msgs[0]}</div>`;
  setInterval(() => {
    const cur = ann.firstElementChild; mi = (mi + 1) % msgs.length;
    const next = document.createElement('div'); next.className = 'in'; next.textContent = msgs[mi]; ann.append(next);
    requestAnimationFrame(() => { cur.classList.add('out'); next.classList.remove('in'); });
    setTimeout(() => cur.remove(), 700);
  }, 4500);

  $('#cartBtn').onclick = openCart;
  $('#searchBtn').onclick = () => ($('#searchPanel').classList.contains('open') ? closeSearch() : openSearch());
  $('#searchClose').onclick = closeSearch;
  $('#searchInput').oninput = (e) => runSuggest(e.target.value);
  $('#searchInput').onkeydown = (e) => {
    const links = $$('#suggest a');
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      suggestIdx = Math.max(-1, Math.min(links.length - 1, suggestIdx + (e.key === 'ArrowDown' ? 1 : -1)));
      links.forEach((l, i) => l.classList.toggle('hl', i === suggestIdx));
    }
  };
  $('#searchForm').onsubmit = (e) => {
    e.preventDefault();
    const links = $$('#suggest a');
    if (suggestIdx >= 0 && links[suggestIdx]) { location.hash = links[suggestIdx].getAttribute('href'); return; }
    const q = $('#searchInput').value.trim();
    if (q) location.hash = '#/shop?q=' + encodeURIComponent(q);
  };
  $('#popular').onclick = (e) => { const t = e.target.closest('[data-term]'); if (t) { $('#searchInput').value = t.dataset.term; runSuggest(t.dataset.term); $('#searchInput').focus(); } };
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.header') && $('#searchPanel').classList.contains('open')) closeSearch();
    const sg = e.target.closest('[data-sizeguide]'); if (sg) { e.preventDefault(); sizeGuide(); }
    const inf = e.target.closest('[data-info]'); if (inf) { e.preventDefault(); const [t, b] = INFO[inf.dataset.info]; openModal(`<div class="inner"><h2 style="font-size:44px;margin-bottom:12px">${t}</h2><div class="tab-panel" style="font-size:15px">${b}</div></div>`, 600); }
  });

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('loom.theme', next); } catch { /* ignore */ }
  };
  $('#themeBtn').onclick = toggleTheme;
  $('#themeBtn2').onclick = toggleTheme;
  $('#menuBtn').onclick = () => $('#mobileNav').classList.add('open');
  $$('[data-close-mobile]').forEach((b) => (b.onclick = () => $('#mobileNav').classList.remove('open')));
  $$('#mobileNav a').forEach((a) => a.addEventListener('click', () => $('#mobileNav').classList.remove('open')));

  addEventListener('scroll', () => {
    $('#header').classList.toggle('scrolled', scrollY > 10);
    $('#backTop').classList.toggle('show', scrollY > 800);
  }, { passive: true });
  $('#backTop').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });

  $('#newsForm').onsubmit = async (e) => {
    e.preventDefault();
    const msg = $('#newsMsg');
    try {
      const r = await api('/api/newsletter', { method: 'POST', body: { email: e.target.email.value } });
      msg.className = 'form-msg ok'; msg.innerHTML = `You're on the list! Use code <b>${esc(r.code)}</b> for 10% off.`;
      e.target.reset();
    } catch (err) { msg.className = 'form-msg err'; msg.textContent = err.message; }
  };

  // keep cart in sync across tabs
  addEventListener('storage', (e) => {
    if (e.key === 'loom.cart') { state.cart = store.get('cart', []); updateBadges(); renderCart(); }
    if (e.key === 'loom.wish') { state.wish = store.get('wish', []); updateBadges(); }
  });
}

(async function init() {
  try { state.meta = await api('/api/meta'); }
  catch { main.innerHTML = '<div class="wrap empty"><h3>Store is offline</h3><p class="muted">Could not reach the server. Is <code>node server.js</code> running?</p></div>'; return; }
  initChrome();
  updateBadges();
  addEventListener('hashchange', router);
  router();
  if (state.cart.length) refreshQuote();
})();
