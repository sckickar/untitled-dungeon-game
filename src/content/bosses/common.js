import { rnd, ri, clamp, norm } from "../../lib/math.js";
import { alive, isHostile, touches } from "../../sim/entity.js";
import { damage, kill } from "../../sim/combat.js";
import { applyStatus } from "../../sim/status.js";
import { resolve } from "../../sim/physics.js";
import { drop } from "../../sim/loot.js";
import { spawnFire } from "../spells.js";

export const INTRO = 3.4,
  APPEAR = 1.4,
  DYING = 2.8;

const PX = 8 * Math.SQRT2;

export const fromScreen = (sx, sy) => ({ x: (sx / 8 + sy / 4) / 2, y: (sy / 4 - sx / 8) / 2 });

export const scaled = (world) => 1 + 0.25 * (world.depth - 1);
export const hits = (world, base) => base + Math.floor(world.depth / 3);

export function anchorPart(e, ax, ay, az = 0, hit = e.def.hit) {
  e.ax = ax;
  e.ay = ay;
  e.az = az;
  e.segs = hit.map(([sx, r]) => {
    const o = fromScreen(sx, 0);
    return { x: ax + o.x, y: ay + o.y, r: r / PX };
  });
  const mid = e.segs[e.segs.length >> 1];
  e.x = mid.x;
  e.y = mid.y;
}

export function part(d) {
  return {
    team: "monster",
    r: 0.2,
    keepOnDeath: true,
    ...d,
    tags: ["creature", "bosspart", ...(d.tags || [])],
    look: { renderer: "boss", blood: "m", outline: "k", gibs: 6, spray: 20, ...d.look },
    setup(world, e, { boss, hp, ...init }) {
      Object.assign(e, { boss, face: { x: 1, y: 1 }, segs: [], ax: e.x, ay: e.y, az: 0, windT: 0, moveX: 0, moveY: 0 });
      e.hp = e.maxhp = Math.max(1, Math.round(hp));
      if (d.hit) anchorPart(e, e.x, e.y, 0);
      d.setup?.(world, e, init);
    },
    update(world, e, dt) {
      e.t += dt;
      e.flash -= dt;
      e.windT -= dt;
      if (!e.dead) d.update?.(world, e, dt);
    },
  };
}

export function spawnPart(world, b, type, init = {}) {
  const e = world.spawn(type, b.x, b.y, { boss: b, ...init });
  b.parts.push(e);
  return e;
}

export const livingParts = (b, type) => b.parts.filter((e) => alive(e) && (!type || e.type === type));

export function boss(d) {
  return {
    team: "monster",
    r: 0,
    tags: ["boss"],
    ...d,
    look: { renderer: "boss", ...d.look },
    setup(world, b, { arena }) {
      Object.assign(b, {
        arena,
        home: { x: b.x, y: b.y },
        state: "dormant",
        stateT: 0,
        appear: 0,
        parts: [],
        attack: null,
        last: null,
        cd: 0,
        tell: 0,
        pose: "idle",
        immune: 0,
        pace: 1,
        minions: 0,
      });
      world.boss = b;
      d.build(world, b);
      d.place(world, b, 0);
    },
    update: tickBoss,
  };
}

export function setState(world, b, state) {
  b.state = state;
  b.stateT = 0;
  world.emit("bossState", { boss: b, state });
}

export function inArena(b, x, y, margin = 0) {
  const A = b.arena;
  return Math.hypot(x - A.cx - 0.5, y - A.cy - 0.5) < Math.min(A.w, A.h) / 2 - margin;
}

export function keepInArena(b, margin) {
  const A = b.arena,
    cx = A.cx + 0.5,
    cy = A.cy + 0.5,
    R = Math.max(0, Math.min(A.w, A.h) / 2 - margin),
    d = Math.hypot(b.x - cx, b.y - cy);
  if (d > R) {
    b.x = cx + ((b.x - cx) / d) * R;
    b.y = cy + ((b.y - cy) / d) * R;
  }
}

