import { defs } from "./defs.js";

export const alive = (e) => !!e && !e.removed && !e.dead;

export function has(e, tag) {
  if (e.tags.has(tag)) return true;
  for (const s of e.status.values()) if (s.def.tags?.includes(tag)) return true;
  return false;
}

export function isHostile(team, target) {
  if (!alive(target) || target.hp == null) return false;
  const t = typeof team === "string" ? team : team?.team;
  return defs.factions[t]?.[target.team] === "hostile";
}

export function startCooldown(a, slot, secs) {
  a.cds[slot] = a.cdMax[slot] = secs;
}

export const bodyPoints = (e) => (e.segs ? [e, ...e.segs] : [e]);

export const touches = (e, x, y, pad) => bodyPoints(e).some((b) => Math.hypot(b.x - x, b.y - y) < (b.r || e.r) + pad);

export function cooldownReady(world, target, key, secs) {
  target.cooldowns ??= {};
  if ((target.cooldowns[key] || 0) > world.time) return false;
  target.cooldowns[key] = world.time + secs;
  return true;
}
