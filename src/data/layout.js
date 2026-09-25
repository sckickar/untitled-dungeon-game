export const HUD_SLOTS = {
  main: { x: 55, y: 117, w: 11, h: 11 },
  off: { x: 68, y: 117, w: 11, h: 11 },
};
export const HUD_BAR = { x: 2, y: 118, w: 50 };

export const INV = { x: 8, y: 14, w: 112, h: 100 };
export const INV_EQUIP = {
  main: { x: 12, y: 28, w: 14, h: 14 },
  off: { x: 28, y: 28, w: 14, h: 14 },
};
export const BAG = { x: 12, y: 48, cols: 7, rows: 3, pitch: 15, size: 14 };

const inR = (r, x, y) => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;

export const bagCell = (i) => ({
  x: BAG.x + (i % BAG.cols) * BAG.pitch,
  y: BAG.y + Math.floor(i / BAG.cols) * BAG.pitch,
  w: BAG.size,
  h: BAG.size,
});

export const hitSlot = (x, y, open) => {
  for (const s in HUD_SLOTS) if (inR(HUD_SLOTS[s], x, y)) return { type: "equip", slot: s };
  if (!open) return null;
  for (const s in INV_EQUIP) if (inR(INV_EQUIP[s], x, y)) return { type: "equip", slot: s };
  for (let i = 0; i < BAG.cols * BAG.rows; i++) if (inR(bagCell(i), x, y)) return { type: "bag", i };
  if (inR(INV, x, y)) return { type: "panel" };
  return null;
};
