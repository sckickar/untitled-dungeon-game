import { test } from "node:test";
import assert from "node:assert/strict";
import { arena, run, idle, press, pacify } from "./helpers.js";
import { terrainIndex } from "../src/sim/defs.js";
import { World } from "../src/sim/world.js";
import { generateLevel } from "../src/sim/level.js";
import { snapshot } from "../src/sim/actor.js";
import { damage } from "../src/sim/combat.js";
import { dist } from "../src/lib/math.js";
import { makeItem } from "../src/sim/items.js";
import { defs } from "../src/sim/defs.js";
import {
  talkTarget,
  openTalk,
  chooseTalk,
  hire,
  upkeep,
  payUpkeep,
} from "../src/content/npcs.js";

const npc = (w, x, y, mode) => {
  const e = w.spawn("npc", x, y, { mode });
  e.equip = { main: makeItem("sword"), off: null };
  return e;
};

test("npcs roll a look, a name, a weapon and a price", () => {
  const w = arena({ depth: 3 });
  const e = npc(w, 25.5, 20.5, "idle");
  assert.ok(e.name && e.appearance && e.equip.main);
  assert.ok(e.price > 0);
  assert.equal(e.team, "neutral");
});

test("a hunting npc kills nearby monsters; the player can't hit a neutral", () => {
  const w = arena();
  w.player.team = "object";
  const e = npc(w, 25.5, 20.5, "hunt");
  e.hp = e.maxhp = 999;
  const slime = w.spawn("slime", 27.5, 20.5);
  run(w, 8, idle);
  assert.ok(slime.removed, "slime killed");
  assert.equal(e.team, "neutral");
});

test("an idle npc holds still until something attacks it", () => {
  const w = arena();
  const e = npc(w, 30.5, 30.5, "idle");
  e.hp = e.maxhp = 999;
  run(w, 2, idle);
  assert.ok(dist(e, e.home) < 0.5, "stayed home");
  const s = pacify(w.spawn("skel", 31.4, 30.5));
  s.hp = 999;
  damage(w, e, { amount: 1, source: s });
  run(w, 3, idle);
  assert.ok(s.hp < 999, "fought back");
});

test("hiring costs gold and turns the npc into a follower", () => {
  const w = arena();
  const e = npc(w, 21.5, 20.5, "idle");
  assert.equal(talkTarget(w), e);
  w.player.gold = e.price - 1;
  let talk = openTalk(w, e);
  talk = chooseTalk(w, talk, "hire");
  assert.equal(e.mode, "idle", "too poor");
  w.player.gold = e.price + 5;
  talk = chooseTalk(w, talk, "hire");
  assert.equal(e.mode, "hired");
  assert.equal(e.team, "player");
  assert.equal(w.player.gold, 5);
  assert.deepEqual(
    talk.options.map((o) => o.id),
    ["chat", "dismiss", "leave"],
  );

  w.player.x = 32.5;
  w.player.y = 32.5;
  run(w, 6, idle);
  assert.ok(dist(e, w.player) < 2.5, "followed the player");
});

test("a hireling fights monsters near the player but not far away", () => {
  const w = arena();
  const e = npc(w, 21.5, 20.5, "idle");
  e.hp = e.maxhp = 999;
  hire(w, e);
  const far = pacify(w.spawn("slime", 28.5, 20.5));
  run(w, 3, idle);
  assert.ok(!far.removed, "ignored the far slime");
  assert.ok(dist(e, w.player) < 3);
  const near = w.spawn("slime", 23, 21.5);
  run(w, 6, idle);
  assert.ok(near.removed, "killed the slime by the player");
});

test("upkeep is small, and cheaper per head the bigger the party", () => {
  assert.ok(upkeep(1) >= 1 && upkeep(10) <= 8);
  assert.ok(upkeep(10, 20) < upkeep(10, 1));
  assert.ok(upkeep(10, 20) * 20 < upkeep(10, 1) * 20 * 0.6);
  assert.ok(upkeep(1, 50) >= 1);
});

