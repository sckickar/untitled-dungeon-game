import { VW, VH, COL } from "../core/constants.js";
import { txt } from "../gfx/fonts.js";
import { WDEF, STACKS, SPELLS, ELEMENTS } from "../data/items.js";
import {
  HUD_SLOTS,
  INV,
  INV_EQUIP,
  BAG,
  bagCell,
  hitSlot,
  HUD_BAR 
} from "../data/layout.js";

const BAG_N = BAG.cols * BAG.rows;
const iconOf = (it) =>
  STACKS[it.base] ? STACKS[it.base].icon : WDEF[it.base].icon;

export class UI extends Phaser.Scene {
  constructor() {
    super("ui");
  }
  create() {
    this.g = this.add.graphics();
    this.tFloor = txt(this, 1, 1, "", "c");
    this.tLv = txt(this, 22, 1, "", "w");
    this.coin = this.add.image(0, 3, "coin").setOrigin(0, 0);
    this.tGold = txt(this, 0, 1, "", "w");
    this.arrowIcon = this.add.image(56, 3, "inv_arrow").setOrigin(0, 0);
    this.tArrows = txt(this, 62, 1, "", "w");
    this.hudIcons = {
      main: this.add.image(0, 0, "inv_sword").setDepth(1),
      off: this.add.image(0, 0, "inv_sword").setDepth(1),
    };
    this.g2 = this.add.graphics();
    this.tMsg = txt(this, 0, 104, "", "w");

    // inventory
    this.gi = this.add.graphics().setDepth(5);
    this.gc = this.add.graphics().setDepth(7);
    this.tInv = txt(this, INV.x + 4, INV.y + 2, "inventory", "m").setDepth(6);
    this.tAtk = txt(this, 48, 31, "", "w").setDepth(6);
    this.gt = this.add.graphics().setDepth(12);
    this.tipT = Array.from({ length: 7 }, () =>
      txt(this, 0, 0, "", "w").setDepth(13).setVisible(false),
    );
    this.invIcons = {
      main: this.add.image(0, 0, "inv_sword").setDepth(6),
      off: this.add.image(0, 0, "inv_sword").setDepth(6),
    };
    this.cellIcons = Array.from({ length: BAG_N }, () =>
      this.add.image(0, 0, "potion").setDepth(6),
    );
    this.cellCounts = Array.from({ length: BAG_N }, () =>
      txt(this, 0, 0, "", "w").setDepth(8),
    );
    this.ghost = this.add.image(0, 0, "potion").setDepth(15).setVisible(false);

    this.overLines = [
      txt(this, 0, 44, "you died", "m"),
      txt(this, 0, 56, "", "w"),
      txt(this, 0, 65, "", "w"),
      txt(this, 0, 74, "", "w"),
      txt(this, 0, 86, "", "c"),
    ];
    this.overLines.forEach((t) => t.setVisible(false));
    this.gw = this.add.graphics().setDepth(20);

    this.isTouch = this.sys.game.device.input.touch;
    this.btns = {
      A: { x: 116, y: 100, r: 8 },
      B: { x: 100, y: 107, r: 7 },
      P: { x: 118, y: 83, r: 6 },
      I: { x: 118, y: 68, r: 6 },
    };
    this.btnTxt = {};
    if (this.isTouch)
      for (const k in this.btns) {
        const b = this.btns[k];
        this.btnTxt[k] = txt(
          this,
          b.x - 3,
          b.y - 4,
          k,
          k === "A" ? "m" : k === "B" ? "c" : "w",
        );
      }
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.held = {};
    this.input.on("pointerdown", (ptr) => {
      if (!ptr.wasTouch) return;
      const gs = this.gs();
      if (!gs) return;
      if (gs.over) {
        gs.restartGame();
        return;
      }
      for (const k in this.btns) {
        const b = this.btns[k];
        if (Math.hypot(ptr.x - b.x, ptr.y - b.y) < b.r + 4) {
          gs["touch" + k] = true;
          if (k === "A" || k === "B") {
            gs["touch" + k + "Held"] = true;
            this.held[ptr.id] = k;
          }
          return;
        }
      }
      if (this.joy.id === null && ptr.x < 88)
        Object.assign(this.joy, {
          id: ptr.id,
          ox: ptr.x,
          oy: ptr.y,
          x: ptr.x,
          y: ptr.y,
        });
    });
    this.input.on("pointermove", (ptr) => {
      if (ptr.id !== this.joy.id) return;
      this.joy.x = ptr.x;
      this.joy.y = ptr.y;
      const gs = this.gs(),
        dx = ptr.x - this.joy.ox,
        dy = ptr.y - this.joy.oy;
      if (gs) gs.touchVec = Math.hypot(dx, dy) > 2 ? { x: dx, y: dy } : null;
    });
    const up = (ptr) => {
      const k = this.held[ptr.id],
        gs = this.gs();
      if (k) {
        delete this.held[ptr.id];
        if (gs) gs["touch" + k + "Held"] = false;
      }
      if (ptr.id !== this.joy.id) return;
      this.joy.id = null;
      if (gs) gs.touchVec = null;
    };
    this.input.on("pointerup", up);
    this.input.on("pointerupoutside", up);
  }
  gs() {
    const s = this.scene.get("game");
    return s && s.p ? s : null;
  }

