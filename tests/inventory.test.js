import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { arena } from "./helpers.js";
import { defs } from "../src/sim/defs.js";
import { makeItem, addStack, countOf, valueOf, sellPrice } from "../src/sim/items.js";
import { GRID_W, makeGrid, sizeOf, itemAt, findSpot, stow, canFit } from "../src/sim/grid.js";
import { CELL } from "../src/scenes/layout.js";
import { move } from "../src/scenes/inventory.js";
import { openTalk, chooseTalk } from "../src/content/npcs.js";

const pngSize = (key) => {
  const b = readFileSync(new URL(`../assets/sprites/weapons/${key}.png`, import.meta.url));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

test("every weapon's footprint holds its sprite at 1:1", () => {
  for (const [base, W] of Object.entries(defs.weapons)) {
    if (W.natural) continue;
    const [w, h] = sizeOf({ base });
    for (const spr of new Set([W.spr, ...(W.variants || []).map((v) => v.spr)])) {
      const [sw, sh] = pngSize(spr);
      assert.ok(sw <= w * CELL - 1 && sh <= h * CELL - 1, `${base} (${spr} ${sw}x${sh}) fits ${w}x${h}`);
    }
  }
});

test("a big item covers its whole footprint and blocks what overlaps it", () => {
  const g = makeGrid(),
    wand = makeItem("magicwand");
  assert.deepEqual(sizeOf(wand), [2, 2]);
  g[GRID_W + 1] = wand;
  assert.equal(itemAt(g, 2, 2), GRID_W + 1);
  assert.equal(itemAt(g, 3, 2), -1);
  assert.ok(!canFit(g, makeItem("sword"), 2 * GRID_W + 2));
  assert.ok(!canFit(g, makeItem("staff"), 2 * GRID_W), "a 2x1 staff clips the wand's corner");
  assert.ok(!canFit(g, makeItem("staff"), GRID_W - 1), "nothing hangs off the right edge");
});

test("the bag fills top to bottom, then left to right", () => {
  const g = makeGrid();
  stow(g, makeItem("sword"));
  assert.equal(findSpot(g, makeItem("sword")), GRID_W);
  assert.equal(findSpot(g, makeItem("bow")), GRID_W, "a 1x2 bow still fits below");
  assert.equal(findSpot(g, makeItem("scythe")), GRID_W, "a 2x2 scythe tucks under it too");
  g[GRID_W] = makeItem("dagger");
  assert.equal(findSpot(g, makeItem("scythe")), 2 * GRID_W, "then lower down");
});

test("stacks top up, then spill into free cells, and stop when the bag is full", () => {
  const w = arena(),
    p = w.player;
  p.bag.fill(null);
  assert.equal(addStack(p, "arrow", 150), 0);
  assert.equal(countOf(p, "arrow"), 150);
  for (let i = 0; i < p.bag.length; i++) if (!p.bag[i]) p.bag[i] = makeItem("sword");
  assert.equal(addStack(p, "arrow", 60), 12, "tops up to 99 then has nowhere to go");
});

function shop() {
  const w = arena({ depth: 3 }),
    p = w.player,
    m = w.spawn("merchant", 21.5, 20.5);
  p.bag.fill(null);
  return { w, p, m, scene: { world: w, trade: m, invOpen: true } };
}

test("the merchant stocks gear and opens a trade from the talk menu", () => {
  const { w, m } = shop();
  assert.ok(m.stock.some((it) => it && defs.weapons[it.base]));
  assert.ok(m.stock.some((it) => it?.base === "potion"));
  const t = openTalk(w, m);
  assert.equal(t.options[0].id, "trade");
  assert.ok(chooseTalk(w, t, "trade").trade);
});

test("dragging from the shop buys, and dragging back sells for a third", () => {
  const { p, m, scene } = shop();
  m.stock.fill(null);
  const sword = makeItem("sword");
  m.stock[0] = sword;
  const cost = valueOf(sword);
  p.gold = cost - 1;
  assert.match(move(scene, { type: "shop", i: 0 }, sword, { type: "bag", i: 5 }), /need/);
  assert.equal(m.stock[0], sword, "still for sale");
  p.gold = cost + 10;
  assert.equal(move(scene, { type: "shop", i: 0 }, sword, { type: "bag", i: 5 }), undefined);
  assert.equal(p.bag[5], sword);
  assert.equal(m.stock[0], null);
  assert.equal(p.gold, 10);

  assert.equal(move(scene, { type: "bag", i: 5 }, sword, { type: "shop", i: 3 }), undefined);
  assert.equal(m.stock[3], sword);
  assert.equal(p.gold, 10 + sellPrice(sword));
});

test("a purchase needs an empty spot; it never swaps into the bag", () => {
  const { p, m, scene } = shop();
  m.stock.fill(null);
  const bow = makeItem("bow");
  m.stock[0] = bow;
  p.gold = 999;
  p.bag[GRID_W] = makeItem("dagger");
  assert.equal(move(scene, { type: "shop", i: 0 }, bow, { type: "bag", i: 0 }), "no room");
  assert.equal(p.gold, 999);
  p.equip.off = makeItem("shield");
  assert.equal(move(scene, { type: "shop", i: 0 }, bow, { type: "equip", slot: "off" }), "slot taken");
  assert.equal(m.stock[0], bow);
});

test("in the bag, dropping onto one item swaps it, onto two is refused", () => {
  const { p, scene } = shop();
  scene.trade = null;
  const scythe = makeItem("scythe"),
    a = makeItem("sword"),
    b = makeItem("dagger");
  p.bag[0] = scythe;
  p.bag[5] = a;
  p.bag[6] = b;
  assert.equal(move(scene, { type: "bag", i: 0 }, scythe, { type: "bag", i: 5 }), "no room");
  assert.equal(p.bag[0], scythe, "left where it was");
  p.bag[6] = null;
  p.bag[9] = b;
  assert.equal(move(scene, { type: "bag", i: 0 }, scythe, { type: "bag", i: 5 }), undefined);
  assert.equal(p.bag[5], scythe);
  assert.equal(p.bag[0], a, "the sword took the scythe's old spot");
});

test("dropping a bag item on the equipped one swaps them", () => {
  const { p, scene } = shop();
  scene.trade = null;
  const old = p.equip.main,
    spear = makeItem("spear");
  p.bag[7] = spear;
  assert.equal(move(scene, { type: "bag", i: 7 }, spear, { type: "equip", slot: "main" }), undefined);
  assert.equal(p.equip.main, spear);
  assert.equal(p.bag[7], old);
});
