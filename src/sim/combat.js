import { defs } from "./defs.js";
import { alive, bodyPoints, has, isHostile } from "./entity.js";
import { rollLoot, drop } from "./loot.js";
import { applyStatus } from "./status.js";
import { gainXP } from "./progression.js";

const NO_DIR = { x: 0, y: 0 };

export function damage(world, target, hit) {
  if (!alive(target) || target.hp == null || target.invuln > 0) return 0;
  const ev = world.emit("damage", {
    target,
    source: hit.source ?? null,
    amount: hit.amount,
    dir: hit.dir ?? NO_DIR,
    kb: hit.kb ?? 0,
    crit: !!hit.crit,
    elem: hit.elem ?? null,
    color: hit.color ?? null,
    cancel: false,
  });
  if (ev.cancel || ev.amount <= 0) return 0;
  target.hp -= ev.amount;
  target.flash = 0.1;
  if (target.def.iframes) target.invuln = target.def.iframes;
  const mass = target.def.mass ?? 1;
  target.kx += (ev.dir.x * ev.kb) / mass;
  target.ky += (ev.dir.y * ev.kb) / mass;
  if (target.windT > 0 && !has(target, "unstoppable")) target.windT = 0;
  if (target.mem) {
    target.mem.aggro = true;
    if (isHostile(target, ev.source)) target.mem.target = ev.source;
  }
  world.emit("damaged", ev);
  if (target.hp <= 0) kill(world, target, ev);
  return ev.amount;
}

export function heal(world, target, amount, { cause = null, quiet = false } = {}) {
  if (!alive(target) || amount <= 0) return 0;
  const before = target.hp;
  target.hp = Math.min(target.maxhp, target.hp + amount);
  const gained = target.hp - before;
  world.emit("healed", { target, amount: gained, requested: amount, cause, quiet });
  return gained;
}

export function kill(world, e, { dir = NO_DIR, source = null } = {}) {
  if (e.dead) return;
  e.dead = true;
  e.hp = Math.max(0, e.hp);
  world.emit("death", { target: e, dir, source });
  e.def.onDeath?.(world, e);
  if (!e.def.keepOnDeath) world.remove(e);
  if (e.def.loot) rollLoot(world, e.def.loot, e.x, e.y);
  for (const it of Object.values(e.equip || {}))
    if (it && !defs.weapons[it.base].natural && Math.random() < (e.gearDrop ?? e.def.gearDrop ?? 0)) drop(world, "item", e.x, e.y, it);
  if (e.def.xp && source?.team === "player" && world.player) {
    world.player.kills++;
    gainXP(world, world.player, e.def.xp + Math.floor(world.depth / 2));
  }
}

export function strike(world, attacker, target, hit) {
  if (!alive(target)) return "missed";
  if (hit.blockable !== false && tryBlock(world, target, hit.dir, hit.blockCost ?? 1, attacker)) return "blocked";
  const dealt = damage(world, target, { ...hit, source: attacker });
  if (hit.elem && alive(target)) defs.elements[hit.elem].onHit(world, attacker, target, hit);
  const item = hit.item;
  applyEffects(world, attacker, target, item, hit);
  if (item?.leech && attacker) heal(world, attacker, Math.round(hit.amount * item.leech), { cause: "leech", quiet: true });
  defs.prefixes[item?.prefix]?.onHit?.(world, attacker, target, hit);
  world.emit("hit", { attacker, target, ...hit, dealt });
  return dealt > 0 ? "hit" : "missed";
}

export function applyEffects(world, user, target, item, hit = {}) {
  for (const fx of item?.effects || []) {
    if (!alive(target)) return;
    const S = defs.suffixes[fx.id];
    if (S.elem) defs.elements[S.elem].onHit(world, user, target, { ...hit, edmg: fx.power });
    if (S.status) applyStatus(world, target, S.status, fx.power == null ? { source: user } : { duration: fx.power, source: user });
    S.onHit?.(world, user, target, hit, fx.power);
  }
}

export function tryBlock(world, defender, dir, cost = 1, attacker = null) {
  if (!defender.blocking || !defender.equip?.off || !defender.face) return false;
  const shield = defender.equip.off;
  if (-(dir.x * defender.face.x + dir.y * defender.face.y) <= (defs.weapons[shield.base].blockArc ?? 0.35)) return false;
  world.emit("blocked", { target: defender, attacker, dir, x: defender.x - dir.x * 0.3, y: defender.y - dir.y * 0.3, z: 5 });
  if (attacker && attacker !== defender) applyEffects(world, defender, attacker, shield, { dir: { x: -dir.x, y: -dir.y } });
  defender.kx += dir.x * 1.5;
  defender.ky += dir.y * 1.5;
  shield.dur -= cost;
  if (shield.dur <= 0) {
    defender.equip.off = null;
    world.emit("shieldBroke", { actor: defender });
    if (defender === world.player) world.say("shield broke", 1.2);
  }
  return true;
}

export function traceBeam(world, x, y, dir, range, team) {
  const hits = new Set(),
    STEP = 0.1,
    targets = world.entities.filter((e) => isHostile(team, e));
  for (let len = 0; len < range; len += STEP) {
    const nx = x + dir.x * STEP,
      ny = y + dir.y * STEP;
    if (world.solidAt(nx, ny)) break;
    x = nx;
    y = ny;
    for (const e of targets) if (!hits.has(e) && touchesBody(e, x, y)) hits.add(e);
  }
  return { x, y, hits };
}

const touchesBody = (e, x, y) =>
  bodyPoints(e).some((b) => Math.hypot(b.x - x, b.y - y) < (b.r || e.r) + (has(e, "creature") ? 0.2 : 0.1));
