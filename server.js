/**
 * LOOM — clothing webshop server
 * Zero dependencies: needs only Node.js 18+.
 *
 *   node server.js            → http://localhost:3000
 *   PORT=8080 node server.js
 *   ADMIN_USER=me ADMIN_PASSWORD=secret node server.js   (only used on first run)
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET_FILE = path.join(DATA_DIR, '.secret');
const MAX_BODY = 25 * 1024 * 1024; // 25 MB (images arrive as base64)
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

const SHIPPING_METHODS = {
  standard: { label: 'Standard (3–5 days)', price: 4.95 },
  express: { label: 'Express (1–2 days)', price: 12.95 },
  pickup: { label: 'Store pickup', price: 0 },
};
const FREE_SHIPPING_OVER = 75;
const TAX_RATE = 0.2; // prices shown include VAT; we report the VAT share
const ORDER_STATUSES = ['pending', 'paid', 'shipped', 'delivered', 'cancelled'];

for (const d of [DATA_DIR, UPLOAD_DIR]) fs.mkdirSync(d, { recursive: true });

/* ------------------------------------------------------------------ */
/* Secret + password hashing                                           */
/* ------------------------------------------------------------------ */
let SECRET;
if (fs.existsSync(SECRET_FILE)) SECRET = fs.readFileSync(SECRET_FILE, 'utf8').trim();
else {
  SECRET = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(SECRET_FILE, SECRET, { mode: 0o600 });
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}
function verifyPassword(password, salt, hash) {
  const test = crypto.scryptSync(password, salt, 64);
  const known = Buffer.from(hash, 'hex');
  return test.length === known.length && crypto.timingSafeEqual(test, known);
}

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }
function signToken(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}
function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig || ''), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.ver !== db.admin.tokenVersion) return null; // invalidated by password change / logout-all
    return payload;
  } catch { return null; }
}

/* ------------------------------------------------------------------ */
/* JSON "database"                                                     */
/* ------------------------------------------------------------------ */
const uid = (p = '') => p + crypto.randomBytes(6).toString('hex');
const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60);

function seedProducts() {
  const now = Date.now();
  const C = {
    black: { name: 'Black', hex: '#1d1d1f' }, white: { name: 'Off-white', hex: '#f1ede4' },
    navy: { name: 'Navy', hex: '#24324a' }, sand: { name: 'Sand', hex: '#d4c3a3' },
    olive: { name: 'Olive', hex: '#6b6b3f' }, rust: { name: 'Rust', hex: '#b3542f' },
    sage: { name: 'Sage', hex: '#9fae8f' }, grey: { name: 'Heather grey', hex: '#a3a3a3' },
    denim: { name: 'Denim', hex: '#4a6587' }, burgundy: { name: 'Burgundy', hex: '#6e2236' },
    camel: { name: 'Camel', hex: '#b88a5a' }, sky: { name: 'Sky', hex: '#a9c4dc' },
    blush: { name: 'Blush', hex: '#e6b9ad' }, forest: { name: 'Forest', hex: '#2f4a3a' },
  };
  const S = ['XS', 'S', 'M', 'L', 'XL'];
  const W = ['28', '30', '32', '34', '36'];
  const stock = (sizes, base = 8) => Object.fromEntries(sizes.map((s, i) => [s, Math.max(0, base + ((i * 7) % 5) - 2)]));
  const list = [
    ['Essential Organic Tee', 'tshirts', 'unisex', 29, null, [C.white, C.black, C.sage, C.rust], S, 'Heavyweight 220 gsm organic cotton tee with a relaxed, boxy fit. Garment-dyed for a soft, lived-in feel from day one.', '100% organic cotton', ['bestseller', 'basics'], true],
    ['Merino Crew Sweater', 'knitwear', 'men', 89, 119, [C.navy, C.camel, C.forest], S, 'Fine-gauge extra-fine merino crewneck. Temperature regulating, naturally odour resistant and soft enough to wear next to skin.', '100% extra-fine merino wool', ['wool', 'sale'], true],
    ['Relaxed Linen Shirt', 'shirts', 'women', 69, null, [C.white, C.sky, C.sand], S, 'Breezy European linen shirt with a dropped shoulder and mother-of-pearl buttons. Gets better with every wash.', '100% European flax linen', ['summer'], false],
    ['Heritage Denim Jacket', 'jackets', 'unisex', 139, null, [C.denim, C.black], S, 'A trucker jacket cut from 13 oz selvedge denim with copper rivets and a corduroy-lined collar.', '100% cotton selvedge denim', ['denim', 'bestseller'], true],
    ['Wide-Leg Trousers', 'pants', 'women', 79, 99, [C.black, C.camel, C.olive], W, 'High-rise wide-leg trousers with a fluid drape, pressed front crease and side-adjusters.', '68% Tencel™ lyocell, 32% linen', ['sale', 'tailoring'], false],
    ['Slim Chino', 'pants', 'men', 65, null, [C.sand, C.navy, C.olive, C.black], W, 'Our everyday chino in a stretch twill with a tapered leg. Smart enough for the office, easy enough for the weekend.', '98% cotton, 2% elastane', ['basics'], false],
    ['Brushed Fleece Hoodie', 'hoodies', 'unisex', 75, null, [C.grey, C.black, C.forest, C.blush], S, 'Loopback-knit hoodie brushed on the inside for warmth. Double-layer hood and ribbed cuffs that keep their shape.', '80% organic cotton, 20% recycled polyester', ['bestseller', 'cosy'], true],
    ['Midi Slip Dress', 'dresses', 'women', 95, null, [C.burgundy, C.black, C.sage], S, 'Bias-cut midi dress with adjustable straps and a cowl neckline. Dress it up with heels or down with a tee underneath.', '100% sand-washed cupro', ['evening'], true],
    ['Wool Overcoat', 'jackets', 'men', 249, 299, [C.camel, C.navy, C.black], S, 'Single-breasted overcoat in a dense Italian wool blend with a half-canvas construction and full lining.', '80% wool, 20% cashmere', ['wool', 'sale', 'outerwear'], true],
    ['Ribbed Tank', 'tshirts', 'women', 22, null, [C.white, C.black, C.blush], S, 'Fitted rib-knit tank with a scoop neck. A layering staple you will reach for all year.', '95% organic cotton, 5% elastane', ['basics'], false],
    ['Oxford Button-Down', 'shirts', 'men', 59, null, [C.sky, C.white], S, 'Classic oxford cloth button-down with a softly rolled collar and box pleat at the back.', '100% cotton oxford', ['basics', 'tailoring'], false],
    ['Pleated Midi Skirt', 'skirts', 'women', 72, 90, [C.sage, C.black, C.camel], S, 'Sunray-pleated midi skirt with an elasticated back waistband that moves beautifully.', '100% recycled polyester', ['sale'], false],
    ['Quilted Puffer Vest', 'jackets', 'unisex', 110, null, [C.black, C.olive, C.rust], S, 'Lightweight vest filled with recycled insulation. Packs into its own pocket for travel.', 'Shell & fill: 100% recycled nylon/polyester', ['outerwear'], false],
    ['Cable Knit Cardigan', 'knitwear', 'women', 99, null, [C.white, C.camel, C.burgundy], S, 'Chunky cable-knit cardigan with horn buttons and patch pockets. Your new favourite cold-morning layer.', '60% lambswool, 40% recycled nylon', ['wool', 'cosy'], true],
    ['Straight Leg Jeans', 'pants', 'unisex', 89, null, [C.denim, C.black], W, 'Mid-rise straight-leg jeans in rigid denim that softens and moulds to you over time.', '100% organic cotton denim', ['denim'], false],
    ['Graphic Sweatshirt', 'hoodies', 'unisex', 58, 70, [C.grey, C.sage, C.navy], S, 'Crewneck sweatshirt with a tonal embroidered logo, raglan sleeves and a slightly cropped body.', '100% organic cotton fleece', ['sale', 'cosy'], false],
  ];
  return list.map(([name, category, gender, price, compareAt, colors, sizes, description, material, tags, featured], i) => {
    const st = stock(sizes, 4 + (i % 6) * 2);
    if (i === 3) st[sizes[0]] = 0; // a sold-out size for realism
    if (i === 8) Object.keys(st).forEach((k, j) => (st[k] = j % 2 ? 1 : 2)); // low stock
    return {
      id: uid('p_'), slug: slugify(name), name, category, gender, price, compareAt, colors, sizes,
      stock: st, description, material, tags, featured, images: [], sold: (i * 13) % 40,
      createdAt: now - i * 86400000 * 3, updatedAt: now - i * 86400000 * 3,
    };
  });
}

