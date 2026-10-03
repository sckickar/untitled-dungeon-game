import "../src/content/index.js";
import { MW, MH } from "../src/config.js";
import { World } from "../src/sim/world.js";
import { terrainIndex } from "../src/sim/defs.js";

export function arena({ depth = 1, x = 20.5, y = 20.5 } = {}) {
  const w = new World({ depth });
  w.tiles.fill(terrainIndex("floor"));
  const wall = terrainIndex("wall");
  for (let i = 0; i < MW; i++) {
    w.setTile(i, 0, wall);
    w.setTile(i, MH - 1, wall);
  }
  for (let i = 0; i < MH; i++) {
    w.setTile(0, i, wall);
    w.setTile(MW - 1, i, wall);
  }
  w.player = w.spawn("player", x, y);
  return w;
}

export function run(w, secs, input = null) {
  const dt = 1 / 30;
  for (let i = 0; i < Math.round(secs / dt); i++) {
    w.input = typeof input === "function" ? input(i) : input;
    w.step(dt);
  }
}

export const idle = { move: { x: 0, y: 0 } };
export const press = (aim, slot = "main") => ({ move: { x: 0, y: 0 }, aim, [slot]: { pressed: true, held: true } });

export const pacify = (e) => {
  e.def = { ...e.def, brain: null };
  return e;
};
