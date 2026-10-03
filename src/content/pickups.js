import { ri } from "../lib/math.js";
import { pickup } from "../sim/templates.js";
import { heal } from "../sim/combat.js";
import { addStack } from "../sim/items.js";

const popup = (world, a, text, color) => world.emit("popup", { x: a.x, y: a.y, z: 14, text, color });

const ammo = (base, sprite, lo, hi) =>
  pickup({
    look: { sprite },
    onCollect(world, p) {
      const n = ri(lo, hi),
        left = addStack(p, base, n);
      if (left === n) return false;
      popup(world, p, "+" + (n - left), "w");
    },
  });

export const PICKUPS = {
  coin: pickup({
    look: { sprite: "coin" },
    onCollect(world, p) {
      const g = ri(1, 4) * Math.max(1, world.depth);
      p.gold += g;
      popup(world, p, "+" + g, "w");
    },
  }),
  potion: pickup({
    look: { sprite: "potion" },
    onCollect(world, p) {
      if (addStack(p, "potion", 1) > 0) return false;
      world.say("got a potion", 1.2);
    },
  }),
  manapotion: pickup({
    look: { sprite: "manapotion" },
    onCollect(world, p) {
      if (addStack(p, "manapotion", 1) > 0) return false;
      world.say("got a mana potion", 1.2);
    },
  }),
  arrows: ammo("arrow", "arrow", 3, 6),
  knives: ammo("knife", "throwingknife", 2, 4),
  axes: ammo("axe", "throwingaxe", 1, 3),
  item: pickup({ manual: true, r: 0.35 }),
};

export const STACKS = {
  potion: {
    icon: "potion",
    max: 9,
    price: 12,
    use(world, a) {
      if (a.hp >= a.maxhp) {
        if (a === world.player) world.say("hp is full", 0.8);
        return false;
      }
      heal(world, a, 10 + (a.lv ?? world.depth) * 2, { cause: "potion" });
    },
  },
  manapotion: {
    name: "mana potion",
    icon: "manapotion",
    max: 9,
    price: 12,
    use(world, a) {
      if (!a.maxmp || a.mp >= a.maxmp) {
        if (a === world.player) world.say("mp is full", 0.8);
        return false;
      }
      const n = 8 + (a.lv ?? world.depth) * 2;
      a.mp = Math.min(a.maxmp, a.mp + n);
      popup(world, a, "+" + n, "c");
    },
  },
  arrow: { icon: "arrow", max: 99, price: 1 },
  knife: { name: "throwing knife", plural: "throwing knives", icon: "throwingknife", max: 20, price: 3 },
  axe: { name: "throwing axe", icon: "throwingaxe", max: 12, price: 5 },
};
