import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle, press } from "./helpers.js";
import { MW, MH } from "../src/config.js";
import { World } from "../src/sim/world.js";
import { generateLevel } from "../src/sim/level.js";
import { bfs } from "../src/sim/nav.js";
import { terrainIndex } from "../src/sim/defs.js";
import { alive } from "../src/sim/entity.js";
import { PAGES, PAGE_ORDER, signAt } from "../src/content/tutorial.js";

const EAST = { x: 1, y: 0 };

const tutorial = () => {
  const w = new World({ depth: 0 });
  generateLevel(w);
  return w;
};

test("runs start on the hand-drawn safe floor; B1 is back to stone", () => {
  const w = tutorial();
  assert.equal(w.biome, "safe");
  assert.ok(w.safe);
  const b1 = new World({ depth: 1 });
  generateLevel(b1);
  assert.equal(b1.biome, "stone");
  assert.ok(!b1.safe);
});

test("the safe floor is fully connected, from the player to the stairs", () => {
  const w = tutorial(),
    p = w.player,
    d = bfs(w, Math.floor(p.x), Math.floor(p.y));
  for (let i = 0; i < MW * MH; i++) {
    const x = i % MW,
      y = (i / MW) | 0;
    if (w.solid(x, y)) continue;
    assert.ok(x > 0 && y > 0 && x < MW - 1 && y < MH - 1, `floor on the map edge at ${x},${y}`);
    assert.ok(d[i] >= 0, `unreachable floor at ${x},${y}`);
  }
  const stairs = w.entities.find((e) => e.type === "stairs");
  assert.ok(d[Math.floor(stairs.y) * MW + Math.floor(stairs.x)] > 0);
});

test("the safe floor has no monsters, no sanctum, and only its own hireling", () => {
  for (let n = 0; n < 10; n++) {
    const w = tutorial();
    run(w, 0.5, idle);
    assert.ok(!w.entities.some((e) => e.team === "monster"));
    assert.ok(!w.sanctum && !w.entities.some((e) => e.type === "merchant"));
    const npcs = w.entities.filter((e) => e.type === "npc");
    assert.equal(npcs.length, 1);
    assert.equal(npcs[0].mode, "idle");
    assert.ok(!w.cleared, "no 'floor clear' on a floor that never had monsters");
  }
});

test("every page has a sign, in order, and every sign has a page", () => {
  const w = tutorial(),
    signs = w.entities.filter((e) => e.type === "signpost");
  assert.equal(signs.length, PAGE_ORDER.length);
  for (const id of PAGE_ORDER) assert.ok(PAGES[id]?.items?.length, `page ${id} has items`);
  assert.deepEqual(new Set(signs.map((s) => s.page)), new Set(PAGE_ORDER.map((id) => PAGES[id])));
});

test("the controls sign is read from where the player starts", () => {
  const w = tutorial();
  assert.equal(signAt(w)?.page, PAGES.controls);
  w.player.x += 6;
  assert.notEqual(signAt(w)?.page, PAGES.controls);
});

test("the armory's gear is laid flat, with ammo for the ranged weapons", () => {
  const w = tutorial(),
    bases = w.entities.filter((e) => e.type === "item").map((e) => e.item.base);
  for (const b of ["spear", "shield", "bow", "throwingknife", "staff", "magicwand"]) assert.ok(bases.includes(b), b);
  assert.ok(w.entities.some((e) => e.type === "arrows") && w.entities.some((e) => e.type === "knives"));
  assert.ok(w.entities.filter((e) => e.type === "item").every((e) => e.z === 0 && e.vz === 0));
});

test("the coins on the safe floor cover the tutorial hireling", () => {
  const w = tutorial(),
    npc = w.entities.find((e) => e.type === "npc"),
    coins = w.entities.filter((e) => e.type === "coin").length;
  assert.ok(coins >= npc.price, `${coins} coins (at least 1g each) for ${npc.price}g`);
});

test("a training dummy takes hits forever", () => {
  const w = arena(),
    dummy = w.spawn("trainingdummy", 21.3, 20.5);
  let hits = 0;
  w.on("damaged", ({ target }) => target === dummy && hits++);
  run(w, 4, (i) => (i % 12 === 0 ? press(EAST) : idle));
  assert.ok(hits >= 5, `${hits} hits landed`);
  assert.ok(alive(dummy));
  assert.equal(dummy.hp, dummy.maxhp);
});

test("hirelings and monsters fight it out with no player in the world", () => {
  const w = new World({ depth: 2 }),
    FLOOR = terrainIndex("floor");
  w.tiles.fill(terrainIndex("wall"));
  for (let y = 17; y < 27; y++) for (let x = 17; x < 27; x++) w.setTile(x, y, FLOOR);
  for (let i = 0; i < 3; i++) w.spawn("npc", 18 + i, 18, { mode: "hunt" });
  for (const type of ["slime", "bat", "skel", "snake"]) w.spawn(type, 24, 24);
  const deaths = [];
  w.on("death", ({ target }) => deaths.push(target.type));
  run(w, 30);
  assert.ok(deaths.length > 0, "somebody died");
});
