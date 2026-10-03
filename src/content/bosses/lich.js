import { rnd, norm, dist } from "../../lib/math.js";
import { alive } from "../../sim/entity.js";
import { monster } from "../creatures.js";
import {
  boss,
  part,
  spawnPart,
  anchorPart,
  livingParts,
  scaled,
  hits,
  keepInArena,
  inArena,
  scatter,
  lead,
  rain,
  summon,
  minionCount,
  target,
} from "./common.js";

const SLEEVES = {
  idle: {
    key: "licharm_idle_",
    w: 16,
    h: 17,
    join: [12.5, 13.5],
    cuff: [3, 10],
  },
  cast: {
    key: "licharm_cast_",
    w: 10,
    h: 18,
    join: [6.5, 2],
    cuff: [3.5, 10.5],
  },
};
for (const S of Object.values(SLEEVES))
  S.dir = Math.atan2(S.cuff[1] - S.join[1], S.cuff[0] - S.join[0]);

const IDLE = { at: [-12, -20], ang: SLEEVES.idle.dir - 0.35 },
  CAST = { at: [-12, -22], ang: SLEEVES.cast.dir - 2 * Math.PI };
const BREATH = { rate: 1.7, swing: 0.07, lift: 0.8 },
  BLEND = 6;
const HANDS = {
  idle: "lichhand2",
  cast: "lichhand3",
  summon: "lichhand4",
  point: "lichhand1",
};

const mix = (a, b, k) => a + (b - a) * k;
const ease = (k) => k * k * (3 - 2 * k);

function armPose(e, b) {
  const k = ease(e.k ?? 0),
    phase = b.t * BREATH.rate + (e.side === "r" ? 0 : 0.9),
    breathe = Math.sin(phase) * (1 - k),
    tremble = b.tell > 0 ? Math.sin(b.t * 40) * 0.04 : 0,
    at = [
      mix(IDLE.at[0], CAST.at[0], k),
      mix(IDLE.at[1], CAST.at[1], k) - breathe * BREATH.lift,
    ],
    ang = mix(IDLE.ang, CAST.ang, k) + breathe * BREATH.swing + tremble;
  const tip = (S) => {
    const r = ang - S.dir,
      dx = S.cuff[0] - S.join[0],
      dy = S.cuff[1] - S.join[1];
    return [
      at[0] + dx * Math.cos(r) - dy * Math.sin(r),
      at[1] + dx * Math.sin(r) + dy * Math.cos(r),
    ];
  };
  return { k, at, ang, tip };
}

function drawArm(e, b) {
  const m = e.side === "r" ? 1 : -1,
    { k, at, ang, tip } = armPose(e, b),
    L = [];
  for (const [name, S] of Object.entries(SLEEVES)) {
    const alpha = Math.min(
      1,
      Math.max(0, name === "idle" ? (0.65 - k) / 0.3 : (k - 0.35) / 0.3),
    );
    if (!alpha) continue;
    const r = ang - S.dir,
      [hx, hy] = tip(S);
    L.push({
      key: S.key + (m > 0 ? "l" : "r"),
      x: at[0] * m,
      y: at[1],
      ox: m > 0 ? S.join[0] / S.w : 1 - S.join[0] / S.w,
      oy: S.join[1] / S.h,
      rot: r * m,
      alpha,
      depth: 0.02,
      outline: false,
    });
    const hand = name === "idle" ? HANDS.idle : (HANDS[e.cast] ?? HANDS.cast);
    L.push({
      key: hand,
      x: hx * m,
      y: hy,
      ox: 0.5,
      oy: name === "idle" ? 0 : 0.5,
      flip: m < 0,
      alpha,
      depth: 0.03,
    });
  }
  return L;
}

const drawHead = (e, b) => [
  {
    key: "lichhead",
    frame: b.pose !== "idle" ? 1 + (Math.floor(b.t * 8) % 2) : 0,
    x: 0,
    y: -24,
    depth: 0.01,
  },
];

const BLINK = { every: [7, 10], near: 2.2 };

