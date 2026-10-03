import { iso } from "../lib/iso.js";
import { rnd, ri, pick } from "../lib/math.js";
import { defs } from "../sim/defs.js";
import { bodyPoints } from "../sim/entity.js";
import { sprOf } from "../sim/items.js";
import { POOLS, GLV } from "./assets/manifest.js";

const corpseFrame = (prefix) => prefix + "_g" + ri(0, GLV - 1);

const styleOf = (L, key) => L[key] ?? (L.debris ? "debris" : "creature");

const HURT = {
  creature(view, e, ev) {
    const L = e.def.look,
      z = L.z || 0;
    view.gore.spray(e.x, e.y, z + 4, ev.dir.x, ev.dir.y, 5 + ev.amount, L.blood, 0.8, 2.6);
    view.pops.add(e.x, e.y, z + 12, ev.crit ? ev.amount + "!" : "" + ev.amount, ev.crit ? "m" : ev.color || "w");
  },
  player(view, e, ev) {
    view.gore.spray(e.x, e.y, 5, ev.dir.x, ev.dir.y, 8 + ev.amount * 2, e.def.look.blood, 0.9, 2.4);
    view.pops.add(e.x, e.y, 14, "" + ev.amount, "m");
    view.camera.shake(2, 0.16);
  },
  debris(view, e, ev) {
    view.gore.debris(e.x, e.y, 4, ev.dir.x, ev.dir.y, e.def.look.debris, 3, false);
  },
  dummy(view, e, ev) {
    view.pops.add(e.x, e.y, 14, ev.crit ? ev.amount + "!" : "" + ev.amount, ev.crit ? "m" : ev.color || "w");
    view.gore.debris(e.x, e.y, 6, ev.dir.x, ev.dir.y, ["splint", "splint2", "splint3"], 2, false);
    const rec = view.recs.get(e.id);
    if (rec) Object.assign(rec, { wob: 1, wobDir: ev.dir.x - ev.dir.y >= 0 ? 1 : -1 });
  },
};

const DEATH = {
  creature(view, e, { dir }) {
    const L = e.def.look,
      c = L.blood,
      z = L.z || 0,
      g = view.gore,
      body = bodyPoints(e);
    body.forEach((b, i) => {
      if (c !== "w" && i % 2 === 0) {
        g.stamp(L.pool || pick(POOLS[c]), b.x, b.y);
        g.bloodAdd(b.x, b.y, 4, 2);
      }
    });
    if (e.segs && L.segment) e.segs.forEach((s, i) => i % 2 === 0 && g.stamp(corpseFrame(L.segment.corpse), s.x, s.y));
    const corpse = view.recs.get(e.id)?.corpse ?? (L.corpse && corpseFrame(L.corpse));
    if (corpse) g.stamp(corpse, e.x + dir.x * 0.1, e.y + dir.y * 0.1);
    for (const b of body) {
      g.spray(b.x, b.y, z + 5, dir.x, dir.y, Math.round((L.spray ?? 22) / (e.segs ? 3 : 1)), c, 1.4, 3.2);
      for (let i = 0; i < (L.gibs || 0); i++) g.gib(b.x, b.y, z + 5, c, dir.x, dir.y, rnd(1, 3.4));
    }
    for (let i = 0, n = ri(1, 3) + (e.segs ? 3 : 0); i < n; i++) {
      const b = pick(body);
      g.glyph(b.x + rnd(-0.5, 0.5), b.y + rnd(-0.5, 0.5), Math.random() < 0.7 ? c : pick("mcw"));
    }
    view.scene.hitstop = 0.05;
    view.camera.shake(2, 0.14);
  },
  player(view, e, { dir }) {
    const g = view.gore;
    g.stamp("cp_big_m", e.x, e.y);
    g.bloodAdd(e.x, e.y, 5, 2);
    g.stamp(view.recs.get(e.id)?.corpse ?? corpseFrame(e.def.look.corpse), e.x, e.y);
    const main = e.equip.main;
    if (main && !view.world.solidAt(e.x + dir.x * 0.6, e.y + dir.y * 0.6)) {
      const sp = iso(e.x + dir.x * 0.6, e.y + dir.y * 0.6);
      const key = sprOf(main),
        rot = rnd(0, 6.283);
      g.drawObj(view.swordStamp, Math.round(sp.x), Math.round(sp.y), (o) => o.setTexture(key).setRotation(rot));
    }
    g.spray(e.x, e.y, 5, dir.x, dir.y, 45, "m", 3.1, 2.6);
    for (let i = 0; i < 10; i++) g.gib(e.x, e.y, 5, pick("mmc"), dir.x, dir.y, rnd(1, 3));
    for (let i = 0; i < 4; i++) g.glyph(e.x + rnd(-0.6, 0.6), e.y + rnd(-0.6, 0.6), pick("mmw"));
    view.scene.hitstop = 0.15;
    view.camera.shake(3, 0.3);
  },
  debris(view, e, { dir }) {
    view.gore.debris(e.x, e.y, 3, dir.x, dir.y, e.def.look.debris, 12, true);
  },
};

