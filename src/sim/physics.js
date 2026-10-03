import { clamp } from "../lib/math.js";

export function resolve(world, o) {
  const r = o.r;
  for (let ty = Math.floor(o.y - r); ty <= Math.floor(o.y + r); ty++)
    for (let tx = Math.floor(o.x - r); tx <= Math.floor(o.x + r); tx++) {
      if (!world.solid(tx, ty)) continue;
      const cx = clamp(o.x, tx, tx + 1),
        cy = clamp(o.y, ty, ty + 1);
      const dx = o.x - cx,
        dy = o.y - cy,
        d2 = dx * dx + dy * dy;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        o.x += (dx / d) * (r - d);
        o.y += (dy / d) * (r - d);
      } else {
        const l = o.x - tx,
          rr = tx + 1 - o.x,
          t = o.y - ty,
          b = ty + 1 - o.y,
          m = Math.min(l, rr, t, b);
        if (m === l) o.x = tx - r;
        else if (m === rr) o.x = tx + 1 + r;
        else if (m === t) o.y = ty - r;
        else o.y = ty + 1 + r;
      }
    }
}

export function separate(world) {
  const bodies = world.entities.filter((e) => !e.removed && !e.dead && e.tags.has("body"));
  const obstacles = world.entities.filter((e) => !e.removed && e.tags.has("obstacle"));
  for (let i = 0; i < bodies.length; i++) {
    const a = bodies[i],
      wa = a.def.weight ?? 1;
    for (let j = i + 1; j < bodies.length; j++) {
      const b = bodies[j],
        dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy),
        m = a.r + b.r;
      if (d < m && d > 1e-4) {
        const wb = b.def.weight ?? 1,
          f = (m - d) / d;
        a.x -= dx * f * (wb / (wa + wb));
        a.y -= dy * f * (wb / (wa + wb));
        b.x += dx * f * (wa / (wa + wb));
        b.y += dy * f * (wa / (wa + wb));
      }
    }
  }
  for (const a of bodies) {
    for (const o of obstacles) {
      const dx = a.x - o.x,
        dy = a.y - o.y,
        d = Math.hypot(dx, dy),
        m = a.r + o.r;
      if (d < m && d > 1e-4) {
        const f = (m - d) / d;
        a.x += dx * f;
        a.y += dy * f;
      }
    }
    resolve(world, a);
  }
}