export const LICH = {
  lich: boss({
    name: "the lich",
    title: "skeltalman",
    intro: "fade",
    look: {
      draw: () => [
        {
          key: "nyarl_under",
          x: 0,
          y: 1,
          ox: 0.5,
          oy: 0.5,
          scale: 0.26,
          alpha: 0.5,
          depth: -8e4,
          ground: true,
        },
      ],
    },
    build(world, b) {
      const s = scaled(world);
      b.core = spawnPart(world, b, "lichbody", { hp: 120 * s });
      spawnPart(world, b, "lichhead", { hp: 40 * s });
      spawnPart(world, b, "licharm", { hp: 32 * s, side: "r" });
      spawnPart(world, b, "licharm", { hp: 32 * s, side: "l" });
      b.blinkT = rnd(...BLINK.every);
    },
    place(world, b, dt) {
      const z = 9 + Math.round(Math.sin(b.t * 1.8) * 2),
        casting = b.pose !== "idle" && alive(b.core);
      for (const e of b.parts) {
        if (e.type !== "licharm") {
          anchorPart(e, b.x, b.y, z);
          continue;
        }

        if (casting) e.cast = b.pose;
        e.k = Math.min(
          1,
          Math.max(0, (e.k ?? 0) + (casting ? 1 : -1) * BLEND * dt),
        );
        const m = e.side === "r" ? 1 : -1,
          { at, tip } = armPose(e, b),
          hand = tip(e.k < 0.5 ? SLEEVES.idle : SLEEVES.cast);
        anchorPart(e, b.x, b.y, z, [
          [((at[0] + hand[0]) / 2) * m, 9],
          [hand[0] * m, 6],
        ]);
      }
    },

    move(world, b, dt) {
      const p = target(world);
      if (!p) return;
      const d = dist(b, p),
        u = norm(p.x - b.x, p.y - b.y),
        s = (d > 6 ? 0.9 : d < 3.5 ? -1.1 : 0) * dt;
      b.x += u.x * s;
      b.y += u.y * s;
      keepInArena(b, 2.5);
      b.near = d < BLINK.near ? (b.near ?? 0) + dt : 0;
      if ((b.blinkT -= dt) > 0 && b.near < 1.2) return;
      if (b.attack) return;
      b.blinkT = rnd(...BLINK.every);
      b.near = 0;
      for (let t = 0; t < 20; t++) {
        const c = scatter(
          world,
          b,
          b.arena.cx + 0.5,
          b.arena.cy + 0.5,
          b.arena.w / 2 - 2.5,
        );
        if (Math.hypot(c.x - p.x, c.y - p.y) < 4) continue;
        world.spawn("explosion", b.x, b.y);
        b.x = c.x;
        b.y = c.y;
        world.spawn("explosion", b.x, b.y);
        world.emit("bossBlink", { boss: b });
        break;
      }
    },
    moves: {
      army: {
        name: "army of the dead",
        pose: "cast",
        tell: 1,
        dur: 1.8,
        fire(world, b) {
          const p = target(world);
          if (!p) return;
          const n = Math.min(
            6 - minionCount(world, b, "risen"),
            1 + livingParts(b, "licharm").length,
          );
          for (let i = 0; i < n; i++) {
            const c = scatter(world, b, p.x, p.y, 3.5);
            if (Math.hypot(c.x - p.x, c.y - p.y) > 1.2)
              summon(world, b, "risen", c.x, c.y);
          }
        },
        tick(world, b, a, dt) {
          const p = target(world);
          if (!p || (a.next = (a.next ?? 0) - dt) > 0) return;
          a.next = 0.09;
          const at = lead(world, p, 0.6),
            c = scatter(world, b, at.x, at.y, 3);
          rain(world, b, "arrow", c.x, c.y, {
            dmg: hits(world, 2),
            delay: 0.25,
          });
        },
      },

      guard: {
        name: "royal guard",
        pose: "summon",
        tell: 0.8,
        dur: 0.6,
        can: (world, b) => minionCount(world, b, "acollade") < 3,
        fire(world, b) {
          for (const m of [-1, 1]) {
            const c = scatter(world, b, b.x + m * 1.2, b.y - m * 1.2, 1);
            if (inArena(b, c.x, c.y, 0.5))
              summon(world, b, "acollade", c.x, c.y);
          }
        },
      },

      siege: {
        name: "siege",
        pose: "point",
        tell: 0.9,
        dur: 2.2,
        tick(world, b, a, dt) {
          const p = target(world);
          if (!p || (a.next = (a.next ?? 0) - dt) > 0) return;
          a.next = 0.45;
          const at = lead(world, p, 1),
            c = scatter(world, b, at.x, at.y, 1.5);
          rain(world, b, "meteor", c.x, c.y, {
            dmg: hits(world, 3),
            delay: 0.4,
          });
        },
      },
    },
  }),

  lichbody: part({
    name: "the lich",
    xp: 70,
    foot: 0.7,
    hit: [[0, 15]],
    look: {
      draw: () => [{ key: "lichbody", x: 0, y: 0 }],
      z: 26,
      blood: "w",
      gibs: 20,
      spray: 30,
    },
  }),
  lichhead: part({
    name: "lich's skull",
    xp: 8,
    hit: [[0, 9]],
    look: { draw: drawHead, z: 42, blood: "w", gibs: 8, spray: 10 },
  }),
  licharm: part({
    name: "lich's arm",
    xp: 6,
    look: { draw: drawArm, z: 28, blood: "w", gibs: 6, spray: 8 },
    setup(world, e, { side }) {
      e.side = side;
      e.name = side === "r" ? "lich's right arm" : "lich's left arm";
    },
  }),

  acollade: monster({
    name: "acollade",
    hp: 14,
    atk: 3,
    spd: 1.5,
    xp: 6,
    r: 0.3,
    wind: 0.4,
    mass: 1.2,
    loot: null,
    tags: ["undead"],
    brain: "melee",
    equip: { main: "bite" },
    ability: { spell: "miasma", every: 5, range: 5 },
    look: {
      sprite: "acollade",
      anims: { front: "acollade_f", back: "acollade_b" },
      attack: { front: 4, back: 5 },
      outline: "m",
      blood: "m",
      gibs: 8,
      spray: 16,
    },
  }),
};

export const LICH_SPELLS = {
  miasma: {
    word: "miasma",
    innate: true,
    mp: 0,
    cd: 4,
    range: 5,
    onCast(world, a, it, slot, dir) {
      const t = a.mem?.target,
        c = alive(t)
          ? { x: t.x, y: t.y }
          : { x: a.x + dir.x * 3, y: a.y + dir.y * 3 };
      for (let i = 0; i < 7; i++) {
        const ang = (i / 7) * 6.283 + rnd(-0.2, 0.2);
        world.spawn("poisonflame", c.x, c.y, {
          source: a,
          vx: Math.cos(ang) * 2.5,
          vy: Math.sin(ang) * 2.5,
          dmg: 1 + Math.floor(world.depth / 5),
        });
      }
    },
  },
};
