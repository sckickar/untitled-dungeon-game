import { COL } from "../../config.js";
import { iso } from "../../lib/iso.js";
import { clamp } from "../../lib/math.js";
import { addOutline, syncOutline, killOutline, tintOutline } from "../outline.js";
import { syncOverlays, destroyOverlays, tintFor, applyTint } from "./common.js";

const RISE = 72,
  DROP = 150;

export const boss = {
  create() {
    return { layers: [], crop: [] };
  },

  update(view, e, rec, dt) {
    const b = e.boss ?? e,
      L = e.def.look,
      scene = view.scene,
      list = b.state === "dormant" || b.state === "dead" ? [] : L.draw(e, b),
      a = b.state === "fight" ? 1 : b.appear,
      arriving = b.state === "intro",
      style = b.def.intro,
      anchor = iso(e.ax ?? e.x, e.ay ?? e.y),
      az = e.az ?? 0,
      base = b.x + b.y,
      tint = e === b || e.dead ? null : tintFor(e),
      ghost = b.immune > 0,
      hot = e === view.hoverMob;
    for (let i = 0; i < list.length; i++) {
      const l = list[i];
      let spr = rec.layers[i];
      if (!spr) spr = rec.layers[i] = scene.add.sprite(0, 0, l.key, l.frame ?? 0);
      const outlined = e !== b && !l.ground && l.outline !== false;
      if (outlined && !spr.outline) addOutline(scene, spr, L.outline ?? "k");
      else if (!outlined && spr.outline) killOutline(spr);
      if (spr.texture.key !== l.key || (l.frame ?? 0) !== spr.frame.name) spr.setTexture(l.key, l.frame ?? 0);
      let x, y, depth;
      if (l.gx != null) {
        const p = iso(l.gx, l.gy);
        x = p.x;
        y = p.y - (l.z ?? 0);
        depth = l.gx + l.gy + (l.depth ?? 0);
      } else {
        x = anchor.x + l.x;
        y = anchor.y - az + l.y;
        depth = (l.depth ?? 0) < -1e3 ? l.depth : base + (l.depth ?? 0);
      }
      let alpha = l.alpha ?? 1,
        scale = l.scale ?? 1,
        clipY = null;
      if (style === "drop" && !l.ground) {
        if (arriving) y -= (1 - a) * (1 - a) * DROP;
        else alpha *= a;
      }
      if (style === "drop" && l.ground) scale *= 0.4 + 0.6 * a;
      if (style === "fade") alpha *= a >= 1 || l.ground ? a : Math.random() < a ? a : 0.15;
      if (l.pool) scale *= clamp(a * 2, 0, 1);
      if (l.clip) {
        const up = (l.rise ?? 1) * (style === "rise" ? a : 1);
        clipY = anchor.y + 4;
        y += (1 - up) * (l.rise != null ? spr.frame.height : RISE);
      }
      if (b.state === "dying" && !l.ground) alpha *= 0.6 + 0.4 * Math.random();
      if (ghost && !l.ground) {
        alpha *= 0.35 + Math.random() * 0.45;
        x += Math.round((Math.random() - 0.5) * 3);
      }
      spr
        .setOrigin(l.ox ?? 0.5, l.oy ?? 1)
        .setPosition(Math.round(x), Math.round(y))
        .setFlipX(!!l.flip)
        .setRotation(l.rot ?? 0)
        .setScale(scale, scale * (l.squash ?? 1))
        .setAlpha(alpha)
        .setDepth(depth)
        .setVisible(true);
      const keep = (rec.crop[i] = clip(spr, clipY));
      applyTint(spr, tint);
      if (spr.outline) {
        syncOutline(spr);
        tintOutline(spr, hot ? "w" : L.outline ?? "k");
        for (const o of spr.outline) {
          o.setOrigin(spr.originX, spr.originY).setAlpha(alpha).setScale(scale, scale * (l.squash ?? 1)).setVisible(keep > 0);
          if (keep < spr.frame.height) o.setCrop(0, 0, spr.frame.width, keep);
          else if (o.isCropped) o.setCrop();
        }
      }
    }
    for (let i = list.length; i < rec.layers.length; i++) {
      rec.layers[i].setVisible(false);
      rec.layers[i].outline?.forEach((o) => o.setVisible(false));
      rec.crop[i] = 0;
    }
    rec.spr = rec.layers.find((s, i) => rec.crop[i] > 0) ?? null;
    if (e !== b && list.length) {
      const p = iso(e.x, e.y);
      syncOverlays(view, e, rec, p.x, p.y - (L.z ?? 0) + 6);
    }
  },

  pick(view, e, rec, wx, wy) {
    const tex = view.scene.textures;
    let best = null;
    rec.layers.forEach((spr, i) => {
      if (!(rec.crop[i] > 0) || !spr.getBounds().contains(wx, wy)) return;
      const p = spr.getLocalPoint(wx, wy),
        w = spr.frame.width,
        h = spr.frame.height;
      let px = Math.floor(p.x),
        py = Math.floor(p.y);
      if (px < 0 || py < 0 || px >= w || py >= rec.crop[i]) return;
      if (spr.flipX) px = w - 1 - px;
      if (!tex.getPixelAlpha(px, py, spr.texture.key, spr.frame.name)) return;
      if (best == null || spr.depth > best) best = spr.depth;
    });
    return best;
  },

  destroy(view, e, rec) {
    for (const spr of rec.layers) {
      killOutline(spr);
      spr.destroy();
    }
    destroyOverlays(rec);
  },
};

function clip(spr, clipY) {
  const h = spr.frame.height;
  if (clipY == null) {
    if (spr.isCropped) spr.setCrop();
    return h;
  }
  const top = spr.y - spr.originY * h * spr.scaleY,
    keep = clamp(Math.round((clipY - top) / spr.scaleY), 0, h);
  if (keep <= 0) spr.setVisible(false);
  else if (keep >= h) spr.setCrop();
  else spr.setCrop(0, 0, spr.frame.width, keep);
  return keep;
}

export const faller = {
  create(view, e) {
    const K = e.K,
      spr = view.scene.add.sprite(0, 0, K.sprite).setRotation(K.rot ?? 0).setVisible(false);
    if (K.anim) spr.play(K.anim);
    return { spr, g: view.scene.add.graphics().setDepth(-7e4) };
  },
  update(view, e, rec) {
    const K = e.K,
      sp = iso(e.x, e.y),
      rx = K.radius * 8 * Math.SQRT2,
      ry = rx / 2,
      k = clamp(1 - e.z / e.h, 0, 1),
      blink = Math.floor(e.t * (k > 0.6 ? 16 : 8)) % 2 === 0;
    rec.spr
      .setPosition(Math.round(sp.x), Math.round(sp.y - e.z))
      .setDepth(e.x + e.y + 0.1)
      .setVisible(e.delay <= 0);
    rec.g.clear();
    rec.g.lineStyle(1, blink ? COL.w : COL[K.color] ?? COL.m, 1).strokeEllipse(sp.x, sp.y, rx * 2, ry * 2);
    if (k > 0) rec.g.fillStyle(COL[K.color] ?? COL.m, 0.45).fillEllipse(sp.x, sp.y, rx * 2 * k, ry * 2 * k);
  },
  destroy(view, e, rec) {
    rec.spr.destroy();
    rec.g.destroy();
  },
};
