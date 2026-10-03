import { rnd, norm, dist } from "../lib/math.js";
import { strike, heal, damage, traceBeam } from "../sim/combat.js";
import { spawnProjectile } from "../sim/attacks.js";
import { projectile } from "../sim/templates.js";
import {
  alive,
  cooldownReady,
  has,
  isHostile,
  touches,
} from "../sim/entity.js";
import { applyStatus } from "../sim/status.js";

export const SPELLS = {
  lightning: {
    word: "storm",
    mp: 3,
    tick: 0.2,
    range: 5,
    channel: true,
    onChannel(world, a, it, slot, dir) {
      const tick = it.tick || SPELLS.lightning.tick,
        dmg = Math.max(1, Math.floor((a.atk + it.atk) / 2)),
        tr = traceBeam(world, a.x, a.y, dir, 5, a.team);
      for (const t of tr.hits)
        if (cooldownReady(world, t, "zap", tick))
          strike(world, a, t, { amount: dmg, dir, kb: 0.6, color: "w", item: it });
      world.emit("beam", {
        key: `zap:${a.id}:${slot}`,
        x0: a.x,
        y0: a.y,
        x1: tr.x,
        y1: tr.y,
        life: 0.06,
      });
    },
  },
  flame: {
    word: "ember",
    mp: 4,
    range: 2.5,
    channel: true,
    onChannel(world, a, it, slot, dir, dt) {
      a.flameT = (a.flameT ?? 0) - dt;
      while (a.flameT <= 0) {
        a.flameT += 0.04;
        const ang = Math.atan2(dir.y, dir.x) + rnd(-0.25, 0.25),
          s = rnd(4.5, 5.5);
        world.spawn("flame", a.x + dir.x * 0.3, a.y + dir.y * 0.3, {
          source: a,
          vx: Math.cos(ang) * s,
          vy: Math.sin(ang) * s,
          dmg: 1 + Math.floor(it.atk / 2),
        });
      }
    },
  },
  eruption: {
    word: "magma",
    mp: 6,
    cd: 5,
    range: 5,
    onCast(world, a, it, slot, dir) {
      const p = eruptAt(world, a, dir, SPELLS.eruption.range);
      world.spawn("crater", p.x, p.y, {
        source: a,
        dmg: 1 + Math.floor((a.atk + it.atk) / 4),
      });
    },
  },
  hex: {
    word: "hex",
    mp: 4,
    cd: 1.2,
    range: 5,
    onCast(world, a, it, slot, dir) {
      spawnProjectile(world, "hexbolt", a, dir, {
        amount: Math.max(1, Math.floor((a.atk + it.atk) / 2)),
        kb: 1,
        item: it,
        elem: "curse",
        edmg: 1,
      });
    },
  },
  bloodsiphon: siphon("hp", { word: "leech", mp: 2 }),
  manasiphon: siphon("mp", { word: "drain", mp: 0 }),
  heal: {
    word: "mend",
    mp: 5,
    cd: 6,
    support: true,
    range: 4,
    onCast(world, a, it, slot, dir) {
      const t = mendTarget(world, a, dir, SPELLS.heal.range);
      world.spawn("mendCircle", t.x, t.y, {
        source: a,
        anchor: t,
        amt: 2 + Math.floor((a.lv || 0) / 2) + it.atk,
      });
    },
  },
};

function siphon(stat, { word, mp }) {
  return {
    word,
    mp,
    range: 4,
    tick: 0.3,
    channel: true,
    onChannel(world, a, it, slot, dir) {
      const tr = traceBeam(world, a.x, a.y, dir, 4, a.team);
      let t = null;
      for (const o of tr.hits)
        if (has(o, "creature") && (!t || dist(a, o) < dist(a, t))) t = o;
      if (!t || !cooldownReady(world, t, "siphon:" + a.id, it.tick || 0.3))
        return;
      const amt = Math.max(1, Math.floor((a.atk + it.atk) / 3));
      let got;
      if (stat === "mp" && t.mp > 0) {
        got = Math.min(t.mp, amt);
        t.mp -= got;
      } else {
        const before = t.hp;
        strike(world, a, t, {
          amount: amt,
          dir: { x: -dir.x, y: -dir.y },
          kb: 0.8,
          color: "m",
          blockable: false,
        });
        got = before - Math.max(0, t.hp);
      }
      if (stat === "hp") heal(world, a, got, { cause: "siphon", quiet: true });
      else if (a.maxmp) a.mp = Math.min(a.maxmp, a.mp + got);
      world.emit("siphon", { from: t, to: a, stat, amount: got });
    },
  };
}

function eruptAt(world, a, dir, range) {
  let best = null,
    bd = 0.85;
  for (const t of world.entities) {
    if (!has(t, "creature") || !isHostile(a, t)) continue;
    const d = dist(a, t) || 1e-3;
    if (d > range + 0.5 || !world.los(a.x, a.y, t.x, t.y)) continue;
    const dot = ((t.x - a.x) * dir.x + (t.y - a.y) * dir.y) / d;
    if (dot > bd) {
      bd = dot;
      best = t;
    }
  }
  if (best) return { x: best.x, y: best.y };
  const tr = traceBeam(world, a.x, a.y, dir, range, null);
  return { x: tr.x - dir.x * 0.3, y: tr.y - dir.y * 0.3 };
}

