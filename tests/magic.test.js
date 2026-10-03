import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle, press, pacify } from "./helpers.js";
import { defs, loadContent } from "../src/sim/defs.js";
import { creature } from "../src/sim/templates.js";
import { makeItem, rollItem } from "../src/sim/items.js";
import { applyStatus, statusSpeed } from "../src/sim/status.js";
import { damage, strike } from "../src/sim/combat.js";

const EAST = { x: 1, y: 0 };
const once = (aim) => (i) => (i === 0 ? press(aim) : idle);

loadContent({ entities: { ally: creature({ team: "player", hp: 999, look: { sprite: "skel" } }) } });

const dummy = (w, x, y, type = "slime") => {
  const t = pacify(w.spawn(type, x, y));
  t.hp = t.maxhp = 999;
  return t;
};
const staff = (w, spell) => (w.player.equip.main = { ...makeItem("staff"), spell, cd: 0 });

function sure(fn) {
  const r = Math.random;
  Math.random = () => 0;
  try {
    fn();
  } finally {
    Math.random = r;
  }
}

test("a spinning blade hits what is behind its wielder, a sword does not", () => {
  const behind = (base) => {
    const w = arena();
    w.player.equip.main = Object.assign(makeItem(base), { crit: 0 });
    const t = dummy(w, 19.4, 20.5);
    run(w, 1 / 30, once(EAST));
    return t.hp < 999;
  };
  assert.ok(behind("excalibur"));
  assert.ok(behind("miramasa"));
  assert.ok(!behind("sword"));
});

test("legendary blades drop far less often than common weapons", () => {
  const n = { sword: 0, excalibur: 0 };
  for (let i = 0; i < 4000; i++) {
    const b = rollItem(3).base;
    if (b in n) n[b]++;
  }
  assert.ok(n.excalibur > 0 && n.excalibur * 3 < n.sword, JSON.stringify(n));
});

test("the miramasa curses what it cuts", () => {
  const w = arena();
  w.player.equip.main = Object.assign(makeItem("miramasa"), { crit: 0 });
  const t = dummy(w, 21.5, 20.5);
  run(w, 1 / 30, once(EAST));
  assert.ok(t.status.has("cursed"));
});

test("a curse slows its victim, saps its blows and gnaws at it", () => {
  const w = arena(),
    t = dummy(w, 25.5, 20.5);
  applyStatus(w, t, "cursed", { source: w.player });
  assert.ok(statusSpeed(t) < 1);
  const foe = dummy(w, 30.5, 30.5);
  assert.equal(damage(w, foe, { amount: 10, source: t }), 6);
  run(w, 2.1, idle);
  assert.ok(t.hp < 999, "curse ticks");
});

test("a cursed attacker passes the curse to what it hits", () => {
  const w = arena(),
    a = dummy(w, 21, 20.5);
  applyStatus(w, a, "cursed");
  sure(() => strike(w, a, w.player, { amount: 1, dir: EAST }));
  assert.ok(w.player.status.has("cursed"));
});

test("a cursed fighter's swing infects friends at its side too", () => {
  const w = arena(),
    p = w.player,
    friend = w.spawn("ally", 20.5, 21.3);
  p.equip.main = Object.assign(makeItem("sword"), { crit: 0 });
  applyStatus(w, p, "cursed");
  sure(() => run(w, 1 / 30, once(EAST)));
  assert.ok(friend.status.has("cursed"));
});

test("vendors are spared the curse", () => {
  const w = arena(),
    m = w.spawn("merchant", 22.5, 20.5);
  assert.equal(applyStatus(w, m, "cursed"), null);
});

test("an eruption opens a crater on the foe that keeps spitting magma", () => {
  const w = arena(),
    foe = dummy(w, 23.5, 21);
  staff(w, "eruption");
  let globs = 0;
  w.on("spawn", ({ entity }) => entity.type === "magma" && globs++);
  run(w, 1 / 30, once(EAST));
  const [c] = w.query((e) => e.type === "crater");
  assert.ok(c && Math.hypot(c.x - foe.x, c.y - foe.y) < 0.01, "crater under the foe");
  assert.equal(w.player.mp, w.player.maxmp - defs.spells.eruption.mp);
  run(w, 5, idle);
  assert.ok(globs >= 5, `spat ${globs}`);
  assert.equal(w.query((e) => e.type === "crater").length, 0, "crater cooled and closed");
});

test("magma burns whoever it lands on, friend or foe, and leaves fire that does too", () => {
  const w = arena(),
    friend = w.spawn("ally", 25.5, 25.5);
  w.spawn("magma", 25.5, 25.5, { source: w.player, vx: 0, vy: 0, dmg: 2 });
  run(w, 1.5, idle);
  assert.ok(friend.hp < 999 && friend.status.has("burning"));
  const fire = w.query((e) => e.type === "fire");
  assert.equal(fire.length, 1);
  assert.ok(fire[0].wild);
});

test("a hex curses its mark and leaves cursed flames that curse anyone", () => {
  const w = arena(),
    foe = dummy(w, 23.5, 20.5);
  staff(w, "hex");
  run(w, 1, once(EAST));
  assert.ok(foe.status.has("cursed"));
  const flames = w.query((e) => e.type === "cursedflame");
  assert.ok(flames.length >= 3);
  const friend = w.spawn("ally", flames[0].x, flames[0].y);
  run(w, 0.2, idle);
  assert.ok(friend.status.has("cursed"));
});

test("a blood siphon drinks a foe's hp into the caster", () => {
  const w = arena(),
    p = w.player,
    foe = dummy(w, 22.5, 20.5);
  staff(w, "bloodsiphon");
  p.hp = 10;
  run(w, 1, press(EAST));
  assert.ok(foe.hp < 999);
  assert.ok(p.hp > 10);
});

test("a mana siphon works from empty, draining mp, or bleeding foes with none", () => {
  const w = arena(),
    p = w.player,
    witch = dummy(w, 22.5, 20.5, "hexer");
  witch.mp = 8;
  staff(w, "manasiphon");
  p.mp = 0;
  run(w, 1, press(EAST));
  assert.ok(witch.mp < 8 && witch.hp === 999, "drained mana, not blood");
  assert.ok(p.mp > 0);

  const w2 = arena(),
    slime = dummy(w2, 22.5, 20.5);
  w2.player.equip.main = { ...makeItem("staff"), spell: "manasiphon", tick: 0.3 };
  w2.player.mp = 0;
  run(w2, 1, press(EAST));
  assert.ok(slime.hp < 999 && w2.player.mp > 0);
});
