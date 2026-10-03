import { test } from "node:test";
import assert from "node:assert/strict";
import "./helpers.js";
import { defs } from "../src/sim/defs.js";
import { SPRITE_KEYS, WEAPON_SPRITE_KEYS, PROJECTILE_SPRITES, BOSS_SPRITES } from "../src/view/assets/manifest.js";
import { World } from "../src/sim/world.js";
import { generateLevel } from "../src/sim/level.js";
import { existsSync } from "node:fs";
import { SHEETS } from "../src/view/assets/sheets.js";
import { PAPERDOLL_SHEETS } from "../src/view/assets/paperdoll.js";
import { PARTS, rollAppearance } from "../src/content/appearance.js";
import { readFileSync } from "node:fs";

const images = new Set([...SPRITE_KEYS, ...WEAPON_SPRITE_KEYS, ...PROJECTILE_SPRITES, ...Object.keys(SHEETS)]);
const frames = new Set(Object.values(SHEETS).flatMap((s) => s.frames));
const anims = new Set([...Object.values(SHEETS).flatMap((s) => Object.keys(s.anims || {})), "torch", "stairs"]);
const RENDERERS = ["creature", "wielder", "prop", "pickup", "projectile", "effect", "boss", "faller"];

test("every entity has a known renderer and existing sprites", () => {
  for (const [id, d] of Object.entries(defs.entities)) {
    const L = d.look;
    assert.ok(RENDERERS.includes(L.renderer), `${id}: unknown renderer ${L.renderer}`);
    if (L.sprite) assert.ok(images.has(L.sprite), `${id}: missing sprite ${L.sprite}`);
    if (L.anim) assert.ok(anims.has(L.anim), `${id}: missing animation ${L.anim}`);
    for (const a of Object.values(L.anims || {})) assert.ok(anims.has(a), `${id}: missing animation ${a}`);
    for (const f of L.debris || []) assert.ok(frames.has(f), `${id}: missing debris frame ${f}`);
    if (L.corpse) assert.ok(frames.has(L.corpse + "_g0"), `${id}: missing corpse ${L.corpse}_g0`);
    if (L.segment) {
      assert.ok(images.has(L.segment.sprite) && images.has(L.segment.tail), `${id}: missing segment sprites`);
      assert.ok(frames.has(L.segment.corpse + "_g0"), `${id}: missing segment corpse`);
    }
  }
});

test("boss sprites exist, and every layer a boss draws is one of them", () => {
  for (const [key, { dir }] of Object.entries(BOSS_SPRITES))
    assert.ok(existsSync(`assets/sprites/bosses/${dir}/${key}.png`), `missing ${dir}/${key}.png`);
  for (const depth of [5, 10, 15]) {
    const w = new World({ depth });
    generateLevel(w);
    for (const e of w.entities) {
      const draw = e.def.look.draw;
      if (!draw) continue;
      for (const L of draw(e, e.boss ?? e)) assert.ok(BOSS_SPRITES[L.key], `${e.type}: unknown boss sprite ${L.key}`);
    }
  }
});

test("every droppable weapon has a hand sprite", () => {
  for (const [id, w] of Object.entries(defs.weapons)) {
    if (w.natural) continue;
    assert.ok(images.has(w.spr), `${id}: missing sprite ${w.spr}`);
  }
});

test("status overlays exist as animations", () => {
  for (const [id, s] of Object.entries(defs.statuses))
    if (s.look?.overlay) assert.ok(anims.has(s.look.overlay), `${id}: missing overlay ${s.look.overlay}`);
});

test("paperdoll part counts match the sheets and rolls are valid", () => {
  const cols = { body: 4, head: 2, helmet: 2 };
  for (const [layer, sheet] of Object.entries(PAPERDOLL_SHEETS)) {
    const png = readFileSync(`assets/sheets/${sheet}.png`);
    assert.equal(png.readUInt32BE(16), cols[layer] * 8, `${sheet}: width`);
    assert.equal(png.readUInt32BE(20) / 8, PARTS[layer], `${sheet}: row count`);
  }
  for (let i = 0; i < 200; i++) {
    const a = rollAppearance();
    for (const layer of ["body", "head"]) assert.ok(a[layer] >= 0 && a[layer] < PARTS[layer]);
    assert.ok(a.helmet >= -1 && a.helmet < PARTS.helmet);
  }
});
