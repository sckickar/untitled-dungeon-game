import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle } from "./helpers.js";
import { MW, MH } from "../src/config.js";
import { World } from "../src/sim/world.js";
import { generateLevel } from "../src/sim/level.js";
import { bfs } from "../src/sim/nav.js";
import { makeItem } from "../src/sim/items.js";
import { defs } from "../src/sim/defs.js";
import { placeSanctum } from "../src/content/sanctum.js";
import { talkTarget, openTalk, chooseTalk } from "../src/content/npcs.js";

const BIOME_DEPTH = { stone: 2, soul: 7, flesh: 12 };

const floorCount = (w) => w.tiles.reduce((n, t, i) => n + (w.solid(i % MW, (i / MW) | 0) ? 0 : 1), 0);

function withSanctum(depth = 4) {
  for (;;) {
    const w = new World({ depth });
    generateLevel(w);
    if (w.sanctum || placeSanctum(w)) return w;
  }
}

test("every biome generates fully connected floors with reachable stairs", () => {
  for (const [biome, depth] of Object.entries(BIOME_DEPTH))
    for (let n = 0; n < 25; n++) {
      const w = new World({ depth });
      generateLevel(w);
      assert.equal(w.biome, biome);
      const p = w.player,
        d = bfs(w, Math.floor(p.x), Math.floor(p.y));
      for (let i = 0; i < MW * MH; i++) {
        const x = i % MW,
          y = (i / MW) | 0;
        if (w.solid(x, y)) continue;
        assert.ok(x > 0 && y > 0 && x < MW - 1 && y < MH - 1, `${biome}: floor on the map edge`);
        assert.ok(d[i] >= 0, `${biome}: unreachable floor at ${x},${y}`);
      }
      for (const r of w.rooms) assert.ok(!w.solid(r.cx, r.cy), `${biome}: room centre walled in`);
    }
});

test("biomes carve visibly different floors", () => {
  const stats = {};
  for (const [biome, depth] of Object.entries(BIOME_DEPTH)) {
    let rooms = 0,
      ragged = 0;
    for (let n = 0; n < 20; n++) {
      const w = new World({ depth });
      generateLevel(w);
      rooms += w.rooms.length;
      for (const r of w.rooms)
        for (let y = r.y; y < r.y + r.h; y++)
          for (let x = r.x; x < r.x + r.w; x++) if (w.solid(x, y)) ragged++;
    }
    stats[biome] = { rooms: rooms / 20, ragged: ragged / 20 };
  }
  assert.ok(stats.soul.rooms > stats.stone.rooms, `crypts have more rooms: ${JSON.stringify(stats)}`);
  assert.ok(stats.flesh.ragged > stats.stone.ragged * 2, `caverns are ragged: ${JSON.stringify(stats)}`);
});

test("a sanctum is sealed off but for one door, with a merchant and cultists inside", () => {
  for (let n = 0; n < 15; n++) {
    const w = withSanctum(),
      v = w.sanctum,
      inside = (e) => e.x >= v.x && e.y >= v.y && e.x < v.x + v.w && e.y < v.y + v.h;
    const door = w.entities.find((e) => e.type === "door");
    assert.equal(Math.floor(door.x), v.door.x);
    assert.equal(Math.floor(door.y), v.door.y);
    const before = floorCount(w);
    w.tiles[v.door.y * MW + v.door.x] = w.tiles[0];
    const d = bfs(w, Math.floor(w.player.x), Math.floor(w.player.y));
    assert.ok(d[v.cy * MW + v.cx] < 0, "only way in is the door");
    assert.equal(floorCount(w), before - 1);

    const vendors = w.query((e) => e.tags.has("vendor"));
    assert.equal(vendors.filter((e) => e.type === "merchant").length, 1);
    const cultists = vendors.filter((e) => e.type !== "merchant");
    assert.ok(cultists.length >= 1 && cultists.length <= 3);
    assert.equal(new Set(cultists.map((c) => c.rite)).size, cultists.length, "each cultist knows a different rite");
    assert.ok(vendors.every(inside));
    assert.ok(!w.query((e) => e.team === "monster").some(inside), "no monsters inside");
  }
});

test("the door opens when the player walks into it", () => {
  const w = withSanctum(),
    v = w.sanctum,
    door = w.entities.find((e) => e.type === "door"),
    p = w.player;
  p.x = v.door.x + 0.5 - v.dir.x * 1.2;
  p.y = v.door.y + 0.5 - v.dir.y * 1.2;
  for (const m of w.query((e) => e.team === "monster")) w.remove(m);
  run(w, 1, { move: v.dir });
  assert.ok(door.removed, "door opened");
});

