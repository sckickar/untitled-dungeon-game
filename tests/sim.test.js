import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle, press, pacify } from "./helpers.js";
import { MW } from "../src/config.js";
import { World } from "../src/sim/world.js";
import { generateLevel } from "../src/sim/level.js";
import { bfs } from "../src/sim/nav.js";
import { makeItem, addEffect } from "../src/sim/items.js";
import { loadContent } from "../src/sim/defs.js";
import { creature } from "../src/sim/templates.js";
import { snapshot } from "../src/sim/actor.js";
import { spawnFire } from "../src/content/spells.js";

const EAST = { x: 1, y: 0 };

loadContent({
  entities: {
    archer: creature({ brain: "caster", hp: 8, atk: 3, equip: { main: "bow" }, look: { sprite: "cult" } }),
  },
});

test("a sword kills a slime and the kill is credited", () => {
  const w = arena();
  const s = pacify(w.spawn("slime", 21.4, 20.5));
  run(w, 2, (i) => (i % 12 === 0 ? press(EAST) : idle));
  assert.ok(s.removed);
  assert.equal(w.player.kills, 1);
  assert.equal(w.player.xp, 2);
});

test("a fire suffix sets the target burning, and burning ticks damage", () => {
  const w = arena();
  w.player.equip.main = addEffect(makeItem("sword"), "of ash");
  const b = pacify(w.spawn("brute", 21.4, 20.5));
  run(w, 0.1, press(EAST));
  assert.ok(b.status.has("burning"));
  const hp = b.hp;
  run(w, 3, idle);
  assert.ok(!b.status.has("burning"), "burning wears off");
  assert.ok(hp - b.hp >= 3, `took ${hp - b.hp} burn damage`);
});

test("shock arcs to a second nearby enemy", () => {
  const w = arena();
  w.player.equip.main = makeItem("sword");
  w.player.equip.main.effects.push({ id: "of sparks", power: 1 });
  pacify(w.spawn("brute", 21.4, 20.5));
  const second = pacify(w.spawn("brute", 22.6, 21));
  run(w, 0.1, press(EAST));
  assert.equal(second.hp, second.maxhp - 1);
});

test("monsters notice the player, close in, and hurt them", () => {
  const w = arena();
  w.spawn("slime", 23.5, 20.5);
  run(w, 4, idle);
  assert.ok(w.player.hp < w.player.maxhp);
});

test("monster projectiles hit the player but not other monsters", () => {
  const w = arena();
  const archer = w.spawn("archer", 25.5, 20.5);
  const bystander = pacify(w.spawn("brute", 23.5, 20.5));
  archer.mem.aggro = true;
  run(w, 6, idle);
  assert.equal(bystander.hp, bystander.maxhp);
  assert.ok(w.player.hp < w.player.maxhp);
});

test("a raised shield blocks a projectile and loses durability", () => {
  const w = arena();
  const p = w.player;
  p.equip.off = makeItem("shield");
  const dur = p.equip.off.dur;
  w.spawn("archer", 24.5, 20.5).mem.aggro = true;
  run(w, 1.5, { move: { x: 0, y: 0 }, aim: EAST, off: { pressed: false, held: true } });
  assert.equal(p.hp, p.maxhp);
  assert.ok(p.equip.off.dur < dur);
});

test("the player's own fire doesn't hurt the player", () => {
  const w = arena();
  spawnFire(w, w.player.x, w.player.y, w.player);
  run(w, 2, idle);
  assert.equal(w.player.hp, w.player.maxhp);
});

test("levels generate at every depth with reachable stairs", () => {
  for (let depth = 1; depth <= 8; depth++)
    for (let n = 0; n < 10; n++) {
      const w = new World({ depth });
      generateLevel(w);
      const p = w.player,
        s = w.entities.find((e) => e.type === "stairs") ?? w.boss;
      assert.ok(!w.solidAt(p.x, p.y));
      const d = bfs(w, Math.floor(p.x), Math.floor(p.y));
      assert.ok(d[Math.floor(s.y) * MW + Math.floor(s.x)] > 0, "stairs reachable");
      run(w, 1, idle);
    }
});

test("the player's state carries to the next floor", () => {
  const w = arena();
  w.player.gold = 12;
  w.player.equip.off = makeItem("shield");
  const next = new World({ depth: 2 });
  generateLevel(next, { carry: snapshot(w.player) });
  assert.equal(next.player.gold, 12);
  assert.equal(next.player.equip.off.base, "shield");
  assert.notEqual(next.player.equip, w.player.equip, "copied, not shared");
});

test("hives and fleshkings are rare in the stone biome, common in the flesh biome, and capped per floor", () => {
  const spawners = (depth) => {
    let n = 0;
    for (let i = 0; i < 40; i++) {
      const w = new World({ depth });
      generateLevel(w);
      const hives = w.query((e) => e.type === "hive").length,
        kings = w.query((e) => e.type === "fleshking").length;
      assert.ok(hives <= 2 && kings <= 2);
      n += hives + kings;
    }
    return n / 40;
  };
  const stone = spawners(4),
    flesh = spawners(12);
  assert.ok(stone < 1, `stone: ${stone} per floor`);
  assert.ok(flesh > 2.5, `flesh: ${flesh} per floor`);
});
