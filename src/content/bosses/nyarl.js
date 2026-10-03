import { rnd, ri, pick, norm } from "../../lib/math.js";
import { alive, isHostile, touches } from "../../sim/entity.js";
import { damage, heal } from "../../sim/combat.js";
import { projectile } from "../../sim/templates.js";
import { defs } from "../../sim/defs.js";
import { boss, part, spawnPart, anchorPart, livingParts, scaled, hits, scatter, lead, rain, summon, target } from "./common.js";

const BODY = { x: 0, y: 6 },
  POOL_R = 4.2;

const drawBody = (e, b) => [
  { key: "nyarlbody", frame: Math.floor(b.t * (b.tell > 0 ? 10 : 4)) % 3, x: BODY.x, y: BODY.y, clip: true },
];
const drawHead = (e, b) => [
  { key: "nyarlhead", frame: Math.floor(b.t * 3) % 3, x: 2, y: -36, ox: 8 / 17, oy: 23 / 24, depth: 0.01, clip: true },
];
const ARMS = {
  l: { key: "nyarlarm_l", x: -5, y: -33, ox: 12 / 14, oy: 0, depth: -0.02, hit: [[-13, 7]] },
  r: { key: "nyarlarm_r", x: 9, y: -32, ox: 1 / 15, oy: 0, depth: 0.02, hit: [[16, 7]] },
};
const drawArm = (e, b) => {
  const A = ARMS[e.side],
    sway = Math.sin(b.t * 1.3 + (e.side === "l" ? 0 : 2)) * (b.tell > 0 ? 0.12 : 0.05);
  return [{ ...A, rot: e.side === "l" ? sway : -sway, clip: true }];
};

const TENTACLES = {
  1: { w: 45, h: 68, frames: 3, base: [39, 67], line: [[37, 45], [33, 22], [27, 4], [17, 10], [8, 20], [3, 25]] },
  2: { w: 73, h: 39, frames: 2, base: [68, 38], line: [[66, 25], [60, 10], [50, 3], [38, 8], [25, 17], [12, 25], [2, 32]] },
  3: { w: 26, h: 94, frames: 3, base: [8, 88], line: [[12, 75], [17, 55], [20, 35], [16, 18], [9, 8], [3, 2]] },
  4: { w: 62, h: 61, frames: 2, base: [60, 60], line: [[57, 40], [54, 20], [47, 6], [36, 4], [22, 8], [10, 13], [2, 17]] },
};
const WRITHE = 5,
  WRITHE_WIND = 12;
const tentacleHits = (v, flip) => {
  const T = TENTACLES[v],
    [bx, by] = T.base,
    m = flip ? -1 : 1;
  return [[0, 7], ...T.line.map(([x]) => [(x - bx) * m, 7])];
};
const drawTentacle = (e) => {
  const T = TENTACLES[e.v],
    { w, h } = T,
    frame = Math.floor(e.t * (e.windT > 0 ? WRITHE_WIND : WRITHE)) % T.frames;
  return [
    {
      key: "nyarl_tentacle" + e.v,
      frame,
      gx: e.ax,
      gy: e.ay,
      ox: (e.flip ? w - T.base[0] : T.base[0]) / w,
      oy: T.base[1] / h,
      flip: e.flip,
      clip: true,
      rise: e.rise,
      squash: e.slamT > 0 ? 0.85 : 1,
    },
  ];
};

function spawnTentacle(world, b) {
  const p = target(world),
    a = p ? Math.atan2(p.y - b.y, p.x - b.x) + rnd(-1, 1) : rnd(0, 6.283),
    ax = b.x + Math.cos(a) * POOL_R,
    ay = b.y + Math.sin(a) * POOL_R;
  if (world.solidAt(ax, ay)) return;
  const flip = !!p && p.x - p.y > ax - ay;
  spawnPart(world, b, "nyarltent", { hp: 12 * scaled(world), v: ri(1, 4), flip, ax, ay });
}

function fan(world, b, type, n, spread, opts) {
  const p = target(world);
  if (!p) return;
  const a0 = Math.atan2(p.y - b.y, p.x - b.x);
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * spread,
      dir = { x: Math.cos(a), y: Math.sin(a) };
    world.spawn(type, b.x + dir.x * 1.2, b.y + dir.y * 1.2, { source: b.core, dir, amount: hits(world, 2), kb: 2, ...opts });
  }
}