function seedReviews(products) {
  const names = ['Maria K.', 'Jonas P.', 'Liis T.', 'Aleksander V.', 'Sofia R.', 'Tom H.', 'Grete M.'];
  const texts = [
    [5, 'Beautiful quality — fits true to size and the fabric feels expensive.'],
    [4, 'Really nice, but I would size down if you are between sizes.'],
    [5, 'Second one I have bought. Washes well and keeps its shape.'],
    [3, 'Lovely colour, slightly shorter than I expected.'],
    [5, 'Fast delivery and gorgeous packaging. Highly recommend.'],
  ];
  const out = [];
  products.forEach((p, i) => {
    const n = (i * 3) % 4;
    for (let j = 0; j < n; j++) {
      const [rating, text] = texts[(i + j) % texts.length];
      out.push({ id: uid('r_'), productId: p.id, name: names[(i + j) % names.length], rating, text, createdAt: Date.now() - (i + j) * 86400000 * 2 });
    }
  });
  return out;
}

function seedOrders(products) {
  // A handful of historic orders so the dashboard has something to show.
  const orders = [];
  const people = [['Kadri Tamm', 'kadri@example.com', 'Tallinn'], ['Mark Lee', 'mark@example.com', 'Tartu'], ['Anna Berg', 'anna@example.com', 'Helsinki'], ['Peeter Saar', 'peeter@example.com', 'Pärnu']];
  for (let i = 0; i < 9; i++) {
    const p = products[(i * 5) % products.length];
    const q = products[(i * 3 + 1) % products.length];
    const items = [
      { productId: p.id, name: p.name, price: p.price, size: p.sizes[1], color: p.colors[0].name, qty: 1 + (i % 2) },
      ...(i % 3 === 0 ? [{ productId: q.id, name: q.name, price: q.price, size: q.sizes[2], color: q.colors[0].name, qty: 1 }] : []),
    ];
    const subtotal = round2(items.reduce((s, it) => s + it.price * it.qty, 0));
    const shipping = subtotal >= FREE_SHIPPING_OVER ? 0 : 4.95;
    const [name, email, city] = people[i % people.length];
    orders.push({
      number: 'LM' + (10231 + i), createdAt: Date.now() - (13 - i) * 86400000 - i * 3600000,
      status: ['delivered', 'delivered', 'shipped', 'delivered', 'paid', 'shipped', 'paid', 'pending', 'paid'][i],
      customer: { name, email, phone: '', address: 'Main street ' + (i + 1), city, zip: '10' + (110 + i), country: 'Estonia' },
      items, subtotal, discount: 0, discountCode: null, shipping, shippingMethod: 'standard', total: round2(subtotal + shipping),
      vat: round2((subtotal + shipping) * TAX_RATE / (1 + TAX_RATE)), payment: { brand: 'visa', last4: '4242' },
      history: [{ status: 'paid', at: Date.now() - (13 - i) * 86400000 }],
    });
  }
  return orders;
}

