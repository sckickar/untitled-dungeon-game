import { OX, OY } from "../config.js";

export const iso = (x, y) => ({ x: (x - y) * 8 + OX, y: (x + y) * 4 + OY });

export const unIso = (sx, sy) => {
  const a = (sx - OX) / 8,
    b = (sy - OY) / 4;
  return { x: (a + b) / 2, y: (b - a) / 2 };
};
