import { MW } from "../config.js";
import { norm, rnd } from "../lib/math.js";
import { defs } from "./defs.js";
import { resolve } from "./physics.js";
import { statusSpeed } from "./status.js";
import { makeItem, takeStack, countOf } from "./items.js";
import { startCooldown } from "./entity.js";

export const SLOTS = ["main", "off"];
const IDLE = {};

export function setupActor(world, e) {
  const D = e.def;
  Object.assign(e, {
    atk: D.atk ?? 0,
    face: norm(1, 1),
    moveX: 0,
    moveY: 0,
    cds: { main: 0, off: 0 },
    cdMax: { main: 0, off: 0 },
    useT: { main: 0, off: 0 },
    castT: 0,
    invuln: 0,
    atkT: 0,
    windT: 0,
    windSlot: null,
    blocking: false,
    channeling: false,
    mem: { aggro: false, target: null },
    seed: rnd(0, 9),
    spdMul: D.spdJitter ? rnd(1 - D.spdJitter, 1 + D.spdJitter) : 1,
    tile: -1,
  });
  e.t = rnd(0, 9);
  e.equip = {
    main: D.equip?.main ? makeItem(D.equip.main) : null,
    off: D.equip?.off ? makeItem(D.equip.off) : null,
  };
  if (D.mp) {
    e.mp = e.maxmp = D.mp;
    e.mpT = 0;
  }
  if (D.segs) {
    e.ang = rnd(0, 6.283);
    e.segs = Array.from({ length: D.segs }, (_, i) => ({
      x: e.x - Math.cos(e.ang) * 0.05 * i,
      y: e.y - Math.sin(e.ang) * 0.05 * i,
      r: 0.13,
    }));
  }
}

export function tickActor(world, e, dt) {
  if (e.dead) return;
  e.t += dt;
  for (const s of SLOTS) {
    e.cds[s] -= dt;
    e.useT[s] -= dt;
  }
  e.castT -= dt;
  e.invuln -= dt;
  e.atkT -= dt;
  e.flash -= dt;
  if (e.maxmp) {
    e.mpT += dt;
    if (e.mpT > (e.def.mpRegen ?? 2.5)) {
      e.mpT = 0;
      e.mp = Math.min(e.maxmp, e.mp + 1);
    }
  }

  const intent = (e.def.brain && defs.brains[e.def.brain](world, e, dt)) || IDLE;

  const winding = e.windT > 0;
  if (winding) {
    e.windT -= dt;
    if (e.windT <= 0) releaseWindup(world, e, intent.aim || e.face);
  }

  let mx = intent.move?.x ?? 0,
    my = intent.move?.y ?? 0;
  const l = Math.hypot(mx, my);
  if (l > 1) {
    mx /= l;
    my /= l;
  }
  if (winding) mx = my = 0;
  const spd =
    (e.mode === "hired" ? e.def.hiredSpd ?? e.def.spd : e.def.spd) * e.spdMul * statusSpeed(e) * (e.atkT > 0 ? 0.4 : 1) * (e.blocking || e.channeling ? 0.5 : 1);
  e.x += (mx * spd + e.kx) * dt;
  e.y += (my * spd + e.ky) * dt;
  const dec = Math.pow(e.def.kbDecay ?? 0.0015, dt);
  e.kx *= dec;
  e.ky *= dec;
  resolve(world, e);
  e.moveX = mx;
  e.moveY = my;
  if (e.segs) followSegments(world, e);

  if (Math.hypot(mx, my) > 0.01) e.face = norm(mx, my);
  if (intent.aim) e.face = intent.aim;

  e.blocking = e.channeling = false;
  for (const slot of SLOTS) if (intent[slot]) useSlot(world, e, slot, intent[slot], e.face, dt);
  if (intent.use) useStack(world, e, intent.use);

  const tile = Math.floor(e.y) * MW + Math.floor(e.x),
    T = world.terrainAt(e.x, e.y);
  if (tile !== e.tile) {
    e.tile = tile;
    T.onEnter?.(world, e);
  }
  T.onStand?.(world, e, dt);
}

export function useSlot(world, a, slot, input, dir, dt) {
  const it = a.equip?.[slot];
  if (!it) return;
  const W = defs.weapons[it.base],
    K = defs.weaponKinds[W.kind];
  if ((input.pressed || input.held) && W.back) a.useT[slot] = 0.6;
  if (K.windup) {
    if (input.pressed && a.cds[slot] <= 0 && !(a.windT > 0)) {
      a.windT = a.def.wind ?? 0.3;
      a.windSlot = slot;
      startCooldown(a, slot, it.cd + rnd(0, W.cdJitter || 0));
    }
    return;
  }
  K.use(world, a, slot, it, input, dir, dt);
}

function releaseWindup(world, a, dir) {
  const it = a.equip?.[a.windSlot];
  if (!it) return;
  defs.weaponKinds[defs.weapons[it.base].kind].release(world, a, a.windSlot, it, dir);
}

export function useStack(world, a, base) {
  const S = defs.stacks[base];
  if (!S?.use || a.dead || !a.bag) return;
  if (countOf(a, base) <= 0) {
    if (a === world.player) world.say("no " + (S.name ?? base) + "s", 0.8);
    return;
  }
  if (S.use(world, a) !== false) takeStack(a, base);
}

function followSegments(world, e) {
  const SP = 0.3;
  let prev = e;
  for (const s of e.segs) {
    const dx = s.x - prev.x,
      dy = s.y - prev.y,
      d = Math.hypot(dx, dy) || 1e-3;
    if (d > SP) {
      s.x = prev.x + (dx / d) * SP;
      s.y = prev.y + (dy / d) * SP;
    }
    resolve(world, s);
    prev = s;
  }
}

export const snapshot = (e) => structuredClone(Object.fromEntries((e.def.carry || []).map((k) => [k, e[k]])));
