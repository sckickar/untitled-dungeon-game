import { COL, VW } from "../config.js";
import { txt } from "./assets/fonts.js";
import { SEX_ICON } from "../config.js";

const drawPix = (g, rows, x, y, col) => {
  g.fillStyle(COL[col]);
  rows.forEach((r, j) => {
    for (let i = 0; i < r.length; i++) if (r[i] === "#") g.fillRect(x + i, y + j, 1, 1);
  });
};

export class MobLabel {
  constructor(view) {
    this.view = view;
    this.g = view.scene.add.graphics().setDepth(1e5 - 1);
    this.t = txt(view.scene, 0, 0, "", "w").setDepth(1e5 - 0.5).setVisible(false);
    this.bar = view.scene.add.image(0, 0, "creaturehp").setOrigin(0, 0).setDepth(1e5 - 0.8).setVisible(false);
    this.gb = view.scene.add.graphics().setDepth(1e5 - 0.7);
  }

  update(mob) {
    const g = this.g,
      t = this.t,
      spr = mob && this.view.spriteOf(mob);
    g.clear();
    this.gb.clear();
    t.setVisible(!!spr);
    this.bar.setVisible(!!spr && !mob.tags.has("vendor"));
    if (!spr) return;
    t.setText(mob.name ?? mob.def.name ?? mob.type);
    const icon = SEX_ICON[mob.sex],
      w = t.width + (icon ? icon.rows[0].length + 2 : 0) + 4,
      cam = this.view.scene.cameras.main,
      b = spr.getBounds(),
      x = Phaser.Math.Clamp(Math.round(b.centerX - w / 2), cam.scrollX, cam.scrollX + VW - w),
      boss = this.view.world.boss,
      top = boss && boss.state !== "dormant" ? 28 : 12,
      y = Math.max(Math.round(b.y) - 15, cam.scrollY + top);
    t.setPosition(x + 2, y + 1);
    if (icon) {
      const ix = t.x + t.width + 2;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]])
        drawPix(g, icon.rows, ix + dx, y + 1 + dy, "k");
      drawPix(g, icon.rows, ix, y + 1, icon.col);
    }
    if (!mob.tags.has("vendor")) {
      const bx = x + Math.floor((w - this.bar.width) / 2),
        f = Phaser.Math.Clamp(mob.hp / mob.maxhp, 0, 1);
      this.bar.setPosition(bx, y + 9);
      this.gb.fillStyle(COL.m).fillRect(bx + 2, y + 11, Math.round(12 * f), 2);
    }
  }
}
