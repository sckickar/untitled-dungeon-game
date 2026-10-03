import { iso } from "../../lib/iso.js";
import { ri } from "../../lib/math.js";
import { addOutline, syncOutline, killOutline, tintOutline } from "../outline.js";
import { syncOverlays, destroyOverlays, tintFor, applyTint } from "./common.js";
import { createHands, drawHands, destroyHands, swingHands } from "./hands.js";

export const creature = {
  create(view, e) {
    const L = e.def.look,
      scene = view.scene;
    const spr = scene.add.sprite(0, 0, L.sprite).setOrigin(0.5, 1);
    if (L.anim || L.anims) spr.play({ key: L.anim ?? L.anims.front, startFrame: ri(0, 1) });
    addOutline(scene, spr, L.outline ?? "m");
    const rec = { spr, drip: 0 };
    createHands(scene, rec);
    if (e.segs)
      rec.segs = e.segs.map((s, i) => {
        const last = i === e.segs.length - 1;
        const img = scene.add
          .image(0, 0, last ? L.segment.tail : L.segment.sprite, last ? 0 : i % 2)
          .setOrigin(0.5, 0.8);
        return addOutline(scene, img, L.outline ?? "m");
      });
    return rec;
  },

  onSwing(view, e, rec, ev) {
    swingHands(rec, ev);
  },

  update(view, e, rec, dt) {
    const L = e.def.look,
      spr = rec.spr,
      sp = iso(e.x, e.y),
      z = L.z ? L.z + Math.round(Math.sin(e.t * 5)) : 0;
    spr.setPosition(sp.x, sp.y - z).setDepth(e.x + e.y);
    const sx =
      L.faceFlip && Math.hypot(e.moveX, e.moveY) < 0.01 ? e.face.x - e.face.y : e.moveX - e.moveY;
    if (Math.abs(sx) > 0.05) spr.setFlipX(sx < 0);
    if (L.anims) {
      const front = e.face.x + e.face.y >= -0.01,
        key = front ? L.anims.front : L.anims.back;
      if (L.attack && (e.windT > 0 || e.atkT > 0 || e.castT > 0)) {
        spr.anims.stop();
        spr.setFrame(front ? L.attack.front : L.attack.back);
      } else if (spr.anims.currentAnim?.key !== key || !spr.anims.isPlaying) spr.play(key);
    }
    const tint = tintFor(e);
    applyTint(spr, tint);
    syncOutline(spr);
    const hot = e === view.hoverMob;
    if (hot !== rec.hot) {
      rec.hot = hot;
      const c = hot ? "w" : L.outline ?? "m";
      tintOutline(spr, c);
      rec.segs?.forEach((img) => tintOutline(img, c));
    }
    syncOverlays(view, e, rec, sp.x, sp.y - (L.z || 0));
    drawHands(view, e, rec, { x: sp.x, y: sp.y - z }, spr, Math.hypot(e.moveX, e.moveY) > 0.01, true, dt);
    if (rec.segs) {
      spr.setFlipX(Math.cos(e.ang) - Math.sin(e.ang) < 0);
      const lit = e.flash > 0 || (e.windT > 0 && Math.floor(e.windT * 25) % 2 === 0);
      rec.segs.forEach((img, i) => {
        const s = e.segs[i],
          p = iso(s.x, s.y),
          bob = Math.round(Math.sin(e.t * 10 - i * 0.9) * 0.6);
        img.setPosition(p.x, p.y - bob).setDepth(s.x + s.y - 0.01);
        applyTint(img, lit ? tint : null);
        syncOutline(img);
      });
    }
    if (e.hp < e.maxhp * 0.5 && L.blood && L.blood !== "w") {
      rec.drip -= dt;
      if (rec.drip <= 0) {
        rec.drip = 0.45;
        view.gore.spray(e.x, e.y, (L.z || 0) + 3, 0, 0, 1, L.blood, 3.14, 0.3);
      }
    }
  },

  destroy(view, e, rec) {
    killOutline(rec.spr);
    rec.spr.destroy();
    if (rec.segs)
      for (const img of rec.segs) {
        killOutline(img);
        img.destroy();
      }
    destroyHands(rec);
    destroyOverlays(rec);
  },
};
