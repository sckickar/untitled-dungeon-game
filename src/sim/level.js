import { MW, MH } from "../config.js";
import { ri, rnd, pick, clamp } from "../lib/math.js";
import { defs, terrainIndex } from "./defs.js";
import { bfs } from "./nav.js";

export function generateLevel(world, { carry = null } = {}) {
  world.run = carry?.run ?? {};
  world.biome = pickBiome(world);
  const B = defs.biomes[world.biome];
  world.safe = !!B.safe;
  if (B.build) {
    B.build(world, { carry });
    world.emit("levelGenerated");
    return;
  }
  carve(world);
  const r0 = world.rooms[0];
  world.player = world.spawn("player", r0.cx + 0.5, r0.cy + 0.5, { carry });
  populate(world);
  const sr = world.stairRoom;
  world.spawn("stairs", sr.cx + 0.5, sr.cy + 0.5);
  world.emit("levelGenerated");
}

function pickBiome(world) {
  const ok = Object.values(defs.biomes).filter((b) => !b.when || b.when(world));
  if (!ok.length) throw new Error(`no biome allows depth ${world.depth}`);
  return weighted(ok.map((b) => ({ id: b.id, weight: b.weight ?? 1 })));
}

const DIRS4 = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function carve(world, { fixed = [] } = {}) {
  const L = defs.biomes[world.biome].layout,
    FLOOR = terrainIndex("floor"),
    WALL = terrainIndex("wall");
  world.tiles.fill(WALL);
  const R = (world.rooms = fixed.map((r) => ({ ...r, fixed: true })));
  for (let t = 0; t < 600 && R.length < L.rooms; t++) {
    const w = ri(...L.size),
      h = ri(...L.size),
      x = ri(2, MW - w - 3),
      y = ri(2, MH - h - 3);
    if (
      R.some(
        (r) =>
          x < r.x + r.w + L.gap &&
          x + w + L.gap > r.x &&
          y < r.y + r.h + L.gap &&
          y + h + L.gap > r.y,
      )
    )
      continue;
    R.push({
      x,
      y,
      w,
      h,
      cx: Math.floor(x + w / 2),
      cy: Math.floor(y + h / 2),
    });
  }
  const dig = (x, y) => {
    if (x > 0 && y > 0 && x < MW - 1 && y < MH - 1) world.setTile(x, y, FLOOR);
  };
  const wall = (x, y) => world.setTile(x, y, WALL);
  for (const r of R) ((r.shape ?? L.shape) === "blob" ? digBlob : digRect)(r, dig);
  for (const r of R)
    if (!r.fixed && L.pillars && Math.random() < L.pillarChance) PILLARS[L.pillars](r, wall);
  for (const r of R) if (!r.fixed) for (let k = ri(...L.alcoves); k > 0; k--) alcove(world, r, dig);

  const hseg = (x0, x1, y) => {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1) + 1; x++) {
      dig(x, y);
      dig(x, y + 1);
    }
  };
  const vseg = (y0, y1, x) => {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1) + 1; y++) {
      dig(x, y);
      dig(x + 1, y);
    }
  };
  const elbow = (a, b) => {
    if (Math.random() < 0.5) {
      hseg(a.cx, b.cx, a.cy);
      vseg(a.cy, b.cy, b.cx);
    } else {
      vseg(a.cy, b.cy, a.cx);
      hseg(a.cx, b.cx, b.cy);
    }
  };
  const corridor = (a, b) => {
    if (Math.random() >= L.bend) return elbow(a, b);
    const mid = {
      cx: clamp(ri(Math.min(a.cx, b.cx), Math.max(a.cx, b.cx)) + ri(-3, 3), 2, MW - 4),
      cy: clamp(ri(Math.min(a.cy, b.cy), Math.max(a.cy, b.cy)) + ri(-3, 3), 2, MH - 4),
    };
    elbow(a, mid);
    elbow(mid, b);
  };
  for (let i = 1; i < R.length; i++) {
    let best = 0,
      bd = 1e9;
    for (let j = 0; j < i; j++) {
      const d = Math.abs(R[i].cx - R[j].cx) + Math.abs(R[i].cy - R[j].cy);
      if (d < bd) {
        bd = d;
        best = j;
      }
    }
    corridor(R[i], R[best]);
  }
  for (let k = 0; k < L.loops && R.length > 3; k++) corridor(pick(R), pick(R));
  if (L.erode) erode(world, ...L.erode, FLOOR);
  for (const r of R) world.setTile(r.cx, r.cy, FLOOR);

  const d = bfs(world, R[0].cx, R[0].cy);
  for (let i = 0; i < d.length; i++) if (d[i] < 0) world.tiles[i] = WALL;
  let far = R[R.length - 1],
    fd = -1;
  for (const r of R.slice(1)) {
    const v = d[r.cy * MW + r.cx];
    if (v > fd) {
      fd = v;
      far = r;
    }
  }
  world.stairRoom = far;
}

