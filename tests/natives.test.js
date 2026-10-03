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
