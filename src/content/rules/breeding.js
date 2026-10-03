import { on } from "../../sim/rules.js";
import { alive, has } from "../../sim/entity.js";
import { nearest, SEEK_EVERY } from "../../sim/ai.js";
import { applyStatus, removeStatus } from "../../sim/status.js";
import { norm, dist, rnd } from "../../lib/math.js";

const HEAT_EVERY = 120;
const SEARCH = 8;
const MATING_TIME = 2;
const MAX_CREATURES = 60;

const attractedTo = (a, b) => a.type === b.type && (has(a, "samesex") ? a.sex === b.sex : a.sex !== b.sex);
const available = (b) => alive(b) && b.sex && !b.mating && !has(b, "sated");

export function court(world, e, dt) {
  const m = e.mating;
  if (m) {
    if (!alive(m.partner)) {
      e.mating = null;
      return null;
    }
    m.t -= dt;
    if (m.lead && m.t <= 0) finish(world, e, m.partner);
    return { aim: norm(m.partner.x - e.x, m.partner.y - e.y) };
  }
  if (!e.sex || !has(e, "horny")) return null;
  if (world.time >= (e.courtAt ?? 0)) {
    e.courtAt = world.time + SEEK_EVERY * rnd(0.8, 1.2);
    e.courtee = nearest(
      world,
      e,
      (b) => b !== e && available(b) && attractedTo(e, b) && attractedTo(b, e) && dist(e, b) < SEARCH,
    );
  }
  const partner = e.courtee;
  if (!partner || !available(partner) || dist(e, partner) >= SEARCH) return null;
  if (dist(e, partner) < e.r + partner.r + 0.15) {
    e.mating = { partner, t: MATING_TIME, lead: true };
    partner.mating = { partner: e, t: MATING_TIME, lead: false };
    world.emit("mate", { a: e, b: partner });
    return {};
  }
  return { move: norm(partner.x - e.x, partner.y - e.y) };
}

function finish(world, a, b) {
  a.mating = b.mating = null;
  for (const p of [a, b]) {
    removeStatus(world, p, "horny");
    applyStatus(world, p, "sated");
  }
  if (a.sex === b.sex) return;
  if (world.query((e) => e.tags.has("creature") && !e.dead).length >= MAX_CREATURES) return;
  const child = world.spawn(a.type, (a.x + b.x) / 2, (a.y + b.y) / 2);
  child.team = a.team;
  applyStatus(world, child, "sated");
  world.emit("born", { child, parents: [a, b] });
}

on("damaged", ({ target }) => {
  const m = target.mating;
  if (!m) return;
  target.mating = null;
  if (m.partner.mating?.partner === target) m.partner.mating = null;
});

on("tick", ({ dt }, world) => {
  for (const e of world.entities) {
    if (!e.sex || !alive(e) || e.mem?.aggro || e.mating || has(e, "horny") || has(e, "sated")) continue;
    if (Math.random() < dt / HEAT_EVERY) applyStatus(world, e, "horny");
  }
});
