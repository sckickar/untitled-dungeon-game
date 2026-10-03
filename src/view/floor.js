import { MW, MH } from "../config.js";
import { iso } from "../lib/iso.js";
import { ri } from "../lib/math.js";
import { defs } from "../sim/defs.js";
import { tilesOf } from "../content/biomes.js";

export function buildFloor(view) {
  const { scene, world } = view;
  const rw = (MW + MH) * 8 + 32,
    rh = (MW + MH) * 4 + 40;
  view.rt = scene.add
    .renderTexture(0, 0, rw, rh)
    .setOrigin(0, 0)
    .setDepth(-1e5);
  for (let ty = 0; ty < MH; ty++)
    for (let tx = 0; tx < MW; tx++) {
      const { look, dir } = lookAt(world, tx, ty);
      if (!look?.tile) continue;
      const p = iso(tx + 0.5, ty + 0.5);
      view.rt.draw(dir + look.tile(tx, ty), p.x - 8, p.y - 4);
    }
  view.walls = new Map();
  for (let ty = 0; ty < MH; ty++)
    for (let tx = 0; tx < MW; tx++) {
      const { look, dir } = lookAt(world, tx, ty);
      if (!look?.wall || !nearOpen(world, tx, ty)) continue;
      const p = iso(tx + 0.5, ty + 0.5);
      const w = scene.add
        .image(p.x, p.y, dir + look.wall)
        .setOrigin(0.5, 0.75)
        .setDepth(tx + ty + 1.5);
      w.hi = dir + look.wall;
      w.lo = dir + look.low;
      view.walls.set(ty * MW + tx, w);
      if (Math.random() < (look.torchChance || 0)) {
        let tp = null;
        if (
          !world.solid(tx, ty + 1) &&
          world.solid(tx - 1, ty) &&
          world.solid(tx + 1, ty)
        )
          tp = iso(tx + 0.5, ty + 1);
        else if (
          !world.solid(tx + 1, ty) &&
          world.solid(tx, ty - 1) &&
          world.solid(tx, ty + 1)
        )
          tp = iso(tx + 1, ty + 0.5);
        if (tp)
          w.torch = scene.add
            .sprite(tp.x, tp.y - 6, "torch0")
            .play({ key: "torch", startFrame: ri(0, 1) })
            .setDepth(tx + ty + 1.6);
      }
    }
}

const lookAt = (world, tx, ty) => {
  const t = world.terrain(tx, ty),
    b = defs.biomes[world.biome],
    look = b?.terrain?.[t.id];
  return look ? { look, dir: `${tilesOf(world, b)}/` } : { look: t.look, dir: "" };
};

const nearOpen = (world, tx, ty) => {
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++)
      if (!world.solid(tx + dx, ty + dy)) return true;
  return false;
};

export function updateCutaway(view) {
  const p = view.world.player;
  if (!p) return;
  const pt = p.x + p.y,
    pd = p.x - p.y,
    next = new Set();
  if (!p.dead) {
    const bx = Math.floor(p.x),
      by = Math.floor(p.y);
    for (let ty = by - 1; ty <= by + 4; ty++)
      for (let tx = bx - 1; tx <= bx + 4; tx++) {
        const i = ty * MW + tx;
        if (!view.walls.has(i)) continue;
        const s = tx + ty + 1.5,
          dd = tx - ty;
        if (s > pt && s - pt < 3.4 && Math.abs(dd - pd) < 2.3) next.add(i);
      }
  }
  for (const i of view.low)
    if (!next.has(i)) {
      const w = view.walls.get(i);
      w.setTexture(w.hi).setOrigin(0.5, 0.75);
      if (w.torch) w.torch.setVisible(true);
    }
  for (const i of next)
    if (!view.low.has(i)) {
      const w = view.walls.get(i);
      w.setTexture(w.lo).setOrigin(0.5, 0.6);
      if (w.torch) w.torch.setVisible(false);
    }
  view.low = next;
}
