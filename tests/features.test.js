import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle, press, pacify } from "./helpers.js";
import { loadContent } from "../src/sim/defs.js";
import { creature } from "../src/sim/templates.js";
import { makeItem, rollItem, addEffect } from "../src/sim/items.js";
import { applyStatus } from "../src/sim/status.js";
import { damage } from "../src/sim/combat.js";

const EAST = { x: 1, y: 0 };

loadContent({ entities: { dummy: creature({ team: "player", hp: 999, look: { sprite: "skel" } }) } });

const count = (w, event, pred) => {
  let n = 0;
  w.on(event, (ev) => pred(ev) && n++);
  return () => n;
};

test("an armed skeleton attacks more often than an unarmed one", () => {
  const hits = (base) => {
    const w = arena();
    w.player.team = "object";
    w.spawn("dummy", 30.5, 30.5);
    const s = w.spawn("skel", 31.2, 30.5);
    s.equip.main = makeItem(base);
    const n = count(w, "hit", (ev) => ev.attacker === s);
    run(w, 8, idle);
    return n();
  };
  const armed = hits("sword"),
    unarmed = hits("bite");
  assert.ok(armed > unarmed, `armed ${armed} vs unarmed ${unarmed}`);
});

test("cultists always carry a staff or a wand and never bite", () => {
  const w = arena({ depth: 3 });
  for (let i = 0; i < 50; i++) {
    const c = w.spawn("cult", 5 + (i % 30), 5 + Math.floor(i / 30)),
      it = c.equip.main;
    assert.ok(["staff", "magicwand", "bloodwand"].includes(it.base));
    assert.ok(it.spell || it.bolt);
  }
});

test("a cultist casts its staff at the player, paying mp", () => {
  const w = arena({ depth: 3 });
  const c = w.spawn("cult", 23.5, 20.5);
  c.equip.main = { ...makeItem("staff"), spell: "lightning", tick: 0.2 };
  c.mem.aggro = true;
  run(w, 2, idle);
  assert.ok(w.player.hp < w.player.maxhp, "player got zapped");
  assert.ok(c.mp < c.maxmp, "cultist spent mp");
});

const couple = (w, sexA, sexB) => {
  const a = pacify(w.spawn("slime", 10.5, 10.5));
  const b = pacify(w.spawn("slime", 12.5, 10.5));
  a.def = b.def = { ...a.def, brain: "melee" };
  a.sex = sexA;
  b.sex = sexB;
  w.player.team = "object";
  return [a, b];
};
const slimes = (w) => w.entities.filter((e) => e.type === "slime").length;

test("a horny monster finds a partner of the opposite sex and they have a baby", () => {
  const w = arena();
  const [a, b] = couple(w, "m", "f");
  applyStatus(w, a, "horny");
  run(w, 5, idle);
  assert.equal(slimes(w), 3);
  assert.ok(a.status.has("sated") && b.status.has("sated"));
  assert.ok(!a.status.has("horny"));
});

test("straight monsters of the same sex don't mate", () => {
  const w = arena();
  const [a] = couple(w, "m", "m");
  applyStatus(w, a, "horny");
  run(w, 5, idle);
  assert.equal(slimes(w), 2);
  assert.ok(!a.status.has("sated"));
});

test("gay monsters pair up with their own sex, but have no baby", () => {
  const w = arena();
  const [a, b] = couple(w, "f", "f");
  applyStatus(w, a, "gay");
  applyStatus(w, b, "gay");
  applyStatus(w, a, "horny");
  run(w, 5, idle);
  assert.ok(a.status.has("sated") && b.status.has("sated"), "they mated");
  assert.equal(slimes(w), 2);
});

test("hurting a mating monster breaks the couple up", () => {
  const w = arena();
  const [a, b] = couple(w, "m", "f");
  applyStatus(w, a, "horny");
  for (let i = 0; i < 200 && !a.mating; i++) w.step(1 / 30);
  assert.ok(a.mating, "started mating");
  damage(w, b, { amount: 1, source: w.player });
  assert.ok(!a.mating && !b.mating);
});