function spinTrail(view, a, { dir, item, spin }, turn) {
  const W = defs.weapons[item.base],
    R = Math.max(0.6, W.reach * 0.6),
    a0 = Math.atan2(dir.y, dir.x),
    n = 6;
  for (let i = 0; i < n; i++)
    view.scene.time.delayedCall((i * spin * 1000) / n, () => {
      const ang = a0 + (turn * i * 6.283) / n,
        ux = Math.cos(ang),
        uy = Math.sin(ang),
        sp = iso(a.x + ux * R, a.y + uy * R);
      const fx = view.scene.add
        .image(sp.x, sp.y - 5, "slashwind")
        .setRotation(Math.atan2((ux + uy) * 0.5, ux - uy) + (turn * Math.PI) / 2)
        .setFlipY(turn < 0)
        .setAlpha(0.8)
        .setDepth(a.x + a.y + ux + uy + 0.3);
      view.scene.time.delayedCall(90, () => fx.destroy());
    });
}

function siphonMotes(view, from, to, stat) {
  const key = stat === "hp" ? "bloodbeam" : "manabeam",
    frames = view.scene.textures.get(key).frameTotal - 1,
    p1 = iso(to.x, to.y),
    depth = Math.max(from.x + from.y, to.x + to.y) + 0.2;
  for (let i = 0; i < 3; i++) {
    const p0 = iso(from.x + rnd(-0.15, 0.15), from.y + rnd(-0.15, 0.15)),
      spr = view.scene.add.image(p0.x, p0.y - 5 - rnd(0, 4), key, ri(0, frames - 1)).setDepth(depth);
    view.scene.tweens.add({
      targets: spr,
      x: p1.x,
      y: p1.y - 6,
      delay: i * 60,
      duration: 220 + rnd(0, 80),
      ease: "Quad.easeIn",
      onComplete: () => spr.destroy(),
    });
  }
}

