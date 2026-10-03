import { test } from "node:test";
import assert from "node:assert/strict";
import { run, idle } from "./helpers.js";
import { MW } from "../src/config.js";
import { World } from "../src/sim/world.js";
import { generateLevel } from "../src/sim/level.js";
import { snapshot } from "../src/sim/actor.js";
import { bfs } from "../src/sim/nav.js";
import { damage } from "../src/sim/combat.js";
import { spawnProjectile } from "../src/sim/attacks.js";
import { alive } from "../src/sim/entity.js";
import { chronicle } from "../src/content/chronicle.js";

const DEPTH = { lich: 5, octo: 10, nyarl: 15 };

function lair(id) {
  const w = new World({ depth: DEPTH[id] });
  generateLevel(w, { carry: { run: { bosses: ["lich", "octo"] } } });
  return w;
}

function engage(w) {
  const b = w.boss,
    p = w.player;
  p.x = b.x + 2.6;
  p.y = b.y + 2.6;
  run(w, 4, idle);
  assert.equal(b.state, "fight");
  return b;
}

const godMode = (p) => (p.hp = p.maxhp = 1e6);

test("lairs close out each stretch: lich and octo on b5 and b10 in either order, nyarl on b15", () => {
  const orders = new Set();
  for (let i = 0; i < 30; i++) {
    const seen = {},
      w0 = new World({ depth: 0 });
    generateLevel(w0);
    let carry = snapshot(w0.player);
    for (const depth of [4, 5, 9, 10, 11, 14, 15]) {
      const w = new World({ depth });
      generateLevel(w, { carry });
      seen[depth] = w.biome;
      carry = snapshot(w.player);
    }
    assert.equal(seen[4], "stone");
    assert.equal(seen[9], "soul");
    assert.ok(seen[11] === "flesh" && seen[14] === "flesh");
    assert.equal(seen[15], "nyarllair", "nyarl always waits after the flesh");
    assert.deepEqual([seen[5], seen[10]].sort(), ["lichlair", "octolair"]);
    orders.add(seen[5]);
  }
  assert.equal(orders.size, 2, "both orders happen");
});

test("every lair is connected, starts far from the arena, and hides its stairs until the boss dies", () => {
  for (const id of ["lich", "octo", "nyarl"])
    for (let n = 0; n < 10; n++) {
      const w = lair(id),
        p = w.player,
        b = w.boss;
      assert.equal(b.type, id);
      assert.equal(b.state, "dormant");
      assert.ok(!w.entities.some((e) => e.type === "stairs"));
      const d = bfs(w, Math.floor(p.x), Math.floor(p.y));
      assert.ok(d[Math.floor(b.y) * MW + Math.floor(b.x)] > 8, `${id}: arena reachable and not next door`);
      assert.ok(!w.sanctum, "no sanctum on a lair floor");
    }
});

test("the boss sleeps until the player walks into its arena, then shows itself", () => {
  const w = lair("lich"),
    b = w.boss;
  run(w, 1, idle);
  assert.equal(b.state, "dormant");
  w.player.x = b.x + 2.5;
  w.player.y = b.y + 2.5;
  run(w, 0.2, idle);
  assert.equal(b.state, "intro");
  assert.ok(w.cutscene, "camera goes to the boss");
  const at = { x: w.player.x, y: w.player.y };
  run(w, 1, { move: { x: 1, y: 0 } });
  assert.deepEqual({ x: w.player.x, y: w.player.y }, at, "the player waits it out");
  run(w, 3, idle);
  assert.equal(b.state, "fight");
  assert.equal(w.cutscene, null);
});

test("nothing hurts a boss before its fight starts", () => {
  const w = lair("octo"),
    hp = w.boss.core.hp;
  damage(w, w.boss.core, { amount: 50, source: w.player });
  assert.equal(w.boss.core.hp, hp);
});

test("parts have their own health, and losing a limb costs the core", () => {
  for (const id of ["lich", "octo", "nyarl"]) {
    const w = lair(id),
      b = engage(w),
      limb = b.parts.find((e) => e !== b.core && !e.def.minor),
      core = b.core.hp;
    damage(w, limb, { amount: 3, source: w.player });
    assert.equal(limb.hp, limb.maxhp - 3, `${id}: the limb took the hit`);
    assert.equal(b.core.hp, core, `${id}: the core didn't`);
    damage(w, limb, { amount: 1e5, source: w.player });
    w.sweep();
    assert.ok(limb.removed, `${id}: the limb is gone`);
    assert.ok(b.core.hp < core, `${id}: the core paid for it`);
  }
});

