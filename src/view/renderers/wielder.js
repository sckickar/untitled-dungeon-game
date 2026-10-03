import { COL } from "../../config.js";
import { iso } from "../../lib/iso.js";
import { addOutline, syncOutline, killOutline } from "../outline.js";
import { syncOverlays, destroyOverlays, tintFor, applyTint } from "./common.js";
import {
  createHands,
  drawHands,
  hideHands,
  destroyHands,
  swingHands,
} from "./hands.js";
import { paperdoll } from "../assets/paperdoll.js";

export const wielder = {
  create(view, e) {
    const L = e.def.look,
      doll = L.paperdoll ? paperdoll(view.scene, e.appearance) : null;
    const spr = view.scene.add
      .sprite(0, 0, doll?.key ?? L.sprite, L.idle.front)
      .setOrigin(0.5, 1);
    if (!doll) addOutline(view.scene, spr, L.outline ?? "c");
    const rec = {
      spr,
      anims: doll ?? L.anims,
      corpse: doll?.corpse,
      lastX: e.x,
      lastY: e.y,
      stepD: 0,
      side: 1,
      bloody: 0,
      drip: 0,
    };
    if (doll) rec.layers = dollLayers(view.scene, doll);
    createHands(view.scene, rec);
    return rec;
  },

  onSwing(view, e, rec, ev) {
    swingHands(rec, ev);
  },

  update(view, e, rec, dt) {
    const L = e.def.look,
      spr = rec.spr;
    if (e.dead) {
      spr.setVisible(false);
      hideHands(rec);
      syncOutline(spr);
      syncLayers(e, rec);
      destroyOverlays(rec);
      rec.overlays = null;
      return;
    }
    footprints(view, e, rec);
    if (e.hp < e.maxhp * 0.35) {
      rec.drip -= dt;
      if (rec.drip <= 0) {
        rec.drip = 0.35;
        view.gore.spray(e.x, e.y, 4, 0, 0, 1, L.blood ?? "m", 3.14, 0.3);
      }
    }

    const sp = iso(e.x, e.y),
      sx = e.face.x - e.face.y,
      front = e.face.x + e.face.y >= -0.01,
      moving = Math.hypot(e.moveX, e.moveY) > 0.01;
    const anim = front ? rec.anims.front : rec.anims.back;
    if (moving) {
      if (spr.anims.currentAnim?.key !== anim || !spr.anims.isPlaying)
        spr.play(anim);
    } else {
      spr.stop();
      spr.setFrame(front ? L.idle.front : L.idle.back);
    }
    spr
      .setFlipX(sx < 0)
      .setPosition(sp.x, sp.y)
      .setDepth(e.x + e.y);
    const vis = !(e.invuln > 0 && Math.floor(e.invuln * 20) % 2 === 0);
    spr.setVisible(vis);
    if (!e.def.iframes) {
      const tint = tintFor(e);
      applyTint(spr, tint);
      if (rec.layers?.[1]) applyTint(rec.layers[1].img, tint);
    }
    syncOutline(spr);
    syncLayers(e, rec);
    syncOverlays(view, e, rec, sp.x, sp.y);
    drawHands(view, e, rec, sp, spr, moving, vis, dt);
  },

  destroy(view, e, rec) {
    killOutline(rec.spr);
    rec.spr.destroy();
    rec.layers?.forEach((l) => l.img.destroy());
    destroyHands(rec);
    destroyOverlays(rec);
  },
};

function dollLayers(scene, doll) {
  const layer = (key, oy, dz) => ({
    img: scene.add.image(0, 0, key, 0).setOrigin(0.5, oy),
    dz,
  });
  const layers = [layer(doll.ring, 0.9, -0.001)];
  if (doll.helm) layers.push(layer(doll.helm, 1, -0.05));
  return layers;
}

const TEAM_OUTLINE = { player: "c", neutral: "w", monster: "m" };

function syncLayers(e, rec) {
  if (!rec.layers) return;
  const spr = rec.spr,
    col = TEAM_OUTLINE[e.team] ?? e.def.look.outline ?? "c";
  if (rec.ringCol !== col)
    rec.layers[0].img.setTintFill(COL[(rec.ringCol = col)]);
  rec.layers.forEach(({ img, dz }) =>
    img
      .setFrame(spr.frame.name)
      .setPosition(spr.x, spr.y)
      .setFlipX(spr.flipX)
      .setVisible(spr.visible)
      .setDepth(spr.depth + dz),
  );
}

function footprints(view, e, rec) {
  const moved = Math.hypot(e.x - rec.lastX, e.y - rec.lastY);
  rec.lastX = e.x;
  rec.lastY = e.y;
  if (view.gore.bloodAt(e.x, e.y) >= 2) rec.bloody = 16;
  rec.stepD += moved;
  if (rec.stepD > 0.2) {
    rec.stepD = 0;
    rec.side = -rec.side;
    if (rec.bloody > 0) {
      rec.bloody--;
      view.gore.stamp(
        "d_m1",
        e.x - e.moveY * 0.07 * rec.side,
        e.y + e.moveX * 0.07 * rec.side,
      );
    }
  }
}