test("'of lust' makes monsters horny and 'of pride' makes them gay", () => {
  const w = arena();
  const it = makeItem("sword");
  addEffect(it, "of lust");
  addEffect(it, "of pride");
  w.player.equip.main = it;
  w.player.atk = -100;
  const b = pacify(w.spawn("brute", 21.4, 20.5));
  run(w, 0.1, press(EAST));
  assert.ok(b.status.has("horny") && b.status.has("gay"));
});

test("lust and pride don't work on the player", () => {
  const w = arena();
  applyStatus(w, w.player, "horny");
  applyStatus(w, w.player, "gay");
  assert.equal(w.player.status.size, 0);
});

test("the same effect twice stacks its power", () => {
  const it = makeItem("sword");
  addEffect(it, "of ash");
  const first = it.effects[0].power;
  addEffect(it, "of ash");
  assert.equal(it.effects.length, 1);
  assert.ok(it.effects[0].power > first);
});

test("rolled weapons and shields can carry several effects", () => {
  for (const base of ["sword", "shield"]) {
    const counts = Array.from({ length: 2000 }, () => rollItem(3, base).effects.length);
    assert.ok(counts.some((n) => n >= 2), `${base}: some items have 2+ effects`);
    assert.ok(Math.max(...counts) <= 3);
  }
});

test("a monster's weapon applies all of its effects to the player", () => {
  const w = arena();
  const s = w.spawn("skel", 21.3, 20.5);
  s.equip.main = makeItem("sword");
  s.equip.main.effects.push({ id: "of ash", power: 1 }, { id: "of frost", power: 1 });
  s.mem.aggro = true;
  run(w, 2, idle);
  assert.ok(w.player.status.has("burning") && w.player.status.has("slowed"));
});

test("blocking with a shield of lust makes the attacker horny", () => {
  const w = arena();
  const p = w.player;
  p.equip.off = makeItem("shield");
  addEffect(p.equip.off, "of lust");
  const slime = w.spawn("slime", 21.2, 20.5);
  slime.mem.aggro = true;
  run(w, 3, { move: { x: 0, y: 0 }, aim: EAST, off: { pressed: false, held: true } });
  assert.equal(p.hp, p.maxhp);
  assert.ok(slime.status.has("horny"));
});

test("blocking with a shield of ash sets the attacker on fire, even at range", () => {
  const w = arena();
  const p = w.player;
  p.equip.off = makeItem("shield");
  p.equip.off.effects.push({ id: "of ash", power: 1 });
  const c = w.spawn("cult", 24.5, 20.5);
  c.equip.main = { ...makeItem("staff"), spell: "lightning", tick: 0.2 };
  c.mem.aggro = true;
  let burned = false;
  w.on("status:applied", (ev) => ev.target === c && ev.id === "burning" && (burned = true));
  run(w, 1.5, { move: { x: 0, y: 0 }, aim: EAST, off: { pressed: false, held: true } });
  assert.ok(burned);
});

test("a hive stays put and broods bees up to its cap once it spots a foe", () => {
  const w = arena();
  w.on("spawn", ({ entity }) => entity.type === "bee" && pacify(entity));
  const h = w.spawn("hive", 24.5, 20.5);
  run(w, 20, idle);
  const bees = w.query((e) => e.type === "bee" && e.owner === h);
  assert.equal(bees.length, h.def.minions.max);
  assert.ok(Math.hypot(h.x - 24.5, h.y - 20.5) < 0.01);
  assert.ok(bees.every((b) => b.team === "monster" && !b.sex));
});

test("a hive never attacks", () => {
  const w = arena();
  w.spawn("hive", 21.2, 20.5);
  w.on("spawn", ({ entity }) => entity.type === "bee" && w.remove(entity));
  run(w, 5, idle);
  assert.equal(w.player.hp, w.player.maxhp);
});

test("a dying fleshking poisons everything near it, its own minions included", () => {
  const w = arena();
  const k = pacify(w.spawn("fleshking", 21.6, 20.5));
  const f = pacify(w.spawn("fleshling", 22.6, 21.2));
  damage(w, k, { amount: 999 });
  run(w, 0.5, idle);
  assert.ok(w.player.status.has("poisoned"));
  assert.ok(f.status.has("poisoned") || f.dead);
  run(w, 5, idle);
  assert.ok(w.player.hp < w.player.maxhp);
  assert.equal(w.query((e) => e.type === "poisonflame").length, 0);
});
