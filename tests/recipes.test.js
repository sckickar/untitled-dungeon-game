import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle, press, pacify } from "./helpers.js";
import { loadContent, terrainIndex } from "../src/sim/defs.js";
import { on } from "../src/sim/rules.js";
import { has, isHostile } from "../src/sim/entity.js";
import { applyStatus } from "../src/sim/status.js";
import { damage } from "../src/sim/combat.js";
import { makeItem } from "../src/sim/items.js";
import { creature } from "../src/sim/templates.js";
import { norm, dist } from "../src/lib/math.js";

const EAST = { x: 1, y: 0 };

loadContent({
  statuses: {
    wet: { duration: 4, tags: ["conductive"], look: { blink: "c" } },
  },
  terrain: {
    water: {
      solid: false,
      onStand(world, e) {
        if (!has(e, "flying")) applyStatus(world, e, "wet");
      },
      look: { tile: () => "stone/fl0" },
    },
  },
});
on("damage", (ev) => {
  if (ev.elem === "shock" && has(ev.target, "conductive")) ev.amount *= 2;
});
on("status:apply", (ev) => {
  if (ev.id === "burning" && has(ev.target, "conductive")) ev.cancel = true;
});

test("recipe: standing in water makes you wet; flyers stay dry", () => {
  const w = arena();
  w.setTile(22, 20, terrainIndex("water"));
  const slime = pacify(w.spawn("slime", 22.5, 20.5));
  const bat = pacify(w.spawn("bat", 22.5, 20.6));
  run(w, 0.2, idle);
  assert.ok(slime.status.has("wet"));
  assert.ok(!bat.status.has("wet"));
});

test("recipe: wet targets take double shock damage and can't burn", () => {
  const w = arena();
  const b = pacify(w.spawn("brute", 22, 20));
  applyStatus(w, b, "wet");
  damage(w, b, { amount: 3, elem: "shock", source: w.player });
  assert.equal(b.hp, b.maxhp - 6);
  applyStatus(w, b, "burning", { dmg: 1, source: w.player });
  assert.ok(!b.status.has("burning"));
});

loadContent({
  prefixes: {
    forking: {
      not: ["shield"],
      onHit(world, attacker, target, hit) {
        const near = world.entities
          .filter((o) => o !== target && isHostile(attacker, o) && dist(o, target) < 3)
          .slice(0, 2);
        for (const o of near) {
          world.emit("beam", { x0: target.x, y0: target.y, x1: o.x, y1: o.y, life: 0.12 });
          damage(world, o, { amount: 2, elem: "shock", color: "w", dir: norm(o.x - target.x, o.y - target.y), source: attacker });
        }
      },
    },
  },
});

test("recipe: a 'forking' prefix chains every hit to nearby enemies", () => {
  const w = arena();
  w.player.equip.main = { ...makeItem("sword"), prefix: "forking" };
  pacify(w.spawn("brute", 21.4, 20.5));
  const b2 = pacify(w.spawn("brute", 22.8, 20.5));
  const b3 = pacify(w.spawn("brute", 22.4, 21.8));
  run(w, 0.1, press(EAST));
  assert.equal(b2.hp, b2.maxhp - 2);
  assert.equal(b3.hp, b3.maxhp - 2);
});

loadContent({
  entities: {
    sellsword: creature({
      team: "player",
      brain: "melee",
      hp: 20,
      atk: 3,
      spd: 2.4,
      equip: { main: "sword" },
      look: { sprite: "skel", anim: "skel", outline: "c", blood: "w", corpse: "c_skel", gibs: 7 },
    }),
    stormcaller: creature({
      team: "monster",
      brain: "caster",
      hp: 8,
      spd: 1.3,
      equip: { main: "staff" },
      look: { sprite: "cult", anim: "cult", outline: "m", blood: "m", corpse: "c_cult", gibs: 7 },
    }),
  },
});

test("recipe: a companion on the player's team hunts monsters", () => {
  const w = arena();
  const ally = w.spawn("sellsword", 20.5, 21.5);
  const slime = w.spawn("slime", 24.5, 21.5);
  run(w, 6, idle);
  assert.ok(slime.removed, "slime killed");
  assert.ok(!ally.dead);
});

test("recipe: a monster holding a staff casts at the player", () => {
  const w = arena();
  w.spawn("stormcaller", 24.5, 20.5).mem.aggro = true;
  run(w, 2, idle);
  assert.ok(w.player.hp < w.player.maxhp);
});

test("recipe: charming a monster is just changing its team", () => {
  const w = arena();
  const charmed = w.spawn("brute", 24.5, 20.5);
  const victim = w.spawn("slime", 25.5, 20.5);
  charmed.team = "player";
  run(w, 4, idle);
  assert.ok(victim.removed, "the charmed brute killed its old ally");
  assert.equal(w.player.hp, w.player.maxhp, "and left the player alone");
});

on("status:apply", (ev) => {
  if (ev.id === "burning" && has(ev.target, "undead")) ev.cancel = true;
});

test("recipe: a rule can cancel a status by tag", () => {
  const w = arena();
  const skel = pacify(w.spawn("skel", 22, 20));
  applyStatus(w, skel, "burning", { dmg: 1, source: w.player });
  assert.ok(!skel.status.has("burning"));
});
