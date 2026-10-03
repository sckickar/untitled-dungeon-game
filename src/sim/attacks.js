import { dist, norm, ri } from "../lib/math.js";
import { defs } from "./defs.js";
import { alive, bodyPoints, isHostile, startCooldown } from "./entity.js";
import { strike } from "./combat.js";
import { useAmmo, takeStack } from "./items.js";

const cooldown = (a, it) => it.cd * (a.def.weaponCdMul ?? 1);

export function slash(world, a, dir, it, slot) {
  if (a.cds[slot] > 0 || a.dead) return;
  const W = defs.weapons[it.base];
  startCooldown(a, slot, cooldown(a, it));
  a.atkT = W.big ? 0.25 : 0.14;
  world.emit("swing", { actor: a, slot, dir, item: it });
  world.emit("melee", { actor: a, reach: W.reach });
  a.kx += dir.x * 1.5;
  a.ky += dir.y * 1.5;
  landBlows(world, a, it, W, (dx, dy, d) => d < 0.45 || (dx * dir.x + dy * dir.y) / d > W.arc);
}

export function spin(world, a, dir, it, slot) {
  if (a.cds[slot] > 0 || a.dead) return;
  const W = defs.weapons[it.base];
  startCooldown(a, slot, cooldown(a, it));
  a.atkT = W.spinT;
  world.emit("swing", { actor: a, slot, dir, item: it, spin: W.spinT });
  world.emit("melee", { actor: a, reach: W.reach });
  landBlows(world, a, it, W, () => true);
}

function landBlows(world, a, it, W, inArc) {
  const caught = (o) =>
    bodyPoints(o).some((b) => {
      const dx = b.x - a.x,
        dy = b.y - a.y,
        d = Math.hypot(dx, dy);
      return d < W.reach + (b.r || o.r) && inArc(dx, dy, d);
    });
  const mark = a === world.player ? world.input?.mark : null,
    bossPart = new Map(),
    hit = [];
  for (const o of world.entities) {
    if (o === a || !isHostile(a, o) || !caught(o)) continue;
    if (!o.boss) hit.push(o);
    else {
      const cur = bossPart.get(o.boss);
      if (!cur || (cur !== mark && (o === mark || dist(o, a) < dist(cur, a)))) bossPart.set(o.boss, o);
    }
  }
  hit.push(...bossPart.values());
  let landed = false;
  for (const o of hit) {
    const crit = Math.random() < it.crit,
      kb = W.kb ?? 4;
    strike(world, a, o, {
      amount: (a.atk + it.atk + ri(0, 2)) * (crit ? 2 : 1),
      dir: norm(o.x - a.x, o.y - a.y),
      kb: crit ? kb * 1.5 : kb,
      crit,
      item: it,
      elem: W.elem,
      edmg: W.edmg,
    });
    landed = true;
  }
  if (landed) world.emit("swingLanded", { actor: a });
}

export function shoot(world, a, dir, it, slot) {
  if (a.cds[slot] > 0 || a.dead) return;
  const W = defs.weapons[it.base];
  if (W.ammo && !useAmmo(a, W.ammo)) {
    if (a === world.player) world.say("no " + plural(W.ammo), 0.8);
    return;
  }
  startCooldown(a, slot, cooldown(a, it));
  a.atkT = 0.1;
  spawnProjectile(world, W.projectile, a, dir, {
    amount: a.atk + it.atk + ri(0, 2),
    speed: W.spd,
    kb: W.kb ?? 2,
    item: it,
  });
}

export const plural = (base) => {
  const S = defs.stacks[base];
  return S?.plural ?? (S?.name ?? base) + "s";
};

function payFor(world, a, W) {
  const isPlayer = a === world.player;
  if (W.mp && a.mp != null) {
    if (a.mp < W.mp) {
      if (isPlayer) world.say("no mp", 0.8);
      return false;
    }
    a.mp -= W.mp;
  }
  if (W.hp) {
    if (a.hp <= W.hp) {
      if (isPlayer) world.say("too weak", 0.8);
      return false;
    }
    a.hp -= W.hp;
    world.emit("bloodPaid", { actor: a, amount: W.hp });
  }
  return true;
}

