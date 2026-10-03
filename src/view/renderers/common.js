import { COL } from "../../config.js";
import { ri } from "../../lib/math.js";

export function syncOverlays(view, e, rec, x, y) {
  rec.overlays ??= new Map();
  for (const [id, spr] of rec.overlays)
    if (!e.status.has(id)) {
      spr.destroy();
      rec.overlays.delete(id);
    }
  for (const s of e.status.values()) {
    const key = s.def.look?.overlay;
    if (!key) continue;
    let spr = rec.overlays.get(s.id);
    if (!spr) {
      spr = view.scene.add.sprite(0, 0, key).setOrigin(0.5, 1).play({ key, startFrame: ri(0, 1) });
      rec.overlays.set(s.id, spr);
    }
    spr.setPosition(x, y).setDepth(e.x + e.y + 0.05);
  }
}

export function destroyOverlays(rec) {
  if (rec.overlays) for (const spr of rec.overlays.values()) spr.destroy();
}

export function tintFor(e) {
  if (e.flash > 0 || (e.windT > 0 && Math.floor(e.windT * 25) % 2 === 0)) return COL.w;
  for (const s of e.status.values()) {
    const c = s.def.look?.blink;
    if (c && s.t > 0 && Math.floor(s.t * 8) % 2 === 0) return COL[c];
  }
  return null;
}

export const applyTint = (spr, tint) => (tint == null ? spr.clearTint() : spr.setTintFill(tint));