test("arriving on a floor pays the party's upkeep; whoever can't be paid runs a tab", () => {
  const w = arena({ depth: 4 });
  const a = npc(w, 22.5, 20.5, "idle"),
    b = npc(w, 20.5, 22.5, "idle");
  hire(w, a);
  hire(w, b);
  const fee = upkeep(4, 2);
  w.player.gold = fee * 2;
  payUpkeep(w);
  assert.equal(w.player.gold, 0);
  assert.equal(a.owed, 0);
  assert.equal(b.owed, 0);

  w.player.gold = fee;
  payUpkeep(w);
  const owing = [a, b].filter((e) => e.owed > 0);
  assert.equal(owing.length, 1);
  assert.equal(owing[0].owed, fee);
  assert.equal(owing[0].unpaid, 1);

  w.player.gold = fee * 2;
  payUpkeep(w);
  assert.equal(owing[0].owed, 0);
  assert.equal(w.player.gold, 0);
});

test("an unpaid hireling sounds ominous and can be paid off by talking to it", () => {
  const w = arena();
  const e = npc(w, 21.5, 20.5, "idle");
  hire(w, e);
  Object.assign(e, { owed: 6, unpaid: 1 });
  let talk = openTalk(w, e);
  assert.equal(talk.options[0].id, "pay");
  w.player.gold = 5;
  talk = chooseTalk(w, talk, "pay");
  assert.equal(e.owed, 6, "too poor");
  w.player.gold = 10;
  talk = chooseTalk(w, talk, "pay");
  assert.equal(e.owed, 0);
  assert.equal(e.unpaid, 0);
  assert.equal(w.player.gold, 4);
  assert.deepEqual(
    talk.options.map((o) => o.id),
    ["chat", "dismiss", "leave"],
  );
});

test("only unpaid hirelings may turn on the player", () => {
  const w = arena({ depth: 5 });
  const bad = npc(w, 22.5, 20.5, "idle"),
    good = npc(w, 20.5, 22.5, "idle");
  hire(w, bad);
  hire(w, good);
  Object.assign(bad, { owed: 99, unpaid: 10, betrayT: 0.5 });
  good.betrayT = 0.5;
  let turned = 0;
  w.on("betray", () => turned++);
  const roll = Math.random;
  Math.random = () => 0;
  try {
    run(w, 1, idle);
  } finally {
    Math.random = roll;
  }
  assert.equal(bad.team, "monster");
  assert.equal(bad.mode, "traitor");
  assert.equal(good.team, "player");
  assert.equal(turned, 1);
});

test("hirelings follow the player down the stairs", () => {
  const w = arena({ depth: 2 });
  const e = npc(w, 21.5, 20.5, "idle");
  hire(w, e);
  const dead = npc(w, 19.5, 20.5, "idle");
  hire(w, dead);
  dead.dead = true;
  w.emit("descend");
  const carry = snapshot(w.player);
  assert.equal(carry.party.length, 1);

  const w2 = new World({ depth: 3 });
  generateLevel(w2, { carry });
  const hired = w2.query((o) => o.mode === "hired");
  assert.equal(hired.length, 1);
  assert.equal(hired[0].name, e.name);
  assert.deepEqual(hired[0].appearance, e.appearance);
  assert.equal(hired[0].team, "player");
  assert.equal(hired[0].owed > 0, true, "couldn't afford their upkeep");
});

test("floors get at most a few npcs, and resting ones get an empty room", () => {
  for (let i = 0; i < 30; i++) {
    const w = new World({ depth: 4 });
    generateLevel(w);
    const npcs = w.query((o) => o.type === "npc");
    assert.ok(npcs.length <= 3);
    for (const n of npcs.filter((o) => o.mode === "idle")) {
      const r = w.rooms.find(
        (r) => n.x >= r.x && n.y >= r.y && n.x < r.x + r.w && n.y < r.y + r.h,
      );
      const monsters = w.query(
        (o) =>
          o.team === "monster" &&
          o.x >= r.x &&
          o.y >= r.y &&
          o.x < r.x + r.w &&
          o.y < r.y + r.h,
      );
      assert.equal(monsters.length, 0);
    }
  }
});

const staff = (spell) => {
  const it = makeItem("staff");
  it.spell = spell;
  it.cd = defs.spells[spell].cd || 0;
  if (defs.spells[spell].tick) it.tick = defs.spells[spell].tick;
  return it;
};

const hireling = (w, x, y, main) => {
  const e = npc(w, x, y, "idle");
  e.equip.main = main;
  hire(w, e);
  return e;
};

test("npcs can roll a healing staff", () => {
  const w = arena({ depth: 3 });
  let healers = 0;
  for (let i = 0; i < 300; i++) {
    const it = w.spawn("npc", 5 + (i % 30), 5 + Math.floor(i / 30)).equip.main;
    if (it.spell && defs.spells[it.spell].support) healers++;
  }
  assert.ok(healers > 0);
});