test("shock runs from one part through the rest of the body", () => {
  const w = lair("lich"),
    b = engage(w),
    others = b.parts.filter((e) => e !== b.core);
  damage(w, b.core, { amount: 4, elem: "shock", source: w.player });
  assert.ok(others.filter((e) => e.hp < e.maxhp).length >= 2, "the chain reached other parts");
});

test("a boss's own magma and poison don't hurt it", () => {
  const w = lair("octo"),
    b = engage(w),
    before = b.parts.map((e) => e.hp);
  damage(w, b.core, { amount: 10, source: b.parts[1] });
  w.spawn("poisonflame", b.core.x, b.core.y, { source: b.core });
  run(w, 0.5, idle);
  assert.deepEqual(
    b.parts.map((e) => e.hp),
    before,
  );
});

test("a shot aimed at one part flies past the others", () => {
  const w = lair("lich"),
    b = engage(w),
    p = w.player,
    head = b.parts.find((e) => e.type === "lichhead");
  b.attack = null;
  b.cd = 99;
  w.input = { mark: head };
  const dir = { x: (head.x - p.x) / Math.hypot(head.x - p.x, head.y - p.y), y: (head.y - p.y) / Math.hypot(head.x - p.x, head.y - p.y) };
  spawnProjectile(w, "arrow", p, dir, { amount: 5, kb: 0, speed: 10 });
  const hp = b.parts.map((e) => e.hp);
  for (let i = 0; i < 30; i++) w.step(1 / 30);
  b.parts.forEach((e, i) => {
    if (e === head) assert.ok(e.hp < hp[i], "the head was hit");
    else assert.equal(e.hp, hp[i], `${e.type} was passed by`);
  });
});

test("every boss gets through its whole moveset without trouble", () => {
  for (const id of ["lich", "octo", "nyarl"]) {
    const w = lair(id),
      b = engage(w),
      used = new Set();
    godMode(w.player);
    const all = Object.keys(b.def.moves);
    for (let i = 0; i < 240 * 30 && used.size < all.length; i++) {
      if (b.attack) used.add(b.attack.id);
      w.input = idle;
      w.step(1 / 30);
    }
    assert.deepEqual([...used].sort(), all.sort(), `${id} never used ${all.filter((m) => !used.has(m))}`);
    assert.ok(w.player.hp < w.player.maxhp, `${id} hurt the player`);
  }
});

test("nyarl's tentacles rise around its pool, and hallucination makes it untouchable", () => {
  const w = lair("nyarl"),
    b = engage(w);
  run(w, 6, idle);
  const t = b.parts.find((e) => e.type === "nyarltent");
  assert.ok(t, "a tentacle came up");
  assert.ok(Math.hypot(t.ax - b.x, t.ay - b.y) > 3, "out at the rim");
  b.immune = 3;
  const hp = b.core.hp;
  damage(w, b.core, { amount: 10, source: w.player });
  assert.equal(b.core.hp, hp);
});

test("killing the core ends the fight: lich and octo leave stairs, nyarl ends the run", () => {
  for (const id of ["lich", "octo", "nyarl"]) {
    const w = lair(id),
      b = engage(w);
    damage(w, b.core, { amount: 1e6, source: w.player });
    assert.equal(b.state, "dying");
    run(w, 3.5, idle);
    assert.ok(b.removed && !w.boss, `${id}: gone`);
    assert.ok(b.parts.every((e) => !alive(e)));
    assert.equal(w.run.slain.at(-1).id, id);
    const stairs = w.entities.some((e) => e.type === "stairs");
    if (id === "nyarl") assert.ok(w.victory && !stairs, "the run is won");
    else assert.ok(stairs && !w.victory, `${id}: the way on is open`);
    assert.ok(w.player.kills >= 1 && w.player.xp > 0, "the kill counts");
  }
});

test("the chronicle tells the run and leaves them going home", () => {
  const pages = chronicle({
    depth: 15,
    lv: 9,
    kills: 211,
    gold: 480,
    time: 3725,
    slain: [
      { id: "octo", name: "king octo", depth: 5 },
      { id: "lich", name: "the lich", depth: 10 },
      { id: "nyarl", name: "nyarl", depth: 15 },
    ],
    party: ["brin", "odo"],
  });
  const text = pages
    .flat()
    .map((l) => (Array.isArray(l) ? l[0] : l))
    .join("\n");
  for (const s of ["nyarl is dead", "floors descended: 15", "foes slain: 211", "62:05", "brin and odo", "went home"])
    assert.ok(text.includes(s), `mentions "${s}"`);
});