function round2(n) { return Math.round(n * 100) / 100; }

let db;
function loadDb() {
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    return;
  }
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const products = seedProducts();
  db = {
    admin: { username, ...hashPassword(password), tokenVersion: 1, mustChangePassword: !process.env.ADMIN_PASSWORD },
    products,
    reviews: seedReviews(products),
    orders: seedOrders(products),
    discounts: [
      { code: 'WELCOME10', type: 'percent', value: 10, minSubtotal: 0, expiresAt: null, active: true, uses: 4, createdAt: Date.now() },
      { code: 'FIVEOFF', type: 'fixed', value: 5, minSubtotal: 40, expiresAt: null, active: true, uses: 1, createdAt: Date.now() },
    ],
    subscribers: [],
    nextOrder: 10240,
  };
  saveDb();
  console.log(`\n  First run: created admin user "${username}" with password "${password}"`);
  if (!process.env.ADMIN_PASSWORD) console.log('  ⚠  Change this password in the admin panel → Settings.\n');
}
let saveTimer = null;
function saveDb() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  }, 50);
}
loadDb();

/* ------------------------------------------------------------------ */
/* HTTP helpers                                                        */
/* ------------------------------------------------------------------ */
class HttpError extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }
const bad = (msg, details) => new HttpError(400, msg, details);

function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new HttpError(413, 'Request body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); } catch { reject(bad('Body must be valid JSON')); }
    });
    req.on('error', reject);
  });
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
function serveStatic(req, res, baseDir, relPath) {
  const filePath = path.normalize(path.join(baseDir, relPath));
  if (!filePath.startsWith(baseDir)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size,
      'Cache-Control': baseDir === UPLOAD_DIR ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* Login rate limiting: 5 failed attempts per IP per 15 min */
const loginAttempts = new Map();
function checkRate(ip) {
  const now = Date.now();
  const rec = loginAttempts.get(ip) || { count: 0, first: now };
  if (now - rec.first > 15 * 60 * 1000) { rec.count = 0; rec.first = now; }
  loginAttempts.set(ip, rec);
  if (rec.count >= 5) {
    const wait = Math.ceil((rec.first + 15 * 60 * 1000 - now) / 60000);
    throw new HttpError(429, `Too many login attempts. Try again in ${wait} min.`);
  }
  return rec;
}

function requireAdmin(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const payload = verifyToken(token);
  if (!payload) throw new HttpError(401, 'Authentication required');
  return payload;
}

/* ------------------------------------------------------------------ */
/* Validation helpers                                                  */
/* ------------------------------------------------------------------ */
const str = (v, max = 500) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (v === '' || v === null || v === undefined ? NaN : Number(v));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const HEX_RE = /^#[0-9a-f]{6}$/i;
const CATEGORIES = ['tshirts', 'shirts', 'knitwear', 'hoodies', 'jackets', 'pants', 'dresses', 'skirts', 'accessories'];
const GENDERS = ['women', 'men', 'unisex'];

function saveImage(dataUrl) {
  if (typeof dataUrl !== 'string') throw bad('Image must be a data URL');
  if (dataUrl.startsWith('/uploads/')) {
    // already uploaded image being kept
    if (!/^\/uploads\/[\w.-]+$/.test(dataUrl)) throw bad('Invalid image path');
    return dataUrl;
  }
  const m = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) throw bad('Images must be PNG, JPEG, WEBP or GIF');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > 8 * 1024 * 1024) throw bad('Each image must be under 8 MB');
  // magic-number check so a renamed file can't sneak through
  const sig = buf.subarray(0, 12).toString('hex');
  const ok = (m[2] === 'png' && sig.startsWith('89504e47')) || (m[2] === 'jpeg' && sig.startsWith('ffd8ff')) ||
    (m[2] === 'gif' && sig.startsWith('47494638')) || (m[2] === 'webp' && sig.startsWith('52494646') && buf.subarray(8, 12).toString() === 'WEBP');
  if (!ok) throw bad('File content does not match its image type');
  const name = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${m[2] === 'jpeg' ? 'jpg' : m[2]}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf);
  return `/uploads/${name}`;
}

