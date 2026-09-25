import { pick, ri } from "../core/constants.js";
import {
  WDEF,
  STACKS,
  SPELLS,
  PREFIXES,
  SUFFIXES,
  SUFFIX_CHANCE,
} from "../data/items.js";

import { hitSlot } from "../data/layout.js";

const DROPPABLE = Object.keys(WDEF);
const ORIGIN = {
  melee: [0.15, 0.5],
  bow: [0.5, 0.5],
  staff: [0.3, 0.5],
  shield: [0.5, 0.5],
};

export const items = {
  makeItem(base) {
    const D = WDEF[base];
    const it = {
      base,
      name: base,
      atk: 0,
      cd: D.cd || 0,
      crit: 0.12,
      leech: 0,
    };
    if (base === "staff") {
      it.spell = "lightning";
    }
    if (base === "shield") it.dur = it.maxDur = D.dur[0];
    return it;
  },

  pickAt(ptr) {
    const w = ptr.positionToCamera(this.cameras.main);
    return this.picks.find(
      (o) =>
        o.item &&
        Phaser.Geom.Rectangle.Inflate(o.spr.getBounds(), 2, 2).contains(
          w.x,
          w.y,
        ),
    );
  },

  // Build the fucking item
  rollItem(base = pick(DROPPABLE)) {
    const D = WDEF[base];
    const pre = pick(
      PREFIXES.filter(
        (x) =>
          (!x.only || x.only.includes(base)) &&
          !(x.not && x.not.includes(base)),
      ),
    );
    const it = {
      base,
      prefix: pre.word,
      atk: D.atk
        ? Math.max(
            0,
            ri(D.atk[0], D.atk[1]) + Math.floor(this.lvl / 2) + (pre.atk || 0),
          )
        : 0,
      cd: (D.cd || 0) * (pre.cd || 1),
      crit: 0.12 + (pre.crit || 0),
      leech: pre.leech || 0,
    };
    if (base === "staff") {
      it.spell = pick(Object.keys(SPELLS));
      const S = SPELLS[it.spell];
      it.cd = (S.cd || 0) * (pre.cd || 1);
      if (S.tick) it.tick = S.tick * (pre.cd || 1);
    }
    if (base === "shield")
      it.dur = it.maxDur = Math.max(
        1,
        Math.round(ri(D.dur[0], D.dur[1]) * (pre.dur || 1)),
      );
    if (
      (D.kind === "melee" || D.kind === "bow") &&
      Math.random() < SUFFIX_CHANCE
    ) {
      const suf = pick(SUFFIXES);
      it.suffix = suf.word;
      it.elem = suf.elem;
      it.edmg = ri(suf.dmg[0], suf.dmg[1]) + Math.floor(this.lvl / 3);
    }

    it.name = [pre.word, base, it.suffix].filter(Boolean).join(" ");

    return it;
  },

  isStack(it) {
    return !!(it && STACKS[it.base]);
  },

  countOf(base) {
    return this.p.bag.reduce(
      (n, c) => n + (c && c.base === base ? c.qty : 0),
      0,
    );
  },

  addStack(base, n) {
    const bag = this.p.bag,
      max = STACKS[base].max;
    for (const c of bag)
      if (n > 0 && c && c.base === base && c.qty < max) {
        const k = Math.min(n, max - c.qty);
        c.qty += k;
        n -= k;
      }
    for (let i = 0; i < bag.length && n > 0; i++)
      if (!bag[i]) {
        const k = Math.min(n, max);
        bag[i] = { base, qty: k };
        n -= k;
      }
    return n;
  },

  takeStack(base, n = 1) {
    if (this.countOf(base) < n) return false;
    const bag = this.p.bag;
    for (let i = bag.length - 1; i >= 0 && n > 0; i--) {
      const c = bag[i];
      if (!c || c.base !== base) continue;
      const k = Math.min(n, c.qty);
      c.qty -= k;
      n -= k;
      if (c.qty <= 0) bag[i] = null;
    }
    return true;
  },

  dropItem(item, x, y) {
    this.drop("item", x, y, item);
  },

  refreshHands() {
    const p = this.p;
    for (const slot of ["main", "off"]) {
      const it = p.equip[slot],
        h = p.hand[slot];
      if (it)
        h.setTexture(WDEF[it.base].spr).setOrigin(
          ...ORIGIN[WDEF[it.base].kind],
        );
      h.setVisible(!!it && !p.dead);
    }
  },

  // ---- slot helpers (target = { type: 'equip'|'bag'|'world', ... }) ----
  getAt(t) {
    if (t.type === "equip") return this.p.equip[t.slot];
    if (t.type === "bag") return this.p.bag[t.i];
    if (t.type === "world") return t.pick.item;
    return null;
  },

  setAt(t, it) {
    if (t.type === "equip") this.p.equip[t.slot] = it;
    else if (t.type === "bag") this.p.bag[t.i] = it;
  },

  fits(it, t) {
    if (!it) return true;
    if (t.type === "equip")
      return !this.isStack(it) && WDEF[it.base].slots.includes(t.slot);
    return t.type === "bag";
  },

  sameSlot(a, b) {
    return a.type === b.type && a.slot === b.slot && a.i === b.i;
  },

  // ---- input ----
  onInvPointerDown(ptr) {
    if (ptr.wasTouch || this.p.dead) return false;
    const hit = hitSlot(ptr.x, ptr.y, this.invOpen);
    if (hit) {
      this.ptrEaten = true;
      if (hit.type === "panel") return true;
      const it = this.getAt(hit);
      if (!it) return true;
      if (ptr.rightButtonDown()) {
        if (this.invOpen) this.quickUse(hit, it);
        return true;
      }
      this.drag = { from: hit, item: it };
      return true;
    }
    if (!ptr.leftButtonDown()) return false;
    const o = this.pickAt(ptr);

    if (!o) return false;
    this.ptrEaten = true;
    if (Math.hypot(o.x - this.p.x, o.y - this.p.y) > 2) {
      this.say("too far", 0.8);
      return true;
    }
    o.spr.setAlpha(0.4);
    this.drag = { from: { type: "world", pick: o }, item: o.item };
    return true;
  },

  quickUse(hit, it) {
    const p = this.p;
    if (it.base === "potion") return this.drink();
    if (this.isStack(it)) return;
    if (hit.type === "bag") {
      const slots = WDEF[it.base].slots,
        slot = slots.find((s) => !p.equip[s]) || slots[0];
      p.bag[hit.i] = p.equip[slot];
      p.equip[slot] = it;
    } else {
      const i = p.bag.indexOf(null);
      if (i < 0) return this.say("bag full", 0.8);
      p.bag[i] = it;
      p.equip[hit.slot] = null;
    }
    this.refreshHands();
  },

  placeDrag(target) {
    const d = this.drag,
      p = this.p;
    if (!d) return;
    this.drag = null;
    const src = d.from,
      item = d.item;
    if (src.type === "world") src.pick.spr.setAlpha(1);

    // released over nothing: drop weapons from slots onto the floor, everything else snaps back
    if (!target) {
      if (src.type !== "world" && !this.isStack(item)) {
        this.setAt(src, null);
        this.dropItem(item, p.x, p.y);
        this.refreshHands();
      }
      return;
    }
    if (target.type === "panel" || this.sameSlot(src, target)) return;
    if (!this.fits(item, target)) return this.say("can't go there", 0.8);

    const other = this.getAt(target);

    if (other && this.isStack(item) && other.base === item.base) {
      const k = Math.min(item.qty, STACKS[item.base].max - other.qty);
      other.qty += k;
      item.qty -= k;
      if (item.qty <= 0) this.setAt(src, null);
      return;
    }
    if (other && src.type !== "world" && !this.fits(other, src))
      return this.say("can't swap", 0.8);

    this.setAt(target, item);
    if (src.type === "world") {
      this.removePick(src.pick);
      if (other) this.dropItem(other, src.pick.x, src.pick.y);
    } else this.setAt(src, other);
    this.refreshHands();
  },
};
