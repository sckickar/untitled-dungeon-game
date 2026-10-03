import { VW, VH, COL } from "../config.js";
import { txt } from "../view/assets/fonts.js";
import { defs } from "../sim/defs.js";
import { effectColor, iconOf, baseName, valueOf, sellPrice } from "../sim/items.js";
import { GRID_W, GRID_H, sizeOf, cellOf, itemAt } from "../sim/grid.js";
import { dropAnchor, dropFit, gridOf } from "./inventory.js";
import { MANUAL_ICONS } from "../view/assets/manual.js";
import { APPEAR, INTRO } from "../content/bosses/common.js";
import {
  HUD_SLOTS,
  INV,
  SHOP,
  INV_EQUIP,
  CELL,
  gridAt,
  footprint,
  hitSlot,
  HUD_BARS,
  HUD_EXP,
  talkBox,
  talkRow,
  hitTalk,
  SIGN,
  BOSS_BAR,
} from "./layout.js";

const GRID_N = GRID_W * GRID_H;
const unmark = (s) => s.replace(/[{}]/g, "");
const TALK_HI = 0x2a4a6a;
const XP_COL = 0x55ff55;

const effectLine = (fx) => {
  const S = defs.suffixes[fx.id],
    name = S.elem || S.status;
  if (fx.power == null) return name;
  return S.elem ? name + " +" + fx.power : name + " " + fx.power + "s";
};

const DIGITS = [
  "111101101101111", "010110010010111", "111001111100111", "111001111001111", "101101111001001",
  "111100111001111", "111100111101111", "111001001001001", "111101111101111", "111101111001111",
];
function drawCount(g, r, n, col) {
  const s = "" + n,
    w = s.length * 4 - 1,
    x = r.x + r.w - 1 - w,
    y = r.y + r.h - 6;
  g.fillStyle(COL.k).fillRect(x - 1, y - 1, w + 1, 6);
  g.fillStyle(COL[col]);
  [...s].forEach((d, k) => {
    for (let p = 0; p < 15; p++)
      if (DIGITS[d][p] === "1") g.fillRect(x + k * 4 + (p % 3), y + ((p / 3) | 0), 1, 1);
  });
}

const fit = (img, w, h) =>
  img.setScale(Math.min(1, w / img.width, h / img.height));