function digRect(r, dig) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) dig(x, y);
}

function digBlob(r, dig) {
  const ox = r.x + r.w / 2,
    oy = r.y + r.h / 2,
    p1 = rnd(0, 6.283),
    p2 = rnd(0, 6.283);
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const nx = (x + 0.5 - ox) / (r.w / 2),
        ny = (y + 0.5 - oy) / (r.h / 2),
        a = Math.atan2(ny, nx),
        edge = 1.05 + 0.16 * Math.sin(3 * a + p1) + 0.1 * Math.sin(5 * a + p2);
      if (Math.hypot(nx, ny) < edge) dig(x, y);
    }
}

const PILLARS = {
  corners(r, wall) {
    if (r.w < 7 || r.h < 7) return;
    for (const [x, y] of [
      [r.x + 2, r.y + 2],
      [r.x + r.w - 3, r.y + 2],
      [r.x + 2, r.y + r.h - 3],
      [r.x + r.w - 3, r.y + r.h - 3],
    ])
      wall(x, y);
  },
  rows(r, wall) {
    if (Math.min(r.w, r.h) < 5 || Math.max(r.w, r.h) < 6) return;
    if (r.w >= r.h)
      for (let x = r.x + 1; x < r.x + r.w - 1; x += 2) {
        wall(x, r.y + 1);
        wall(x, r.y + r.h - 2);
      }
    else
      for (let y = r.y + 1; y < r.y + r.h - 1; y += 2) {
        wall(r.x + 1, y);
        wall(r.x + r.w - 2, y);
      }
  },
  lumps(r, wall) {
    for (let k = ri(1, 3); k > 0; k--) {
      const x = ri(r.x + 1, r.x + r.w - 3),
        y = ri(r.y + 1, r.y + r.h - 3),
        big = Math.random() < 0.4;
      if (Math.abs(x - r.cx) <= 2 && Math.abs(y - r.cy) <= 2) continue;
      wall(x, y);
      if (big) {
        wall(x + 1, y);
        wall(x, y + 1);
        wall(x + 1, y + 1);
      }
    }
  },
};

function alcove(world, r, dig) {
  const [dx, dy] = pick(DIRS4),
    along = dx ? ri(r.y + 1, r.y + r.h - 2) : ri(r.x + 1, r.x + r.w - 2),
    x = dx ? (dx > 0 ? r.x + r.w : r.x - 1) : along,
    y = dy ? (dy > 0 ? r.y + r.h : r.y - 1) : along;
  if (x < 2 || y < 2 || x > MW - 3 || y > MH - 3) return;
  if (world.solid(x - dx, y - dy)) return;
  for (let j = -1; j <= 1; j++)
    for (let k = 0; k <= 1; k++) {
      const cx = x + dx * k + (dx ? 0 : j),
        cy = y + dy * k + (dy ? 0 : j);
      if (!world.solid(cx, cy)) return;
    }
  dig(x, y);
}

function erode(world, passes, chance, FLOOR) {
  for (let p = 0; p < passes; p++) {
    const bite = [];
    for (let y = 2; y < MH - 2; y++)
      for (let x = 2; x < MW - 2; x++)
        if (
          world.solid(x, y) &&
          DIRS4.some(([dx, dy]) => !world.solid(x + dx, y + dy)) &&
          Math.random() < chance
        )
          bite.push([x, y]);
    for (const [x, y] of bite) world.setTile(x, y, FLOOR);
  }
}

