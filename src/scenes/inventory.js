import { defs } from "../sim/defs.js";
import { isStack, addStack, valueOf, sellPrice } from "../sim/items.js";
import { GRID_W, sizeOf, cellOf, itemAt, overlaps, inGrid, canFit, findSpot, stow } from "../sim/grid.js";
import { useStack } from "../sim/actor.js";
import { drop } from "../sim/loot.js";
import { hitSlot } from "./layout.js";
import { isHostile, has, alive } from "../sim/entity.js";
import { sfx } from "../audio/engine.js";

export function pickAt(scene, ptr) {
  const w = ptr.positionToCamera(scene.cameras.main);
  return scene.world.entities.find((o) => {
    if (!o.item || o.removed) return false;
    const spr = scene.view.spriteOf(o);
    return spr && Phaser.Geom.Rectangle.Inflate(spr.getBounds(), 2, 2).contains(w.x, w.y);
  });
}

export function pickMobAt(scene, ptr) {
  const w = ptr.positionToCamera(scene.cameras.main),
    p = scene.world.player;
  let best = null,
    bd = -Infinity;
  for (const o of scene.world.entities) {
    if (!isHostile(p, o) && !((has(o, "npc") || has(o, "vendor")) && alive(o))) continue;
    const rec = scene.view.recs.get(o.id);
    if (!rec) continue;
    let d = o.x + o.y;
    if (rec.R.pick) d = rec.R.pick(scene.view, o, rec, w.x, w.y);
    else {
      const parts = rec.segs ? [rec.spr, ...rec.segs] : [rec.spr];
      if (!parts.some((s) => s.getBounds().contains(w.x, w.y))) continue;
    }
    if (d == null || d <= bd) continue;
    best = o;
    bd = d;
  }
  return best;
}

const note = (scene, why) => {
  if (!why) return;
  sfx("select", { rate: 0.55 });
  if (scene.invOpen) scene.invNote = { text: why, t: 1.2 };
  else scene.world.say(why, 0.8);
};

const isGrid = (t) => t.type === "bag" || t.type === "shop";

export const gridOf = (scene, type) => (type === "bag" ? scene.world.player.bag : type === "shop" ? scene.trade?.stock : null);

export function getAt(scene, t) {
  const p = scene.world.player;
  if (t.type === "equip") return p.equip[t.slot];
  if (isGrid(t)) {
    const g = gridOf(scene, t.type),
      i = t.i ?? itemAt(g, t.cx, t.cy);
    return i >= 0 ? g[i] : null;
  }
  if (t.type === "world") return t.pick.item;
  return null;
}

const sameSlot = (a, b) => a.type === b.type && a.slot === b.slot && a.i === b.i;

const centre = (it) => sizeOf(it).map((n) => (n - 1) >> 1);

export function dropAnchor(scene, hov, d) {
  const g = gridOf(scene, hov.type),
    [w, h] = sizeOf(d.item),
    x = Math.max(0, Math.min(GRID_W - w, hov.cx - d.grab[0])),
    y = Math.max(0, Math.min(g.length / GRID_W - h, hov.cy - d.grab[1]));
  return y * GRID_W + x;
}

export function dropFit(scene, hov, d) {
  const g = gridOf(scene, hov.type),
    [w, h] = sizeOf(d.item),
    [x, y] = cellOf(dropAnchor(scene, hov, d)),
    skip = d.from.type === hov.type ? d.from.i : -1,
    hit = overlaps(g, x, y, w, h, skip);
  if (!hit.length) return "ok";
  return hit.length === 1 && !trading(d.from, hov) ? "swap" : "no";
}

const trading = (src, to) => (src.type === "shop") !== (to.type === "shop");

function setDragging(scene, o, on) {
  o.dragging = on;
  scene.view.spriteOf(o)?.setAlpha(on ? 0.4 : 1);
}

export function onInvPointerDown(scene, ptr) {
  if (ptr.wasTouch || scene.world.player.dead) return false;
  const hit = hitSlot(ptr.x, ptr.y, scene.invOpen, !!scene.trade);
  if (hit) {
    scene.ptrEaten = true;
    if (hit.type === "panel") return true;
    let from = hit;
    if (isGrid(hit)) {
      const i = itemAt(gridOf(scene, hit.type), hit.cx, hit.cy);
      if (i < 0) return true;
      from = { type: hit.type, i };
    }
    const it = getAt(scene, from);
    if (!it) return true;
    if (ptr.rightButtonDown()) {
      if (scene.invOpen) quickUse(scene, from, it);
      return true;
    }
    const [ax, ay] = isGrid(from) ? cellOf(from.i) : [];
    scene.drag = { from, item: it, grab: isGrid(from) ? [hit.cx - ax, hit.cy - ay] : centre(it) };
    sfx("pickupwep", { vol: 0.5 });
    return true;
  }
  if (!ptr.leftButtonDown()) return false;
  const o = pickAt(scene, ptr);
  if (!o) return false;
  scene.ptrEaten = true;
  const p = scene.world.player;
  if (Math.hypot(o.x - p.x, o.y - p.y) > 2) {
    note(scene, "too far");
    return true;
  }
  setDragging(scene, o, true);
  sfx("pickupwep", { vol: 0.5 });
  scene.drag = { from: { type: "world", pick: o }, item: o.item, grab: centre(o.item) };
  return true;
}