function validateProduct(body, existing) {
  const errors = {};
  const p = existing ? { ...existing } : { id: uid('p_'), sold: 0, createdAt: Date.now() };
  const has = (k) => !existing || k in body;

  if (has('name')) { p.name = str(body.name, 120); if (!p.name) errors.name = 'Name is required'; }
  if (has('description')) p.description = str(body.description, 4000);
  if (has('material')) p.material = str(body.material, 200);
  if (has('category')) { p.category = str(body.category, 40); if (!CATEGORIES.includes(p.category)) errors.category = 'Unknown category'; }
  if (has('gender')) { p.gender = str(body.gender, 10) || 'unisex'; if (!GENDERS.includes(p.gender)) errors.gender = 'Must be women, men or unisex'; }
  if (has('price')) { p.price = round2(num(body.price)); if (!(p.price > 0) || p.price > 100000) errors.price = 'Price must be a positive number'; }
  if (has('compareAt')) {
    const c = num(body.compareAt);
    p.compareAt = Number.isFinite(c) && c > 0 ? round2(c) : null;
    if (p.compareAt && p.compareAt <= p.price) errors.compareAt = 'Original price must be higher than the sale price';
  }
  if (has('colors')) {
    p.colors = Array.isArray(body.colors) ? body.colors.slice(0, 12).map((c) => ({ name: str(c && c.name, 30), hex: str(c && c.hex, 7) })) : [];
    if (!p.colors.length) errors.colors = 'Add at least one colour';
    else if (p.colors.some((c) => !c.name || !HEX_RE.test(c.hex))) errors.colors = 'Each colour needs a name and a #rrggbb value';
  }
  if (has('sizes') || has('stock')) {
    const sizes = Array.isArray(body.sizes) ? body.sizes.map((s) => str(s, 10)).filter(Boolean).slice(0, 15) : p.sizes || [];
    p.sizes = [...new Set(sizes)];
    if (!p.sizes.length) errors.sizes = 'Add at least one size';
    const stockIn = body.stock && typeof body.stock === 'object' ? body.stock : p.stock || {};
    p.stock = {};
    for (const s of p.sizes) {
      const q = Math.floor(num(stockIn[s] ?? 0));
      if (!(q >= 0) || q > 100000) errors.stock = `Stock for size ${s} must be 0 or more`;
      p.stock[s] = q >= 0 ? q : 0;
    }
  }
  if (has('tags')) {
    const t = Array.isArray(body.tags) ? body.tags : String(body.tags || '').split(',');
    p.tags = [...new Set(t.map((x) => str(String(x), 30).toLowerCase()).filter(Boolean))].slice(0, 15);
  }
  if (has('featured')) p.featured = !!body.featured;
  if ('images' in body) {
    if (!Array.isArray(body.images)) errors.images = 'Images must be a list';
    else if (body.images.length > 8) errors.images = 'Maximum 8 images';
  }
  if (Object.keys(errors).length) throw bad('Please fix the highlighted fields', errors);

  if (Array.isArray(body.images)) p.images = body.images.map(saveImage);
  if (!p.images) p.images = [];
  if (!p.tags) p.tags = [];
  if (p.compareAt === undefined) p.compareAt = null;
  p.slug = slugify(p.name);
  p.updatedAt = Date.now();
  return p;
}

/* ------------------------------------------------------------------ */
/* Product presentation                                                */
/* ------------------------------------------------------------------ */
function ratingOf(productId) {
  const r = db.reviews.filter((x) => x.productId === productId);
  return { avg: r.length ? round2(r.reduce((s, x) => s + x.rating, 0) / r.length) : 0, count: r.length };
}
function publicProduct(p) {
  const totalStock = Object.values(p.stock).reduce((a, b) => a + b, 0);
  return { ...p, totalStock, rating: ratingOf(p.id), onSale: !!(p.compareAt && p.compareAt > p.price) };
}

