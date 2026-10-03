import { COL } from "../../config.js";

const SMALL_ROWS = { 0: '0123456789.-=+/*!?~,_()[]', 1: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ:', 10: 'abcdefghijklmnopqrstuvwxyz' };
const SMALL_CELLS = {};
for (const [row, chars] of Object.entries(SMALL_ROWS))
  [...chars].forEach((c, col) => { if (c !== '_') SMALL_CELLS[c] = [col * 10, +row * 10 + 2]; });
const SMALL_EXTRA = {
  "'": ['#', '#'], '"': ['#.#', '#.#'], '`': ['#.', '.#'], '^': ['.#.', '#.#'],
  ';': ['', '.#', '', '', '.#', '.#', '#.'], '_': ['', '', '', '', '', '', '####'],
  '<': ['', '..#', '.#.', '#..', '.#.', '..#'], '>': ['', '#..', '.#.', '..#', '.#.', '#..'],
  '|': ['#', '#', '#', '#', '#', '#', '#'], '\\': ['#..', '#..', '.#.', '.#.', '..#', '..#'],
  '%': ['##...', '##..#', '...#.', '..#..', '.#.##', '#..##'],
  '#': ['', '.#.#.', '#####', '.#.#.', '#####', '.#.#.'],
  '&': ['.##..', '#..#.', '.##..', '#.#.#', '#..#.', '.##.#'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  '{': ['.##', '.#.', '.#.', '#..', '.#.', '.#.', '.##'], '}': ['##.', '.#.', '.#.', '..#', '.#.', '.#.', '##.'],
};
const CW = 10, CH = 9;

function drawGlyph(ctx, src, i, dx, dy) {
  const c = String.fromCharCode(i), cell = SMALL_CELLS[c], px = SMALL_EXTRA[c];
  if (cell) ctx.drawImage(src, cell[0], cell[1] - 1, CW, CH, dx, dy, CW, CH);
  else if (px) {
    ctx.fillStyle = '#fff';
    px.forEach((r, y) => [...r].forEach((p, x) => p === '#' && ctx.fillRect(dx + 1 + x, dy + 1 + y, 1, 1)));
  }
}

export function buildFonts(scene, srcKey = 'fontsrc', prefix = 'font_') {
  const src = scene.textures.get(srcKey).getSourceImage();
  const n = 95, W = 16 * CW, H = Math.ceil(n / 16) * CH;
  for (const c of Object.keys(COL)) {
    const key = prefix + c, t = scene.textures.createCanvas(key + '_tex', W, H), ctx = t.getContext();
    for (let d = 0; d < n; d++) drawGlyph(ctx, src, d + 32, (d % 16) * CW, Math.floor(d / 16) * CH);
    const img = ctx.getImageData(0, 0, W, H), p = img.data, v = COL[c];
    const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
    const m = new Uint8Array(W * H);
    for (let k = 0; k < m.length; k++) if (p[k * 4 + 3]) m[k] = p[k * 4] | p[k * 4 + 1] | p[k * 4 + 2] ? 2 : 1;
    for (let k = 0; k < m.length; k++) {
      if (m[k] !== 2) continue;
      const x = k % W;
      for (const o of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W])
        if (o >= 0 && o < m.length && !m[o]) m[o] = 1;
    }
    for (let k = 0; k < m.length; k++) {
      const j = k * 4;
      if (m[k] === 2) { p[j] = r; p[j + 1] = g; p[j + 2] = b; p[j + 3] = 255; }
      else if (m[k] === 1) { p[j] = p[j + 1] = p[j + 2] = 0; p[j + 3] = 255; }
      else p[j + 3] = 0;
    }
    ctx.putImageData(img, 0, 0); t.refresh();
    const font = Phaser.GameObjects.RetroFont.Parse(scene, {
      image: key + '_tex', width: CW, height: CH, chars: Phaser.GameObjects.RetroFont.TEXT_SET1,
      charsPerRow: 16, spacing: { x: 0, y: 0 }, offset: { x: 0, y: 0 }, lineSpacing: 0,
    });
    for (let d = 0; d < n; d++) {
      const g = font.data.chars[d + 32], gx = (d % 16) * CW, gy = Math.floor(d / 16) * CH;
      let l = CW, r = -1;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++)
        if (m[(gy + y) * W + gx + x]) { l = Math.min(l, x); r = Math.max(r, x); }
      if (r < 0) { g.xAdvance = SPACE; continue; }
      const du = (g.u1 - g.u0) / CW, w = r - l + 1;
      g.u1 = g.u0 + (r + 1) * du; g.u0 += l * du;
      g.x += l; g.width = w; g.centerX = Math.floor(w / 2); g.xAdvance = w - 1;
    }
    scene.cache.bitmapFont.add(key, font);
  }
}

const SPACE = 3;
export const txt = (scene, x, y, s, c = 'w', f = 'font_') => scene.add.bitmapText(x, y, f + c, s);
