import { MW } from "../config.js";
import { rnd, dist, norm } from "../lib/math.js";
import { alive } from "./entity.js";

export const RISE_T = 0.9;
const WAKE_DIST = 2.5,
  STAGGER = 0.6;

export function bury(e, trap) {
  e.buried = { trap, team: e.team, sex: e.sex };
  e.team = "buried";
  e.sex = null;
  e.tags.delete("body");
  trap.mobs.push(e);
}

export function spring(world, trap) {
  if (trap.sprung) return;
  trap.sprung = true;
  for (const m of trap.mobs) if (m.buried) m.riseIn = rnd(0, STAGGER);
  world.say("the ground stirs...", 1.5);
  world.emit("trapSprung", { trap });
}

function emerge(world, e) {
  const B = e.buried;
  e.buried = null;
  e.team = B.team;
  e.sex = B.sex;
  e.tags.add("body");
  e.rise = 0;
  const p = world.player;
  if (alive(p)) {
    e.mem.target = p;
    e.mem.aggro = true;
  }
  world.emit("emerge", { actor: e });
}

// Runs before the brain. Returns an intent while the creature is underground or still climbing out.
export function tickBuried(world, e, dt) {
  if (e.buried) {
    e.invuln = 0.5;
    const trap = e.buried.trap,
      p = world.player;
    if (!trap.sprung && alive(p) && (trap.tiles.has(Math.floor(p.y) * MW + Math.floor(p.x)) || dist(p, e) < WAKE_DIST))
      spring(world, trap);
    if (trap.sprung && (e.riseIn -= dt) <= 0) emerge(world, e);
    return {};
  }
  if (e.rise != null && e.rise < 1) {
    e.rise = Math.min(1, e.rise + dt / RISE_T);
    const t = e.mem.target;
    return { aim: alive(t) ? norm(t.x - e.x, t.y - e.y) : null };
  }
  return null;
}
