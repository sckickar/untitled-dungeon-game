import { COL } from "../config.js";

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function addOutline(scene, spr, color) {
  spr.outline = DIRS.map(([dx, dy]) =>
    scene.add
      .image(0, 0, spr.texture.key, spr.frame.name)
      .setOrigin(spr.originX, spr.originY)
      .setTintFill(COL[color])
      .setData("off", [dx, dy]),
  );
  return spr;
}

export function syncOutline(spr) {
  if (!spr.outline) return;
  for (const o of spr.outline) {
    const [dx, dy] = o.getData("off");
    o.setTexture(spr.texture.key, spr.frame.name)
      .setPosition(spr.x + dx, spr.y + dy)
      .setFlipX(spr.flipX)
      .setRotation(spr.rotation)
      .setVisible(spr.visible)
      .setDepth(spr.depth - 0.001);
  }
}

export function tintOutline(spr, color) {
  if (spr.outline) spr.outline.forEach((s) => s.setTintFill(COL[color]));
}

export function killOutline(spr) {
  if (spr.outline) spr.outline.forEach((o) => o.destroy());
  spr.outline = null;
}
