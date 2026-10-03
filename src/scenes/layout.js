import { GRID_W, GRID_H } from "../sim/grid.js";

export const HUD_SLOTS = {
  main: { x: 58, y: 113, w: 15, h: 15 },
  off: { x: 74, y: 113, w: 15, h: 15 },
};
export const HUD_BARS = {
  hp: { x: 0, y: 111, well: { x: 14, y: 2, w: 40, h: 4 } },
  mp: { x: 0, y: 119, well: { x: 15, y: 2, w: 40, h: 4 } },
};
export const HUD_EXP = { y: 1, well: { x: 2, y: 2, w: 30, h: 4 } };

export const CELL = 9;
const PANEL = { x: 2, w: 124, h: 50 };
export const INV = { ...PANEL, y: 60 };
export const SHOP = { ...PANEL, y: 10 };
export const INV_EQUIP = {
  main: { x: 99, y: 71, w: 24, h: 18 },
  off: { x: 99, y: 90, w: 24, h: 18 },
};

export const gridAt = (P) => ({ x: P.x + 3, y: P.y + 11, w: GRID_W * CELL + 1, h: GRID_H * CELL + 1 });

export const footprint = (P, cx, cy, w = 1, h = 1) => {
  const o = gridAt(P);
  return { x: o.x + cx * CELL, y: o.y + cy * CELL, w: w * CELL + 1, h: h * CELL + 1 };
};

const inR = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

const gridHit = (type, P, x, y) => {
  const o = gridAt(P);
  if (!inR({ ...o, w: o.w - 1, h: o.h - 1 }, x, y)) return null;
  return { type, cx: Math.floor((x - o.x) / CELL), cy: Math.floor((y - o.y) / CELL) };
};

export const hitSlot = (x, y, open, trade = false) => {
  for (const s in HUD_SLOTS)
    if (inR(HUD_SLOTS[s], x, y)) return { type: "equip", slot: s };
  if (!open) return null;
  for (const s in INV_EQUIP)
    if (inR(INV_EQUIP[s], x, y)) return { type: "equip", slot: s };
  const hit = gridHit("bag", INV, x, y) || (trade && gridHit("shop", SHOP, x, y));
  if (hit) return hit;
  if (inR(INV, x, y) || (trade && inR(SHOP, x, y))) return { type: "panel" };
  return null;
};

const TALK_BOTTOM = 110, TALK_HEAD = 33;
export const TALK = { x: 4, w: 120, rowH: 9 };
export const talkBox = (n) => {
  const h = TALK_HEAD + n * TALK.rowH + 3, y = TALK_BOTTOM - h;
  return { ...TALK, y, h, textY: y + 13, optY: y + TALK_HEAD };
};
export const talkRow = (i, n) => ({
  x: TALK.x + 1,
  y: talkBox(n).optY + i * TALK.rowH,
  w: TALK.w - 2,
  h: TALK.rowH,
});
export const hitTalk = (x, y, n) => {
  for (let i = 0; i < n; i++) if (inR(talkRow(i, n), x, y)) return i;
  return inR(talkBox(n), x, y) ? -1 : null;
};

export const BOSS_BAR = { x: 14, y: 21, w: 100, h: 3, nameY: 11 };

export const SIGN = { x: 0, y: 11, w: 128, h: 48, lineH: 8, lines: 4, hi: "y" };
