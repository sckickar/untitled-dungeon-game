import { rnd, norm, dist } from "../../lib/math.js";
import { cooldownReady, isHostile, touches } from "../../sim/entity.js";
import { damage, traceBeam } from "../../sim/combat.js";
import { applyStatus } from "../../sim/status.js";
import { boss, part, spawnPart, anchorPart, livingParts, scaled, hits, keepInArena, scatter, lead, rain, target } from "./common.js";

const ARMS = 8,
  SEGS = 7,
  ROOT = 0.62,
  LINK = 0.34,
  BEAM = 7;

function drawHead(e, b) {
  const L = [{ key: "octohead", x: 0, y: 0 }],
    t = b.tell > 0 ? Math.floor(b.t * 14) % 2 === 0 : !!b.attack;
  if (t) L.push({ key: "octo_eyes", x: -13, y: -16, ox: 0, oy: 0, depth: 0.001 });
  return L;
}

function drawArm(e) {
  return e.segs.map((s, k) => ({
    key: "octo_arm_seg",
    gx: s.x,
    gy: s.y,
    z: s.z,
    ox: 0.5,
    oy: 0.5,
    scale: k < SEGS - 2 ? 1 : k === SEGS - 2 ? 0.75 : 0.5,
  }));
}

function placeArm(b, e, dt) {
  const shock = b.attack?.id === "shock" ? 1 : 0;
  e.straight = (e.straight ?? 0) + (shock - (e.straight ?? 0)) * Math.min(1, dt * 5);
  const base = (e.slot / ARMS) * 6.283 + Math.PI / 8 + b.spin,
    i = e.slot,
    curl = 1 - e.straight * 0.9;
  let ang = base,
    x = b.x + Math.cos(base) * ROOT,
    y = b.y + Math.sin(base) * ROOT;
  e.ax = x;
  e.ay = y;
  e.az = 0;
  e.segs = [];
  for (let k = 0; k < SEGS; k++) {
    ang = base + Math.sin(b.t * 2 + i * 1.7 - k * 0.7) * 0.5 * curl * ((k + 1) / SEGS);
    x += Math.cos(ang) * LINK;
    y += Math.sin(ang) * LINK;
    e.segs.push({ x, y, r: k < SEGS - 2 ? 0.24 : 0.16, z: 2 + Math.sin((Math.PI * (k + 1)) / (SEGS + 1)) * 4 + e.straight * k });
  }
  const mid = e.segs[SEGS >> 1],
    tip = e.segs[SEGS - 1];
  e.x = mid.x;
  e.y = mid.y;
  e.tip = tip;
  e.dir = norm(tip.x - e.ax, tip.y - e.ay);
}

export const OCTO = {
  octo: boss({
    name: "octopussy",
    title: "hentai porn",
    intro: "drop",
    look: { draw: (b) => [{ key: "nyarl_under", x: 0, y: 1, ox: 0.5, oy: 0.5, scale: 0.32, alpha: 0.45, depth: -8e4, ground: true }] },
    build(world, b) {
      const s = scaled(world);
      b.spin = 0;
      b.spinV = 0;
      b.core = spawnPart(world, b, "octohead", { hp: 150 * s });
      for (let i = 0; i < ARMS; i++) spawnPart(world, b, "octoarm", { hp: 20 * s, slot: i });
    },
    place(world, b, dt) {
      b.spin += b.spinV * dt;
      anchorPart(b.core, b.x, b.y, 6 + Math.round(Math.sin(b.t * 2.2) * 1.5));
      for (const e of b.parts) if (e.type === "octoarm") placeArm(b, e, dt);
    },
    move(world, b, dt) {
      const p = target(world);
      if (p && b.attack?.id !== "shock") {
        const d = dist(b, p),
          u = norm(p.x - b.x, p.y - b.y),
          s = (d > 3.4 ? 0.7 : d < 2.4 ? -0.5 : 0) * dt;
        b.x += u.x * s;
        b.y += u.y * s;
        keepInArena(b, 4.2);
      }
      for (const arm of livingParts(b, "octoarm"))
        for (const t of world.entities) {
          if (!isHostile(b.team, t) || !t.tags.has("body") || !arm.segs.some((s) => touches(t, s.x, s.y, s.r))) continue;
          if (!cooldownReady(world, t, "octoslap", 0.9)) continue;
          damage(world, t, { amount: hits(world, 1), dir: norm(t.x - b.x, t.y - b.y), kb: 6, color: "m", source: arm });
        }
    },
    moves: {
      shock: {
        name: "tentacle shock",
        tell: 1.1,
        dur: 2.8,
        rest: 1.8,
        can: (world, b) => livingParts(b, "octoarm").length > 0,
        start(world, b) {
          for (const e of livingParts(b, "octoarm")) e.windT = 1.1;
        },
        fire(world, b) {
          b.spinV = (Math.random() < 0.5 ? -1 : 1) * 0.55;
        },
        tick(world, b) {
          for (const e of livingParts(b, "octoarm")) {
            const tr = traceBeam(world, e.tip.x, e.tip.y, e.dir, BEAM, b.team);
            world.emit("beam", { key: "octo:" + e.id, x0: e.tip.x, y0: e.tip.y, x1: tr.x, y1: tr.y, life: 0.08 });
            for (const t of tr.hits) {
              if (t.boss === b || !cooldownReady(world, t, "octoshock", 0.4)) continue;
              applyStatus(world, t, "shocked");
              damage(world, t, { amount: hits(world, 2), dir: e.dir, kb: 2, elem: "shock", color: "w", source: e });
            }
          }
        },
        end(world, b) {
          b.spinV = 0;
        },
      },
      eye: {
        name: "eye of terror",
        tell: 1,
        dur: 2.4,
        tick(world, b, a, dt) {
          const p = target(world);
          if (!p || (a.next = (a.next ?? 0) - dt) > 0) return;
          a.next = 0.16;
          const at = lead(world, p, 0.9),
            c = scatter(world, b, at.x, at.y, 2.6);
          rain(world, b, "magma", c.x, c.y, { dmg: hits(world, 2), delay: 0.3 });
        },
      },
      sweep: {
        name: "poison sweep",
        tell: 0.8,
        dur: 1.6,
        fire(world, b, a) {
          const p = target(world) ?? { x: b.x + 1, y: b.y + 1 };
          a.aim = Math.atan2(p.y - b.y, p.x - b.x);
          a.side = Math.random() < 0.5 ? -1 : 1;
        },
        tick(world, b, a, dt) {
          if ((a.next = (a.next ?? 0) - dt) > 0) return;
          a.next = 0.04;
          const ang = a.aim + (-1 + (2 * a.ft) / 1.6) * 0.9 * a.side + rnd(-0.1, 0.1),
            u = { x: Math.cos(ang), y: Math.sin(ang) },
            s = rnd(8, 11);
          world.spawn("poisonflame", b.x + u.x * 0.9, b.y + u.y * 0.9, {
            source: b.core,
            vx: u.x * s,
            vy: u.y * s,
            dmg: hits(world, 1),
          });
        },
      },
    },
  }),

  octohead: part({
    name: "king octo",
    xp: 60,
    foot: 1,
    hit: [[0, 15]],
    look: { draw: drawHead, z: 22, blood: "m", gibs: 24, spray: 50 },
  }),

  octoarm: part({
    name: "tentacle",
    xp: 4,
    look: { draw: drawArm, z: 4, blood: "m", gibs: 4, spray: 6 },
    setup(world, e, { slot }) {
      e.slot = slot;
      e.straight = 0;
    },
  }),
};
