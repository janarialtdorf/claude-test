# LOOM — clothing webshop

A complete clothing store with a customer-facing shop and a password-protected admin panel.
It has **no dependencies**: all you need is [Node.js 18 or newer](https://nodejs.org).

## Run it

```bash
cd shop
npm start            # or: node server.js
```

Then open:

- Shop: http://localhost:3000
- Admin: http://localhost:3000/admin

**Default admin login:** `admin` / `admin123`. The admin panel will ask you to change it
(Settings → Change login). To pick your own credentials on first start:

```bash
# macOS / Linux
ADMIN_USER=janari ADMIN_PASSWORD=a-strong-password npm start
# Windows PowerShell
$env:ADMIN_USER="janari"; $env:ADMIN_PASSWORD="a-strong-password"; npm start
```

(These only apply the first time, when `data/db.json` is created.) Use `PORT=8080` to change the port.
`npm run reset` wipes all data and uploaded images so the store re-seeds with demo products.

## What's in it

**Storefront**
- Home page with hero, category tiles, bestsellers, sale promo, new arrivals, recently viewed
- Catalogue with filters (category, department, size in stock, colour, dual price slider, on sale, in stock),
  8 sort orders, grid/list view, removable filter chips, load-more + infinite scroll, filters kept in the URL
- Live search with suggestions and keyboard navigation (press `/` anywhere)
- Product page: gallery with thumbnails, hover zoom, swipe & arrow-key navigation; colour switching;
  per-size stock (sold-out and "2 left" states); quantity; size guide; tabs for details, care, reviews, shipping;
  star-rating review form with rating breakdown; share link; related products
- Quick view and quick-add-size straight from product cards; colour swatches preview on hover
- Bag drawer: quantity steppers, remove with undo, save for later, free-shipping progress bar,
  discount codes (try `WELCOME10` or `FIVEOFF`); totals are always computed by the server
- 3-step checkout with validation, card formatting/brand detection, delivery method choice, order notes,
  "remember my details"; confirmation page with confetti and printable receipt
- Order tracking by order number + email, with status timeline
- Wishlist, newsletter signup (returns a welcome code), dark mode, rotating announcement bar,
  cart sync across tabs, mobile menu, back-to-top, accessible focus handling and reduced-motion support

**Admin panel** (`/admin`)
- Login with rate limiting (5 failed attempts → 15-minute lockout), 8-hour signed tokens, optional "keep me signed in"
- Dashboard: revenue, orders, average order, 14-day revenue chart, orders by status, top sellers, low-stock alerts
- Products: searchable/sortable table, filters, inline "featured" toggle, bulk feature/delete, CSV export, duplicate
- Product editor (create = `POST`, edit = `PUT`): drag-and-drop/paste image upload with auto-resize and drag-to-reorder,
  colour picker with presets, size presets with per-size stock, sale pricing, tags, live preview card,
  unsaved-changes guard, Ctrl/⌘+S to save
- Orders: filter by status, search, detail view, status updates with tracking number (cancelling restocks items), CSV export
- Discount codes: percentage or fixed, minimum order, expiry date, pause/resume, usage counts
- Review moderation, newsletter subscribers (CSV export), change username/password, sign out everywhere

## The admin API

Every admin endpoint requires `Authorization: Bearer <token>`.

```bash
# 1. Log in
TOKEN=$(curl -s -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).token")

# 2. Put a product up for sale
curl -X POST http://localhost:3000/api/admin/products \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "name": "Linen Overshirt",
    "description": "Boxy overshirt in washed linen.",
    "category": "shirts",
    "gender": "unisex",
    "price": 85,
    "compareAt": 110,
    "material": "100% linen",
    "colors": [{"name": "Sand", "hex": "#d4c3a3"}, {"name": "Black", "hex": "#1d1d1f"}],
    "sizes": ["S", "M", "L"],
    "stock": {"S": 4, "M": 8, "L": 3},
    "tags": ["linen", "summer"],
    "featured": true,
    "images": ["data:image/jpeg;base64,/9j/4AAQ..."]
  }'
```

`images` takes base64 data URLs (PNG, JPEG, WEBP, GIF; max 8 MB each, 8 per product). The server checks the
file signature and stores the file in `uploads/`. Images can be left out entirely.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/admin/login` | Get a token |
| GET | `/api/admin/me` | Check the token |
| POST | `/api/admin/password` | Change username/password (signs out other sessions) |
| POST | `/api/admin/logout-all` | Invalidate every token |
| GET | `/api/admin/products` | All products |
| POST | `/api/admin/products` | Create a product |
| PUT / PATCH | `/api/admin/products/:id` | Replace / partially update |
| DELETE | `/api/admin/products/:id` | Delete |
| POST | `/api/admin/upload` | Upload one image `{ "image": "data:..." }` → `{ url }` |
| GET | `/api/admin/orders?status=&q=` | List orders |
| PATCH | `/api/admin/orders/:number` | `{ status, tracking }` |
| GET / POST | `/api/admin/discounts` | List / create codes |
| PATCH / DELETE | `/api/admin/discounts/:code` | Toggle `active` / delete |
| GET / DELETE | `/api/admin/reviews[/:id]` | Moderate reviews |
| GET | `/api/admin/subscribers` | Newsletter list |
| GET | `/api/admin/stats` | Dashboard numbers |

Public endpoints: `GET /api/meta`, `GET /api/products` (query: `q, category, gender, size, color, min, max, sale,
instock, featured, tag, ids, sort, page, limit`), `GET /api/products/:idOrSlug`, `POST /api/products/:id/reviews`,
`POST /api/cart/quote`, `POST /api/discounts/validate`, `POST /api/orders`, `GET /api/orders/:number?email=`,
`POST /api/newsletter`.

## How it's built

- `server.js` — Node's built-in `http` module, JSON file storage in `data/db.json` (written atomically),
  scrypt password hashing, HMAC-signed tokens, server-side price/stock/discount calculation, input validation
- `public/` — vanilla HTML/CSS/JS: `index.html` + `app.js` (shop), `admin.html` + `admin.js` (admin),
  `styles.css` (shared), `garment.js` (draws product illustrations when a product has no photos)

This is a demo store: checkout validates cards (Luhn check) but never charges anything. Before running it for real
you would add a payment provider (e.g. Stripe), HTTPS, email sending and a proper database.
