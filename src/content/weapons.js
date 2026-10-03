import { slash, spin, shoot, cast, zap, toss, lunge, spit } from "../sim/attacks.js";
import { projectile } from "../sim/templates.js";

export const WEAPON_KINDS = {
  melee: {
    grip: [0.15, 0.5],
    use(world, a, slot, it, input, dir) {
      if (input.pressed) slash(world, a, dir, it, slot);
    },
  },
  spin: {
    grip: [0.15, 0.5],
    use(world, a, slot, it, input, dir) {
      if (input.pressed) spin(world, a, dir, it, slot);
    },
  },
  bow: {
    grip: [0.5, 0.5],
    use(world, a, slot, it, input, dir) {
      if (input.pressed) shoot(world, a, dir, it, slot);
    },
  },
  staff: {
    grip: [0.3, 0.5],
    use(world, a, slot, it, input, dir, dt) {
      cast(world, a, it, slot, input, dir, dt);
    },
  },

  wand: {
    grip: [0.2, 0.5],
    use(world, a, slot, it, input, dir) {
      if (input.pressed) zap(world, a, dir, it, slot);
    },
  },

  thrown: {
    grip: [0.35, 0.5],
    use(world, a, slot, it, input, dir) {
      if (input.pressed) toss(world, a, dir, it, slot);
    },
  },
  shield: {
    grip: [0.5, 0.5],
    use(world, a, slot, it, input) {
      if (input.held) a.blocking = true;
    },
  },
  lunge: { windup: true, release: lunge },
  spit: { windup: true, release: spit },
};

const MISSILES = {
  fire: { elem: "fire" },
  frost: { elem: "frost" },
  shock: { elem: "shock" },
  wind: { elem: "wind" },
  explosive: { elem: "explosion" },
};
const FIREBALL = { fireball: { elem: "fire", projectile: "fireball" } };

const BIG = {
  big: true,
  slash: "slashwind",
  back: true,
  backRot: -1.2,
  slots: ["main"],
};
const AFFIXES = { suffixChance: 0.4, extraSuffixChance: 0.25 };