function listProducts(q) {
  let items = db.products.map(publicProduct);
  const search = (q.get('q') || '').trim().toLowerCase();
  if (search) {
    const words = search.split(/\s+/);
    items = items.filter((p) => {
      const hay = [p.name, p.description, p.category, p.gender, p.material, ...p.tags, ...p.colors.map((c) => c.name)].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }
  const multi = (k) => (q.get(k) || '').split(',').map((s) => s.trim()).filter(Boolean);
  const cats = multi('category'); if (cats.length) items = items.filter((p) => cats.includes(p.category));
  const genders = multi('gender'); if (genders.length) items = items.filter((p) => genders.includes(p.gender) || (p.gender === 'unisex' && genders.length));
  const sizes = multi('size'); if (sizes.length) items = items.filter((p) => sizes.some((s) => (p.stock[s] || 0) > 0));
  const colors = multi('color').map((c) => c.toLowerCase()); if (colors.length) items = items.filter((p) => p.colors.some((c) => colors.includes(c.name.toLowerCase())));
  const min = num(q.get('min')); if (Number.isFinite(min)) items = items.filter((p) => p.price >= min);
  const max = num(q.get('max')); if (Number.isFinite(max)) items = items.filter((p) => p.price <= max);
  if (q.get('sale') === '1') items = items.filter((p) => p.onSale);
  if (q.get('instock') === '1') items = items.filter((p) => p.totalStock > 0);
  if (q.get('featured') === '1') items = items.filter((p) => p.featured);
  const tag = q.get('tag'); if (tag) items = items.filter((p) => p.tags.includes(tag.toLowerCase()));
  const ids = multi('ids'); if (ids.length) items = items.filter((p) => ids.includes(p.id));

  const sorters = {
    newest: (a, b) => b.createdAt - a.createdAt,
    'price-asc': (a, b) => a.price - b.price,
    'price-desc': (a, b) => b.price - a.price,
    popular: (a, b) => b.sold - a.sold,
    rating: (a, b) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count,
    name: (a, b) => a.name.localeCompare(b.name),
    discount: (a, b) => ((b.compareAt || b.price) - b.price) / (b.compareAt || b.price) - ((a.compareAt || a.price) - a.price) / (a.compareAt || a.price),
  };
  items.sort(sorters[q.get('sort')] || ((a, b) => (b.featured - a.featured) || b.sold - a.sold));

  const total = items.length;
  const limit = Math.min(100, Math.max(1, Number(q.get('limit')) || 12));
  const page = Math.max(1, Number(q.get('page')) || 1);
  return { total, page, pages: Math.max(1, Math.ceil(total / limit)), items: items.slice((page - 1) * limit, page * limit) };
}

function findProduct(idOrSlug) {
  return db.products.find((p) => p.id === idOrSlug || p.slug === idOrSlug);
}

/* ------------------------------------------------------------------ */
/* Pricing (always server-side; client totals are never trusted)       */
/* ------------------------------------------------------------------ */
function findDiscount(code, subtotal) {
  if (!code) return null;
  const d = db.discounts.find((x) => x.code.toUpperCase() === String(code).trim().toUpperCase());
  if (!d || !d.active) throw bad('This discount code is not valid');
  if (d.expiresAt && d.expiresAt < Date.now()) throw bad('This discount code has expired');
  if (subtotal < (d.minSubtotal || 0)) throw bad(`This code requires a minimum order of €${d.minSubtotal.toFixed(2)}`);
  return d;
}
function priceCart(items, code, shippingMethod = 'standard') {
  if (!Array.isArray(items) || !items.length) throw bad('Your cart is empty');
  if (items.length > 50) throw bad('Too many items in cart');
  const lines = items.map((it) => {
    const p = findProduct(str(it.productId || it.id, 40));
    if (!p) throw bad('A product in your cart is no longer available');
    const size = str(it.size, 10), color = str(it.color, 30);
    const qty = Math.floor(num(it.qty));
    if (!p.sizes.includes(size)) throw bad(`Size ${size} is not available for ${p.name}`);
    if (!p.colors.some((c) => c.name === color)) throw bad(`Colour ${color} is not available for ${p.name}`);
    if (!(qty >= 1 && qty <= 20)) throw bad('Quantity must be between 1 and 20');
    return { productId: p.id, name: p.name, price: p.price, size, color, qty, image: p.images[0] || null, category: p.category, hex: (p.colors.find((c) => c.name === color) || {}).hex };
  });
  // stock check aggregated per product+size
  const need = {};
  for (const l of lines) need[l.productId + '|' + l.size] = (need[l.productId + '|' + l.size] || 0) + l.qty;
  for (const [k, q] of Object.entries(need)) {
    const [pid, size] = k.split('|');
    const p = findProduct(pid);
    if ((p.stock[size] || 0) < q) throw bad(`Only ${p.stock[size] || 0} left of ${p.name} in size ${size}`);
  }
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.qty, 0));
  const d = findDiscount(code, subtotal);
  let discount = 0;
  if (d) discount = round2(Math.min(subtotal, d.type === 'percent' ? subtotal * d.value / 100 : d.value));
  const method = SHIPPING_METHODS[shippingMethod] ? shippingMethod : 'standard';
  const shipping = method === 'pickup' || subtotal - discount >= FREE_SHIPPING_OVER ? (method === 'express' ? 7.95 : 0) : SHIPPING_METHODS[method].price;
  const total = round2(subtotal - discount + shipping);
  return { lines, subtotal, discount, discountCode: d ? d.code : null, shipping, shippingMethod: method, total, vat: round2(total * TAX_RATE / (1 + TAX_RATE)) };
}

function luhn(num) {
  let sum = 0, alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = +num[i];
    if (alt) { n *= 2; if (n > 9) n -= 9; }
    sum += n; alt = !alt;
  }
  return sum % 10 === 0;
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
const routes = [];
/** route(method, pattern, handler, adminOnly = false, successStatus = 200) */
const route = (method, pattern, handler, admin = false, status = 200) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, handler, admin, status });
};

/* ---- public ---- */
route('GET', '/api/meta', () => {
  const colors = new Map();
  db.products.forEach((p) => p.colors.forEach((c) => colors.set(c.name, c.hex)));
  const sizes = [...new Set(db.products.flatMap((p) => p.sizes))];
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
  sizes.sort((a, b) => (order.indexOf(a) + 1 || 99 + Number(a)) - (order.indexOf(b) + 1 || 99 + Number(b)));
  const prices = db.products.map((p) => p.price);
  const catCounts = {};
  db.products.forEach((p) => (catCounts[p.category] = (catCounts[p.category] || 0) + 1));
  return {
    categories: CATEGORIES.filter((c) => catCounts[c]).map((c) => ({ id: c, count: catCounts[c] })),
    allCategories: CATEGORIES, genders: GENDERS,
    colors: [...colors].map(([name, hex]) => ({ name, hex })), sizes,
    price: { min: Math.floor(Math.min(...prices, 0)), max: Math.ceil(Math.max(...prices, 100)) },
    shipping: SHIPPING_METHODS, freeShippingOver: FREE_SHIPPING_OVER, orderStatuses: ORDER_STATUSES,
  };
});

route('GET', '/api/products', ({ query }) => listProducts(query));

route('GET', '/api/products/:id', ({ params }) => {
  const p = findProduct(params.id);
  if (!p) throw new HttpError(404, 'Product not found');
  const reviews = db.reviews.filter((r) => r.productId === p.id).sort((a, b) => b.createdAt - a.createdAt);
  const related = db.products.filter((x) => x.id !== p.id && (x.category === p.category || x.tags.some((t) => p.tags.includes(t))))
    .sort((a, b) => (b.category === p.category) - (a.category === p.category) || b.sold - a.sold).slice(0, 4).map(publicProduct);
  return { product: publicProduct(p), reviews, related };
});

