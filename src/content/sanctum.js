import { pick, ri, rnd, norm, dist } from "../lib/math.js";
import { creature } from "../sim/templates.js";
import { defs } from "../sim/defs.js";
import { alive } from "../sim/entity.js";
import { addEffect, itemName, baseName, rollItem, MAX_EFFECTS } from "../sim/items.js";
import { makeGrid, sizeOf, stow } from "../sim/grid.js";
import { carveVault } from "../sim/level.js";
import { on } from "../sim/rules.js";

const CHANCE = 1,
  SIZE = { w: [3, 5], h: [3, 4] },
  CULTISTS = [1, 3],
  WATCH = 4,
  STILL = 2.2,
  PACE = 0.6,
  REST = [1.5, 4],
  GIVE_UP = 5,
  STOCK = { items: [4, 7], potion: [2, 5], manapotion: [1, 4], arrow: [15, 40] };

const MERCHANT_NAMES = ["ozzo", "fitch", "marl", "quill", "bram"];

const LINES = {
  merchant: {
    hello: [
      "steel gets tired down here. i fix that.",
      "a little gold, a little sharper.",
      "door's shut for a reason. buying?",
    ],
    done: ["there. ", "good as new. better. ", "mind the edge. "],
  },
  cultist: {
    hello: [
      "the rite of $ hungers for gold.",
      "let $ into your steel, pilgrim.",
      "$ answers those who tithe.",
    ],
    done: ["it is done. ", "$ takes hold. ", "the rite holds. "],
  },
  none: ["you've nothing i can work with."],
  full: ["that one can hold no more."],
  poor: ["come back with more gold."],
};

const riteWord = (id) => id.replace(/^of /, "");
const say = (lines, e) => pick(lines).replace("$", e.rite ? riteWord(e.rite) : "");

const SERVICES = {
  hone: {
    who: "merchant",
    tag: " +1",
    can: (it) => !!it,
    price: (it, depth) =>
      Math.round((10 + 4 * depth) * (1 + 0.6 * (it.plus || 0))),
    apply(world, e, it) {
      it.plus = (it.plus || 0) + 1;
      if (defs.weapons[it.base].kind === "shield") {
        it.maxDur += 3;
        it.dur = it.maxDur;
      } else it.atk += 1;
      it.name = itemName(it);
      return baseName(it);
    },
  },
  bless: {
    who: "cultist",
    tag: "",
    can: (it, e) => {
      if (!it || !defs.weapons[it.base].suffixChance) return false;
      const have = it.effects.find((fx) => fx.id === e.rite);
      return have ? have.power != null : it.effects.length < MAX_EFFECTS;
    },
    price: (it, depth) =>
      Math.round((16 + 5 * depth) * (1 + 0.5 * it.effects.length)),
    apply(world, e, it) {
      addEffect(it, e.rite, world.depth);
      return riteWord(e.rite);
    },
  },
};

function offers(world, e) {
  const S = SERVICES[e.def.service],
    p = world.player,
    list = [];
  for (const slot of ["main", "off"]) {
    const it = p.equip[slot];
    if (!S.can(it, e)) continue;
    const cost = S.price(it, world.depth);
    list.push({ id: slot, label: `${slot}${S.tag} ${cost}g`, cost });
  }
  if (e.stock) list.unshift({ id: "trade", label: "trade" });
  return [...list, { id: "leave", label: "leave" }];
}

const talk = {
  open(world, e) {
    const options = offers(world, e),
      L = LINES[SERVICES[e.def.service].who];
    return { text: say(options.length > 1 ? L.hello : LINES.none, e), options };
  },
  choose(world, e, id) {
    if (id === "trade") return { trade: true };
    const S = SERVICES[e.def.service],
      p = world.player,
      it = p.equip[id],
      opt = offers(world, e).find((o) => o.id === id);
    let text;
    if (!opt) text = say(it ? LINES.full : LINES.none, e);
    else if (p.gold < opt.cost) text = say(LINES.poor, e) + ` (${opt.cost}g)`;
    else {
      p.gold -= opt.cost;
      const what = S.apply(world, e, it);
      text = say(LINES[S.who].done, e) + what;
      world.emit("popup", { x: e.x, y: e.y, z: 14, text: "-" + opt.cost + "g", color: "y" });
      world.emit("enchanted", { actor: e, item: it, service: e.def.service, cost: opt.cost });
    }
    return { text, options: offers(world, e) };
  },
};

export function vendorBrain(world, e, dt) {
  const p = world.player,
    near = alive(p) ? dist(e, p) : Infinity,
    aim = near < WATCH ? norm(p.x - e.x, p.y - e.y) : null;
  if (near < STILL) return { aim };
  if (!e.room) return { move: walkTo(e, e.home, 1), aim };
  e.restT = (e.restT ?? rnd(...REST)) - dt;
  if (!e.goal) {
    if (e.restT > 0) return { aim };
    e.goal = roomSpot(e.room);
    e.goalT = GIVE_UP;
  }
  e.goalT -= dt;
  const move = walkTo(e, e.goal, PACE);
  if (!move || e.goalT <= 0) {
    e.goal = null;
    e.restT = rnd(...REST);
  }
  return { move, aim };
}