function tickBoss(world, b, dt) {
  const D = b.def,
    p = world.player;
  b.t += dt;
  b.stateT += dt;
  b.immune -= dt;
  if (b.parts.some((e) => e.removed)) b.parts = b.parts.filter((e) => !e.removed);
  if (b.state === "dormant") {
    if (alive(p) && inArena(b, p.x, p.y, 1.5)) {
      setState(world, b, "intro");
      world.cutscene = { focus: b };
    }
  } else if (b.state === "intro") {
    const was = b.appear;
    b.appear = clamp(b.stateT / APPEAR, 0, 1);
    if (was < 1 && b.appear >= 1) world.emit("bossArrived", { boss: b, x: b.x, y: b.y });
    if (b.stateT >= INTRO) {
      setState(world, b, "fight");
      world.cutscene = null;
      b.cd = 0.8;
    }
  } else if (b.state === "fight") {
    b.pace = b.core.hp < b.core.maxhp * 0.5 ? 1.35 : 1;
    D.move?.(world, b, dt);
    D.passive?.(world, b, dt);
    runAttack(world, b, dt, D);
  } else if (b.state === "dying") {
    b.appear = 1 - clamp((b.stateT - 0.4) / (DYING - 0.4), 0, 1);
    b.boomT = (b.boomT ?? 0) - dt;
    if (b.boomT <= 0) {
      b.boomT = rnd(0.12, 0.25);
      const parts = b.parts.length ? b.parts : [b],
        e = parts[ri(0, parts.length - 1)],
        s = e.segs?.length ? e.segs[ri(0, e.segs.length - 1)] : e;
      world.spawn("explosion", s.x + rnd(-0.3, 0.3), s.y + rnd(-0.3, 0.3));
      world.emit("boom", { x: s.x, y: s.y, radius: 1 });
    }
    if (b.stateT >= DYING) return finish(world, b);
  }
  b.pose = b.attack ? b.attack.M.pose ?? "idle" : "idle";
  D.place(world, b, dt);
  shove(world, b);
}

function runAttack(world, b, dt, D) {
  let a = b.attack;
  if (!a) {
    b.tell = 0;
    if ((b.cd -= dt * b.pace) > 0) return;
    const ok = Object.entries(D.moves).filter(([id, M]) => id !== b.last && (!M.can || M.can(world, b)));
    if (!ok.length) return void (b.last = null);
    let r = Math.random() * ok.reduce((n, [, M]) => n + (M.weight ?? 1), 0),
      pick = ok[ok.length - 1];
    for (const o of ok) if ((r -= o[1].weight ?? 1) < 0) {
      pick = o;
      break;
    }
    const [id, M] = pick;
    a = b.attack = { id, M, t: 0, ft: 0, fired: false };
    b.last = id;
    world.say(M.name, Math.min(2, M.tell + 0.8));
    M.start?.(world, b, a);
    return;
  }
  const M = a.M;
  a.t += dt;
  if (a.t < M.tell) {
    b.tell = a.t / M.tell;
    return;
  }
  b.tell = 0;
  if (!a.fired) {
    a.fired = true;
    M.fire?.(world, b, a);
  }
  a.ft += dt;
  M.tick?.(world, b, a, dt);
  if (a.ft >= M.dur) {
    M.end?.(world, b, a);
    b.attack = null;
    b.cd = M.rest ?? 1.5;
  }
}

function shove(world, b) {
  const feet = [];
  for (const e of b.parts) if (!e.dead && e.def.foot) feet.push({ x: e.ax, y: e.ay, r: e.def.foot });
  if (!feet.length) return;
  for (const o of world.entities) {
    if (o.removed || o.dead || !o.tags.has("body")) continue;
    for (const f of feet) {
      const dx = o.x - f.x,
        dy = o.y - f.y,
        d = Math.hypot(dx, dy) || 1e-3,
        m = f.r + o.r;
      if (d >= m) continue;
      o.x = f.x + (dx / d) * m;
      o.y = f.y + (dy / d) * m;
      resolve(world, o);
    }
  }
}

function finish(world, b) {
  const D = b.def,
    A = b.arena,
    cx = A.cx + 0.5,
    cy = A.cy + 0.5;
  for (const e of b.parts) world.remove(e);
  for (const m of world.query((m) => m.owner === b && alive(m))) kill(world, m);
  b.parts = [];
  for (let i = 0; i < 8 + world.depth; i++) drop(world, "coin", b.x, b.y);
  for (const k of ["potion", "potion", "manapotion", "item", "item"]) drop(world, k, b.x, b.y);
  const run = world.run ?? (world.run = {});
  run.slain = [...(run.slain || []), { id: b.type, name: D.name, depth: world.depth }];
  setState(world, b, "dead");
  world.boss = null;
  world.remove(b);
  if (D.final) {
    world.victory = true;
    world.emit("victory", { boss: b });
  } else {
    world.spawn("stairs", cx, cy);
    world.say(D.name + " is dead", 2.5);
  }
}