route('POST', '/api/products/:id/reviews', ({ params, body }) => {
  const p = findProduct(params.id);
  if (!p) throw new HttpError(404, 'Product not found');
  const name = str(body.name, 40), text = str(body.text, 1000), rating = Math.round(num(body.rating));
  const errors = {};
  if (!name) errors.name = 'Please enter your name';
  if (!(rating >= 1 && rating <= 5)) errors.rating = 'Choose a rating from 1 to 5';
  if (text.length < 5) errors.text = 'Please write a few words';
  if (Object.keys(errors).length) throw bad('Please fix the highlighted fields', errors);
  const review = { id: uid('r_'), productId: p.id, name, rating, text, createdAt: Date.now() };
  db.reviews.push(review); saveDb();
  return { review, rating: ratingOf(p.id) };
});

route('POST', '/api/cart/quote', ({ body }) => priceCart(body.items, body.code, body.shippingMethod));

route('POST', '/api/discounts/validate', ({ body }) => {
  const subtotal = num(body.subtotal) || 0;
  const d = findDiscount(body.code, subtotal);
  if (!d) throw bad('Enter a code');
  return { code: d.code, type: d.type, value: d.value, minSubtotal: d.minSubtotal };
});

route('POST', '/api/orders', ({ body }) => {
  const c = body.customer || {};
  const customer = {
    name: str(c.name, 80), email: str(c.email, 120).toLowerCase(), phone: str(c.phone, 30),
    address: str(c.address, 200), city: str(c.city, 80), zip: str(c.zip, 20), country: str(c.country, 60),
  };
  const errors = {};
  if (!customer.name) errors.name = 'Required';
  if (!EMAIL_RE.test(customer.email)) errors.email = 'Enter a valid email';
  const method = SHIPPING_METHODS[body.shippingMethod] ? body.shippingMethod : 'standard';
  if (method !== 'pickup') {
    if (!customer.address) errors.address = 'Required';
    if (!customer.city) errors.city = 'Required';
    if (!customer.zip) errors.zip = 'Required';
    if (!customer.country) errors.country = 'Required';
  }
  const pay = body.payment || {};
  const card = String(pay.number || '').replace(/\D/g, '');
  if (card.length < 13 || card.length > 19 || !luhn(card)) errors.cardNumber = 'Card number is not valid';
  const exp = /^(\d{2})\s*\/\s*(\d{2})$/.exec(String(pay.expiry || ''));
  if (!exp || +exp[1] < 1 || +exp[1] > 12 || new Date(2000 + +exp[2], +exp[1]) < new Date()) errors.cardExpiry = 'Expiry date is not valid';
  if (!/^\d{3,4}$/.test(String(pay.cvc || ''))) errors.cardCvc = 'CVC is not valid';
  if (Object.keys(errors).length) throw bad('Please check your details', errors);

  const quote = priceCart(body.items, body.code, method);
  // commit: decrement stock
  for (const l of quote.lines) {
    const p = findProduct(l.productId);
    p.stock[l.size] -= l.qty;
    p.sold = (p.sold || 0) + l.qty;
  }
  if (quote.discountCode) { const d = db.discounts.find((x) => x.code === quote.discountCode); if (d) d.uses = (d.uses || 0) + 1; }
  const brand = /^4/.test(card) ? 'visa' : /^5[1-5]|^2[2-7]/.test(card) ? 'mastercard' : /^3[47]/.test(card) ? 'amex' : 'card';
  const order = {
    number: 'LM' + db.nextOrder++, createdAt: Date.now(), status: 'paid', customer,
    items: quote.lines.map(({ productId, name, price, size, color, qty }) => ({ productId, name, price, size, color, qty })),
    subtotal: quote.subtotal, discount: quote.discount, discountCode: quote.discountCode, shipping: quote.shipping,
    shippingMethod: quote.shippingMethod, total: quote.total, vat: quote.vat,
    payment: { brand, last4: card.slice(-4) }, note: str(body.note, 500),
    history: [{ status: 'paid', at: Date.now() }],
  };
  db.orders.push(order); saveDb();
  return { order };
});

route('GET', '/api/orders/:number', ({ params, query }) => {
  const o = db.orders.find((x) => x.number.toUpperCase() === params.number.toUpperCase());
  const email = (query.get('email') || '').trim().toLowerCase();
  // both order number AND email must match, so order details can't be enumerated
  if (!o || o.customer.email !== email) throw new HttpError(404, 'No order found with that number and email');
  return { order: o };
});

route('POST', '/api/newsletter', ({ body }) => {
  const email = str(body.email, 120).toLowerCase();
  if (!EMAIL_RE.test(email)) throw bad('Enter a valid email address');
  if (!db.subscribers.some((s) => s.email === email)) { db.subscribers.push({ email, createdAt: Date.now() }); saveDb(); }
  return { ok: true, code: 'WELCOME10' };
});

/* ---- admin auth ---- */
route('POST', '/api/admin/login', ({ body, ip }) => {
  const rec = checkRate(ip);
  const username = str(body.username, 60), password = typeof body.password === 'string' ? body.password : '';
  const userOk = crypto.timingSafeEqual(
    crypto.createHash('sha256').update(username).digest(), crypto.createHash('sha256').update(db.admin.username).digest());
  const passOk = verifyPassword(password, db.admin.salt, db.admin.hash);
  if (!userOk || !passOk) { rec.count++; throw new HttpError(401, 'Wrong username or password'); }
  loginAttempts.delete(ip);
  const exp = Date.now() + TOKEN_TTL_MS;
  return { token: signToken({ sub: db.admin.username, exp, ver: db.admin.tokenVersion }), expiresAt: exp, username: db.admin.username, mustChangePassword: !!db.admin.mustChangePassword };
});