export const WEAPONS = {
  sword: {
    kind: "melee",
    spr: "sword",
    slots: ["main", "off"],
    atk: [1, 3],
    cd: 0.3,
    reach: 1.15,
    arc: 0.35,
    ...AFFIXES,
  },
  scimitar: {
    kind: "melee",
    spr: "scimitar",
    slots: ["main", "off"],
    atk: [0, 2],
    cd: 0.22,
    reach: 1.05,
    arc: 0.1,
    ...AFFIXES,
  },
  dagger: {
    kind: "melee",
    spr: "dagger",
    slots: ["main", "off"],
    atk: [0, 2],
    cd: 0.16,
    reach: 0.9,
    arc: 0.45,
    crit: 0.1,
    ...AFFIXES,
  },
  katana: {
    kind: "melee",
    spr: "katana",
    size: [2, 1],
    slots: ["main", "off"],
    atk: [1, 3],
    cd: 0.17,
    reach: 0.95,
    arc: -0.35,
    grip: [0.1, 0.75],
    ...AFFIXES,
  },
  spear: {
    kind: "melee",
    spr: "spear",
    slots: ["main", "off"],
    atk: [2, 4],
    cd: 0.45,
    reach: 2.1,
    arc: 0.8,
    ...AFFIXES,
  },
  greatsword: {
    kind: "melee",
    spr: "greatsword",
    size: [2, 1],
    ...BIG,
    atk: [3, 5],
    cd: 0.55,
    reach: 1.6,
    arc: 0.2,
    kb: 9,
    grip: [0.08, 0.62],
    ...AFFIXES,
  },
  halberd: {
    kind: "melee",
    spr: "halberd",
    size: [2, 1],
    ...BIG,
    atk: [3, 6],
    cd: 0.65,
    reach: 2.25,
    arc: 0.65,
    kb: 9,
    grip: [0.08, 0.45],
    ...AFFIXES,
  },
  scythe: {
    kind: "melee",
    spr: "scythe",
    size: [2, 2],
    ...BIG,
    atk: [2, 5],
    cd: 0.6,
    reach: 1.75,
    arc: -0.2,
    kb: 8,
    grip: [0.08, 0.42],
    ...AFFIXES,
  },
  excalibur: {
    kind: "spin",
    spr: "excalibur",
    size: [2, 1],
    slots: ["main"],
    atk: [4, 6],
    cd: 0.55,
    reach: 1.5,
    kb: 8,
    spinT: 0.3,
    dropWeight: 0.15,
    price: 60,
    ...AFFIXES,
  },
  miramasa: {
    kind: "spin",
    spr: "miramasa",
    size: [2, 1],
    slots: ["main"],
    atk: [3, 5],
    cd: 0.4,
    reach: 1.35,
    kb: 5,
    spinT: 0.24,
    elem: "curse",
    edmg: 1,
    dropWeight: 0.15,
    price: 60,
    ...AFFIXES,
  },
  windstaff: {
    kind: "melee",
    spr: "windstaff",
    size: [2, 1],
    slots: ["main", "off"],
    atk: [0, 1],
    cd: 0.5,
    reach: 1.6,
    arc: 0.0,
    kb: 6,
    elem: "wind",
    edmg: 1,
    slash: "slashwind",
    back: true,
    backRot: -1.2,
    grip: [0.3, 0.5],
  },
  bow: {
    kind: "bow",
    spr: "bow",
    size: [1, 2],
    slots: ["main", "off"],
    atk: [1, 3],
    cd: 0.45,
    spd: 10,
    ammo: "arrow",
    projectile: "arrow",
    range: 6,
    back: true,
    backRot: 0.5,
    ...AFFIXES,
    variants: [
      { spr: "bow" },
      { spr: "bow2" },
    ],
  },
  largebow: {
    kind: "bow",
    spr: "largebow",
    size: [1, 2],
    ...BIG,
    slash: null,
    backRot: 0.5,
    atk: [3, 5],
    cd: 0.75,
    spd: 13,
    kb: 6,
    ammo: "arrow",
    projectile: "arrow",
    range: 7,
    ...AFFIXES,
  },
  staff: {
    kind: "staff",
    spr: "staff",
    size: [2, 1],
    slots: ["main", "off"],
    atk: [0, 2],
    spell: "lightning",
    back: true,
    backRot: -1.2,
  },
  magicwand: {
    kind: "wand",
    spr: "magicwand",
    size: [2, 2],
    slots: ["main", "off"],
    atk: [1, 3],
    cd: 0.35,
    mp: 2,
    projectile: "magicmissile",
    range: 6,
    bolts: { ...MISSILES, ...FIREBALL },
    ...AFFIXES,
  },
  bloodwand: {
    kind: "wand",
    spr: "bloodwand",
    size: [2, 1],
    slots: ["main", "off"],
    atk: [2, 4],
    cd: 0.3,
    hp: 1,
    projectile: "magicmissile",
    range: 6,
    bolts: MISSILES,
    ...AFFIXES,
  },
  throwingknife: {
    kind: "thrown",
    spr: "throwingknife",
    slots: ["main", "off"],
    atk: [1, 3],
    cd: 0.25,
    spd: 11,
    kb: 2,
    ammo: "knife",
    projectile: "thrown",
    range: 5,
    ...AFFIXES,
  },
  throwingaxe: {
    kind: "thrown",
    spr: "throwingaxe",
    slots: ["main", "off"],
    atk: [2, 4],
    cd: 0.45,
    spd: 9,
    kb: 5,
    ammo: "axe",
    projectile: "thrown",
    range: 5,
    ...AFFIXES,
  },
  shield: {
    kind: "shield",
    spr: "shield",
    slots: ["off"],
    dur: [6, 12],
    ...AFFIXES,
    variants: [
      { spr: "shield" },
      { spr: "shield2" },
    ],
  },

  greatshield: {
    kind: "shield",
    spr: "greatshield",
    slots: ["off"],
    dur: [12, 20],
    blockArc: 0,
    ...AFFIXES,
  },

  bite: { kind: "lunge", natural: true, slots: ["main"], cd: 1.1 },
};

export const PROJECTILES = {
  arrow: projectile({ speed: 10, look: { sprite: "arrow", rotate: true } }),
  magicmissile: projectile({
    speed: 7,
    homing: 7,
    tint: true,
    look: { sprite: "magicmissile", rotate: true },
  }),
  fireball: projectile({
    speed: 6,
    homing: 6,
    life: 2,
    look: { sprite: "flame", anim: "fireball", trail: { sprite: "flame", anim: "flame", every: 0.03, life: 0.3 } },
  }),

  thrown: projectile({
    speed: 10,
    life: 1,
    spin: 20,
    breaks: true,
    look: { sprite: "throwingknife" },
  }),
};