  drawSlot(g, r, it, img, gs, hot) {
    g.fillStyle(hot ? COL.w : COL.c).fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(COL.k).fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    img.setVisible(!!it);
    if (!it) return;
    img
      .setTexture(iconOf(it))
      .setPosition(r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2))
      .setAlpha(gs.drag && gs.drag.item === it ? 0.3 : 1);
    if (it.maxDur)
      g.fillStyle(COL.m).fillRect(
        r.x + 1,
        r.y + r.h - 2,
        Math.round(((r.w - 2) * it.dur) / it.maxDur),
        1,
      );
  }

  tipItem(gs, ptr) {
    gs.hoverPick = null;
    if (gs.drag || gs.over || gs.p.dead) return null;
    const hov = hitSlot(ptr.x, ptr.y, gs.invOpen);
    if (hov) return hov.type === "panel" ? null : gs.getAt(hov);
    if (gs.invOpen || this.isTouch) return null;
    const o = gs.pickAt(ptr);
    gs.hoverPick = o || null;
    return o ? o.item : null;
  }

  // each line is [text, colour] for posterity
  tipLines(it, gs) {
    if (STACKS[it.base])
      return [
        [it.base, "w"],
        ["x" + it.qty, "c"],
      ];
    const D = WDEF[it.base],
      L = [[[it.prefix, it.base].filter(Boolean).join(" "), "w"]];
    if (it.spell) L.push([it.spell, "c"]);
    if (it.suffix) L.push([it.suffix, ELEMENTS[it.elem].col]);
    if (D.kind === "shield") {
      L.push(["dur " + it.dur + " of " + it.maxDur, "c"]);
      return L;
    }
    const cur = gs.p.equip[D.slots[0]],
      diff = cur && cur !== it ? it.atk - (cur.atk || 0) : 0;
    L.push([
      "atk " + it.atk + (diff > 0 ? " +" + diff : diff < 0 ? " " + diff : ""),
      diff > 0 ? "c" : diff < 0 ? "m" : "w",
    ]);
    if (it.spell) {
      const S = SPELLS[it.spell];
      L.push(["mp " + S.mp + (S.channel ? " per sec" : ""), "c"]);
    } else L.push(["cd " + Math.round(it.cd * 100), "w"]);
    if (it.elem) L.push([it.elem + " +" + it.edmg, ELEMENTS[it.elem].col]);
    if (it.crit > 0.12)
      L.push(["crit +" + Math.round((it.crit - 0.12) * 100), "m"]);
    if (it.leech) L.push(["leech " + Math.round(it.leech * 100), "m"]);
    return L;
  }

  drawTip(lines, ptr, border) {
    const gt = this.gt;
    gt.clear();
    this.tipT.forEach((t, i) => t.setVisible(!!lines && i < lines.length));
    if (!lines) return;
    let w = 0;
    lines.forEach(([s, c], i) => {
      const t = this.tipT[i].setFont("font_" + c).setText(s);
      w = Math.max(w, t.width);
    });
    w += 4;
    const h = lines.length * 8 + 3;
    let x = ptr.x + 6;
    if (x + w > VW) x = ptr.x - w - 2;
    x = Math.max(0, Math.round(x));
    const y = Math.round(Phaser.Math.Clamp(ptr.y + 6, 0, VH - h));
    gt.fillStyle(COL[border]).fillRect(x, y, w, h);
    gt.fillStyle(COL.k).fillRect(x + 1, y + 1, w - 2, h - 2);
    lines.forEach((_, i) => this.tipT[i].setPosition(x + 2, y + 2 + i * 8));
  }

  statLine(it) {
    if (STACKS[it.base]) return "x" + it.qty;
    const D = WDEF[it.base];
    if (D.kind === "shield") return "dur " + it.dur + " max " + it.maxDur;
    if (D.kind === "staff")
      return "atk " + it.atk + " mp " + SPELLS[it.spell].mp;
    return "atk " + it.atk + " cd " + Math.round(it.cd * 100);
  }

  drawInventory(gs, ptr) {
    const open = gs.invOpen && !gs.over,
      p = gs.p,
      gi = this.gi,
      gc = this.gc;
    gi.clear();
    gc.clear();
    [this.tInv, this.tAtk].forEach((t) => t.setVisible(open));
    if (!open) {
      Object.values(this.invIcons).forEach((i) => i.setVisible(false));
      this.cellIcons.forEach((i) => i.setVisible(false));
      this.cellCounts.forEach((t) => t.setVisible(false));
      return;
    }
    gi.fillStyle(COL.m).fillRect(INV.x, INV.y, INV.w, INV.h);
    gi.fillStyle(COL.k).fillRect(INV.x + 1, INV.y + 1, INV.w - 2, INV.h - 2);
    const hov = hitSlot(ptr.x, ptr.y, true);
    const isHot = (t) =>
      !!hov && hov.type === t.type && hov.slot === t.slot && hov.i === t.i;
    for (const s of ["main", "off"])
      this.drawSlot(
        gi,
        INV_EQUIP[s],
        p.equip[s],
        this.invIcons[s],
        gs,
        isHot({ type: "equip", slot: s }),
      );
    for (let i = 0; i < BAG_N; i++) {
      const r = bagCell(i),
        it = p.bag[i],
        t = this.cellCounts[i];
      this.drawSlot(
        gi,
        r,
        it,
        this.cellIcons[i],
        gs,
        isHot({ type: "bag", i }),
      );
      const show = !!(it && it.qty);
      t.setVisible(show);
      if (show) {
        t.setText("" + it.qty);
        t.setPosition(r.x + r.w - t.width, r.y + r.h - 8);
        gc.fillStyle(COL.k).fillRect(t.x, t.y + 1, t.width, 7);
      }
    }
    const m = p.equip.main;
    this.tAtk.setText("atk " + (p.atk + (m ? m.atk : 0)));
  }

  update(time) {
    const gs = this.gs();
    if (!gs) return;
    const p = gs.p,
      g = this.g,
      ptr = this.input.activePointer;
    g.clear();
    g.fillStyle(COL.k).fillRect(0, 0, VW, 10);
    g.fillStyle(COL.c).fillRect(0, 10, VW, 1);
    g.fillStyle(COL.w).fillRect(0, 9, Math.round((VW * p.xp) / p.next), 1);
    this.tFloor.setText("B" + gs.lvl);
    this.tLv.setText("Lv" + p.lv);
    this.tGold.setText("" + p.gold);
    this.tGold.x = VW - this.tGold.width;
    this.coin.x = this.tGold.x - 6;
    const bow = ["main", "off"].some(
      (s) => p.equip[s] && p.equip[s].base === "bow",
    );
    this.arrowIcon.setVisible(bow);
    this.tArrows.setVisible(bow).setText("" + gs.countOf("arrow"));

    g.fillStyle(COL.c).fillRect(0, 116, VW, 1);
    g.fillStyle(COL.k).fillRect(0, 117, VW, 11);
    const { x: bx, y: by, w: bw } = HUD_BAR;
    g.fillStyle(COL.w).fillRect(bx, by, bw, 6);
    g.fillStyle(COL.k).fillRect(bx + 1, by + 1, bw - 2, 4);
    const hw = Math.round(((bw - 2) * Math.max(0, p.hp)) / p.maxhp);
    const lowBlink = p.hp < p.maxhp * 0.3 && Math.floor(time / 200) % 2;
    g.fillStyle(lowBlink ? COL.w : COL.m).fillRect(bx + 1, by + 1, hw, 4);
    g.fillStyle(COL.w).fillRect(bx, by + 6, bw, 3);
    g.fillStyle(COL.k).fillRect(bx + 1, by + 7, bw - 2, 1);
    g.fillStyle(COL.c).fillRect(bx + 1, by + 7, Math.round(((bw - 2) * p.mp) / p.maxmp), 1);

    for (const s of ["main", "off"])
      this.drawSlot(g, HUD_SLOTS[s], p.equip[s], this.hudIcons[s], gs, false);

    this.drawInventory(gs, ptr);

    const g2 = this.g2;
    g2.clear();
    const show = gs.msgT > 0 && !gs.over && !gs.invOpen;
    this.tMsg.setVisible(show);
    if (show) {
      this.tMsg.setText(gs.msgText);
      this.tMsg.x = Math.round((VW - this.tMsg.width) / 2);
      g2.fillStyle(COL.k).fillRect(
        this.tMsg.x - 2,
        103,
        this.tMsg.width + 4,
        10,
      );
    }
    if (this.isTouch && !gs.over) {
      for (const k in this.btns) {
        const b = this.btns[k],
          pressed = gs["touch" + k] || gs["touch" + k + "Held"];
        g2.fillStyle(COL.k).fillCircle(b.x, b.y, b.r);
        g2.fillStyle(
          pressed ? COL.w : k === "A" ? COL.m : k === "B" ? COL.c : COL.w,
        ).fillCircle(b.x, b.y, b.r);
        g2.fillStyle(COL.k).fillCircle(b.x, b.y, b.r - 1);
      }
      if (this.joy.id !== null) {
        g2.fillStyle(COL.c).fillCircle(this.joy.ox, this.joy.oy, 11);
        g2.fillStyle(COL.k).fillCircle(this.joy.ox, this.joy.oy, 10);
        const dx = this.joy.x - this.joy.ox,
          dy = this.joy.y - this.joy.oy,
          l = Math.hypot(dx, dy),
          m = Math.min(l, 8) / (l || 1);
        g2.fillStyle(COL.w).fillCircle(
          Math.round(this.joy.ox + dx * m),
          Math.round(this.joy.oy + dy * m),
          4,
        );
      }
    }
    for (const k in this.btnTxt)
      this.btnTxt[k].setVisible(this.isTouch && !gs.over).setDepth(10);

    const d = gs.drag;
    this.ghost.setVisible(!!d);
    if (d)
      this.ghost
        .setTexture(iconOf(d.item))
        .setPosition(Math.round(ptr.x), Math.round(ptr.y));
    const tip = this.tipItem(gs, ptr);
    this.drawTip(
      tip && this.tipLines(tip, gs),
      ptr,
      tip && tip.elem ? ELEMENTS[tip.elem].col : "c",
    );
    const ov = gs.over;
    this.overLines.forEach((t) => t.setVisible(ov));
    if (ov) {
      g2.fillStyle(COL.m).fillRect(12, 38, 104, 60);
      g2.fillStyle(COL.k).fillRect(13, 39, 102, 58);
      const L = this.overLines;
      L[1].setText("on B" + gs.lvl + " at lv" + p.lv);
      L[2].setText("kills " + p.kills);
      L[3].setText("gold " + p.gold);
      L[4].setText(this.isTouch ? "tap to retry" : "press r");
      L[4].setVisible(Math.floor(time / 400) % 2 === 0);
      L.forEach((t) => {
        t.x = Math.round((VW - t.width) / 2);
      });
      this.children.bringToTop(this.g2);
      L.forEach((t) => this.children.bringToTop(t));
    }
    const gw = this.gw;
    gw.clear();
    gw.fillStyle(COL.k);
    if (gs.descending)
      gw.fillRect(0, 0, VW, Math.min(16, Math.ceil(gs.wipe * 16)) * 8);
    else if (gs.reveal > 0) {
      const h = Math.ceil((gs.reveal / 0.35) * 16) * 8;
      gw.fillRect(0, VH - h, VW, h);
    }
    this.children.bringToTop(gw);
  }
}
