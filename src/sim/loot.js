import { defs } from "./defs.js";
import { rollItem } from "./items.js";

export function rollLoot(world, tableId, x, y) {
  let r = Math.random();
  for (const row of defs.loot[tableId]) {
    if (r < row.chance) return drop(world, row.drop, x, y);
    r -= row.chance;
  }
  return null;
}

export function drop(world, kind, x, y, item) {
  if (kind === "item") return world.spawn("item", x, y, { item: item ?? rollItem(world.depth) });
  return world.spawn(kind, x, y);
}
