import {
  perceive,
  chase,
  wander,
  weave,
  slither,
  inReach,
  attackRange,
  hasMana,
  isSupport,
  supportIntent,
  PRESS,
} from "../sim/ai.js";
import { court } from "./rules/breeding.js";
import { alive } from "../sim/entity.js";
import { rnd, dist, norm } from "../lib/math.js";
import { countOf } from "../sim/items.js";
import { defs } from "../sim/defs.js";

const AUTO_MANA = 0.04;

function brood(world, e, { type, max }) {
  if (world.query((m) => m.owner === e && alive(m)).length >= max) return;
  const a = rnd(0, 6.283),
    m = world.spawn(type, e.x + Math.cos(a) * 0.05, e.y + Math.sin(a) * 0.05);
  Object.assign(m, { owner: e, team: e.team, sex: null });
  m.mem.target = e.mem.target;
  m.mem.aggro = true;
  world.emit("brood", { parent: e, child: m });
}

function broodTick(world, e, dt) {
  const M = e.def.minions;
  e.broodT = (e.broodT ?? rnd(0.3, 1)) - dt;
  if (e.broodT > 0) return false;
  e.broodT = M.every * rnd(0.85, 1.15);
  brood(world, e, M);
  return true;
}

function useAbility(world, e, dt) {
  const A = e.def.ability,
    t = e.mem.target;
  e.abilityT = (e.abilityT ?? rnd(1.5, A.every)) - dt;
  if (e.abilityT > 0 || !e.mem.aggro || !alive(t) || e.windT > 0) return;
  if (dist(e, t) > A.range || !world.los(e.x, e.y, t.x, t.y)) return;
  e.abilityT = A.every * rnd(0.85, 1.15);
  e.castT = 0.3;
  defs.spells[A.spell].onCast(world, e, { atk: 0 }, "ability", norm(t.x - e.x, t.y - e.y));
}

function melee(world, e, dt) {
  const love = court(world, e, dt);
  if (love) return love;
  const seen = perceive(world, e);
  if (e.def.ability) useAbility(world, e, dt);
  if (e.windT > 0) return { aim: seen?.dir };
  if (!seen || !e.mem.aggro) return { move: wander(e, dt) };
  return {
    move: chase(world, e, seen),
    aim: seen.dir,
    main: inReach(e, seen) ? PRESS : null,
  };
}

function caster(world, e, dt) {
  const love = court(world, e, dt);
  if (love) return love;
  const seen = perceive(world, e);
  if (e.windT > 0) return { aim: seen?.dir };
  if (!seen || !e.mem.aggro) return { move: wander(e, dt) };
  const u = seen.dir,
    range = attackRange(e) || 5;
  let move;
  if (seen.dist < range * 0.55 && seen.see) move = { x: -u.x, y: -u.y };
  else if (seen.dist > range * 0.95 || !seen.see)
    move = chase(world, e, seen);
  else {
    const s = Math.sin(e.t * 1.3 + e.seed) > 0 ? 1 : -1;
    move = { x: -u.y * s * 0.6, y: u.x * s * 0.6 };
  }
  if (isSupport(e)) {
    const s = supportIntent(world, e);
    return s ? { ...s, move: s.move ?? move } : { move, aim: u };
  }
  return {
    move,
    aim: u,
    main: seen.see && seen.dist < range && hasMana(e) ? PRESS : null,
  };
}

export const BRAINS = {
  player(world, e) {
    if (!world.input || world.descending || world.cutscene) return null;

    if (
      !world.input.use &&
      e.maxmp &&
      e.mp < e.maxmp * AUTO_MANA &&
      countOf(e, "manapotion") > 0
    )
      return { ...world.input, use: "manapotion" };
    return world.input;
  },

  melee,

  weaver(world, e, dt) {
    const intent = melee(world, e, dt);
    if (e.mem.aggro && intent.move) intent.move = weave(e, intent.move);
    return intent;
  },

  serpent(world, e, dt) {
    const intent = melee(world, e, dt);
    if (intent.move) intent.move = slither(e, intent.move, dt);
    return intent;
  },

  spawner(world, e, dt) {
    const M = e.def.minions,
      seen = perceive(world, e);
    if (!seen || !e.mem.aggro)
      return e.def.spd ? { move: wander(e, dt) } : null;
    broodTick(world, e, dt);
    if (!e.def.spd) return null;
    return {
      move: seen.dist > (M.keepAway ?? 0) ? chase(world, e, seen) : null,
      aim: seen.dir,
    };
  },

  caster,

  summoner(world, e, dt) {
    const intent = caster(world, e, dt);
    if (e.mem.aggro && !e.mating && broodTick(world, e, dt)) e.castT = 0.4;
    return intent;
  },
};