for (const spell of ["lightning", "flame"])
  test(`a hireling with a ${spell} staff keeps fighting`, () => {
    const w = arena();
    const e = hireling(w, 21.5, 20.5, staff(spell));
    e.hp = e.maxhp = 999;
    const s = pacify(w.spawn("skel", 23.5, 22));
    s.hp = s.maxhp = 999;
    run(w, 12, idle);
    assert.ok(999 - s.hp >= 15, `dealt ${999 - s.hp}`);
  });

test("a hireling with a heal staff mends the player and keeps behind them", () => {
  const w = arena();
  const e = hireling(w, 21.5, 20.5, staff("heal"));
  w.player.hp = 5;
  run(w, 4, idle);
  assert.ok(w.player.hp > 5, "healed the player");

  const s = pacify(w.spawn("skel", 23.5, 20.5));
  s.hp = 999;
  run(w, 3, idle);
  assert.ok(e.x < w.player.x, "stands on the far side of the player");
  assert.ok(dist(e, w.player) < 2.5);
});

test("a heal staff mends whichever ally it is aimed at, or the caster", () => {
  const w = arena();
  const p = w.player;
  p.equip.main = staff("heal");
  const e = hireling(w, 23.5, 20.5, makeItem("sword"));
  pacify(e);
  e.hp = 3;
  p.hp = 5;
  run(w, 0.1, press({ x: 1, y: 0 }));
  run(w, 2, idle);
  assert.ok(e.hp > 3, "healed the aimed-at hireling");
  assert.equal(p.hp, 5, "not the caster");

  run(w, 6, idle);
  run(w, 0.1, press({ x: 0, y: 1 }));
  run(w, 2, idle);
  assert.ok(p.hp > 5, "healed self when aiming at nobody");
});

test("a monster that locked onto a far-off npc turns on the player beside it", () => {
  const w = arena();
  w.player.hp = w.player.maxhp = 999;
  const far = npc(w, 40.5, 20.5, "idle");
  pacify(far);
  const s = w.spawn("slime", 21.3, 20.5);
  s.mem.target = far;
  s.mem.aggro = true;
  run(w, 4, idle);
  assert.ok(w.player.hp < 999, "the slime bit the player");
});

test("a hireling hunts enemies near the player but ignores ones behind walls", () => {
  const w = arena();
  const wall = terrainIndex("wall");
  for (let y = 15; y < 26; y++) w.setTile(24, y, wall);
  const e = hireling(w, 21.5, 20.5, makeItem("sword"));
  e.hp = e.maxhp = 999;
  const hidden = pacify(w.spawn("skel", 25.5, 20.5));
  hidden.hp = 999;
  const open = w.spawn("slime", 19, 24);
  run(w, 6, idle);
  assert.ok(open.removed, "killed the slime by the player");
  assert.equal(hidden.hp, 999);
});

const loot = (w, x, y, item, extra = {}) => {
  const o = w.spawn("item", x, y, { item });
  Object.assign(o, { z: 0, vz: 0, vx: 0, vy: 0, rest: 1 }, extra);
  return o;
};
const sword = (atk) => Object.assign(makeItem("sword"), { atk });

test("a hireling swaps up to a better weapon of its kind and leaves the rest", () => {
  const w = arena();
  const e = hireling(w, 21.5, 20.5, sword(1));
  const old = e.equip.main;
  const worse = loot(w, 22.5, 22.5, sword(0)),
    bow = loot(w, 19.5, 22, Object.assign(makeItem("bow"), { atk: 9 })),
    better = loot(w, 23, 19, sword(6));
  run(w, 5, idle);
  assert.equal(e.equip.main, better.item, "took the better sword");
  assert.ok(better.removed);
  assert.ok(!worse.removed && !bow.removed, "left the worse sword and the bow");
  const dropped = w.query((o) => o.item === old);
  assert.equal(dropped.length, 1, "dropped its old sword");
  run(w, 3, idle);
  assert.equal(e.equip.main, better.item, "didn't take its old sword back");
});

test("a sword-wielding hireling swaps up to a spinning blade and keeps spinning it", () => {
  const w = arena();
  const e = hireling(w, 21.5, 20.5, sword(1));
  e.hp = e.maxhp = 999;
  const blade = loot(w, 22.5, 21.5, Object.assign(makeItem("excalibur"), { atk: 6 }));
  run(w, 4, idle);
  assert.equal(e.equip.main, blade.item, "took the excalibur");
  const near = w.spawn("slime", 23, 21.5);
  near.hp = near.maxhp = 999;
  let spins = 0;
  w.on("swing", (ev) => ev.actor === e && ev.spin && spins++);
  run(w, 4, idle);
  assert.ok(spins >= 3, `spun ${spins} times`);
  assert.ok(near.hp < 999);
});