export function carveVault(world, w, h, tries = 300) {
  const FLOOR = terrainIndex("floor");
  for (let t = 0; t < tries; t++) {
    const r = pick(world.rooms),
      [dx, dy] = pick(DIRS4);
    let x = ri(r.x, r.x + r.w - 1),
      y = ri(r.y, r.y + r.h - 1);
    if (world.solid(x, y)) continue;
    while (!world.solid(x + dx, y + dy)) {
      x += dx;
      y += dy;
    }
    const door = { x: x + dx, y: y + dy },
      vx = dx ? (dx > 0 ? door.x + 1 : door.x - w) : door.x - ri(0, w - 1),
      vy = dy ? (dy > 0 ? door.y + 1 : door.y - h) : door.y - ri(0, h - 1);
    if (vx < 2 || vy < 2 || vx + w > MW - 2 || vy + h > MH - 2) continue;
    let sealed = true;
    for (let yy = vy - 1; sealed && yy <= vy + h; yy++)
      for (let xx = vx - 1; xx <= vx + w; xx++)
        if (!(xx === door.x && yy === door.y) && !world.solid(xx, yy)) {
          sealed = false;
          break;
        }
    if (!sealed) continue;
    for (let yy = vy; yy < vy + h; yy++)
      for (let xx = vx; xx < vx + w; xx++) world.setTile(xx, yy, FLOOR);
    world.setTile(door.x, door.y, FLOOR);
    return {
      x: vx,
      y: vy,
      w,
      h,
      cx: vx + Math.floor(w / 2),
      cy: vy + Math.floor(h / 2),
      door,
      dir: { x: dx, y: dy },
    };
  }
  return null;
}

function weighted(list) {
  let r = Math.random() * list.reduce((n, o) => n + o.weight, 0);
  for (const o of list) if ((r -= o.weight) < 0) return o.id;
  return list[list.length - 1].id;
}

export function roomCell(world, r) {
  for (let t = 0; t < 30; t++) {
    const x = ri(r.x, r.x + r.w - 1),
      y = ri(r.y, r.y + r.h - 1);
    if (!world.solid(x, y) && !(x === r.cx && y === r.cy))
      return { x: x + rnd(0.3, 0.7), y: y + rnd(0.3, 0.7) };
  }
  return { x: r.cx + 0.5, y: r.cy + 0.5 };
}

function populate(world) {
  const all = Object.values(defs.entities).filter((d) => d.spawn);

  const monsters = all
    .filter(
      (d) =>
        !d.spawn.wall &&
        d.spawn.minDepth <= world.depth &&
        (!d.spawn.only || d.spawn.only.includes(world.biome)),
    )
    .map((d) => ({
      id: d.id,
      weight: d.spawn.weight * (d.spawn.biomes?.[world.biome] ?? 1),
      max: d.spawn.max ?? Infinity,
    }))
    .filter((m) => m.weight > 0);
  const placeProps = wallProps(world);
  world.rooms.forEach((r, i) => {
    if (i > 0 && monsters.length) {
      const n = ri(1, Math.min(6, 2 + Math.floor(world.depth / 2)));
      for (let k = 0; k < n; k++) {
        const c = roomCell(world, r),
          id = weighted(monsters),
          m = monsters.find((o) => o.id === id);
        world.spawn(m.id, c.x, c.y);
        if (--m.max <= 0) monsters.splice(monsters.indexOf(m), 1);
        if (!monsters.length) break;
      }
    }
    placeProps(r, ri(0, 3));
  });
}

export function wallProps(world) {
  const props = Object.values(defs.entities)
      .filter((d) => d.spawn?.wall)
      .map((d) => ({ id: d.id, weight: d.spawn.weight })),
    placed = new Set();
  return (r, n) => {
    for (let t = 0; n > 0 && t < 12 && props.length; t++) {
      const [ox, oy] = pick(DIRS4),
        x = ri(r.x, r.x + r.w - 1),
        y = ri(r.y, r.y + r.h - 1);
      if (
        world.solid(x, y) ||
        !world.solid(x + ox, y + oy) ||
        (x === r.cx && y === r.cy)
      )
        continue;
      if (placed.has(y * MW + x)) continue;
      placed.add(y * MW + x);
      world.spawn(weighted(props), x + 0.5, y + 0.5);
      n--;
    }
  };
}
