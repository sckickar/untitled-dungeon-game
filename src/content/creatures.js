import { rnd, pick, dist } from "../lib/math.js";
import { creature } from "../sim/templates.js";
import { makeItem, rollItem } from "../sim/items.js";
import { makeGrid } from "../sim/grid.js";
import { xpForLevel } from "../sim/progression.js";
import { applyStatus } from "../sim/status.js";
import { alive, has } from "../sim/entity.js";
import { rollAppearance } from "./appearance.js";

export const monster = (d) =>
  creature({
    team: "monster",
    loot: "monster",
    spdJitter: 0.1,
    gearDrop: 0.3,
    ...d,
    setup(world, e, init) {
      const mul = 1 + 0.25 * (world.depth - 1);
      e.hp = e.maxhp = Math.round(d.hp * mul);
      e.atk = d.atk + Math.floor((world.depth - 1) / 2);
      e.cds.main = rnd(0.3, 1);
      e.sex = pick(["m", "f"]);
      if (d.gear && Math.random() < (d.gear.chance ?? 1))
        for (const slot of ["main", "off"])
          if (d.gear[slot])
            e.equip[slot] = rollItem(world.depth, pick(d.gear[slot]), {
              spells: d.gear.spells,
            });
      d.setup?.(world, e, init);
    },
  });

