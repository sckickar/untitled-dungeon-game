export const rnd = (a, b) => a + Math.random() * (b - a);
export const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};

export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const wrapAngle = (a) => {
  const t = (a + Math.PI) % (2 * Math.PI);
  return (t < 0 ? t + 2 * Math.PI : t) - Math.PI;
};

export const others = (c) => "mcw".replace(c, "");
