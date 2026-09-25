import { MW, iso, ri } from '../core/constants.js';
import { txt } from '../gfx/fonts.js';

const DZX = 16, DZY = 8;

export const view = {
  updateCutaway() {
    const p = this.p, pt = p.x + p.y, pd = p.x - p.y, next = new Set();
    if (!p.dead) {
      const bx = Math.floor(p.x), by = Math.floor(p.y);
      for (let ty = by - 1; ty <= by + 4; ty++) for (let tx = bx - 1; tx <= bx + 4; tx++) {
        const i = ty * MW + tx; if (!this.walls.has(i)) continue;
        const s = tx + ty + 1.5, dd = tx - ty;
        if (s > pt && s - pt < 3.4 && Math.abs(dd - pd) < 2.3) next.add(i);
      }
    }
    for (const i of this.low) if (!next.has(i)) { const w = this.walls.get(i); w.setTexture('wall').setOrigin(0.5, 0.75); if (w.torch) w.torch.setVisible(true); }
    for (const i of next) if (!this.low.has(i)) { const w = this.walls.get(i); w.setTexture('wall_lo').setOrigin(0.5, 0.6); if (w.torch) w.torch.setVisible(false); }
    this.low = next;
  },

  shake(a, t) { if (a >= this.shakeA || this.shakeT <= 0) { this.shakeA = a; this.shakeT = t; } },

  updateCamera(dt) {
    const sp = iso(this.p.x, this.p.y), tx = sp.x - 64, ty = sp.y - 70;
    const ox = this.camX, oy = this.camY;
    this.camX = Math.min(Math.max(ox, tx - DZX), tx + DZX);
    this.camY = Math.min(Math.max(oy, ty - DZY), ty + DZY);
    const mx = this.camX - ox, my = this.camY - oy;
    const v = this.camV, k = Math.min(1, dt * 8);
    v.x += (mx - v.x) * k;
    v.y += (my - v.y) * k;
    const cx = this.camX, cy = this.camY, ax = Math.abs(v.x), ay = Math.abs(v.y), S = this.camS;
    let sx, sy;
    if (ax >= ay) { sx = Math.round(cx); sy = Math.round(cy + (ax > 1e-4 ? v.y / v.x : 0) * (sx - cx)); }
    else { sy = Math.round(cy); sx = Math.round(cx + (ay > 1e-4 ? v.x / v.y : 0) * (sy - cy)); }
    if (mx > 0) sx = Math.max(sx, S.x); else if (mx < 0) sx = Math.min(sx, S.x);
    if (my > 0) sy = Math.max(sy, S.y); else if (my < 0) sy = Math.min(sy, S.y);
    S.x = sx; S.y = sy;
    if (this.shakeT > 0) { this.shakeT -= dt; sx += ri(-this.shakeA, this.shakeA); sy += ri(-this.shakeA, this.shakeA); }
    this.cameras.main.setScroll(sx, sy);
  },

  pop(x, y, z, s, c) {
    const sp = iso(x, y), t = txt(this, 0, 0, s, c).setOrigin(0.5, 1).setDepth(1e5);
    this.fxs.push({ t, x: sp.x + ri(-2, 2), y: sp.y - z, life: 0.6 });
  },

  updateFx(dt) {
    for (let i = this.fxs.length - 1; i >= 0; i--) {
      const f = this.fxs[i]; f.life -= dt; f.y -= 16 * dt * (f.life > 0.3 ? 1 : 0.2);
      if (f.life <= 0) { f.t.destroy(); this.fxs.splice(i, 1); continue; }
      f.t.setPosition(Math.round(f.x), Math.round(f.y));
    }
  },
};
