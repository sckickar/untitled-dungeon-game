import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle } from "./helpers.js";
import { defs } from "../src/sim/defs.js";
import { World } from "../src/sim/world.js";
import { generateLevel } from "../src/sim/level.js";

const NATIVES = { stone: ["ghoul"], soul: ["necromancer", "hexer"], flesh: ["ravager", "lizardbrute"] };

test("biome natives only ever spawn on their own floors, and do show up there", () => {
  const seen = new Set();
  for (let depth = 1; depth <= 13; depth++)
    for (let i = 0; i < 6; i++) {
      const w = new World({ depth });
      generateLevel(w);
      for (const e of w.entities) {
        const only = e.def.spawn?.only;
        if (!only) continue;
        assert.ok(only.includes(w.biome), `${e.type} on a ${w.biome} floor`);
        seen.add(e.type);
      }
    }
  for (const ids of Object.values(NATIVES)) for (const id of ids) assert.ok(seen.has(id), `${id} never spawned`);
});

test("a necromancer raises unarmed skeletons, a few at a time", () => {
  const w = arena({ depth: 6 }),
    p = w.player;
  p.hp = p.maxhp = 9999;
  const n = w.spawn("necromancer", 25.5, 20.5);
  n.equip.main = null;
  n.mem.aggro = true;
  run(w, 20, idle);
  const risen = w.query((e) => e.type === "risen" && e.owner === n && !e.dead);
  assert.ok(risen.length >= 1 && risen.length <= defs.entities.necromancer.minions.max);
  for (const r of risen) {
    assert.equal(r.equip.main.base, "bite");
    assert.equal(r.team, n.team);
  }
});

test("staff-carrying natives only roll their own schools of magic", () => {
  const w = arena({ depth: 6 });
  for (const type of ["necromancer", "hexer"])
    for (let i = 0; i < 40; i++) {
      const it = w.spawn(type, 5 + (i % 30), 5).equip.main;
      if (it) assert.ok(defs.entities[type].gear.spells.includes(it.spell), `${type}: ${it.spell}`);
    }
});

test("a lizardbrute cracks the ground open under the player", () => {
  const w = arena({ depth: 11 }),
    p = w.player;
  p.hp = p.maxhp = 9999;
  const l = w.spawn("lizardbrute", 24.5, 20.5);
  l.mem.aggro = true;
  let craters = 0;
  w.on("spawn", ({ entity }) => entity.type === "crater" && craters++);
  run(w, 10, idle);
  assert.ok(craters >= 1);
});

test("soul corridors hide rotting corpses at the configured chance, and nowhere else", async () => {
  const { MW } = await import("../src/config.js");
  const soul = defs.biomes.soul.traps,
    was = soul.chance;
  try {
    soul.chance = 1;
    let traps = 0;
    for (let i = 0; i < 6; i++) {
      const w = new World({ depth: 7 });
      generateLevel(w);
      assert.equal(w.biome, "soul");
      for (const t of w.traps) {
        traps++;
        assert.ok(t.mobs.length >= 1);
        for (const m of t.mobs) {
          assert.equal(m.type, "rotcorpse");
          assert.ok(m.buried && t.tiles.has(Math.floor(m.y) * MW + Math.floor(m.x)));
        }
      }
    }
    assert.ok(traps > 0, "no corridor was ever trapped at chance 1");
    soul.chance = 0;
    const w = new World({ depth: 7 });
    generateLevel(w);
    assert.equal(w.traps.length, 0);
    for (const depth of [2, 12]) {
      const o = new World({ depth });
      generateLevel(o);
      assert.ok(!o.entities.some((e) => e.type === "rotcorpse"), `rotting corpse on B${depth}`);
    }
  } finally {
    soul.chance = was;
  }
});

test("a buried rotting corpse is untouchable until the trap springs, then climbs out and fights", async () => {
  const { bury } = await import("../src/sim/burial.js");
  const { damage } = await import("../src/sim/combat.js");
  const { MW } = await import("../src/config.js");
  const w = arena({ depth: 6, x: 10.5, y: 20.5 }),
    p = w.player;
  p.hp = p.maxhp = 9999;
  const trap = { tiles: new Set([20 * MW + 20, 20 * MW + 21]), mobs: [], sprung: false },
    c = w.spawn("rotcorpse", 25.5, 20.5);
  bury(c, trap);
  run(w, 2, idle);
  assert.ok(c.buried && !trap.sprung);
  assert.equal(damage(w, c, { amount: 99, source: p }), 0);
  assert.ok(!c.tags.has("body"));
  p.x = 20.5;
  run(w, 0.1, idle);
  assert.ok(trap.sprung);
  run(w, 2, idle);
  assert.ok(!c.buried && c.rise === 1 && c.team === "monster" && c.tags.has("body"));
  assert.equal(c.equip.main.base, "bite");
  assert.ok(c.mem.aggro);
});

test("rotting corpses poison what they bite, and burst into poison when they die", async () => {
  const { kill } = await import("../src/sim/combat.js");
  const w = arena({ depth: 6 }),
    p = w.player;
  p.hp = p.maxhp = 9999;
  const c = w.spawn("rotcorpse", 21.2, 20.5);
  c.mem.aggro = true;
  let poisoned = false;
  w.on("status:applied", ({ target, id }) => target === p && id === "poisoned" && (poisoned = true));
  run(w, 6, idle);
  assert.ok(poisoned, "the bite never poisoned");
  let flames = 0;
  w.on("spawn", ({ entity }) => entity.type === "poisonflame" && flames++);
  kill(w, c, { source: p });
  assert.ok(flames >= 4);
});
