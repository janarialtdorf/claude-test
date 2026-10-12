/* Generates a flat illustration of a garment as SVG, used whenever a product
   has no uploaded photo. Shared by the storefront and admin panel. */
(function (global) {
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const f = (c) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
    return '#' + [f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
  }
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  }

  const SHAPES = {
    tshirts: (c, d) => `
      <path d="M128 92 L168 74 Q200 104 232 74 L272 92 L338 150 L304 192 L276 170 L276 428 L124 428 L124 170 L96 192 L62 150 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M168 74 Q200 112 232 74" fill="none" stroke="${d}" stroke-width="5"/>
      <path d="M96 192 L124 170 M304 192 L276 170" stroke="${d}" stroke-width="2" opacity=".5"/>`,
    shirts: (c, d) => `
      <path d="M130 86 L170 70 L200 92 L230 70 L270 86 L322 138 L346 402 L306 408 L284 208 L280 430 L120 430 L116 208 L94 408 L54 402 L78 138 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M170 70 L200 118 L184 126 L160 82 Z M230 70 L200 118 L216 126 L240 82 Z" fill="${shade(c, .12)}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="200" y1="118" x2="200" y2="430" stroke="${d}" stroke-width="2"/>
      ${[160, 210, 260, 310, 360, 405].map((y) => `<circle cx="207" cy="${y}" r="4" fill="${d}"/>`).join('')}
      <rect x="226" y="170" width="38" height="44" rx="3" fill="none" stroke="${d}" stroke-width="2" opacity=".7"/>
      <path d="M94 408 L54 402 L57 384 L97 390 Z M306 408 L346 402 L343 384 L303 390 Z" fill="${shade(c, -.08)}" stroke="${d}" stroke-width="2"/>`,
    knitwear: (c, d) => `
      <path d="M128 88 L168 74 Q200 98 232 74 L272 88 L322 140 L344 398 L306 404 L284 210 L280 426 L120 426 L116 210 L94 404 L56 398 L78 140 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M164 76 Q200 112 236 76" fill="none" stroke="${shade(c, -.2)}" stroke-width="12"/>
      <rect x="120" y="398" width="160" height="28" fill="${shade(c, -.1)}" stroke="${d}" stroke-width="2"/>
      ${Array.from({ length: 15 }, (_, i) => `<line x1="${126 + i * 10.5}" y1="400" x2="${126 + i * 10.5}" y2="424" stroke="${d}" stroke-width="1.4" opacity=".55"/>`).join('')}
      ${Array.from({ length: 6 }, (_, i) => `<path d="M${140 + i * 24} 180 q6 14 0 28 q-6 14 0 28 q6 14 0 28 q-6 14 0 28 q6 14 0 28 q-6 14 0 28" fill="none" stroke="${d}" stroke-width="1.6" opacity=".35"/>`).join('')}`,
    hoodies: (c, d) => `
      <path d="M128 98 L160 84 Q200 112 240 84 L272 98 L322 150 L344 402 L306 408 L284 220 L280 428 L120 428 L116 220 L94 408 L56 402 L78 150 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M150 104 Q146 36 200 30 Q254 36 250 104 Q228 128 200 126 Q172 128 150 104 Z" fill="${shade(c, -.06)}" stroke="${d}" stroke-width="3"/>
      <path d="M168 104 Q200 70 232 104 Q216 120 200 120 Q184 120 168 104 Z" fill="${shade(c, -.3)}"/>
      <path d="M186 122 L182 196 M214 122 L218 196" stroke="${shade(c, .35)}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M146 300 L254 300 L272 380 L128 380 Z" fill="none" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="120" y="404" width="160" height="24" fill="${shade(c, -.1)}" stroke="${d}" stroke-width="2"/>`,
    jackets: (c, d) => `
      <path d="M126 86 L168 70 L200 120 L232 70 L274 86 L324 138 L346 404 L308 410 L286 210 L284 432 L116 432 L114 210 L92 410 L54 404 L76 138 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M168 70 L200 120 L200 432" fill="none" stroke="${d}" stroke-width="3"/>
      <path d="M168 70 L150 96 L178 150 L200 120 Z M232 70 L250 96 L222 150 L200 120 Z" fill="${shade(c, -.14)}" stroke="${d}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M134 290 L182 290 M218 290 L266 290" stroke="${d}" stroke-width="3" stroke-linecap="round"/>
      <path d="M136 186 L176 186 L176 220 L136 220 Z M224 186 L264 186 L264 220 L224 220 Z" fill="none" stroke="${d}" stroke-width="2" opacity=".7"/>
      ${[200, 260, 320, 380].map((y) => `<circle cx="212" cy="${y}" r="5" fill="${shade(c, -.4)}"/>`).join('')}`,
    pants: (c, d) => `
      <path d="M132 64 L268 64 L294 436 L216 436 L200 176 L184 436 L106 436 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="132" y="64" width="136" height="24" fill="${shade(c, -.1)}" stroke="${d}" stroke-width="2.5"/>
      <path d="M200 88 L200 176 M200 88 Q214 140 200 160" fill="none" stroke="${d}" stroke-width="2"/>
      <path d="M140 92 Q162 120 176 96 M260 92 Q238 120 224 96" fill="none" stroke="${d}" stroke-width="2"/>
      ${[150, 186, 214, 250].map((x) => `<rect x="${x - 3}" y="62" width="6" height="28" fill="${shade(c, -.2)}"/>`).join('')}
      <path d="M148 120 L130 430 M252 120 L270 430" stroke="${d}" stroke-width="1.5" opacity=".35"/>`,
    dresses: (c, d) => `
      <path d="M164 62 L170 62 L176 104 Q200 120 224 104 L230 62 L236 62 L250 190 Q290 300 318 436 L82 436 Q110 300 150 190 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M150 190 Q200 206 250 190" fill="none" stroke="${d}" stroke-width="2.5"/>
      <path d="M176 210 Q160 330 140 436 M224 210 Q240 330 260 436 M200 212 L200 436" stroke="${d}" stroke-width="1.6" opacity=".35" fill="none"/>`,
    skirts: (c, d) => `
      <path d="M140 110 L260 110 L330 420 Q200 444 70 420 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="140" y="96" width="120" height="22" rx="2" fill="${shade(c, -.1)}" stroke="${d}" stroke-width="2.5"/>
      ${Array.from({ length: 9 }, (_, i) => { const t = (i + 1) / 10; return `<line x1="${140 + 120 * t}" y1="118" x2="${70 + 260 * t}" y2="${424 + Math.sin(t * Math.PI) * 8}" stroke="${d}" stroke-width="1.6" opacity=".4"/>`; }).join('')}`,
    accessories: (c, d) => `
      <path d="M160 170 Q160 90 200 90 Q240 90 240 170" fill="none" stroke="${d}" stroke-width="10" stroke-linecap="round"/>
      <path d="M100 170 L300 170 L320 430 L80 430 Z" fill="${c}" stroke="${d}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M100 170 L300 170 L298 200 L102 200 Z" fill="${shade(c, -.12)}"/>`,
  };

  global.garmentSVG = function (category, hex, opts = {}) {
    hex = /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#888888';
    const shape = SHAPES[category] || SHAPES.tshirts;
    const L = lum(hex);
    const stroke = shade(hex, L > 0.5 ? -0.45 : -0.55);
    const bg = opts.bg || (L > 0.78 ? '#ddd5c7' : '#ece6dc');
    const id = 'g' + Math.random().toString(36).slice(2, 8);
    return `<svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || 'Product illustration'}" preserveAspectRatio="xMidYMid slice">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs>
      <rect width="400" height="500" fill="${bg}"/>
      <ellipse cx="200" cy="462" rx="150" ry="14" fill="#000" opacity=".07"/>
      <g>${shape(hex, stroke)}</g>
      <rect width="400" height="500" fill="url(#${id})" style="mix-blend-mode:soft-light" pointer-events="none"/>
    </svg>`;
  };
  global.garmentShade = shade;
})(window);