route('GET', '/api/admin/me', ({ admin }) => ({ username: admin.sub, expiresAt: admin.exp, mustChangePassword: !!db.admin.mustChangePassword }), true);

route('POST', '/api/admin/logout-all', () => { db.admin.tokenVersion++; saveDb(); return { ok: true }; }, true);

route('POST', '/api/admin/password', ({ body }) => {
  if (!verifyPassword(String(body.current || ''), db.admin.salt, db.admin.hash)) throw bad('Current password is wrong', { current: 'Wrong password' });
  const next = String(body.next || '');
  if (next.length < 8) throw bad('New password must be at least 8 characters', { next: 'At least 8 characters' });
  const newUser = str(body.username, 60);
  if (newUser) db.admin.username = newUser;
  Object.assign(db.admin, hashPassword(next), { mustChangePassword: false });
  db.admin.tokenVersion++;
  saveDb();
  const exp = Date.now() + TOKEN_TTL_MS;
  return { token: signToken({ sub: db.admin.username, exp, ver: db.admin.tokenVersion }), expiresAt: exp, username: db.admin.username };
}, true);

/* ---- admin: products ---- */
route('GET', '/api/admin/products', () => ({ items: db.products.map(publicProduct).sort((a, b) => b.createdAt - a.createdAt) }), true);

route('POST', '/api/admin/products', ({ body }) => {
  const p = validateProduct(body, null);
  if (db.products.some((x) => x.slug === p.slug)) p.slug += '-' + p.id.slice(-4);
  db.products.push(p); saveDb();
  return { product: publicProduct(p) };
}, true, 201);

route('PUT', '/api/admin/products/:id', ({ params, body }) => {
  const i = db.products.findIndex((x) => x.id === params.id);
  if (i < 0) throw new HttpError(404, 'Product not found');
  const p = validateProduct(body, db.products[i]);
  if (db.products.some((x) => x.slug === p.slug && x.id !== p.id)) p.slug += '-' + p.id.slice(-4);
  db.products[i] = p; saveDb();
  return { product: publicProduct(p) };
}, true);

route('PATCH', '/api/admin/products/:id', ({ params, body }) => {
  const p = db.products.find((x) => x.id === params.id);
  if (!p) throw new HttpError(404, 'Product not found');
  const updated = validateProduct(body, p);
  Object.assign(p, updated); saveDb();
  return { product: publicProduct(p) };
}, true);

route('DELETE', '/api/admin/products/:id', ({ params }) => {
  const i = db.products.findIndex((x) => x.id === params.id);
  if (i < 0) throw new HttpError(404, 'Product not found');
  const [p] = db.products.splice(i, 1);
  db.reviews = db.reviews.filter((r) => r.productId !== p.id);
  saveDb();
  return { ok: true, deleted: p.id };
}, true);

route('POST', '/api/admin/upload', ({ body }) => ({ url: saveImage(body.image) }), true, 201);

/* ---- admin: orders ---- */
route('GET', '/api/admin/orders', ({ query }) => {
  let items = [...db.orders].sort((a, b) => b.createdAt - a.createdAt);
  const status = query.get('status'); if (status) items = items.filter((o) => o.status === status);
  const q = (query.get('q') || '').toLowerCase();
  if (q) items = items.filter((o) => [o.number, o.customer.name, o.customer.email].join(' ').toLowerCase().includes(q));
  return { items };
}, true);

route('PATCH', '/api/admin/orders/:number', ({ params, body }) => {
  const o = db.orders.find((x) => x.number === params.number);
  if (!o) throw new HttpError(404, 'Order not found');
  const status = str(body.status, 20);
  if (!ORDER_STATUSES.includes(status)) throw bad('Unknown status');
  if (status === 'cancelled' && o.status !== 'cancelled') {
    // restock
    for (const it of o.items) { const p = findProduct(it.productId); if (p && it.size in p.stock) { p.stock[it.size] += it.qty; p.sold = Math.max(0, (p.sold || 0) - it.qty); } }
  }
  if (o.status === 'cancelled' && status !== 'cancelled') throw bad('Cancelled orders cannot be reopened');
  o.status = status;
  o.history = o.history || [];
  o.history.push({ status, at: Date.now() });
  if (body.tracking !== undefined) o.tracking = str(body.tracking, 60);
  saveDb();
  return { order: o };
}, true);

