import { norm, dist } from "../lib/math.js";
import { damage } from "../sim/combat.js";
import { applyStatus } from "../sim/status.js";
import { has, isHostile, touches } from "../sim/entity.js";
import { spawnFire } from "./spells.js";

export const ELEMENTS = {
  fire: {
    col: "m",
    onHit(world, attacker, target, hit) {
      applyStatus(world, target, "burning", {
        dmg: hit.edmg,
        source: attacker,
      });
    },
    onImpact(world, source, x, y) {
      spawnFire(world, x, y, source);
    },
  },
  frost: {
    col: "c",
    onHit(world, attacker, target, hit) {
      applyStatus(world, target, "slowed");
      damage(world, target, {
        amount: hit.edmg,
        elem: "frost",
        color: "c",
        source: attacker,
      });
    },
  },
  shock: {
    col: "w",
    onHit(world, attacker, target, hit) {
      const { x, y } = target;
      let arc = null;
      for (const o of world.entities)
        if (
          o !== target &&
          has(o, "creature") &&
          isHostile(attacker, o) &&
          dist(o, target) < 2.5 &&
          world.los(x, y, o.x, o.y)
        )
          if (!arc || dist(o, target) < dist(arc, target)) arc = o;
      applyStatus(world, target, "shocked");
      damage(world, target, {
        amount: hit.edmg,
        elem: "shock",
        color: "w",
        source: attacker,
      });
      if (!arc) return;
      world.emit("beam", { x0: x, y0: y, x1: arc.x, y1: arc.y, life: 0.25 });
      applyStatus(world, arc, "shocked");
      damage(world, arc, {
        amount: hit.edmg,
        elem: "shock",
        dir: norm(arc.x - x, arc.y - y),
        kb: 1,
        color: "w",
        source: attacker,
      });
    },
  },

  wind: {
    col: "w",
    onHit(world, attacker, target, hit) {
      const dir =
        hit.dir?.x || hit.dir?.y
          ? hit.dir
          : norm(target.x - attacker.x, target.y - attacker.y);
      damage(world, target, {
        amount: hit.edmg,
        elem: "wind",
        dir,
        kb: 7,
        color: "w",
        source: attacker,
      });
    },
  },
  curse: {
    col: "m",
    onHit(world, attacker, target, hit) {
      applyStatus(world, target, "cursed", { source: attacker });
      damage(world, target, {
        amount: hit.edmg,
        elem: "curse",
        color: "m",
        source: attacker,
      });
    },
  },
  explosion: {
    col: "m",
    onHit(world, attacker, target, hit) {
      explode(world, attacker, target.x, target.y, hit.edmg);
    },
    onImpact(world, source, x, y, hit) {
      explode(world, source, x, y, hit.edmg);
    },
  },
};

export function explode(world, source, x, y, dmg, radius = 1.2) {
  world.spawn("explosion", x, y);
  world.emit("boom", { x, y, radius });
  for (const t of [...world.entities]) {
    if (!isHostile(source, t) || !touches(t, x, y, radius)) continue;
    damage(world, t, {
      amount: dmg,
      elem: "explosion",
      dir: norm(t.x - x, t.y - y),
      kb: 5,
      color: "m",
      source,
    });
  }
}
