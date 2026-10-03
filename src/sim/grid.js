import { defs } from "./defs.js";

export const GRID_W = 10,
  GRID_H = 4;

export const makeGrid = (rows = GRID_H) => Array(GRID_W * rows).fill(null);

export const sizeOf = (it) => (defs.stacks[it.base] ? [1, 1] : (defs.weapons[it.base].size ?? [1, 1]));

export const cellOf = (i) => [i % GRID_W, (i / GRID_W) | 0];

export const inGrid = (g, x, y, w, h) => x >= 0 && y >= 0 && x + w <= GRID_W && y + h <= g.length / GRID_W;

export function overlaps(g, x, y, w, h, skip = -1) {
  const out = [];
  g.forEach((it, i) => {
    if (!it || i === skip) return;
    const [ix, iy] = cellOf(i),
      [iw, ih] = sizeOf(it);
    if (ix < x + w && x < ix + iw && iy < y + h && y < iy + ih) out.push(i);
  });
  return out;
}

export const itemAt = (g, x, y) => overlaps(g, x, y, 1, 1)[0] ?? -1;

export function canFit(g, it, i, skip = -1) {
  const [w, h] = sizeOf(it),
    [x, y] = cellOf(i);
  return inGrid(g, x, y, w, h) && !overlaps(g, x, y, w, h, skip).length;
}

export function findSpot(g, it) {
  const rows = g.length / GRID_W;
  for (let x = 0; x < GRID_W; x++)
    for (let y = 0; y < rows; y++) if (canFit(g, it, y * GRID_W + x)) return y * GRID_W + x;
  return -1;
}

export function stow(g, it) {
  const i = findSpot(g, it);
  if (i >= 0) g[i] = it;
  return i;
}