export function bindReactions(view) {
  const { world, gore, pops } = view;
  const on = (event, fn) => world.on(event, fn);

  on("damaged", (ev) => HURT[styleOf(ev.target.def.look, "hurt")](view, ev.target, ev));
  on("death", (ev) => DEATH[styleOf(ev.target.def.look, "death")](view, ev.target, ev));

  on("healed", ({ target: t, requested, cause, quiet }) => {
    if (quiet) return;
    pops.add(t.x, t.y, 14, "+" + requested, "c");
    if (cause === "potion") gore.floaters(t.x, t.y, 10, { z: [0, 6] });
    else gore.floaters(t.x, t.y, 3);
  });
  on("levelUp", ({ actor: a }) => gore.floaters(a.x, a.y, 16, { ring: 0.5, z: [2, 2], keys: ["d_c1", "d_w1"], life: [0.6, 0.6] }));
  on("alert", ({ actor: a }) => pops.add(a.x, a.y, (a.def.look.z || 0) + 14, "!", "m"));
  on("popup", ({ x, y, z, text, color }) => pops.add(x, y, z, text, color));
  on("status:applied", ({ target: t, status: s, fresh }) => {
    const L = s.def.look;
    if (fresh && L?.popup) pops.add(t.x, t.y, (t.def.look.z || 0) + 14, L.popup, L.popupCol || "w");
  });
  on("mate", ({ a, b }) => pops.add((a.x + b.x) / 2, (a.y + b.y) / 2, 16, "<3", "m"));
  on("born", ({ child: c }) => {
    const blood = c.def.look.blood || "m";
    gore.spray(c.x, c.y, 3, 0, 0, 14, blood, 3.14, 1.4);
    if (blood !== "w") gore.stamp(pick(POOLS[blood]), c.x, c.y);
    pops.add(c.x, c.y, 14, "+1", "m");
  });

  on("brood", ({ parent: p, child: c }) => gore.spray(c.x, c.y, 3, 0, 0, 6, p.def.look.blood || "m", 3.14, 1));

  on("blocked",({ target: t, x, y, z, dir }) => {
    gore.spray(x, y, z, -dir.x, -dir.y, 6, "w", 1.2, 2);
    pops.add(t.x, t.y, 14, "block", "c");
    view.camera.shake(1, 0.08);
  });
  on("shieldBroke", ({ actor: a }) => gore.debris(a.x, a.y, 6, 0, 0, ["splint", "splint2", "splint3"], 10, true));

  on("swing", (ev) => {
    const a = ev.actor,
      rec = view.recs.get(a.id);
    rec?.R.onSwing?.(view, a, rec, ev);
    if (ev.spin) return spinTrail(view, a, ev, rec?.spinDir ?? 1);
    const { dir, slot, item } = ev,
      W = item && defs.weapons[item.base],
      wind = W?.slash === "slashwind",
      out = wind ? Math.max(0.45, W.reach * 0.45) : 0.45,
      sp = iso(a.x + dir.x * out, a.y + dir.y * out);
    const fx = view.scene.add
      .image(sp.x, sp.y - 5, wind ? "slashwind" : "slash0")
      .setRotation(Math.atan2((dir.x + dir.y) * 0.5, dir.x - dir.y))
      .setFlipY(slot === "main" ? (rec?.swingFrom ?? 0) > 0 : false)
      .setDepth(a.x + a.y + dir.x + dir.y + 0.3);
    if (wind) {
      fx.setScale(W.big ? 2 : 1.5);
      view.scene.time.delayedCall(70, () => fx.setScale(W.big ? 2.4 : 1.8).setAlpha(0.6));
      view.scene.time.delayedCall(150, () => fx.destroy());
      return;
    }
    view.scene.time.delayedCall(60, () => fx.setTexture("slash1"));
    view.scene.time.delayedCall(130, () => fx.destroy());
  });
  on("swingLanded", () => view.camera.shake(1, 0.08));
  on("siphon", ({ from, to, stat }) => siphonMotes(view, from, to, stat));
  on("beam", (ev) => view.beams.show(ev));
  on("impact", ({ x, y, z, dir, color }) => gore.spray(x, y, z, dir.x, dir.y, 6, color, 1.2, 2));
  on("shatter", ({ x, y, z, dir }) => gore.debris(x, y, z, -dir.x, -dir.y, ["shard", "shard2", "shard3", "splint"], 5, false));
  on("boom", () => view.camera.shake(2, 0.15));
  on("bossArrived", () => view.camera.shake(4, 0.5));
  on("bossState", ({ state }) => state === "dying" && view.camera.shake(3, 1));
  on("victory", () => view.camera.shake(4, 1.2));
  on("bloodPaid", ({ actor: a, amount }) => {
    gore.spray(a.x, a.y, 5, 0, 0, 3 + amount * 2, a.def.look.blood ?? "m", 3.14, 0.8);
    if (a === world.player) pops.add(a.x, a.y, 14, "-" + amount, "m");
  });
}
