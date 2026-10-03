import { damage } from "../sim/combat.js";
import { has } from "../sim/entity.js";

const monstersOnly = (e) => has(e, "creature") && !has(e, "player");

export const STATUSES = {
  burning: {
    duration: 2.5,
    tick: 0.5,
    onTick(world, e, s) {
      damage(world, e, { amount: s.dmg, elem: "fire", color: "m", source: s.source });
    },
    look: { overlay: "fire" },
  },
  shocked: {
    duration: 1,
    look: { overlay: "spark" },
  },
  poisoned: {
    duration: 4,
    tick: 0.7,
    onTick(world, e, s) {
      damage(world, e, { amount: s.dmg ?? 1, color: "c", source: s.source });
    },
    look: { blink: "c", popup: "poisoned", popupCol: "c" },
  },
  slowed: {
    duration: 2,
    speed: 0.45,
    look: { blink: "c" },
  },
  cursed: {
    duration: 6,
    tick: 1,
    speed: 0.65,
    weaken: 0.6,
    canAffect: (e) => has(e, "creature") && !has(e, "vendor"),
    onTick(world, e, s) {
      damage(world, e, { amount: s.dmg ?? 1, elem: "curse", color: "m", source: s.source });
    },
    look: { overlay: "manabeam", blink: "m", popup: "cursed", popupCol: "m" },
  },

  horny: {
    duration: 15,
    tags: ["horny"],
    canAffect: monstersOnly,
    look: { blink: "m", popup: "<3", popupCol: "m" },
  },
  gay: {
    duration: Infinity,
    tags: ["samesex"],
    canAffect: monstersOnly,
    look: { popup: "<3", popupCol: "c" },
  },
  sated: {
    duration: 30,
    tags: ["sated"],
  },
};
