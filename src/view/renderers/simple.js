import { COL } from "../../config.js";
import { iso } from "../../lib/iso.js";
import { ri, rnd } from "../../lib/math.js";
import { iconOf } from "../../sim/items.js";
import { addOutline, syncOutline, killOutline, tintOutline } from "../outline.js";
import { syncOverlays, destroyOverlays, tintFor, applyTint } from "./common.js";

const plain = (rec) => {
  if (rec.spr.outline) killOutline(rec.spr);
  rec.spr.destroy();
  destroyOverlays(rec);
};

export const prop = {
  create(view, e) {
    return { spr: view.scene.add.image(0, 0, e.def.look.sprite).setOrigin(0.5, 1) };
  },
  update(view, e, rec, dt) {
    const sp = iso(e.x, e.y);
    rec.spr.setPosition(sp.x, sp.y + (e.def.look.yOff || 0)).setDepth(e.x + e.y);
    if (rec.wob > 0) {
      rec.wob = Math.max(0, rec.wob - dt * 2.5);
      rec.spr.setRotation(Math.sin(rec.wob * 20) * rec.wob * 0.35 * rec.wobDir);
    }
    applyTint(rec.spr, tintFor(e));
    syncOverlays(view, e, rec, sp.x, sp.y);
  },
  destroy: (view, e, rec) => plain(rec),
};

export const pickup = {
  create(view, e) {
    const key = e.item ? iconOf(e.item) : e.def.look.sprite;
    const spr = view.scene.add.image(0, 0, key).setOrigin(0.5, 1);
    if (e.item) addOutline(view.scene, spr, "w");
    return { spr };
  },
  update(view, e, rec) {
    const sp = iso(e.x, e.y),
      bob = e.rest > 0 && Math.floor(e.t * 2.5) % 2 ? 1 : 0;
    rec.spr
      .setPosition(sp.x, sp.y + 1 - e.z - bob)
      .setDepth(e.x + e.y)
      .setAlpha(e.dragging ? 0.4 : 1);
    if (e.item) {
      syncOutline(rec.spr);
      tintOutline(rec.spr, e === view.hoverPick ? "c" : "w");
    }
  },
  destroy: (view, e, rec) => plain(rec),
};

export const projectile = {
  create(view, e) {
    const L = e.def.look,
      spr = view.scene.add.sprite(0, 0, e.sprite ?? L.sprite);
    if (L.anim) spr.play(L.anim);
    if (e.tinted) spr.setTintFill(COL[e.color]);
    return { spr, rot: Math.atan2((e.vx + e.vy) * 0.5, e.vx - e.vy) };
  },
  update(view, e, rec, dt) {
    const sp = iso(e.x, e.y);
    if (e.def.spin) rec.rot += e.def.spin * dt;
    else if (e.def.look.rotate) rec.rot = Math.atan2((e.vx + e.vy) * 0.5, e.vx - e.vy);
    rec.spr
      .setPosition(sp.x, sp.y - e.z)
      .setDepth(e.x + e.y + 0.1)
      .setRotation(e.def.spin || e.def.look.rotate ? rec.rot : 0);
    const T = e.def.look.trail;
    if (T && dt > 0 && (rec.trailT = (rec.trailT ?? 0) - dt) <= 0) {
      rec.trailT = T.every ?? 0.04;
      dropTrail(view, T, sp.x + rnd(-1, 1), sp.y - e.z + rnd(-1, 1), e.x + e.y);
    }
  },
  destroy: (view, e, rec) => plain(rec),
};

function dropTrail(view, T, x, y, depth) {
  const s = view.scene,
    fx = s.add.sprite(x, y, T.sprite).setDepth(depth).setScale(T.scale ?? 0.8).setAlpha(T.alpha ?? 0.9);
  if (T.anim) fx.play(T.anim);
  s.tweens.add({
    targets: fx,
    y: y - (T.rise ?? 3),
    scale: 0.2,
    alpha: 0,
    duration: (T.life ?? 0.3) * 1000,
    onComplete: () => fx.destroy(),
  });
}

export const effect = {
  create(view, e) {
    const L = e.def.look,
      spr = view.scene.add.sprite(0, 0, L.sprite).setOrigin(...(L.origin || [0.5, 0.5]));
    if (L.anim) spr.play(L.randomFrame ? { key: L.anim, startFrame: ri(0, 1) } : L.anim);
    return { spr };
  },
  update(view, e, rec) {
    const L = e.def.look,
      sp = iso(e.x, e.y);
    const y = L.zDraw ? sp.y - e.z : sp.y + (L.yOff || 0);
    rec.spr.setPosition(Math.round(sp.x), Math.round(y)).setDepth(L.depth ?? e.x + e.y + (L.zDraw ? 0.1 : 0));
    if (L.frame) rec.spr.setFrame(L.frame(e));
    if (L.fadeBelow != null) rec.spr.setVisible(e.life > L.fadeBelow || Math.floor(e.life * 20) % 2 === 0);
  },
  destroy: (view, e, rec) => plain(rec),
};