/* ---- admin: discounts ---- */
route('GET', '/api/admin/discounts', () => ({ items: db.discounts }), true);
route('POST', '/api/admin/discounts', ({ body }) => {
  const code = str(body.code, 30).toUpperCase().replace(/\s+/g, '');
  const errors = {};
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) errors.code = '3–30 letters, digits, - or _';
  if (db.discounts.some((d) => d.code === code)) errors.code = 'Code already exists';
  const type = body.type === 'fixed' ? 'fixed' : 'percent';
  const value = round2(num(body.value));
  if (!(value > 0) || (type === 'percent' && value > 100)) errors.value = type === 'percent' ? '1–100' : 'Must be positive';
  const minSubtotal = Math.max(0, num(body.minSubtotal) || 0);
  const expiresAt = body.expiresAt ? new Date(body.expiresAt).getTime() : null;
  if (body.expiresAt && !Number.isFinite(expiresAt)) errors.expiresAt = 'Invalid date';
  if (Object.keys(errors).length) throw bad('Please fix the highlighted fields', errors);
  const d = { code, type, value, minSubtotal, expiresAt, active: true, uses: 0, createdAt: Date.now() };
  db.discounts.push(d); saveDb();
  return { discount: d };
}, true, 201);
route('PATCH', '/api/admin/discounts/:code', ({ params, body }) => {
  const d = db.discounts.find((x) => x.code === params.code);
  if (!d) throw new HttpError(404, 'Code not found');
  if ('active' in body) d.active = !!body.active;
  saveDb();
  return { discount: d };
}, true);
route('DELETE', '/api/admin/discounts/:code', ({ params }) => {
  const n = db.discounts.length;
  db.discounts = db.discounts.filter((x) => x.code !== params.code);
  if (n === db.discounts.length) throw new HttpError(404, 'Code not found');
  saveDb(); return { ok: true };
}, true);

/* ---- admin: reviews, subscribers, stats ---- */
route('GET', '/api/admin/reviews', () => ({
  items: [...db.reviews].sort((a, b) => b.createdAt - a.createdAt).map((r) => ({ ...r, productName: (findProduct(r.productId) || {}).name || '(deleted)' })),
}), true);
route('DELETE', '/api/admin/reviews/:id', ({ params }) => {
  const n = db.reviews.length;
  db.reviews = db.reviews.filter((r) => r.id !== params.id);
  if (n === db.reviews.length) throw new HttpError(404, 'Review not found');
  saveDb(); return { ok: true };
}, true);
route('GET', '/api/admin/subscribers', () => ({ items: db.subscribers }), true);

route('GET', '/api/admin/stats', () => {
  const valid = db.orders.filter((o) => o.status !== 'cancelled');
  const revenue = round2(valid.reduce((s, o) => s + o.total, 0));
  const days = [];
  const start = new Date(); start.setHours(0, 0, 0, 0);
  for (let i = 13; i >= 0; i--) {
    const d0 = start.getTime() - i * 86400000, d1 = d0 + 86400000;
    const os = valid.filter((o) => o.createdAt >= d0 && o.createdAt < d1);
    days.push({ date: d0, revenue: round2(os.reduce((s, o) => s + o.total, 0)), orders: os.length });
  }
  const top = {};
  valid.forEach((o) => o.items.forEach((it) => { top[it.productId] = top[it.productId] || { name: it.name, qty: 0, revenue: 0 }; top[it.productId].qty += it.qty; top[it.productId].revenue = round2(top[it.productId].revenue + it.qty * it.price); }));
  const lowStock = [];
  db.products.forEach((p) => p.sizes.forEach((s) => { if (p.stock[s] <= 2) lowStock.push({ id: p.id, name: p.name, size: s, stock: p.stock[s] }); }));
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, db.orders.filter((o) => o.status === s).length]));
  return {
    revenue, orders: valid.length, avgOrder: valid.length ? round2(revenue / valid.length) : 0,
    products: db.products.length, units: db.products.reduce((s, p) => s + Object.values(p.stock).reduce((a, b) => a + b, 0), 0),
    subscribers: db.subscribers.length, reviews: db.reviews.length, days, byStatus,
    top: Object.entries(top).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    lowStock: lowStock.sort((a, b) => a.stock - b.stock).slice(0, 12),
    recentOrders: [...db.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
  };
}, true);

/* ------------------------------------------------------------------ */
/* Server                                                              */
/* ------------------------------------------------------------------ */
const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  const ip = req.socket.remoteAddress || 'unknown';
  const started = Date.now();
  res.on('finish', () => { if (pathname.startsWith('/api/')) console.log(`${req.method} ${pathname} → ${res.statusCode} (${Date.now() - started}ms)`); });

  if (pathname.startsWith('/api/')) {
    try {
      const r = routes.find((x) => x.method === req.method && x.re.test(pathname));
      if (!r) {
        const any = routes.some((x) => x.re.test(pathname));
        throw new HttpError(any ? 405 : 404, any ? 'Method not allowed' : 'Not found');
      }
      const m = r.re.exec(pathname);
      const params = Object.fromEntries(r.keys.map((k, i) => [k, m[i + 1]]));
      const ctx = { params, query: url.searchParams, ip, req };
      // authenticate BEFORE reading the body, so anonymous clients can't push large uploads
      if (r.admin) ctx.admin = requireAdmin(req);
      ctx.body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : {};
      const result = await r.handler(ctx);
      return send(res, r.status || 200, result);
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, details: err.details });
      console.error(err);
      return send(res, 500, { error: 'Something went wrong on our side' });
    }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  if (pathname.startsWith('/uploads/')) return serveStatic(req, res, UPLOAD_DIR, pathname.slice('/uploads/'.length));
  if (pathname === '/admin' || pathname === '/admin/') return serveStatic(req, res, PUBLIC_DIR, 'admin.html');
  if (pathname === '/') return serveStatic(req, res, PUBLIC_DIR, 'index.html');
  return serveStatic(req, res, PUBLIC_DIR, pathname);
});

server.listen(PORT, () => {
  console.log(`\n  LOOM webshop running`);
  console.log(`  Shop:  http://localhost:${PORT}`);
  console.log(`  Admin: http://localhost:${PORT}/admin\n`);
});