function mendTarget(world, a, dir, range) {
  const ok = (t) =>
    alive(t) &&
    t.team === a.team &&
    has(t, "creature") &&
    dist(a, t) <= range + 0.5 &&
    (t === a || world.los(a.x, a.y, t.x, t.y));
  if (ok(a.mem?.healTarget)) return a.mem.healTarget;
  let best = a,
    bd = 0.9;
  for (const t of world.entities) {
    if (t === a || !ok(t)) continue;
    const d = dist(a, t) || 1e-3,
      dot = ((t.x - a.x) * dir.x + (t.y - a.y) * dir.y) / d;
    if (dot > bd) {
      bd = dot;
      best = t;
    }
  }
  return best;
}

export function spawnFire(world, x, y, source, wild = false) {
  if (world.solidAt(x, y)) return;
  const fires = world.entities.filter((e) => e.type === "fire" && !e.removed);
  if (
    fires.length >= 40 ||
    fires.some((f) => Math.hypot(f.x - x, f.y - y) < 0.3)
  )
    return;
  world.spawn("fire", x, y, { source, wild });
}

const CRATER_COOL = 1.2;

const fromCaster = (e, source) =>
  Object.assign(e, { source, team: source.team });

export const SPELL_ENTITIES = {
  flame: {
    look: { renderer: "effect", sprite: "flame", anim: "flame", zDraw: true },
    setup(world, f, { source, vx, vy, dmg }) {
      fromCaster(f, source);
      Object.assign(f, { vx, vy, dmg, z: 4, life: 0.5 });
    },
    update(world, f, dt) {
      f.life -= dt;
      const nx = f.x + f.vx * dt,
        ny = f.y + f.vy * dt;
      let dead = f.life <= 0;
      if (!dead && world.solidAt(nx, ny)) {
        dead = true;
        spawnFire(world, f.x, f.y, f.source);
      } else if (!dead) {
        f.x = nx;
        f.y = ny;
      }
      if (!dead) {
        const u = norm(f.vx, f.vy);
        for (const t of [...world.entities])
          if (
            isHostile(f.team, t) &&
            touches(t, f.x, f.y, has(t, "creature") ? 0.2 : 0.1) &&
            cooldownReady(world, t, "flame", 0.15)
          )
            strike(world, f.source, t, {
              amount: f.dmg,
              dir: u,
              kb: 0.5,
              elem: "fire",
              edmg: 1,
            });
      }
      if (dead) {
        if (f.life <= 0 && Math.random() < 0.35)
          spawnFire(world, f.x, f.y, f.source);
        world.remove(f);
      }
    },
  },

  fire: {
    tags: ["hazard"],
    look: {
      renderer: "effect",
      sprite: "fire",
      anim: "fire",
      randomFrame: true,
      origin: [0.5, 1],
      yOff: 2,
      fadeBelow: 0.5,
    },
    setup(world, f, { source, wild = false }) {
      fromCaster(f, source);
      Object.assign(f, { life: rnd(2.5, 4), tick: 0, wild });
    },
    update(world, f, dt) {
      f.life -= dt;
      f.tick -= dt;
      if (f.life <= 0) return world.remove(f);
      if (f.tick > 0) return;
      f.tick = 0.4;
      for (const t of [...world.entities])
        if (
          has(t, "creature") &&
          (f.wild ? alive(t) : isHostile(f.team, t)) &&
          Math.hypot(t.x - f.x, t.y - f.y) < t.r + 0.25
        )
          strike(world, f.source, t, {
            amount: 1,
            color: "m",
            elem: "fire",
            edmg: 1,
            blockable: false,
          });
    },
  },

  poisonflame: {
    tags: ["hazard"],
    look: {
      renderer: "effect",
      sprite: "poisonflame",
      anim: "poisonflame",
      origin: [0.5, 0.9],
    },
    setup(world, f, { source, vx = 0, vy = 0, dmg = 1 }) {
      Object.assign(f, { source, vx, vy, dmg, life: 2 });
    },
    update(world, f, dt) {
      f.life -= dt;
      if (f.life <= 0) return world.remove(f);
      const drag = Math.pow(0.05, dt);
      f.vx *= drag;
      f.vy *= drag;
      const nx = f.x + f.vx * dt,
        ny = f.y + f.vy * dt;
      if (world.solidAt(nx, f.y)) f.vx = 0;
      else f.x = nx;
      if (world.solidAt(f.x, ny)) f.vy = 0;
      else f.y = ny;
      if (f.life < 0.5) return;
      for (const t of world.entities)
        if (
          alive(t) &&
          has(t, "creature") &&
          touches(t, f.x, f.y, 0.25) &&
          cooldownReady(world, t, "poison", 0.3)
        )
          applyStatus(world, t, "poisoned", { dmg: f.dmg, source: f.source });
    },
  },

  crater: {
    tags: ["hazard"],
    look: {
      renderer: "effect",
      sprite: "crater",
      origin: [0.5, 0.6],
      depth: -8e4,
      frame: (c) => (c.life > CRATER_COOL ? 0 : 1),
      fadeBelow: 0.4,
    },
    setup(world, c, { source, dmg = 1 }) {
      Object.assign(c, { source, dmg, life: 3 + CRATER_COOL, spitT: 0.15 });
      world.emit("boom", { x: c.x, y: c.y, radius: 0.6 });
    },
    update(world, c, dt) {
      c.life -= dt;
      if (c.life <= 0) return world.remove(c);
      if (c.life <= CRATER_COOL || (c.spitT -= dt) > 0) return;
      c.spitT = rnd(0.2, 0.4);
      const a = rnd(0, 6.283),
        s = rnd(1.4, 3.2);
      world.spawn("magma", c.x, c.y, {
        source: c.source,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        dmg: c.dmg,
      });
    },
  },

  magma: {
    look: { renderer: "effect", sprite: "magma", anim: "magma", zDraw: true },
    setup(world, m, { source, vx, vy, dmg }) {
      Object.assign(m, { source, vx, vy, dmg, z: 4, vz: rnd(55, 75) });
    },
    update(world, m, dt) {
      m.vz -= 160 * dt;
      m.z += m.vz * dt;
      const nx = m.x + m.vx * dt,
        ny = m.y + m.vy * dt;
      if (world.solidAt(nx, m.y)) m.vx *= -0.3;
      else m.x = nx;
      if (world.solidAt(m.x, ny)) m.vy *= -0.3;
      else m.y = ny;
      if (m.z > 0) return;
      world.remove(m);
      world.emit("impact", { x: m.x, y: m.y, z: 0, dir: { x: 0, y: 0 }, color: "m" });
      for (const t of [...world.entities])
        if (alive(t) && has(t, "creature") && touches(t, m.x, m.y, 0.35)) {
          damage(world, t, {
            amount: m.dmg,
            elem: "fire",
            color: "m",
            dir: norm(t.x - m.x, t.y - m.y),
            kb: 2,
            source: m.source,
          });
          applyStatus(world, t, "burning", { dmg: 1, source: m.source });
        }
      spawnFire(world, m.x, m.y, m.source, true);
    },
  },

  hexbolt: projectile({
    speed: 6,
    life: 1.4,
    look: { sprite: "cursed-flame", anim: "hexbolt" },
    burst(world, q) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.283 + rnd(-0.3, 0.3),
          r = i ? rnd(0.35, 0.7) : 0,
          x = q.x + Math.cos(a) * r,
          y = q.y + Math.sin(a) * r;
        if (!world.solidAt(x, y)) world.spawn("cursedflame", x, y, { source: q.source });
      }
    },
  }),

  cursedflame: {
    tags: ["hazard"],
    look: {
      renderer: "effect",
      sprite: "cursed-flame",
      anim: "cursedflame",
      randomFrame: true,
      origin: [0.5, 0.9],
      fadeBelow: 0.5,
    },
    setup(world, f, { source }) {
      Object.assign(f, { source, life: rnd(2.5, 3.5) });
    },
    update(world, f, dt) {
      f.life -= dt;
      if (f.life <= 0) return world.remove(f);
      for (const t of [...world.entities])
        if (
          alive(t) &&
          has(t, "creature") &&
          touches(t, f.x, f.y, 0.2) &&
          cooldownReady(world, t, "cursedflame", 0.5)
        ) {
          applyStatus(world, t, "cursed", { source: f.source });
          damage(world, t, { amount: 1, elem: "curse", color: "m", source: f.source });
        }
    },
  },

  explosion: {
    look: {
      renderer: "effect",
      sprite: "explosion",
      anim: "explosion",
      origin: [0.5, 0.9],
    },
    setup(world, f) {
      f.life = 5 / 14;
    },
    update(world, f, dt) {
      f.life -= dt;
      if (f.life <= 0) world.remove(f);
    },
  },

  mendCircle: {
    look: {
      renderer: "effect",
      sprite: "heal-pentagram",
      anim: "heal",
      depth: -8e4,
      fadeBelow: 0.5,
    },
    setup(world, h, { source, anchor = null, amt }) {
      fromCaster(h, source);
      Object.assign(h, { life: 3, tick: 0, amt, anchor });
    },
    update(world, h, dt) {
      h.life -= dt;
      h.tick -= dt;
      if (h.life <= 0) return world.remove(h);
      if (alive(h.anchor)) {
        h.x = h.anchor.x;
        h.y = h.anchor.y;
      }
      if (h.tick > 0) return;
      const allies = world.entities.filter(
        (t) =>
          !t.removed &&
          !t.dead &&
          has(t, "creature") &&
          t.team === h.team &&
          Math.hypot(t.x - h.x, t.y - h.y) < 0.8,
      );
      if (!allies.length) return;
      h.tick = 0.5;
      for (const t of allies)
        if (t.hp < t.maxhp) heal(world, t, h.amt, { cause: "mend" });
    },
  },
};