export function scatter(world, b, x, y, r) {
  for (let t = 0; t < 12; t++) {
    const a = rnd(0, 6.283),
      d = Math.sqrt(Math.random()) * r,
      px = x + Math.cos(a) * d,
      py = y + Math.sin(a) * d;
    if (!world.solidAt(px, py) && inArena(b, px, py, 0.6)) return { x: px, y: py };
  }
  return { x, y };
}

export function lead(world, t, secs) {
  const s = (t.def.spd ?? 0) * (t.spdMul ?? 1) * secs;
  return { x: t.x + (t.moveX ?? 0) * s, y: t.y + (t.moveY ?? 0) * s };
}

export const target = (world) => (alive(world.player) ? world.player : null);

export const FALLS = {
  magma: {
    sprite: "magma",
    anim: "magma",
    radius: 0.6,
    elem: "fire",
    color: "m",
    land(world, f) {
      spawnFire(world, f.x, f.y, f.source, true);
      world.emit("boom", { x: f.x, y: f.y, radius: 0.6 });
    },
    onHit: (world, f, t) => applyStatus(world, t, "burning", { dmg: 1, source: f.source }),
  },
  meteor: {
    sprite: "magma",
    anim: "magma",
    radius: 0.7,
    elem: "fire",
    color: "m",
    land(world, f) {
      world.spawn("crater", f.x, f.y, { source: f.source, dmg: Math.max(1, f.dmg - 1) });
    },
    onHit: (world, f, t) => applyStatus(world, t, "burning", { dmg: 1, source: f.source }),
  },
  arrow: { sprite: "arrow", rot: Math.PI / 2, radius: 0.35, color: "w", kb: 1 },
  curse: {
    sprite: "cursed-flame",
    anim: "hexbolt",
    radius: 0.5,
    elem: "curse",
    color: "m",
    land(world, f) {
      if (Math.random() < 0.5) world.spawn("cursedflame", f.x, f.y, { source: f.source });
    },
    onHit: (world, f, t) => applyStatus(world, t, "cursed", { source: f.source }),
  },
};

const FALL_SPEED = 260;

export const FALLER = {
  faller: {
    look: { renderer: "faller" },
    setup(world, f, { source, kind, dmg, delay = 0.6, h = 120 }) {
      Object.assign(f, { source, team: source.team, kind, K: FALLS[kind], dmg, delay, h, z: h });
    },
    update(world, f, dt) {
      f.t += dt;
      if (f.delay > 0) return void (f.delay -= dt);
      f.z -= FALL_SPEED * dt;
      if (f.z > 0) return;
      const K = f.K;
      f.z = 0;
      for (const t of [...world.entities]) {
        if (!isHostile(f.team, t) || !touches(t, f.x, f.y, K.radius)) continue;
        damage(world, t, {
          amount: f.dmg,
          elem: K.elem ?? null,
          color: K.color,
          dir: norm(t.x - f.x, t.y - f.y),
          kb: K.kb ?? 3,
          source: f.source,
        });
        if (alive(t)) K.onHit?.(world, f, t);
      }
      world.emit("impact", { x: f.x, y: f.y, z: 0, dir: { x: 0, y: 0 }, color: K.color });
      K.land?.(world, f);
      world.remove(f);
    },
  },
};

export function rain(world, b, kind, x, y, { dmg, delay } = {}) {
  return world.spawn("faller", x, y, { source: b.core, kind, dmg: dmg ?? hits(world, 2), delay });
}

export function summon(world, b, type, x, y) {
  const m = world.spawn(type, x, y);
  Object.assign(m, { owner: b, team: b.team, sex: null });
  m.mem.aggro = true;
  m.mem.target = target(world);
  world.emit("brood", { parent: b.core, child: m });
  return m;
}

export const minionCount = (world, b, type) =>
  world.query((m) => m.owner === b && alive(m) && (!type || m.type === type)).length;