const opaque = new Map();
function opaqueBounds(textures, key) {
  if (opaque.has(key)) return opaque.get(key);
  const { width: w, height: h } = textures.get(key).getSourceImage();
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (textures.getPixelAlpha(x, y, key)) {
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
  const b = x1 < 0 ? { x: 0, y: 0, w, h } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  opaque.set(key, b);
  return b;
}

const boltLine = (it) => {
  const B = defs.weapons[it.base].bolts[it.bolt];
  return [it.bolt + " bolt", defs.elements[B.elem].col];
};

function ammoReadout(p, countOf) {
  for (const s of ["main", "off"]) {
    const it = p.equip[s],
      W = it && defs.weapons[it.base];
    if (!W) continue;
    if (W.ammo)
      return {
        icon: defs.stacks[W.ammo].icon,
        text: "" + countOf(W.ammo),
        col: "w",
      };
    if (W.mp) return { text: "mp " + Math.floor(p.mp), col: "c" };
    if (W.hp) return { text: "hp " + Math.max(0, Math.ceil(p.hp)), col: "m" };
  }
  return null;
}

export class UI extends Phaser.Scene {
  constructor() {
    super("ui");
  }
  create() {
    for (const k in HUD_BARS)
      this.add.image(HUD_BARS[k].x, HUD_BARS[k].y, k + "bar").setOrigin(0, 0);
    this.hudFrames = {};
    for (const s in HUD_SLOTS)
      this.hudFrames[s] = this.add
        .nineslice(HUD_SLOTS[s].x, HUD_SLOTS[s].y, "item", undefined, HUD_SLOTS[s].w, HUD_SLOTS[s].h, 3, 3, 3, 3)
        .setOrigin(0, 0);
    this.add.image(22, 1, "levelaffix").setOrigin(0, 0);
    this.expBar = this.add.image(0, HUD_EXP.y, "expbar").setOrigin(0, 0);
    this.g = this.add.graphics();
    this.tFloor = txt(this, 1, 1, "", "c");
    this.tLv = txt(this, 31, 1, "", "w");
    this.tGold = txt(this, 0, 1, "", "w");
    this.ammoIcon = this.add.image(68, 5, "arrow");
    this.tAmmo = txt(this, 74, 1, "", "w");
    this.potIcon = this.add.image(95, 120, "potion");
    this.tPot = txt(this, 99, 117, "", "w");
    this.manaIcon = this.add.image(0, 120, "manapotion");
    this.tMana = txt(this, 0, 117, "", "w");
    this.hudIcons = {
      main: this.add.image(0, 0, "sword").setDepth(1),
      off: this.add.image(0, 0, "sword").setDepth(1),
    };
    this.gcd = this.add.graphics().setDepth(2);

    this.g2 = this.add.graphics();
    this.tMsg = txt(this, 0, 101, "", "w");

    this.gBoss = this.add.graphics().setDepth(3);
    this.tBoss = txt(this, 0, BOSS_BAR.nameY, "", "w").setDepth(3).setVisible(false);
    this.cardName = txt(this, 0, 34, "", "m").setScale(2).setDepth(4).setVisible(false);
    this.cardTitle = txt(this, 0, 54, "", "c").setDepth(4).setVisible(false);
    this.bossLag = 1;

    this.gi = this.add.graphics().setDepth(5);
    this.gc = this.add.graphics().setDepth(7);
    this.tInv = txt(this, INV.x + 3, INV.y + 2, "inventory", "m").setDepth(6);
    this.tAtk = txt(this, 0, INV.y + 2, "", "w").setDepth(6);
    this.tShop = txt(this, SHOP.x + 3, SHOP.y + 2, "", "y").setDepth(6);
    this.tShopGold = txt(this, 0, SHOP.y + 2, "", "w").setDepth(6);
    this.gt = this.add.graphics().setDepth(12);
    this.tipT = Array.from({ length: 10 }, () =>
      txt(this, 0, 0, "", "w").setDepth(13).setVisible(false),
    );
    this.invIcons = {
      main: this.add.image(0, 0, "sword").setDepth(6),
      off: this.add.image(0, 0, "sword").setDepth(6),
    };
    const pool = () =>
      Array.from({ length: GRID_N }, () =>
        this.add.image(0, 0, "potion").setDepth(6),
      );
    this.bagPool = pool();
    this.shopPool = pool();
    this.ghost = this.add.image(0, 0, "potion").setDepth(15).setVisible(false);

    this.overLines = [
      txt(this, 0, 44, "you died", "m"),
      txt(this, 0, 56, "", "w"),
      txt(this, 0, 65, "", "w"),
      txt(this, 0, 74, "", "w"),
      txt(this, 0, 86, "", "c"),
    ];
    this.overLines.forEach((t) => t.setVisible(false).setDepth(19));

    this.gov = this.add.graphics().setDepth(18);
    this.gw = this.add.graphics().setDepth(20);

    this.talkFrame = this.add
      .nineslice(0, 0, "dialogbox", undefined, 24, 24, 3, 3, 3, 3)
      .setOrigin(0, 0)
      .setDepth(30)
      .setVisible(false);
    this.gk = this.add.graphics().setDepth(30);
    this.talkName = txt(this, 0, 0, "", "m").setDepth(31);
    this.talkGold = txt(this, 0, 0, "", "w").setDepth(31);
    this.talkText = [0, 1].map(() => txt(this, 0, 0, "", "w").setDepth(31));
    this.talkOpts = [0, 1, 2, 3].map(() => txt(this, 0, 0, "", "w").setDepth(31));

    this.signFrame = this.add
      .nineslice(0, 0, "manualbox", undefined, 24, 24, 4, 4, 4, 4)
      .setOrigin(0, 0)
      .setDepth(25)
      .setVisible(false);
    this.signText = Array.from({ length: 40 }, () => txt(this, 0, 0, "", "w").setDepth(26).setVisible(false));
    this.signMeasure = txt(this, 0, 0, "", "w").setVisible(false);
    this.signIcons = Array.from({ length: 4 }, () =>
      this.add.image(0, 0, "manual").setOrigin(0, 0).setDepth(26).setVisible(false),
    );

    this.isTouch = this.sys.game.device.input.touch;
    this.btns = {
      A: { x: 116, y: 94, r: 8 },
      B: { x: 100, y: 101, r: 7 },
      P: { x: 118, y: 77, r: 6 },
      M: { x: 98, y: 77, r: 6 },
      I: { x: 118, y: 62, r: 6 },
      E: { x: 118, y: 47, r: 6 },
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
          k === "A" ? "m" : k === "B" || k === "M" ? "c" : "w",
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
      if (gs.talk) {
        const i = hitTalk(ptr.x, ptr.y, gs.talk.options.length);
        if (i === null) gs.talk = null;
        else if (i >= 0) gs.talkPick(i);
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

  drawIcon(g, r, it, img, gs, grow = false, pad = 0) {
    img.setVisible(!!it);
    if (!it) return;
    const key = iconOf(it),
      b = opaqueBounds(this.textures, key),
      iw = r.w - 2 * pad,
      ih = r.h - 2 * pad,
      s = Math.min(iw / b.w, ih / b.h),
      k = s >= 1 ? (grow ? Math.floor(s) : 1) : s;
    img
      .setTexture(key)
      .setOrigin(0, 0)
      .setScale(k)
      .setPosition(
        r.x + pad + Math.floor((iw - b.w * k) / 2) - b.x * k,
        r.y + pad + Math.floor((ih - b.h * k) / 2) - b.y * k,
      )
      .setAlpha(gs.drag && gs.drag.item === it ? 0.3 : 1);
    if (it.maxDur)
      g.fillStyle(COL.m).fillRect(
        r.x,
        r.y + r.h - 1,
        Math.round((r.w * it.dur) / it.maxDur),
        1,
      );
  }

  drawSlot(g, r, it, img, gs, hot, edge = "c", equipped = false) {
    g.fillStyle(hot ? COL.w : COL[edge]).fillRect(r.x, r.y, r.w, r.h);
    g.fillStyle(COL.k).fillRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    const inner = { x: r.x + 1, y: r.y + 1, w: r.w - 2, h: r.h - 2 };
    this.drawIcon(g, inner, it, img, gs, equipped, equipped ? 3 : 0);
  }

  drawHudSlot(g, s, p, gs) {
    const r = HUD_SLOTS[s],
      ready = p.cdMax[s] > 0 && p.cds[s] <= 0 && p.cds[s] > -0.08;
    if (ready) this.hudFrames[s].setTint(COL.c);
    else this.hudFrames[s].clearTint();
    const well = { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 5 };
    this.drawIcon(g, well, p.equip[s], this.hudIcons[s], gs, true, 1);
    this.drawCooldown(this.gcd, r.x + 3, r.y + 2, r.w - 6, p, s);
  }

  drawCooldown(g, x, y, w, p, slot) {
    const max = p.cdMax[slot],
      left = p.cds[slot];
    if (!(max > 0) || left <= 0) return;
    const f = Math.min(1, left / max);
    g.fillStyle(COL.k).fillRect(x, y, w, 1);
    g.fillStyle(COL.m).fillRect(x, y, Math.ceil(w * (1 - f)), 1);
  }

  tipItem(gs, ptr) {
    gs.view.hoverPick = null;
    if (gs.drag || gs.over || gs.p.dead) return null;
    const hov = hitSlot(ptr.x, ptr.y, gs.invOpen, !!gs.trade);
    this.tipFrom = hov;
    if (hov) return hov.type === "panel" ? null : gs.getAt(hov);
    if (gs.invOpen || this.isTouch) return null;
    const o = gs.pickAt(ptr);
    gs.view.hoverPick = o || null;
    return o ? o.item : null;
  }

  tipLines(it, gs) {
    const L = this.itemLines(it, gs),
      from = this.tipFrom;
    if (gs.trade && from) {
      const cost = valueOf(it);
      if (from.type === "shop")
        L.push(["buy " + cost + "g", gs.p.gold < cost ? "m" : "y"]);
      else L.push(["sell " + sellPrice(it) + "g", "y"]);
    }
    return L;
  }

  itemLines(it, gs) {
    if (defs.stacks[it.base])
      return [
        [it.base, "w"],
        ["x" + it.qty, "c"],
      ];
    const D = defs.weapons[it.base],
      L = [[[it.prefix, baseName(it)].filter(Boolean).join(" "), "w"]];
    if (it.spell) L.push([it.spell, "c"]);
    if (it.bolt) L.push(boltLine(it));
    if (D.elem) L.push([D.elem, defs.elements[D.elem].col]);
    for (const fx of it.effects || [])
      L.push([effectLine(fx), effectColor(fx)]);
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
      const S = defs.spells[it.spell];
      L.push(["mp " + S.mp + (S.channel ? " per sec" : ""), "c"]);
    } else L.push(["cd " + Math.round(it.cd * 100), "w"]);
    if (D.mp) L.push(["mp " + D.mp + " per bolt", "c"]);
    if (D.hp) L.push(["hp " + D.hp + " per bolt", "m"]);
    if (D.kind === "thrown") L.push(["ammo " + gs.countOf(D.ammo), "w"]);
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
    if (defs.stacks[it.base]) return "x" + it.qty;
    const D = defs.weapons[it.base];
    if (D.kind === "shield") return "dur " + it.dur + " max " + it.maxDur;
    if (D.kind === "staff")
      return "atk " + it.atk + " mp " + defs.spells[it.spell].mp;
    if (D.kind === "wand")
      return "atk " + it.atk + (D.mp ? " mp " + D.mp : " hp " + D.hp);
    return "atk " + it.atk + " cd " + Math.round(it.cd * 100);
  }

  drawPanel(g, P, edge) {
    g.fillStyle(COL[edge]).fillRect(P.x, P.y, P.w, P.h);
    g.fillStyle(COL.k).fillRect(P.x + 1, P.y + 1, P.w - 2, P.h - 2);
    const o = gridAt(P);
    g.fillStyle(COL.c).fillRect(o.x, o.y, o.w, o.h);
    g.fillStyle(COL.k).fillRect(o.x + 1, o.y + 1, o.w - 2, o.h - 2);
    g.fillStyle(COL.c);
    for (let x = 1; x < GRID_W; x++)
      for (let y = 1; y < GRID_H; y++)
        g.fillPoint(o.x + x * CELL, o.y + y * CELL, 1);
  }

  drawGrid(gs, P, type, pool, hov, edge) {
    const items = gridOf(gs, type),
      hotI =
        hov && hov.type === type && !gs.drag
          ? itemAt(items, hov.cx, hov.cy)
          : -1;
    let n = 0;
    items.forEach((it, i) => {
      if (!it) return;
      const [cx, cy] = cellOf(i),
        r = footprint(P, cx, cy, ...sizeOf(it)),
        img = pool[n++];
      this.drawSlot(this.gi, r, it, img, gs, i === hotI, edge);
      if (it.qty > 1) drawCount(this.gc, r, it.qty, "w");
    });
    for (; n < GRID_N; n++) pool[n].setVisible(false);
  }

  drawDropPreview(gs, P, hov) {
    const d = gs.drag,
      [w, h] = sizeOf(d.item),
      [cx, cy] = cellOf(dropAnchor(gs, hov, d)),
      r = footprint(P, cx, cy, w, h),
      fit = dropFit(gs, hov, d),
      gc = this.gc.fillStyle(COL[fit === "ok" ? "c" : fit === "swap" ? "w" : "m"]);
    gc.fillRect(r.x, r.y, r.w, 1).fillRect(r.x, r.y + r.h - 1, r.w, 1);
    gc.fillRect(r.x, r.y, 1, r.h).fillRect(r.x + r.w - 1, r.y, 1, r.h);
  }

  drawInventory(gs, ptr) {
    const open = gs.invOpen && !gs.over,
      trade = open && gs.trade,
      p = gs.p,
      gi = this.gi,
      gc = this.gc;
    gi.clear();
    gc.clear();
    [this.tInv, this.tAtk].forEach((t) => t.setVisible(open));
    [this.tShop, this.tShopGold].forEach((t) => t.setVisible(!!trade));
    if (!trade) this.shopPool.forEach((o) => o.setVisible(false));
    if (!open) {
      Object.values(this.invIcons).forEach((i) => i.setVisible(false));
      this.bagPool.forEach((o) => o.setVisible(false));
      return;
    }
    const hov = hitSlot(ptr.x, ptr.y, true, !!trade);
    this.drawPanel(gi, INV, "m");
    for (const s of ["main", "off"])
      this.drawSlot(
        gi,
        INV_EQUIP[s],
        p.equip[s],
        this.invIcons[s],
        gs,
        !!hov && hov.type === "equip" && hov.slot === s,
        "c",
        true,
      );
    this.drawGrid(gs, INV, "bag", this.bagPool, hov, "c");
    const m = p.equip.main;
    const note = gs.invNote?.t > 0 ? gs.invNote.text : null;
    this.tInv.setFont("font_" + (note ? "w" : "m")).setText(note ?? "inventory");
    this.tAtk.setText("atk " + (p.atk + (m ? m.atk : 0)));
    this.tAtk.x = INV.x + INV.w - 3 - this.tAtk.width;
    if (trade) {
      this.drawPanel(gi, SHOP, "y");
      this.drawGrid(gs, SHOP, "shop", this.shopPool, hov, "y");
      this.tShop.setText(trade.name + "'s wares");
      const t = this.tShopGold.setText(p.gold + "g");
      t.x = SHOP.x + SHOP.w - 3 - t.width;
    }
    if (gs.drag && hov && (hov.type === "bag" || hov.type === "shop"))
      this.drawDropPreview(gs, hov.type === "bag" ? INV : SHOP, hov);
  }

  wrap(s, width, maxLines) {
    const m = this.talkText[0],
      keep = m.text,
      lines = [];
    let cur = "";
    for (const word of s.split(" ")) {
      const next = cur ? cur + " " + word : word;
      if (cur && m.setText(unmark(next)).width > width) {
        lines.push(cur);
        cur = word;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    m.setText(keep);
    return lines.slice(0, maxLines);
  }

  drawTalk(gs, ptr) {
    const t = gs.talk,
      gk = this.gk,
      all = [this.talkName, this.talkGold, ...this.talkText, ...this.talkOpts];
    gk.clear();
    all.forEach((o) => o.setVisible(!!t));
    this.talkFrame.setVisible(!!t);
    if (!t) return;
    const box = talkBox(t.options.length),
      { x, y, w, h } = box,
      npc = t.npc,
      hired = npc.mode === "hired",
      vendor = npc.tags.has("vendor");
    this.talkFrame.setPosition(x, y).setSize(w, h);
    this.talkName
      .setFont("font_" + (hired ? "c" : vendor ? "y" : "m"))
      .setText(npc.name + (hired ? " (hired)" : ""))
      .setPosition(x + 3, y + 2);
    this.talkGold
      .setText(gs.p.gold + "g")
      .setPosition(x + w - 3 - this.talkGold.width, y + 2);
    const lines = this.wrap(t.text, w - 6, 2);
    this.talkText.forEach((o, i) =>
      o.setText(lines[i] || "").setPosition(x + 3, box.textY + i * 9),
    );
    const moved = ptr.x !== this.talkPtrX || ptr.y !== this.talkPtrY;
    this.talkPtrX = ptr.x;
    this.talkPtrY = ptr.y;
    const hov =
      moved && !this.isTouch ? hitTalk(ptr.x, ptr.y, t.options.length) : null;
    if (hov !== null && hov >= 0) t.sel = hov;
    this.talkOpts.forEach((o, i) => {
      const opt = t.options[i];
      o.setVisible(!!opt);
      if (!opt) return;
      const r = talkRow(i, t.options.length),
        sel = i === t.sel,
        poor =
          opt.cost != null
            ? gs.p.gold < opt.cost
            : (opt.id === "hire" && gs.p.gold < npc.price) ||
              (opt.id === "pay" && gs.p.gold < npc.owed);
      if (sel) gk.fillStyle(TALK_HI).fillRect(r.x + 1, r.y, r.w - 2, r.h);
      o.setFont("font_" + (poor ? "m" : "w"))
        .setText((this.isTouch ? "" : i + 1 + ". ") + opt.label)
        .setPosition(r.x + 2, r.y);
    });
  }

  markedLine(s, tx, ty, col, hi, line) {
    const m = this.signMeasure;
    let done = "";
    for (const part of s.split(/([{}])/)) {
      if (part === "{" || part === "}") {
        hi = part === "{";
        continue;
      }
      done += part;
      const core = part.trim();
      if (!core) continue;
      const at = m.setText(done.trimEnd()).width - m.setText(core).width;
      line(core, tx + at, ty, hi ? SIGN.hi : col);
    }
    return hi;
  }

  drawSign(gs) {
    const e = gs.sign,
      page = e && ((this.isTouch && e.page.touch) || e.page.items),
      { x, y } = SIGN;
    let ti = 0,
      ii = 0;
    this.signFrame.setVisible(!!page);
    if (page) {
      this.signFrame.setPosition(x, y).setSize(SIGN.w, SIGN.h);
      const line = (s, tx, ty, col) =>
        this.signText[ti++].setFont("font_" + (col || "w")).setText(s).setPosition(tx, ty).setVisible(true);
      for (const it of page) {
        if (it.icon) {
          const [key, frame] = MANUAL_ICONS[it.icon] ?? [it.icon],
            img = this.signIcons[ii++].setTexture(key, frame).setFlipX(!!it.flip).setVisible(true),
            b = frame ? { x: 0, y: 0, w: img.width, h: img.height } : opaqueBounds(this.textures, key),
            k = it.grow ? Math.max(1, Math.floor(Math.min(it.grow[0] / b.w, it.grow[1] / b.h, 2))) : 1;
          img.setScale(k).setPosition(x + it.x - Math.floor((b.w * k) / 2) - b.x * k, y + it.y - Math.floor((b.h * k) / 2) - b.y * k);
        } else if (it.wrap) {
          let hi = false;
          this.wrap(it.wrap, it.w, SIGN.lines).forEach(
            (s, k) => (hi = this.markedLine(s, x + it.x, y + it.y + k * SIGN.lineH, it.col, hi, line)),
          );
        } else {
          const t = line(it.text, x + it.x, y + it.y, it.col);
          if (it.center) t.x -= Math.floor(t.width / 2);
        }
      }
    }
    for (; ti < this.signText.length; ti++) this.signText[ti].setVisible(false);
    for (; ii < this.signIcons.length; ii++) this.signIcons[ii].setVisible(false);
  }

  drawBoss(gs, dt) {
    const b = gs.world.boss,
      g = this.gBoss,
      show = !!b && b.state !== "dormant" && !gs.over && !gs.invOpen,
      card = show && b.state === "intro" && b.stateT > APPEAR * 0.6;
    g.clear();
    this.tBoss.setVisible(show);
    this.cardName.setVisible(card);
    this.cardTitle.setVisible(card);
    if (!show) return;
    const c = b.core,
      B = BOSS_BAR,
      hp = b.state === "dying" ? 0 : Phaser.Math.Clamp(c.hp / c.maxhp, 0, 1),
      f = b.state === "intro" ? hp * Phaser.Math.Clamp((b.stateT - APPEAR) / (INTRO - APPEAR - 0.6), 0, 1) : hp;
    this.bossLag = b.state === "intro" ? f : Math.max(f, this.bossLag - dt * 0.4);
    g.fillStyle(COL.k).fillRect(B.x - 2, B.y - 2, B.w + 4, B.h + 4);
    g.fillStyle(COL.w).fillRect(B.x - 1, B.y - 1, B.w + 2, B.h + 2);
    g.fillStyle(COL.k).fillRect(B.x, B.y, B.w, B.h);
    g.fillStyle(COL.y).fillRect(B.x, B.y, Math.round(B.w * this.bossLag), B.h);
    g.fillStyle(b.immune > 0 ? COL.c : COL.m).fillRect(B.x, B.y, Math.round(B.w * f), B.h);
    const t = this.tBoss.setText(b.def.name);
    t.x = Math.round((VW - t.width) / 2);
    if (!card) return;
    const k = b.stateT - APPEAR * 0.6,
      name = b.def.name.toUpperCase(),
      n = Math.floor(k * 12),
      full = this.cardName.setText(name).width;
    g.fillStyle(COL.k, 0.55).fillRect(0, 30, VW, 38);
    this.cardName.setText(name.slice(0, n)).setX(Math.round((VW - full) / 2));
    this.cardName.setFont("font_" + (n > name.length && Math.floor(b.t * 11) % 2 ? "w" : "m"));
    const sub = this.cardTitle.setText(b.def.title);
    sub.setX(Math.round((VW - sub.width) / 2)).setVisible(n > name.length + 3);
  }

  update(time, delta) {
    const gs = this.gs();
    if (!gs) return;
    const p = gs.p,
      g = this.g,
      ptr = this.input.activePointer;
    g.clear();
    this.tFloor.setText("B" + gs.lvl);
    this.tLv.setText("" + p.lv);
    const xb = this.expBar.setX(this.tLv.x + this.tLv.width + 1),
      xw = HUD_EXP.well;
    g.fillStyle(XP_COL).fillRect(
      xb.x + xw.x,
      xb.y + xw.y,
      Math.round(xw.w * Phaser.Math.Clamp(p.xp / p.next, 0, 1)),
      xw.h,
    );
    this.tGold.setText("" + p.gold + "g");
    this.tGold.x = VW - this.tGold.width;
    const ammo = ammoReadout(p, (b) => gs.countOf(b));
    this.ammoIcon.setVisible(!!ammo?.icon);
    this.tAmmo.setVisible(!!ammo);
    if (ammo) {
      const ax = xb.x + xb.width + 2;
      if (ammo.icon) fit(this.ammoIcon.setTexture(ammo.icon), 8, 8).setX(ax + 4);
      this.tAmmo
        .setFont("font_" + ammo.col)
        .setText(ammo.text)
        .setX(ammo.icon ? ax + 10 : ax);
    }
    this.tPot.setText("" + gs.countOf("potion"));
    this.manaIcon.x = this.tPot.x + this.tPot.width + 5;
    this.tMana.setText("" + gs.countOf("manapotion")).setX(this.manaIcon.x + 4);

    const fillBar = (b, f, col) =>
      g.fillStyle(col).fillRect(
        b.x + b.well.x,
        b.y + b.well.y,
        Math.round(b.well.w * Phaser.Math.Clamp(f, 0, 1)),
        b.well.h,
      );
    const lowBlink = p.hp < p.maxhp * 0.3 && Math.floor(time / 200) % 2;
    fillBar(HUD_BARS.hp, p.hp / p.maxhp, lowBlink ? COL.w : COL.m);
    fillBar(HUD_BARS.mp, p.mp / p.maxmp, COL.c);

    this.gcd.clear();
    for (const s of ["main", "off"]) this.drawHudSlot(g, s, p, gs);

    this.drawInventory(gs, ptr);

    const g2 = this.g2;
    g2.clear();
    const npc = gs.talkable,
      prompt = !!npc && !(gs.msgT > 0) && !gs.over,
      show = (gs.msgT > 0 || prompt) && !gs.over && !gs.invOpen && !gs.talk;
    this.tMsg.setVisible(show);
    if (show) {
      this.tMsg.setText(
        prompt
          ? (this.isTouch ? "E" : "e") + ": talk to " + npc.name
          : gs.msgText,
      );
      this.tMsg.x = Math.round((VW - this.tMsg.width) / 2);
    }
    if (this.isTouch && !gs.over) {
      for (const k in this.btns) {
        if (k === "E" && !gs.talkable) continue;
        const b = this.btns[k],
          pressed = gs["touch" + k] || gs["touch" + k + "Held"];
        g2.fillStyle(COL.k).fillCircle(b.x, b.y, b.r);
        g2.fillStyle(
          pressed
            ? COL.w
            : k === "A"
              ? COL.m
              : k === "B" || k === "M"
                ? COL.c
                : COL.w,
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
      this.btnTxt[k]
        .setVisible(this.isTouch && !gs.over && (k !== "E" || !!gs.talkable))
        .setDepth(10);
    this.drawTalk(gs, ptr);
    this.drawSign(gs);
    this.drawBoss(gs, delta / 1000);

    const d = gs.drag;
    this.ghost.setVisible(!!d);
    if (d)
      fit(
        this.ghost
          .setTexture(iconOf(d.item))
          .setPosition(Math.round(ptr.x), Math.round(ptr.y)),
        12,
        12,
      );
    const tip = this.tipItem(gs, ptr);
    gs.view.hoverMob =
      !tip && !this.isTouch && !gs.invOpen && !gs.over && !gs.p.dead && !gs.drag
        ? gs.pickMobAt(ptr)
        : null;
    gs.view.mobLabel.update(gs.view.hoverMob);

    this.drawTip(
      tip && this.tipLines(tip, gs),
      ptr,
      tip && tip.effects?.length ? effectColor(tip.effects[0]) : "c",
    );
    const ov = gs.over,
      gov = this.gov;
    gov.clear();
    this.overLines.forEach((t) => t.setVisible(ov));
    if (ov) {
      gov.fillStyle(COL.m).fillRect(12, 38, 104, 60);
      gov.fillStyle(COL.k).fillRect(13, 39, 102, 58);
      const L = this.overLines;
      L[1].setText("on B" + gs.lvl + " at lv" + p.lv);
      L[2].setText("kills " + p.kills);
      L[3].setText("gold " + p.gold);
      L[4].setText(this.isTouch ? "tap to retry" : "press r");
      L[4].setVisible(Math.floor(time / 400) % 2 === 0);
      L.forEach((t) => {
        t.x = Math.round((VW - t.width) / 2);
      });
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
