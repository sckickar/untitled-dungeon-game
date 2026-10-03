import { iso } from "../lib/iso.js";
import { ri } from "../lib/math.js";

const DZX = 16,
  DZY = 8;

export class Camera {
  constructor(scene, target) {
    this.scene = scene;
    const p = iso(target.x, target.y);
    this.x = p.x - 64;
    this.y = p.y - 70;
    this.v = { x: 0, y: 0 };
    this.snap = { x: Math.round(this.x), y: Math.round(this.y) };
    this.shakeT = 0;
    this.shakeA = 0;
  }

  shake(a, t) {
    if (a >= this.shakeA || this.shakeT <= 0) {
      this.shakeA = a;
      this.shakeT = t;
    }
  }

  update(dt, target) {
    const sp = iso(target.x, target.y),
      tx = sp.x - 64,
      ty = sp.y - 70;
    const ox = this.x,
      oy = this.y;
    this.x = Math.min(Math.max(ox, tx - DZX), tx + DZX);
    this.y = Math.min(Math.max(oy, ty - DZY), ty + DZY);
    const mx = this.x - ox,
      my = this.y - oy;
    const v = this.v,
      k = Math.min(1, dt * 8);
    v.x += (mx - v.x) * k;
    v.y += (my - v.y) * k;
    const cx = this.x,
      cy = this.y,
      ax = Math.abs(v.x),
      ay = Math.abs(v.y),
      S = this.snap;
    let sx, sy;
    if (ax >= ay) {
      sx = Math.round(cx);
      sy = Math.round(cy + (ax > 1e-4 ? v.y / v.x : 0) * (sx - cx));
    } else {
      sy = Math.round(cy);
      sx = Math.round(cx + (ay > 1e-4 ? v.x / v.y : 0) * (sy - cy));
    }
    if (mx > 0) sx = Math.max(sx, S.x);
    else if (mx < 0) sx = Math.min(sx, S.x);
    if (my > 0) sy = Math.max(sy, S.y);
    else if (my < 0) sy = Math.min(sy, S.y);
    S.x = sx;
    S.y = sy;
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      sx += ri(-this.shakeA, this.shakeA);
      sy += ri(-this.shakeA, this.shakeA);
    }
    this.scene.cameras.main.setScroll(sx, sy);
  }
}
