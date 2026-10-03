import { defs } from "./defs.js";
import { flowDir } from "./nav.js";
import { alive, has, isHostile } from "./entity.js";
import { rnd, clamp, wrapAngle, dist, norm } from "../lib/math.js";

export const PRESS = { pressed: true, held: true };
export const SEEK_EVERY = 0.25;

export function perceive(world, e, { sight = 6.5, forget = 13 } = {}) {
  const m = e.mem;
  if (m.target && !isHostile(e, m.target)) m.target = null;
  if (world.time >= (m.seekAt ?? 0)) {
    m.seekAt = world.time + SEEK_EVERY * rnd(0.8, 1.2);
    const foe = (t) => t !== e && isHostile(e, t) && has(t, "creature");
    if (!m.target) m.target = nearest(world, e, foe);
    else {
      const cur = m.target,
        cd = dist(cur, e),
        curSeen = world.los(e.x, e.y, cur.x, cur.y),
        alt = nearest(
          world,
          e,
          (t) =>
            t !== cur &&
            foe(t) &&
            dist(t, e) < sight &&
            world.los(e.x, e.y, t.x, t.y),
        );
      if (alt && (!curSeen || dist(alt, e) < cd - 1.5)) m.target = alt;
    }
  }
  const t = m.target;
  if (!t) {
    m.aggro = false;
    return null;
  }
  const dx = t.x - e.x,
    dy = t.y - e.y,
    d = Math.hypot(dx, dy) || 1e-3;
  if (!m.aggro) {
    if (d < sight && world.los(e.x, e.y, t.x, t.y)) {
      m.aggro = true;
      world.emit("alert", { actor: e, target: t });
    }
  } else if (d > forget) m.aggro = false;
  return {
    target: t,
    dist: d,
    dir: { x: dx / d, y: dy / d },
    see: m.aggro && world.los(e.x, e.y, t.x, t.y),
  };
}

export function nearest(world, e, pred) {
  let best = null,
    bd = Infinity;
  for (const o of world.entities) {
    if (o.removed || !pred(o)) continue;
    const d = Math.hypot(o.x - e.x, o.y - e.y);
    if (d < bd) {
      bd = d;
      best = o;
    }
  }
  return best;
}

export function chase(world, e, info) {
  if (info.see) return info.dir;
  return (info.target === world.player && flowDir(world, e)) || info.dir;
}

export function wander(e, dt) {
  e.wt = (e.wt ?? 0) - dt;
  if (e.wt <= 0) {
    e.wt = rnd(0.8, 2.2);
    if (Math.random() < 0.5) {
      const a = rnd(0, 6.283);
      e.wx = Math.cos(a) * 0.4;
      e.wy = Math.sin(a) * 0.4;
    } else e.wx = e.wy = 0;
  }
  return { x: e.wx, y: e.wy };
}

export function weave(e, move, freq = 7, amount = 0.9) {
  const s = Math.sin(e.t * freq + e.seed) * amount;
  return { x: move.x - move.y * s, y: move.y + move.x * s };
}

export function slither(e, move, dt, turnRate = 5) {
  const l = Math.min(1, Math.hypot(move.x, move.y));
  if (l <= 0.01 || e.windT > 0) return move;
  const want = Math.atan2(move.y, move.x) + Math.sin(e.t * 6 + e.seed) * 0.9;
  e.ang += clamp(wrapAngle(want - e.ang), -turnRate * dt, turnRate * dt);
  return { x: Math.cos(e.ang) * l, y: Math.sin(e.ang) * l };
}

export function inReach(e, seen) {
  const it = e.equip?.main,
    reach = it && defs.weapons[it.base].reach;
  return (
    seen.dist <
    (reach ? reach + seen.target.r * 0.5 : e.r + seen.target.r + 0.3)
  );
}

export function attackRange(e) {
  const it = e.equip?.main;
  if (!it) return 0;
  if (it.spell) return defs.spells[it.spell].range ?? 5;
  return defs.weapons[it.base].range ?? 1;
}

export function hasMana(e) {
  if (e.mp == null) return true;
  const spell = e.equip?.main?.spell;
  if (spell && !defs.spells[spell].mp) return true;
  if (e.mp < 0.5) e.mem.drained = true;
  else if (e.mp >= e.maxmp * 0.5) e.mem.drained = false;
  return !e.mem.drained;
}

export const isSupport = (e) => {
  const it = e.equip?.main;
  return !!(it?.spell && defs.spells[it.spell].support);
};

export function healTarget(world, e, range, below = 0.9) {
  let best = null,
    bf = below;
  for (const o of world.entities) {
    if (!alive(o) || o.team !== e.team || o.hp == null || !has(o, "creature"))
      continue;
    const f = o.hp / o.maxhp;
    if (f >= bf) continue;
    if (o !== e && (dist(o, e) > range || !world.los(e.x, e.y, o.x, o.y)))
      continue;
    best = o;
    bf = f;
  }
  return best;
}

export function supportIntent(world, e, search) {
  const range = attackRange(e) || 4,
    t = healTarget(world, e, search ?? range);
  e.mem.healTarget = t;
  if (!t) return null;
  const d = dist(e, t),
    u = t === e ? e.face : norm(t.x - e.x, t.y - e.y);
  return {
    move: d > range * 0.8 ? u : null,
    aim: u,
    main: d <= range && hasMana(e) ? PRESS : null,
  };
}
