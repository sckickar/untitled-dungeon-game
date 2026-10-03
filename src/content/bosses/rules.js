import { on } from "../../sim/rules.js";
import { alive, cooldownReady } from "../../sim/entity.js";
import { damage } from "../../sim/combat.js";
import { applyStatus } from "../../sim/status.js";
import { dist } from "../../lib/math.js";
import { setState } from "./common.js";

const SEVER = 0.08;
const CHAIN = { hops: 4, range: 4.5, share: 0.6 };

const shielded = (b, source) => source?.boss === b || b.state !== "fight" || b.immune > 0;

on(
  "damage",
  (ev, world) => {
    const t = ev.target,
      b = t.boss;
    if (!b || !shielded(b, ev.source)) return;
    ev.cancel = true;
    if (b.immune > 0 && ev.source?.boss !== b && cooldownReady(world, t, "immune", 0.5))
      world.emit("popup", { x: t.x, y: t.y, z: 16, text: "immune", color: "c" });
  },
  { priority: 10 },
);

on(
  "status:apply",
  (ev) => {
    const b = ev.target.boss;
    if (b && shielded(b, ev.opts?.source)) ev.cancel = true;
  },
  { priority: 10 },
);

function conduct(world, source, from, amount) {
  if (world.conducting || !amount) return;
  world.conducting = true;
  try {
    const done = new Set([from]);
    let at = from;
    for (let i = 0; i < CHAIN.hops; i++) {
      let next = null;
      for (const o of from.boss.parts)
        if (!done.has(o) && alive(o) && dist(o, at) < CHAIN.range && (!next || dist(o, at) < dist(next, at))) next = o;
      if (!next) break;
      done.add(next);
      world.emit("beam", { x0: at.x, y0: at.y, x1: next.x, y1: next.y, life: 0.2 });
      if (cooldownReady(world, next, "chain", 0.2)) {
        applyStatus(world, next, "shocked");
        damage(world, next, { amount: Math.max(1, Math.round(amount * CHAIN.share)), elem: "chain", color: "c", source });
      }
      at = next;
    }
  } finally {
    world.conducting = false;
  }
}

on("damaged", (ev, world) => {
  if (ev.target.boss && ev.elem === "shock") conduct(world, ev.source, ev.target, ev.amount);
});
on("hit", (ev, world) => {
  if (ev.target.boss && ev.item?.spell === "lightning") conduct(world, ev.attacker, ev.target, ev.dealt);
});

on("death", ({ target: e, source }, world) => {
  const b = e.boss;
  if (!b) return;
  if (e === b.core) {
    b.attack = null;
    b.tell = 0;
    b.immune = 0;
    world.cutscene = null;
    setState(world, b, "dying");
    for (const o of b.parts) if (o !== e && alive(o)) o.dead = true;
    return;
  }
  world.remove(e);
  if (e.def.minor || !alive(b.core)) return;
  world.say(e.def.name + " severed", 1.5);
  damage(world, b.core, {
    amount: Math.max(1, Math.round(b.core.maxhp * SEVER)),
    color: "m",
    source,
  });
});