test("a hireling with a mana siphon keeps draining even when its mana is spent", () => {
  const w = arena();
  const e = hireling(w, 21.5, 20.5, { ...makeItem("staff"), spell: "manasiphon", tick: 0.3 });
  e.hp = e.maxhp = 999;
  e.mp = 0;
  e.mpT = -1e9;
  const foe = w.spawn("slime", 24, 20.5);
  foe.hp = foe.maxhp = 999;
  run(w, 3, idle);
  assert.ok(foe.hp < 999, "siphoned the slime");
  assert.ok(e.mp > 0, "drank mana from it");
});

test("a hireling goes for gear the player drops first and takes it whatever it is", () => {
  const w = arena();
  const e = hireling(w, 21.5, 20.5, sword(5));
  const near = loot(w, 21.5, 21.5, sword(9)),
    bow = loot(w, 23.5, 20.5, makeItem("bow"), { gift: true });
  run(w, 0.25, idle);
  assert.equal(e.mem.loot, bow, "headed for the gift first");
  run(w, 4, idle);
  assert.equal(e.equip.main.base, "bow");
  assert.ok(bow.removed);
  assert.ok(!near.removed, "a sword is no use to an archer");
});

test("a hireling picks up potions and drinks one when hurt", () => {
  const w = arena();
  const e = hireling(w, 21.5, 20.5, sword(1));
  e.potions = { potion: 0, manapotion: 0 };
  w.player.bag.fill({ base: "arrow", qty: 99 });
  const pot = w.spawn("potion", 23.5, 21.5);
  run(w, 4, idle);
  assert.ok(pot.removed);
  assert.equal(e.potions.potion, 1);
  e.hp = 2;
  run(w, 0.2, idle);
  assert.equal(e.potions.potion, 0);
  assert.ok(e.hp > 2, "drank it");
});

test("only casters pick up mana potions, and they drink one when drained", () => {
  const w = arena();
  const fighter = hireling(w, 21.5, 20.5, sword(1)),
    mage = hireling(w, 19.5, 20.5, staff("lightning"));
  fighter.potions = { potion: 0, manapotion: 0 };
  mage.potions = { potion: 0, manapotion: 0 };
  w.player.bag.fill({ base: "arrow", qty: 99 });
  const a = w.spawn("manapotion", 22.5, 22.5),
    b = w.spawn("manapotion", 18.5, 22.5);
  run(w, 5, idle);
  assert.ok(a.removed && b.removed);
  assert.equal(fighter.potions.manapotion, 0);
  assert.equal(mage.potions.manapotion, 2);
  mage.mp = 0;
  run(w, 0.2, idle);
  assert.equal(mage.potions.manapotion, 1);
  assert.ok(mage.mp > 0, "drank one");
});

test("the player drinks a mana potion from the bag", () => {
  const w = arena();
  const p = w.player;
  p.bag[1] = { base: "manapotion", qty: 1 };
  p.mp = 0;
  run(w, 0.1, { ...idle, use: "manapotion" });
  assert.ok(p.mp > 0);
  assert.equal(p.bag[1], null);
});

test("a fallen hireling drops all its gear and potions", () => {
  const w = arena();
  const e = hireling(w, 25.5, 20.5, sword(3));
  e.potions = { potion: 2, manapotion: 1 };
  e.def = { ...e.def, loot: null };
  const it = e.equip.main;
  damage(w, e, { amount: 9999 });
  w.sweep();
  assert.ok(w.query((o) => o.item === it).length === 1);
  assert.equal(w.query((o) => o.type === "potion").length, 2);
  assert.equal(w.query((o) => o.type === "manapotion").length, 1);
});

test("the player auto-drinks a mana potion when nearly out of mana", () => {
  const w = arena();
  const p = w.player;
  p.bag[1] = { base: "manapotion", qty: 2 };
  p.mp = p.maxmp * 0.1;
  run(w, 0.1, idle);
  assert.equal(p.bag[1].qty, 2, "not yet");
  p.mp = 0;
  run(w, 0.1, idle);
  assert.equal(p.bag[1].qty, 1);
  assert.ok(p.mp > p.maxmp * 0.04);
});