export function zap(world, a, dir, it, slot) {
  if (a.cds[slot] > 0 || a.dead) return;
  const W = defs.weapons[it.base],
    B = W.bolts[it.bolt] ?? Object.values(W.bolts)[0];
  if (!payFor(world, a, W)) return;
  startCooldown(a, slot, cooldown(a, it));
  a.castT = 0.2;
  spawnProjectile(world, B.projectile ?? W.projectile, a, dir, {
    amount: a.atk + it.atk + ri(0, 1),
    kb: 2,
    item: it,
    elem: B.elem,
    edmg: 1 + Math.floor(it.atk / 2),
  });
}

export function toss(world, a, dir, it, slot) {
  if (a.cds[slot] > 0 || a.dead) return;
  const W = defs.weapons[it.base];
  if (a.bag && !takeStack(a, W.ammo)) {
    a.equip[slot] = null;
    if (a === world.player)
      world.say("no more " + (defs.stacks[W.ammo].name ?? W.ammo), 1);
  }
  startCooldown(a, slot, cooldown(a, it));
  a.atkT = 0.1;
  spawnProjectile(world, W.projectile, a, dir, {
    amount: a.atk + it.atk + ri(0, 2),
    speed: W.spd,
    kb: W.kb ?? 3,
    item: it,
    sprite: it.spr ?? W.spr,
  });
}

export function cast(world, a, it, slot, input, dir, dt) {
  const S = defs.spells[it.spell],
    free = a.mp == null,
    isPlayer = a === world.player;
  if (S.channel) {
    if (!input.held) return;
    if (!free && S.mp && a.mp < 0.5) {
      if (isPlayer && world.message.t <= 0) world.say("no mp", 0.8);
      return;
    }
    if (!free) a.mp = Math.max(0, a.mp - S.mp * dt);
    a.channeling = true;
    a.castT = 0.1;
    S.onChannel(world, a, it, slot, dir, dt);
    return;
  }
  if (!input.pressed || a.cds[slot] > 0) return;
  if (!free && a.mp < S.mp) {
    if (isPlayer) world.say("no mp", 0.8);
    return;
  }
  if (!free) a.mp -= S.mp;
  startCooldown(a, slot, cooldown(a, it));
  a.castT = 0.25;
  S.onCast(world, a, it, slot, dir);
}

export function lunge(world, a, slot, it, dir) {
  a.kx += dir.x * 3.5;
  a.ky += dir.y * 3.5;
  world.emit("melee", { actor: a, reach: 0.6 });
  for (const t of [...world.entities]) {
    if (t === a || !isHostile(a, t) || dist(a, t) >= a.r + t.r + 0.6) continue;
    const u = norm(t.x - a.x, t.y - a.y);
    const res = strike(world, a, t, {
      amount: a.atk + it.atk,
      dir: u,
      kb: 5,
      item: it,
      blockCost: Math.max(1, Math.ceil(a.atk / 3)),
    });
    if (res === "blocked") {
      const m = a.def.mass ?? 1;
      a.kx -= (u.x * 5) / m;
      a.ky -= (u.y * 5) / m;
      if (a.cds[slot] < 1.4) startCooldown(a, slot, 1.4);
    }
  }
}

export function spit(world, a, slot, it, dir) {
  const W = defs.weapons[it.base];
  spawnProjectile(world, W.projectile, a, dir, {
    amount: a.atk + it.atk,
    kb: 5,
    item: it,
  });
}

export function spawnProjectile(world, type, source, dir, opts) {
  const mark = source === world.player ? world.input?.mark ?? null : null;
  if (alive(mark)) dir = norm(mark.x - source.x, mark.y - source.y);
  return world.spawn(type, source.x + dir.x * 0.3, source.y + dir.y * 0.3, {
    source,
    dir,
    mark: alive(mark) ? mark : null,
    ...opts,
  });
}