function quickUse(scene, from, it) {
  const p = scene.world.player,
    say = (why) => note(scene, why);
  if (scene.trade) {
    if (from.type !== "shop") {
      const i = findSpot(scene.trade.stock, it);
      return say(i < 0 ? "no room" : move(scene, from, it, { type: "shop", i }));
    }
    if (isStack(it)) return say(buyStack(scene, from, it));
    const i = findSpot(p.bag, it);
    return say(i < 0 ? "bag full" : move(scene, from, it, { type: "bag", i }));
  }
  if (isStack(it)) return useStack(scene.world, p, it.base);
  if (from.type === "bag") {
    const slots = defs.weapons[it.base].slots,
      slot = slots.find((s) => !p.equip[s]) || slots[0];
    return say(move(scene, from, it, { type: "equip", slot }));
  }
  const i = findSpot(p.bag, it);
  say(i < 0 ? "bag full" : move(scene, from, it, { type: "bag", i }));
}

function buyStack(scene, from, it) {
  const p = scene.world.player,
    cost = valueOf(it);
  if (p.gold < cost) return "need " + cost + "g";
  const keep = [...p.bag],
    qty = new Map(keep.filter(isStack).map((c) => [c, c.qty]));
  if (addStack(p, it.base, it.qty) > 0) {
    p.bag.splice(0, p.bag.length, ...keep);
    qty.forEach((n, c) => (c.qty = n));
    return "bag full";
  }
  scene.trade.stock[from.i] = null;
  p.gold -= cost;
  sfx("coin");
}

export function placeDrag(scene, target) {
  const d = scene.drag,
    world = scene.world,
    p = world.player;
  if (!d) return;
  scene.drag = null;
  const src = d.from,
    item = d.item;
  if (src.type === "world") setDragging(scene, src.pick, false);

  if (!target) {
    if (src.type !== "world" && src.type !== "shop" && !isStack(item)) {
      take(scene, src);
      drop(world, "item", p.x, p.y, item).gift = true;
      sfx("dropitem");
    }
    return;
  }
  if (target.type === "panel") return;
  const to = isGrid(target) ? { type: target.type, i: dropAnchor(scene, target, d) } : target;
  if (sameSlot(src, to)) return;
  note(scene, move(scene, src, item, to));
}

export function move(scene, src, item, to) {
  const world = scene.world,
    p = world.player,
    buying = src.type === "shop" && to.type !== "shop",
    selling = src.type !== "shop" && to.type === "shop",
    cost = buying ? valueOf(item) : 0,
    gain = selling ? sellPrice(item) : 0;
  if (buying && p.gold < cost) return "need " + cost + "g";
  const undo = save(scene),
    spill = [],
    why = place(scene, src, item, to, buying || selling, spill);
  if (why) {
    restore(scene, undo);
    return why;
  }
  p.gold += gain - cost;
  sfx(buying || selling ? "coin" : "placeitem");
  if (src.type === "world") {
    world.remove(src.pick);
    world.sweep();
    for (const it of spill) drop(world, "item", src.pick.x, src.pick.y, it).gift = true;
  }
}

function take(scene, src) {
  if (src.type === "equip") scene.world.player.equip[src.slot] = null;
  else if (isGrid(src)) gridOf(scene, src.type)[src.i] = null;
}

function place(scene, src, item, to, trade, spill) {
  const p = scene.world.player;
  take(scene, src);
  if (to.type === "equip") {
    if (isStack(item) || !defs.weapons[item.base].slots.includes(to.slot)) return "can't go there";
    const other = p.equip[to.slot];
    if (other && trade) return "slot taken";
    p.equip[to.slot] = item;
    return other && putBack(scene, src, other, spill);
  }
  const g = gridOf(scene, to.type),
    [w, h] = sizeOf(item),
    [x, y] = cellOf(to.i);
  if (!inGrid(g, x, y, w, h)) return "no room";
  const hit = overlaps(g, x, y, w, h);
  if (!hit.length) {
    g[to.i] = item;
    return;
  }
  if (hit.length > 1 || trade) return "no room";
  const other = g[hit[0]];
  if (isStack(item) && other.base === item.base && other.qty < defs.stacks[item.base].max) {
    const k = Math.min(item.qty, defs.stacks[item.base].max - other.qty);
    other.qty += k;
    item.qty -= k;
    if (item.qty > 0) putBack(scene, src, item, spill);
    return;
  }
  g[hit[0]] = null;
  g[to.i] = item;
  return putBack(scene, src, other, spill);
}

function putBack(scene, src, it, spill) {
  if (src.type === "world") return void spill.push(it);
  if (src.type === "equip") {
    if (isStack(it) || !defs.weapons[it.base].slots.includes(src.slot)) return "can't swap";
    scene.world.player.equip[src.slot] = it;
    return;
  }
  const g = gridOf(scene, src.type);
  if (canFit(g, it, src.i)) g[src.i] = it;
  else if (stow(g, it) < 0) return "no room";
}

function save(scene) {
  const p = scene.world.player;
  return { bag: [...p.bag], equip: { ...p.equip }, stock: scene.trade && [...scene.trade.stock] };
}

function restore(scene, s) {
  const p = scene.world.player;
  p.bag.splice(0, p.bag.length, ...s.bag);
  Object.assign(p.equip, s.equip);
  if (s.stock) scene.trade.stock.splice(0, s.stock.length, ...s.stock);
}