export const CREATURES = {
  player: creature({
    team: "player",
    brain: "player",
    tags: ["player"],
    hp: 24,
    mp: 10,
    atk: 4,
    spd: 3.7,
    r: 0.26,
    weight: 7 / 3,
    iframes: 0.8,
    kbDecay: 0.002,
    keepOnDeath: true,
    carry: [
      "hp",
      "maxhp",
      "mp",
      "maxmp",
      "atk",
      "lv",
      "xp",
      "next",
      "gold",
      "kills",
      "equip",
      "bag",
      "appearance",
      "party",
      "run",
    ],
    look: {
      renderer: "wielder",
      paperdoll: true,
      idle: { front: 0, back: 2 },
      outline: "c",
      blood: "m",
      corpse: "c_player",
      hurt: "player",
      death: "player",
    },
    setup(world, e, { carry }) {
      Object.assign(e, {
        lv: 1,
        xp: 0,
        next: xpForLevel(1),
        gold: 0,
        kills: 0,
      });
      e.bag = makeGrid();
      e.bag[0] = { base: "potion", qty: 1 };
      e.equip = { main: makeItem("sword"), off: null };
      e.appearance = rollAppearance();
      e.party = [];
      e.run = world.run ??= {};
      if (carry) Object.assign(e, carry);
    },
  }),

  slime: monster({
    hp: 6,
    atk: 2,
    spd: 1.1,
    xp: 2,
    r: 0.3,
    wind: 0.28,
    mass: 1,
    brain: "melee",
    equip: { main: "bite" },
    spawn: { minDepth: 1, weight: 4 },
    look: {
      sprite: "slime",
      anim: "slime",
      outline: "m",
      blood: "c",
      corpse: "c_slime",
      gibs: 5,
    },
  }),

  bat: monster({
    hp: 3,
    atk: 1,
    spd: 2.7,
    xp: 2,
    r: 0.22,
    wind: 0.15,
    mass: 0.7,
    tags: ["flying"],
    brain: "weaver",
    equip: { main: "bite" },
    spawn: { minDepth: 1, weight: 3 },
    look: {
      sprite: "bat",
      anim: "bat",
      z: 7,
      outline: "m",
      blood: "m",
      corpse: "c_bat",
      gibs: 4,
    },
  }),

  snake: monster({
    hp: 14,
    atk: 3,
    spd: 2.1,
    xp: 6,
    r: 0.24,
    wind: 0.3,
    mass: 1.5,
    segs: 7,
    brain: "serpent",
    equip: { main: "bite" },
    spawn: { minDepth: 1, weight: 2 },
    look: {
      sprite: "snake",
      anim: "snake",
      outline: "m",
      blood: "m",
      corpse: "c_snhead",
      gibs: 2,
      segment: { sprite: "snake_seg", tail: "snake_tail", corpse: "c_snseg" },
    },
  }),

  skel: monster({
    hp: 11,
    atk: 3,
    spd: 1.55,
    xp: 4,
    r: 0.28,
    wind: 0.32,
    mass: 1,
    tags: ["undead"],
    brain: "melee",
    equip: { main: "bite" },
    gear: {
      chance: 0.9,
      main: [
        "sword",
        "sword",
        "scimitar",
        "spear",
        "dagger",
        "katana",
        "greatsword",
        "halberd",
        "scythe",
      ],
    },
    weaponCdMul: 3,
    spawn: { minDepth: 2, weight: 3 },
    look: {
      sprite: "skel",
      anim: "skel",
      outline: "m",
      blood: "w",
      corpse: "c_skel",
      gibs: 7,
      handY: 4,
    },
  }),

  cult: monster({
    hp: 8,
    atk: 3,
    spd: 1.3,
    xp: 5,
    r: 0.28,
    mass: 1,
    mp: 6,
    brain: "caster",
    gear: { chance: 1, main: ["staff", "staff", "magicwand", "bloodwand"] },
    spawn: { minDepth: 3, weight: 2 },
    look: {
      sprite: "cult",
      anim: "cult",
      outline: "m",
      blood: "m",
      corpse: "c_cult",
      gibs: 7,
      handY: 3,
    },
  }),

  brute: monster({
    hp: 28,
    atk: 6,
    spd: 1.1,
    xp: 12,
    r: 0.42,
    wind: 0.55,
    mass: 3,
    tags: ["unstoppable"],
    brain: "melee",
    equip: { main: "bite" },
    spawn: { minDepth: 4, weight: 1 },
    look: {
      sprite: "brute",
      anim: "brute",
      outline: "m",
      blood: "m",
      corpse: "c_brute",
      gibs: 16,
      pool: "cp_big_m",
      spray: 42,
    },
  }),

  hive: monster({
    hp: 30,
    atk: 0,
    spd: 0,
    xp: 10,
    r: 0.45,
    mass: 1000,
    weight: 1000,
    brain: "spawner",
    minions: { type: "bee", every: 2.2, max: 5 },
    spawn: { minDepth: 2, weight: 2, max: 2, biomes: { stone: 0.05 } },
    look: { sprite: "hive", outline: "m", blood: "m", gibs: 10, spray: 30 },
  }),
  bee: monster({
    hp: 2,
    atk: 1,
    spd: 3,
    xp: 0,
    r: 0.18,
    wind: 0.12,
    mass: 0.5,
    loot: null,
    tags: ["flying"],
    brain: "weaver",
    equip: { main: "bite" },
    look: {
      sprite: "bees",
      anim: "bee",
      z: 7,
      outline: "m",
      blood: "c",
      gibs: 2,
      spray: 8,
    },
  }),

  fleshking: monster({
    hp: 36,
    atk: 0,
    spd: 0.7,
    xp: 14,
    r: 0.5,
    mass: 4,
    weight: 4,
    tags: ["unstoppable"],
    brain: "spawner",
    minions: { type: "fleshling", every: 2.8, max: 4, keepAway: 3 },

    onDeath(world, e) {
      world.spawn("explosion", e.x, e.y);
      const dmg = 1 + Math.floor(world.depth / 4);
      for (const t of world.entities)
        if (t !== e && alive(t) && has(t, "creature") && dist(t, e) < 1.5)
          applyStatus(world, t, "poisoned", { dmg, source: e });
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * 6.283 + rnd(-0.2, 0.2),
          s = rnd(3, 5.5);
        world.spawn("poisonflame", e.x, e.y, {
          source: e,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          dmg,
        });
      }
    },
    spawn: { minDepth: 4, weight: 2, max: 2, biomes: { stone: 0.05 } },
    look: {
      sprite: "fleshking",
      anims: { front: "fleshking_f", back: "fleshking_b" },
      outline: "m",
      blood: "m",
      gibs: 18,
      pool: "cp_big_m",
      spray: 46,
    },
  }),
  fleshling: monster({
    hp: 4,
    atk: 1,
    spd: 2,
    xp: 0,
    r: 0.2,
    wind: 0.2,
    mass: 0.6,
    loot: null,
    brain: "melee",
    equip: { main: "bite" },
    look: {
      sprite: "fleshling",
      anims: { front: "fleshling_f", back: "fleshling_b" },
      outline: "m",
      blood: "m",
      gibs: 3,
      spray: 12,
    },
  }),

  ghoul: monster({
    hp: 7,
    atk: 2,
    spd: 2.3,
    xp: 3,
    r: 0.24,
    wind: 0.2,
    mass: 0.8,
    tags: ["undead"],
    brain: "weaver",
    equip: { main: "bite" },
    spawn: { minDepth: 1, weight: 3, only: ["stone"] },
    look: {
      sprite: "skel2",
      anims: { front: "skel2_f", back: "skel2_b" },
      outline: "m",
      blood: "m",
      gibs: 5,
      spray: 14,
    },
  }),

  necromancer: monster({
    hp: 14,
    atk: 3,
    spd: 1.2,
    xp: 10,
    r: 0.28,
    mass: 1,
    mp: 10,
    brain: "summoner",
    minions: { type: "risen", every: 4, max: 3 },
    gear: {
      chance: 0.75,
      main: ["staff"],
      spells: ["lightning", "hex", "bloodsiphon", "manasiphon"],
    },
    spawn: { minDepth: 5, weight: 2, max: 2, only: ["soul"] },
    look: {
      sprite: "necromancer",
      anims: { front: "necromancer_f", back: "necromancer_b" },
      outline: "m",
      blood: "m",
      gibs: 7,
      handY: 3,
    },
  }),
  risen: monster({
    hp: 6,
    atk: 2,
    spd: 1.4,
    xp: 0,
    r: 0.28,
    wind: 0.35,
    mass: 1,
    loot: null,
    tags: ["undead"],
    brain: "melee",
    equip: { main: "bite" },
    look: {
      sprite: "skel",
      anim: "skel",
      outline: "m",
      blood: "w",
      corpse: "c_skel",
      gibs: 5,
      handY: 4,
    },
  }),

  rotcorpse: monster({
    name: "rotting corpse",
    hp: 11,
    atk: 3,
    spd: 1.55,
    xp: 5,
    r: 0.28,
    wind: 0.32,
    mass: 1,
    tags: ["undead"],
    brain: "buried",
    equip: { main: "bite" },
    onStrike(world, e, t) {
      applyStatus(world, t, "poisoned", { dmg: 1, duration: 2.5, source: e });
    },
    onDeath(world, e) {
      for (const t of world.entities)
        if (t !== e && alive(t) && has(t, "creature") && dist(t, e) < 1)
          applyStatus(world, t, "poisoned", { dmg: 1, duration: 2.5, source: e });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283 + rnd(-0.3, 0.3),
          s = rnd(1.5, 3);
        world.spawn("poisonflame", e.x, e.y, { source: e, vx: Math.cos(a) * s, vy: Math.sin(a) * s, dmg: 1 });
      }
    },
    look: {
      sprite: "rottingcorpse",
      anims: { front: "rottingcorpse_f", back: "rottingcorpse_b" },
      outline: "m",
      blood: "c",
      gibs: 6,
      spray: 14,
    },
  }),

  hexer: monster({
    hp: 10,
    atk: 3,
    spd: 1.35,
    xp: 7,
    r: 0.28,
    mass: 1,
    mp: 8,
    brain: "caster",
    gear: {
      chance: 1,
      main: ["staff"],
      spells: ["hex", "hex", "bloodsiphon", "eruption"],
    },
    spawn: { minDepth: 5, weight: 2, only: ["soul"] },
    look: {
      sprite: "cult2",
      anims: { front: "cult2_f", back: "cult2_b" },
      outline: "m",
      blood: "m",
      gibs: 7,
      handY: 3,
    },
  }),

  ravager: monster({
    hp: 22,
    atk: 5,
    spd: 2.6,
    xp: 14,
    r: 0.4,
    wind: 0.35,
    mass: 2.5,
    tags: ["unstoppable"],
    brain: "melee",
    equip: { main: "bite" },
    spawn: { minDepth: 10, weight: 2, only: ["flesh"] },
    look: {
      sprite: "fastbrute",
      anims: { front: "fastbrute_f", back: "fastbrute_b" },
      outline: "m",
      blood: "m",
      gibs: 14,
      pool: "cp_big_m",
      spray: 36,
    },
  }),

  lizardbrute: monster({
    hp: 34,
    atk: 6,
    spd: 1,
    xp: 18,
    r: 0.42,
    wind: 0.6,
    mass: 3.5,
    tags: ["unstoppable"],
    brain: "melee",
    equip: { main: "bite" },
    ability: { spell: "eruption", every: 7, range: 6 },
    spawn: { minDepth: 10, weight: 2, only: ["flesh"] },
    look: {
      sprite: "lizardbrute",
      anim: "lizardbrute",
      outline: "m",
      blood: "c",
      gibs: 16,
      spray: 40,
    },
  }),
};