function ring(world, b, n, fire) {
  const off = rnd(0, 6.283);
  for (let i = 0; i < n; i++) {
    const a = off + (i / n) * 6.283;
    fire({ x: Math.cos(a), y: Math.sin(a) });
  }
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const BURSTS = {
  fire: (world, b) => fan(world, b, "fireball", 5, 0.22, { elem: "fire", edmg: 1 }),
  frost: (world, b) =>
    ring(world, b, 12, (dir) =>
      world.spawn("voidbolt", b.x + dir.x * 1.2, b.y + dir.y * 1.2, { source: b.core, dir, amount: hits(world, 2), kb: 2, elem: "frost", edmg: 1 }),
    ),
  shock: (world, b) => fan(world, b, "voidbolt", 7, 0.15, { elem: "shock", edmg: 1 }),
  poison: (world, b) =>
    ring(world, b, 16, (dir) =>
      world.spawn("poisonflame", b.x + dir.x, b.y + dir.y, { source: b.core, vx: dir.x * 10, vy: dir.y * 10, dmg: hits(world, 1) }),
    ),
  magma: (world, b) => {
    const p = target(world);
    if (!p) return;
    for (let i = 0; i < 5; i++) {
      const c = scatter(world, b, p.x, p.y, 2.5);
      rain(world, b, "magma", c.x, c.y, { dmg: hits(world, 2), delay: 0.2 + i * 0.08 });
    }
  },
  curse: (world, b) => fan(world, b, "hexbolt", 3, 0.3, { elem: "curse", edmg: 1 }),
  wind: (world, b) =>
    ring(world, b, 10, (dir) =>
      world.spawn("voidbolt", b.x + dir.x * 1.2, b.y + dir.y * 1.2, { source: b.core, dir, amount: hits(world, 1), kb: 2, elem: "wind", edmg: 1 }),
    ),
};

const consumable = () =>
  Object.values(defs.entities)
    .filter((d) => d.spawn && !d.spawn.wall && d.hp)
    .map((d) => d.id);

export const NYARL = {
  nyarl: boss({
    name: "nyarly",
    title: "the crawling chaos",
    intro: "rise",
    final: true,
    look: { draw: (b) => [{ key: "nyarl_under", x: 0, y: 0, ox: 0.5, oy: 0.5, depth: -8e4, ground: true, pool: true }] },
    build(world, b) {
      const s = scaled(world);
      b.core = spawnPart(world, b, "nyarlbody", { hp: 130 * s });
      spawnPart(world, b, "nyarlhead", { hp: 45 * s });
      spawnPart(world, b, "nyarlarm", { hp: 38 * s, side: "l" });
      spawnPart(world, b, "nyarlarm", { hp: 38 * s, side: "r" });
      b.tentT = 0.5;
    },
    place(world, b) {
      const z = Math.round(Math.sin(b.t * 1.6) * 1.5);
      for (const e of b.parts) {
        if (e.type === "nyarltent") continue;
        anchorPart(e, b.x, b.y, z, e.type === "nyarlarm" ? ARMS[e.side].hit : e.def.hit);
      }
    },
    passive(world, b, dt) {
      b.tentT -= dt * (b.immune > 0 ? 2 : 1);
      if (b.tentT > 0) return;
      b.tentT = rnd(3.5, 5.5) / b.pace;
      if (livingParts(b, "nyarltent").length < (b.pace > 1 ? 4 : 3)) spawnTentacle(world, b);
    },
    moves: {
      nightmare: {
        name: "nightmare",
        tell: 1,
        dur: 2.2,
        start(world, b) {
          for (const e of livingParts(b, "nyarlhead")) e.windT = 1;
        },
        tick(world, b, a, dt) {
          const p = target(world);
          if (!p || (a.next = (a.next ?? 0) - dt) > 0) return;
          a.next = 0.11;
          const at = lead(world, p, 0.8),
            c = scatter(world, b, at.x, at.y, 3.2);
          rain(world, b, "curse", c.x, c.y, { dmg: hits(world, 2), delay: 0.3 });
        },
      },
      consume: {
        name: "consume",
        tell: 0.6,
        dur: 3.4,
        fire(world, b, a) {
          const p = target(world),
            u = p ? norm(p.x - b.x, p.y - b.y) : { x: 1, y: 0 },
            c = scatter(world, b, b.x + u.x * (POOL_R - 0.5), b.y + u.y * (POOL_R - 0.5), 1);
          a.prey = summon(world, b, pick(consumable()), c.x, c.y);
        },
        tick(world, b, a, dt) {
          const m = a.prey;
          if (a.ft < 2 || !alive(m) || !alive(b.core) || (a.next = (a.next ?? 0) - dt) > 0) return;
          a.next = 0.12;
          const got = damage(world, m, { amount: Math.max(1, Math.ceil(m.maxhp * 0.15)), color: "c" });
          world.emit("siphon", { from: m, to: b.core, stat: "hp", amount: got });
          if (got) heal(world, b.core, Math.ceil(got * 0.6), { cause: "consume" });
        },
      },
      hallucination: {
        name: "hallucination",
        tell: 0.5,
        dur: 0.4,
        rest: 1,
        can: (world, b) => b.immune <= 0,
        fire(world, b) {
          b.immune = 5;
          spawnTentacle(world, b);
        },
      },
      worldsend: {
        name: "world's end",
        tell: 1.4,
        dur: 4.4,
        rest: 2.2,
        start(world, b) {
          for (const e of livingParts(b)) if (e.type !== "nyarltent") e.windT = 1.4;
        },
        fire(world, b, a) {
          a.order = shuffle(Object.keys(BURSTS));
        },
        tick(world, b, a, dt) {
          if ((a.next = (a.next ?? 0) - dt) > 0 || !a.order.length) return;
          a.next = 0.6;
          BURSTS[a.order.pop()](world, b);
          world.emit("boom", { x: b.x, y: b.y, radius: 2 });
        },
      },
    },
  }),

  nyarlbody: part({
    name: "nyarl",
    xp: 150,
    foot: 1.1,
    hit: [[-1, 13]],
    look: { draw: drawBody, z: 24, blood: "c", gibs: 30, spray: 60 },
  }),
  nyarlhead: part({
    name: "nyarl's head",
    xp: 10,
    hit: [[2, 9]],
    look: { draw: drawHead, z: 48, blood: "c", gibs: 10, spray: 14 },
  }),
  nyarlarm: part({
    name: "nyarl's arm",
    xp: 8,
    hit: ARMS.l.hit,
    look: { draw: drawArm, z: 22, blood: "c", gibs: 8, spray: 10 },
    setup(world, e, { side }) {
      e.side = side;
      e.name = side === "l" ? "nyarl's left arm" : "nyarl's right arm";
    },
  }),

  nyarltent: part({
    name: "tentacle",
    xp: 3,
    minor: true,
    look: { draw: drawTentacle, z: 24, blood: "c", gibs: 6, spray: 10 },
    setup(world, e, { v, flip, ax, ay }) {
      Object.assign(e, { v, flip, rise: 0, life: 9, atkT: rnd(1, 1.6), slamT: 0, winding: false, hit: tentacleHits(v, flip) });
      anchorPart(e, ax, ay, 0, e.hit);
    },
    update(world, e, dt) {
      const b = e.boss;
      e.slamT -= dt;
      e.life -= dt;
      if (b.state !== "fight") e.life = Math.min(e.life, 0.6);
      e.rise = e.life < 0.6 ? Math.max(0, e.life / 0.6) : Math.min(1, e.rise + dt / 0.6);
      if (e.life <= 0) return world.remove(e);
      if (e.rise < 1) return;
      if (e.winding) {
        if (e.windT > 0) return;
        e.winding = false;
        e.slamT = 0.25;
        world.emit("boom", { x: e.ax, y: e.ay, radius: 1 });
        for (const t of [...world.entities])
          if (isHostile(b.team, t) && e.segs.some((s) => touches(t, s.x, s.y, s.r + 0.2)))
            damage(world, t, { amount: hits(world, 2), dir: norm(t.x - e.ax, t.y - e.ay), kb: 6, color: "c", source: e });
        return;
      }
      if ((e.atkT -= dt) > 0) return;
      e.atkT = rnd(1.6, 2.4);
      const p = target(world);
      if (p && e.segs.some((s) => touches(p, s.x, s.y, s.r + 1.6))) {
        e.winding = true;
        e.windT = 0.7;
      }
    },
  }),

  voidbolt: projectile({ speed: 5, life: 3, tint: true, look: { sprite: "magicmissile", rotate: true } }),
};
