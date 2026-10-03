import { on } from "../../sim/rules.js";
import { alive, has } from "../../sim/entity.js";
import { applyStatus } from "../../sim/status.js";
import { dist } from "../../lib/math.js";

const INFECT = 0.5;

const cursed = (e) => !!e?.status?.has("cursed");

function infect(world, from, to) {
  if (cursed(to) || Math.random() >= INFECT) return;
  applyStatus(world, to, "cursed", { source: from });
}

on("damage", (ev) => {
  const s = ev.source?.status?.get("cursed");
  if (s && ev.elem !== "curse") ev.amount = Math.max(1, Math.round(ev.amount * s.def.weaken));
});

on("hit", ({ attacker, target }, world) => {
  if (cursed(attacker) && attacker !== target) infect(world, attacker, target);
});

on("melee", ({ actor: a, reach }, world) => {
  if (!cursed(a)) return;
  for (const o of world.entities)
    if (o !== a && alive(o) && has(o, "creature") && o.team === a.team && dist(a, o) < a.r + o.r + reach)
      infect(world, a, o);
});