test("vendors stay put, never fight, and nobody fights them", () => {
  const w = arena();
  const m = w.spawn("merchant", 22.5, 20.5),
    c = w.spawn("zealot", 23.5, 20.5, { rite: "of ash" });
  const skel = w.spawn("skel", 24.5, 21.5);
  w.player.hp = w.player.maxhp = 999;
  run(w, 4, idle);
  assert.equal(m.hp, m.maxhp);
  assert.equal(c.hp, c.maxhp);
  assert.ok(Math.hypot(m.x - m.home.x, m.y - m.home.y) < 0.5);
  assert.equal(skel.mem.target, w.player, "the skeleton goes for the player instead");
  assert.equal(m.def.look.outline, "y");
});

test("the merchant hones gear for gold, pricier each time", () => {
  const w = arena({ depth: 3 }),
    p = w.player;
  const m = w.spawn("merchant", 21.5, 20.5);
  p.equip.main = makeItem("sword");
  p.equip.off = makeItem("shield");
  p.gold = 0;
  assert.equal(talkTarget(w), m);
  let t = openTalk(w, m);
  const main = t.options.find((o) => o.id === "main");
  assert.ok(main && t.options.some((o) => o.id === "off"));

  t = chooseTalk(w, t, "main");
  assert.equal(p.equip.main.atk, 0, "too poor");
  p.gold = 1000;
  t = chooseTalk(w, t, "main");
  assert.equal(p.equip.main.atk, 1);
  assert.equal(p.equip.main.plus, 1);
  assert.equal(p.equip.main.name, "sword+1");
  assert.equal(p.gold, 1000 - main.cost);
  assert.ok(t.options.find((o) => o.id === "main").cost > main.cost, "second hone costs more");

  const dur = p.equip.off.maxDur;
  chooseTalk(w, t, "off");
  assert.equal(p.equip.off.maxDur, dur + 3);
  assert.equal(chooseTalk(w, t, "leave"), null);
});

test("cultists bless gear with their rite, up to the effect cap", () => {
  const w = arena({ depth: 3 }),
    p = w.player;
  const c = w.spawn("acolyte", 21.5, 20.5, { rite: "of frost" });
  p.equip.main = makeItem("sword");
  p.equip.off = null;
  p.gold = 10000;
  let t = openTalk(w, c);
  assert.deepEqual(t.options.map((o) => o.id), ["main", "leave"]);
  t = chooseTalk(w, t, "main");
  assert.deepEqual(p.equip.main.effects.map((fx) => fx.id), ["of frost"]);
  const power = p.equip.main.effects[0].power;
  t = chooseTalk(w, t, "main");
  assert.ok(p.equip.main.effects[0].power > power, "blessing twice deepens the rite");

  p.equip.main.effects = [
    { id: "of ash", power: 1 },
    { id: "of sparks", power: 1 },
    { id: "of gales", power: 1 },
  ];
  t = openTalk(w, c);
  assert.deepEqual(t.options.map((o) => o.id), ["leave"], "no room for another rite");

  p.equip.main = makeItem("staff");
  assert.ok(!defs.weapons.staff.suffixChance);
  assert.deepEqual(openTalk(w, c).options.map((o) => o.id), ["leave"], "staves can't be blessed");
});

test("vendors wander their sanctum without leaving it, and hold still for the player", () => {
  const w = withSanctum(),
    v = w.sanctum,
    vendors = w.query((e) => e.tags.has("vendor")),
    start = vendors.map((e) => ({ x: e.x, y: e.y }));
  w.entities.find((e) => e.type === "door").update = () => {};
  for (const m of w.query((e) => e.team === "monster")) w.remove(m);
  w.player.x = w.player.y = 1e3;
  let roamed = 0;
  for (let s = 0; s < 30; s++) {
    run(w, 1, idle);
    for (const e of vendors) {
      assert.ok(e.x >= v.x && e.y >= v.y && e.x < v.x + v.w && e.y < v.y + v.h, `${e.type} left the room`);
    }
  }
  vendors.forEach((e, i) => (roamed += Math.hypot(e.x - start[i].x, e.y - start[i].y) > 0.5 ? 1 : 0));
  assert.ok(roamed > 0, "someone moved");

  const m = vendors.find((e) => e.type === "merchant");
  w.player.x = m.x + 1;
  w.player.y = m.y;
  run(w, 0.2, idle);
  const at = { x: m.x, y: m.y };
  run(w, 2, idle);
  assert.ok(Math.hypot(m.x - at.x, m.y - at.y) < 0.2, "stands still while the player is close");
});
