import { defs } from "./defs.js";
import { alive, has } from "./entity.js";

const defaultCanAffect = (e) => has(e, "creature");

export function applyStatus(world, e, id, opts = {}) {
  const def = defs.statuses[id];
  if (!def) throw new Error(`applyStatus: unknown status "${id}"`);
  if (!alive(e) || !(def.canAffect || defaultCanAffect)(e)) return null;
  const ev = world.emit("status:apply", { target: e, id, opts, cancel: false });
  if (ev.cancel) return null;
  const fresh = !e.status.has(id);
  const s = { id, def, ...ev.opts, t: ev.opts.duration ?? def.duration, nextTick: def.tick ?? 0 };
  e.status.set(id, s);
  if (fresh) def.onApply?.(world, e, s);
  world.emit("status:applied", { target: e, id, status: s, fresh });
  return s;
}

export function removeStatus(world, e, id) {
  const s = e.status.get(id);
  if (!s) return;
  e.status.delete(id);
  s.def.onExpire?.(world, e, s);
  world.emit("status:removed", { target: e, id, status: s });
}

export function tickStatuses(world, dt) {
  for (const e of world.entities) {
    if (!e.status.size || !alive(e)) continue;
    for (const s of [...e.status.values()]) {
      s.t -= dt;
      if (s.def.tick) {
        s.nextTick -= dt;
        if (s.nextTick <= 0) {
          s.nextTick = s.def.tick;
          s.def.onTick(world, e, s);
        }
      }
      if (!alive(e)) break;
      if (s.t <= 0 && e.status.get(s.id) === s) removeStatus(world, e, s.id);
    }
  }
}

export function statusSpeed(e) {
  let m = 1;
  for (const s of e.status.values()) if (s.def.speed != null) m *= s.def.speed;
  return m;
}
