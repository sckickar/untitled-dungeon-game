const CORNER = 6;

export const MANUAL_ICONS = {
  wasd: ["manual", "wasd"],
  mouse: ["manual", "mouse"],
};

export function buildManual(scene) {
  const t = scene.textures.get("manual");
  t.add("wasd", 0, 14, 19, 25, 19);
  t.add("mouse", 0, 104, 25, 9, 12);
  const src = t.getSourceImage(),
    { width: w, height: h } = src,
    C = CORNER,
    box = scene.textures.createCanvas("manualbox", C * 2, C * 2),
    ctx = box.getContext();
  for (const [sx, sy] of [[0, 0], [w - C, 0], [0, h - C], [w - C, h - C]])
    ctx.drawImage(src, sx, sy, C, C, sx ? C : 0, sy ? C : 0, C, C);
  box.refresh();
}
