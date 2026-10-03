import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle, press, pacify } from "./helpers.js";
import { defs } from "../src/sim/defs.js";
import { makeItem, rollItem, countOf } from "../src/sim/items.js";
import { strike } from "../src/sim/combat.js";
import { WEAPON_SPRITE_KEYS } from "../src/view/assets/manifest.js";

const EAST = { x: 1, y: 0 };
const once = (aim, slot = "main") => (i) => (i === 0 ? press(aim, slot) : idle);

const dummy = (w, x, y) => {
  const t = pacify(w.spawn("slime", x, y));
  t.hp = t.maxhp = 999;
  return t;
};

const armed = (w, base, props = {}) => (w.player.equip.main = Object.assign(makeItem(base), { crit: 0 }, props));

test("a magic missile homes in on a target off the aim line and carries its element", () => {
  const w = arena();
  armed(w, "magicwand", { bolt: "frost" });
  const t = dummy(w, 24.5, 22.5);
  run(w, 1.5, once(EAST));
  assert.ok(t.hp < 999, "the bolt curved onto the target");
  assert.ok(t.status.has("slowed"), "frost bolt slowed it");
  assert.ok(w.player.mp < w.player.maxmp, "paid mp");
});

test("a wand refuses to fire without the mp for it", () => {
  const w = arena();
  armed(w, "magicwand");
  w.player.mp = 1;
  run(w, 0.1, once(EAST));
  assert.equal(w.query((e) => e.type === "magicmissile").length, 0);
});

test("a fireball wand throws a homing fireball", () => {
  const w = arena();
  armed(w, "magicwand", { bolt: "fireball" });
  const t = dummy(w, 24.5, 22);
  let burned = false;
  w.on("status:applied", (ev) => ev.target === t && ev.id === "burning" && (burned = true));
  run(w, 0.05, once(EAST));
  assert.equal(w.query((e) => e.type === "fireball").length, 1);
  run(w, 1.5, idle);
  assert.ok(burned && t.hp < 999);
});

test("a blood wand pays in hp and won't kill its wielder", () => {
  const w = arena();
  armed(w, "bloodwand", { bolt: "shock" });
  const p = w.player;
  run(w, 0.1, once(EAST));
  assert.equal(p.hp, p.maxhp - defs.weapons.bloodwand.hp);
  p.hp = 1;
  run(w, 1, once(EAST));
  assert.equal(p.hp, 1);
});

test("an explosive bolt blasts everything around what it hits", () => {
  const w = arena();
  armed(w, "magicwand", { bolt: "explosive" });
  const a = dummy(w, 23.5, 20.5),
    b = dummy(w, 23.5, 21.4);
  let booms = 0;
  w.on("boom", () => booms++);
  run(w, 1.5, once(EAST));
  assert.equal(booms, 1);
  assert.ok(a.hp < 999 && b.hp < 999, "both caught in the blast");
});

test("a throwing knife spends the bag first, then itself, and breaks on hitting", () => {
  const w = arena(),
    p = w.player;
  armed(w, "throwingknife");
  p.bag[1] = { base: "knife", qty: 1 };
  const t = dummy(w, 23.5, 20.5);
  let shattered = 0;
  w.on("shatter", () => shattered++);
  run(w, 1, once(EAST));
  assert.equal(countOf(p, "knife"), 0);
  assert.equal(p.equip.main.base, "throwingknife", "still holding one");
  run(w, 1, once(EAST));
  assert.equal(p.equip.main, null, "threw the last one");
  assert.ok(t.hp < 999);
  assert.equal(shattered, 2);
  assert.equal(w.query((e) => e.type === "thrown").length, 0);
});

const swingAt = (base, d) => {
  const w = arena();
  armed(w, base);
  const t = dummy(w, 20.5 + d, 20.5);
  run(w, 1 / 30, once(EAST));
  return t;
};

test("big weapons and spears reach farther than a sword", () => {
  assert.equal(swingAt("sword", 1.6).hp, 999);
  for (const base of ["greatsword", "halberd", "spear"]) assert.ok(swingAt(base, 1.6).hp < 999, base);
});

test("a greatsword and a windstaff knock back harder than a sword", () => {
  const sword = swingAt("sword", 1).kx;
  assert.ok(swingAt("greatsword", 1).kx > sword);
  assert.ok(swingAt("windstaff", 1).kx > swingAt("greatsword", 1).kx);
});

test("a katana cuts wide but short", () => {
  const side = (base) => {
    const w = arena();
    armed(w, base);
    const t = dummy(w, 20.3, 21.3);
    run(w, 1 / 30, once(EAST));
    return t.hp < 999;
  };
  assert.ok(side("katana"));
  assert.ok(!side("sword"));
  assert.equal(swingAt("katana", 1.4).hp, 999);
});

test("a greatshield blocks blows a small shield lets through", () => {
  const blocks = (base) => {
    const w = arena(),
      p = w.player;
    p.equip.off = makeItem(base);
    p.blocking = true;
    p.face = EAST;
    const s = pacify(w.spawn("slime", 20.7, 21.3));
    return strike(w, s, p, { amount: 1, dir: { x: -0.243, y: -0.97 } }) === "blocked";
  };
  assert.ok(!blocks("shield"));
  assert.ok(blocks("greatshield"));
});

test("bows and shields roll sprite variants that are all loaded", () => {
  const images = new Set(WEAPON_SPRITE_KEYS);
  for (const base of ["bow", "shield"]) {
    const seen = new Set();
    for (let i = 0; i < 200; i++) {
      const it = rollItem(2, base);
      assert.ok(images.has(it.spr), `${base}: ${it.spr}`);
      seen.add(it.spr);
    }
    assert.equal(seen.size, defs.weapons[base].variants.length);
  }
});

test("wands roll a bolt the weapon allows", () => {
  for (let i = 0; i < 100; i++) {
    assert.ok(rollItem(2, "magicwand").bolt in defs.weapons.magicwand.bolts);
    assert.ok(rollItem(2, "bloodwand").bolt in defs.weapons.bloodwand.bolts);
  }
});

test("a skeleton swings whatever big weapon it rolled", () => {
  const w = arena({ depth: 3 });
  const s = w.spawn("skel", 22, 20.5);
  s.equip.main = makeItem("halberd");
  s.mem.aggro = true;
  run(w, 4, idle);
  assert.ok(w.player.hp < w.player.maxhp);
});
