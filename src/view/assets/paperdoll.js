export const PAPERDOLL_SHEETS = {
  body: "char_bodies",
  head: "char_heads",
  helmet: "char_helmets",
};

const S = 8,
  R = S + 2;

const FRAMES = [
  { body: 0, top: 0 },
  { body: 1, top: 0 },
  { body: 2, top: 1 },
  { body: 3, top: 1 },
];
const N = FRAMES.length;

const dollKey = (a) => `doll_${a.body}_${a.head}_${a.helmet}`;

function layerCanvas(scene, look, layers) {
  const c = document.createElement("canvas");
  c.width = S * N;
  c.height = S;
  const ctx = c.getContext("2d");
  for (const layer of layers) {
    if (!(look[layer] >= 0)) continue;
    const img = scene.textures.get(PAPERDOLL_SHEETS[layer]).getSourceImage();
    FRAMES.forEach((f, i) => {
      const col = layer === "body" ? f.body : f.top;
      ctx.drawImage(img, col * S, look[layer] * S, S, S, i * S, 0, S, S);
    });
  }
  return c;
}

function addSheet(scene, key, canvas, w, h) {
  const t = scene.textures.addCanvas(key, canvas);
  for (let i = 0; i < N; i++) t.add(i, 0, i * w, 0, w, h);
}

function ringCanvas(full) {
  const src = full.getContext("2d").getImageData(0, 0, full.width, S).data,
    solid = (x, y) =>
      x >= 0 &&
      y >= 0 &&
      x < S * N &&
      y < S &&
      src[(y * S * N + x) * 4 + 3] > 0;
  const c = document.createElement("canvas");
  c.width = R * N;
  c.height = R;
  const ctx = c.getContext("2d"),
    out = ctx.createImageData(c.width, R);
  for (let i = 0; i < N; i++)
    for (let y = -1; y <= S; y++)
      for (let x = -1; x <= S; x++) {
        const fx = (x) => (x >= 0 && x < S ? i * S + x : -1),
          at = (dx, dy) => fx(x + dx) >= 0 && solid(fx(x + dx), y + dy);
        if (at(0, 0) || !(at(1, 0) || at(-1, 0) || at(0, 1) || at(0, -1)))
          continue;
        out.data.fill(
          255,
          ((y + 1) * c.width + i * R + x + 1) * 4,
          ((y + 1) * c.width + i * R + x + 2) * 4,
        );
      }
  ctx.putImageData(out, 0, 0);
  return c;
}

export function paperdoll(scene, look) {
  const key = dollKey(look),
    doll = {
      key,
      helm: look.helmet >= 0 ? key + "_helm" : null,
      ring: key + "_ring",
      corpse: key + "_corpse",
      front: key + "_f",
      back: key + "_b",
    };
  if (scene.textures.exists(key)) return doll;

  const full = layerCanvas(scene, look, ["body", "head", "helmet"]),
    base = layerCanvas(scene, look, ["body", "head"]);
  if (doll.helm) {
    const helm = layerCanvas(scene, look, ["helmet"]),
      bctx = base.getContext("2d");
    bctx.globalCompositeOperation = "destination-out";
    bctx.drawImage(helm, 0, 0);
    addSheet(scene, doll.helm, helm, S, S);
  }
  addSheet(scene, key, base, S, S);
  addSheet(scene, doll.ring, ringCanvas(full), R, R);

  const corpse = document.createElement("canvas");
  corpse.width = corpse.height = S;
  const cctx = corpse.getContext("2d");
  cctx.imageSmoothingEnabled = false;
  cctx.translate(S / 2, S / 2);
  cctx.rotate(-Math.PI / 2);
  cctx.drawImage(full, 0, 0, S, S, -S / 2, -S / 2, S, S);
  scene.textures.addCanvas(doll.corpse, corpse);

  const A = scene.anims;
  A.create({
    key: doll.front,
    frames: [0, 1].map((frame) => ({ key, frame })),
    frameRate: 7,
    repeat: -1,
  });
  A.create({
    key: doll.back,
    frames: [2, 3].map((frame) => ({ key, frame })),
    frameRate: 7,
    repeat: -1,
  });
  return doll;
}