const walkTo = (e, at, pace) => {
  const d = Math.hypot(at.x - e.x, at.y - e.y);
  if (d < 0.15) return null;
  const u = norm(at.x - e.x, at.y - e.y),
    k = pace * Math.min(1, d);
  return { x: u.x * k, y: u.y * k };
};

function roomSpot(v) {
  for (;;) {
    const x = ri(v.x, v.x + v.w - 1),
      y = ri(v.y, v.y + v.h - 1);
    if (x === v.door.x + v.dir.x && y === v.door.y + v.dir.y) continue;
    return { x: x + rnd(0.3, 0.7), y: y + rnd(0.3, 0.7) };
  }
}

function rollStock(depth) {
  const g = makeGrid(),
    area = (it) => sizeOf(it).reduce((a, b) => a * b);
  const gear = Array.from({ length: ri(...STOCK.items) }, () => rollItem(depth));
  for (const it of gear.sort((a, b) => area(b) - area(a))) stow(g, it);
  for (const base of ["potion", "manapotion", "arrow"]) stow(g, { base, qty: ri(...STOCK[base]) });
  return g;
}

const vendor = (d) =>
  creature({
    team: "vendor",
    brain: "vendor",
    tags: ["vendor"],
    hp: 40,
    spd: 1.2,
    r: 0.26,
    weight: 6,
    talk,
    ...d,
    look: { outline: "y", blood: "m", faceFlip: true, ...d.look },
    setup(world, e, { rite, room } = {}) {
      e.home = { x: e.x, y: e.y };
      e.room = room ?? null;
      e.name = d.name ?? pick(MERCHANT_NAMES);
      if (rite) e.rite = rite;
      if (d.service === "hone") e.stock = rollStock(world.depth);
    },
  });

export const SANCTUM = {
  merchant: vendor({
    service: "hone",
    look: { sprite: "merchant", anims: { front: "merchant_f", back: "merchant_b" } },
  }),
  acolyte: vendor({
    name: "acolyte",
    service: "bless",
    look: { sprite: "cult", anim: "cult" },
  }),
  zealot: vendor({
    name: "zealot",
    service: "bless",
    look: { sprite: "cult2", anims: { front: "cult2_f", back: "cult2_b" } },
  }),

  door: {
    r: 0.5,
    tags: ["obstacle"],
    look: { renderer: "prop", sprite: "door", yOff: 5 },
    update(world, d) {
      const p = world.player;
      if (!alive(p) || dist(p, d) > d.r + p.r + 0.1) return;
      world.remove(d);
      world.emit("popup", { x: d.x, y: d.y, z: 14, text: "creak", color: "y" });
      world.say("a hidden sanctum", 2);
      world.emit("doorOpened", { door: d });
    },
  },
};

function pickRites(n) {
  const left = Object.values(defs.suffixes),
    out = [];
  while (out.length < n && left.length) {
    let r = Math.random() * left.reduce((s, a) => s + (a.weight ?? 1), 0),
      i = 0;
    while ((r -= left[i].weight ?? 1) >= 0 && i < left.length - 1) i++;
    out.push(left.splice(i, 1)[0].id);
  }
  return out;
}

export function placeSanctum(world) {
  const v = carveVault(world, ri(...SIZE.w), ri(...SIZE.h));
  if (!v) return null;
  world.sanctum = v;
  world.spawn("door", v.door.x + 0.5, v.door.y + 0.5);
  const { door, dir } = v,
    cells = [];
  for (let y = v.y; y < v.y + v.h; y++)
    for (let x = v.x; x < v.x + v.w; x++) {
      const deep = (x - door.x) * dir.x + (y - door.y) * dir.y,
        side = Math.abs((x - door.x) * dir.y + (y - door.y) * dir.x);
      if (deep === 1 && side === 0) continue;
      cells.push({ x, y, deep, side });
    }
  cells.sort((a, b) => b.deep - a.deep || a.side - b.side);
  const back = cells.shift();
  world.spawn("merchant", back.x + 0.5, back.y + 0.5, { room: v });
  const rites = pickRites(Math.min(ri(...CULTISTS), cells.length));
  for (const rite of rites) {
    const c = cells.splice(ri(0, cells.length - 1), 1)[0];
    world.spawn(pick(["acolyte", "zealot"]), c.x + 0.5, c.y + 0.5, { rite, room: v });
  }
  return v;
}

on("levelGenerated", (ev, world) => {
  if (!world.safe && !world.lair && Math.random() < CHANCE) placeSanctum(world);
});
