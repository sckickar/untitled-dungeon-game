import { MW, MH } from "../config.js";
import { norm } from "../lib/math.js";

export function bfs(world, sx, sy) {
  const d = new Int16Array(MW * MH).fill(-1),
    q = new Int32Array(MW * MH);
  let h = 0,
    t = 0;
  const s = sy * MW + sx;
  d[s] = 0;
  q[t++] = s;
  while (h < t) {
    const c = q[h++],
      cx = c % MW,
      cy = (c / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx,
        ny = cy + dy;
      if (world.solid(nx, ny)) continue;
      const n = ny * MW + nx;
      if (d[n] < 0) {
        d[n] = d[c] + 1;
        q[t++] = n;
      }
    }
  }
  return d;
}

export function flowDir(world, e) {
  const flow = world.flow;
  if (!flow) return null;
  const tx = Math.floor(e.x),
    ty = Math.floor(e.y),
    cur = flow[ty * MW + tx];
  let best = null,
    bv = cur < 0 ? 1e9 : cur;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = tx + dx,
        ny = ty + dy;
      if (world.solid(nx, ny) || (dx && dy && (world.solid(tx + dx, ty) || world.solid(tx, ty + dy)))) continue;
      const v = flow[ny * MW + nx];
      if (v >= 0 && v < bv) {
        bv = v;
        best = { x: nx + 0.5, y: ny + 0.5 };
      }
    }
  return best ? norm(best.x - e.x, best.y - e.y) : null;
}
