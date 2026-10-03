import { pick, ri, rnd, norm, dist } from "../lib/math.js";
import { creature } from "../sim/templates.js";
import { rollItem } from "../sim/items.js";
import { defs } from "../sim/defs.js";
import { alive, has, isHostile, cooldownReady } from "../sim/entity.js";
import { drop } from "../sim/loot.js";
import { flowDir } from "../sim/nav.js";
import {
  perceive,
  chase,
  wander,
  inReach,
  attackRange,
  hasMana,
  isSupport,
  supportIntent,
  nearest,
  PRESS,
  SEEK_EVERY,
} from "../sim/ai.js";
import { roomCell } from "../sim/level.js";
import { on } from "../sim/rules.js";
import { rollAppearance } from "./appearance.js";

export const TALK_RANGE = 1.6;
const ROOM_CHANCE = 0.2,
  MAX_PER_FLOOR = 3,
  HUNT = 6,
  STRAY = 7.5,
  BEHIND = 1.3,
  UPKEEP_BASE = 1,
  UPKEEP_DEPTH = 0.6,
  BULK = 0.08,
  BULK_FLOOR = 0.3,
  BETRAY_CHANCE = 0.2,
  BETRAY_CAP = 0.75,
  BROOD = [15, 40],
  LOOK = 5,
  GRAB = 0.7,
  UPGRADE = 1,
  POTION_MAX = 2;

const casts = (e) => {
  const it = e.equip.main;
  return !!it && (!!it.spell || !!defs.weapons[it.base].mp);
};

const FLASKS = {
  potion: { want: () => true, need: (e) => e.hp < e.maxhp * 0.4 },
  manapotion: { want: casts, need: (e) => casts(e) && e.mp < e.maxmp * 0.25 },
};

const WEAPONS = [
  "sword",
  "sword",
  "scimitar",
  "spear",
  "dagger",
  "katana",
  "greatsword",
  "halberd",
  "scythe",
  "windstaff",
  "bow",
  "bow",
  "largebow",
  "staff",
  "staff",
  "magicwand",
  "bloodwand",
  "throwingknife",
  "throwingaxe",
];
const NAMES = [
  "jork",
  "bran",
  "cass",
  "val",
  "olie",
  "fenn",
  "gil",
  "hale",
  "ione",
  "jory",
  "uell",
  "lute",
  "mara",
  "nell",
  "orin",
  "pell",
  "quin",
  "gork",
  "sable",
  "tam",
  "pete",
  "vex",
  "wren",
  "yorr",
];
const MEMBER_KEYS = [
  "name",
  "appearance",
  "hp",
  "maxhp",
  "atk",
  "mp",
  "maxmp",
  "equip",
  "price",
  "owed",
  "unpaid",
  "potions",
  "gearDrop",
];

const LINES = {
  idle: ["just resting here.", "long way down, eh?", "quiet room. for now."],
  hunt: [
    "these halls are crawling.",
    "more for my blade.",
    "stay out of my way.",
  ],
  hired: ["i've got your back.", "lead on.", "watch the corners."],
  unpaid: [
    "a blade's only as loyal as its last meal.",
    "funny how heavy your purse looks from back here.",
    "i've buried bosses who forgot to pay.",
    "pay up, or i start keeping my own accounts.",
    "you sleep light, i hope.",
  ],
  paid: [
    "that's more like it.",
    "all square. lead on.",
    "pleasure doing business.",
  ],
  chat: [
    "the deeper you go, the stronger they get.",
    "never trust a quiet floor.",
    "slimes split if you let them breed.",
    "i lost a friend on B3.",
    "potions. always carry potions.",
  ],
  poor: ["come back with more gold."],
  hire: ["deal. lead the way.", "gold's good. let's go."],
  dismiss: ["suit yourself.", "fine. good luck."],
  broke: ["you can't cover it. i'll remember that."],
  betray: ["nothing personal.", "your gold, my gold.", "end of the road."],
  gift: ["for me? thanks, boss.", "i'll put it to use.", "fine steel."],
  loot: ["mine now.", "better than mine.", "finders keepers."],
  potion: ["i'll hold onto this.", "for later."],
  drink: ["*gulp*", "ahh. better."],
};

export function hirePrice(e, depth) {
  const main = e.equip.main,
    gear = (main?.atk || 0) * 3 + (e.equip.off ? 5 : 0);
  return Math.round((8 + 6 * depth + gear + e.maxhp / 4) * rnd(0.85, 1.2));
}

function rollEquip(e, depth) {
  const base = pick(WEAPONS),
    W = defs.weapons[base],
    oneHanded = W.kind === "melee" && W.slots.includes("off");

  e.equip.main = rollItem(depth, base);
  e.equip.off =
    oneHanded && Math.random() < 0.3
      ? rollItem(depth, Math.random() < 0.2 ? "greatshield" : "shield")
      : null;
  e.potions = {
    potion: Math.random() < 0.4 ? 1 : 0,
    manapotion: casts(e) && Math.random() < 0.4 ? 1 : 0,
  };
}

export const NPCS = {
  npc: creature({
    team: "neutral",
    brain: "npc",
    tags: ["npc"],
    hp: 16,
    atk: 2,
    mp: 8,
    mpRegen: 0.8,
    spd: 2.5,
    hiredSpd: 3.4,
    r: 0.26,
    xp: 8,
    loot: "monster",
    gearDrop: 0.6,
    weaponCdMul: 1.5,
    look: {
      renderer: "wielder",
      paperdoll: true,
      idle: { front: 0, back: 2 },
      outline: "w",
      blood: "m",
      corpse: "c_player",
    },
    setup(world, e, { member, mode } = {}) {
      e.home = { x: e.x, y: e.y };
      if (member) {
        Object.assign(e, structuredClone(member));
        e.team = "player";
        e.mode = "hired";
        e.betrayT = rnd(...BROOD);
        return;
      }
      const d = world.depth;
      e.name = pick(NAMES);
      e.appearance = rollAppearance();
      e.hp = e.maxhp = 14 + 4 * d + ri(0, 4);
      e.atk = 2 + Math.floor(d / 2);
      e.mp = e.maxmp = 8 + 2 * d;
      rollEquip(e, d);
      e.mode = mode ?? pick(["idle", "hunt"]);
      e.price = hirePrice(e, d);
    },
  }),
};

const CLOSE = new Set(["melee", "spin"]);
const closeKind = (W) => (CLOSE.has(W.kind) ? "melee" : W.kind);

function fight(world, e, seen) {
  const it = e.equip.main,
    W = it && defs.weapons[it.base];
  if (!W) return { move: chase(world, e, seen), aim: seen.dir };
  if (closeKind(W) === "melee") {
    const shield =
        e.equip.off && defs.weapons[e.equip.off.base].kind === "shield",
      block = shield && seen.dist < 1.8 && seen.target.windT > 0;
    return {
      move: chase(world, e, seen),
      aim: seen.dir,
      main: !block && inReach(e, seen) ? PRESS : null,
      off: block ? { pressed: false, held: true } : null,
    };
  }

  const u = seen.dir,
    range = attackRange(e) || 5;
  let move;
  if (seen.dist < range * 0.55 && seen.see) move = { x: -u.x, y: -u.y };
  else if (seen.dist > range * 0.95 || !seen.see) move = chase(world, e, seen);
  else {
    const s = Math.sin(e.t * 1.3 + e.seed) > 0 ? 1 : -1;
    move = { x: -u.y * s * 0.6, y: u.x * s * 0.6 };
  }
  if (isSupport(e)) {
    const s = supportIntent(world, e);
    return s ? { ...s, move: s.move ?? move } : { move, aim: u };
  }
  const want = seen.see && seen.dist < range;
  return { move, aim: u, main: want && hasMana(e) ? PRESS : null };
}

function guard(world, e, p) {
  const m = e.mem;
  if (dist(e, p) > STRAY) {
    m.target = null;
    m.aggro = false;
    return null;
  }
  if (world.time >= (m.seekAt ?? 0)) {
    m.seekAt = world.time + SEEK_EVERY;
    let best = null,
      bs = Infinity;
    for (const t of world.entities) {
      if (!isHostile(e, t) || !has(t, "creature")) continue;
      const dp = dist(t, p);
      if (dp > HUNT) continue;
      if (!world.los(e.x, e.y, t.x, t.y) && !world.los(p.x, p.y, t.x, t.y))
        continue;
      const after = t.mem?.target,
        s =
          dist(t, e) +
          dp * 0.5 -
          (t === m.target ? 1 : 0) -
          (after === p || after === e ? 1.5 : 0);
      if (s < bs) {
        bs = s;
        best = t;
      }
    }
    if (best && !m.target) world.emit("alert", { actor: e, target: best });
    m.target = best;
  }
  const t = m.target;
  if (!t || !isHostile(e, t) || dist(t, p) > HUNT + 1) {
    m.target = null;
    m.aggro = false;
    return null;
  }
  m.aggro = true;
  const d = dist(e, t) || 1e-3;
  return {
    target: t,
    dist: d,
    dir: { x: (t.x - e.x) / d, y: (t.y - e.y) / d },
    see: world.los(e.x, e.y, t.x, t.y),
  };
}

function escort(world, e, p, threat) {
  const back = threat
      ? norm(p.x - threat.x, p.y - threat.y)
      : { x: -p.face.x, y: -p.face.y },
    gx = p.x + back.x * BEHIND,
    gy = p.y + back.y * BEHIND;
  if (world.solidAt(gx, gy) || !world.los(e.x, e.y, gx, gy))
    return follow(world, e, p);
  const dx = gx - e.x,
    dy = gy - e.y,
    d = Math.hypot(dx, dy),
    aim = threat ? norm(threat.x - e.x, threat.y - e.y) : null;
  if (d < (threat ? 0.25 : 0.9)) return { aim };
  let u = { x: dx / d, y: dy / d };
  const px = e.x - p.x,
    py = e.y - p.y,
    pd = Math.hypot(px, py) || 1e-3;
  if (pd < 1.1 && u.x * px + u.y * py < 0) {
    const s = u.x * -py + u.y * px >= 0 ? 1 : -1;
    u = norm(u.x - (py / pd) * s * 1.5, u.y + (px / pd) * s * 1.5);
  }
  const pace = Math.min(1, d / 1.5);
  return { move: { x: u.x * pace, y: u.y * pace }, aim };
}

function medic(world, e, p) {
  const threat = nearest(
      world,
      p,
      (t) =>
        isHostile(e, t) &&
        has(t, "creature") &&
        dist(t, p) < HUNT &&
        world.los(p.x, p.y, t.x, t.y),
    ),
    stay = escort(world, e, p, threat),
    s = dist(e, p) < STRAY && supportIntent(world, e, HUNT);
  if (!s) return (!threat && scavenge(world, e, p)) || stay;
  return { ...s, move: s.move ?? stay.move };
}

function follow(world, e, p) {
  const d = dist(e, p);
  if (d < 1.4) return {};
  const dir =
    (world.los(e.x, e.y, p.x, p.y) ? null : flowDir(world, e)) ||
    norm(p.x - e.x, p.y - e.y);
  const pace = d > 2.5 ? 1 : 0.5;
  return { move: { x: dir.x * pace, y: dir.y * pace } };
}

const say = (world, e, lines, color = "w") =>
  world.emit("popup", { x: e.x, y: e.y, z: 14, text: pick(lines), color });

export function gearScore(it) {
  if (!it) return -Infinity;
  const fx = (it.effects || []).reduce(
    (n, f) => n + 1 + (f.power ?? 1) * 0.5,
    0,
  );
  return (
    it.atk + fx + it.crit * 10 + (it.leech || 0) * 8 + (it.dur ?? 0) * 0.25
  );
}

const healsWith = (it) => !!(it.spell && defs.spells[it.spell].support);

function slotFor(e, it, gift) {
  const W = defs.weapons[it.base],
    cur = e.equip.main,
    C = cur && defs.weapons[cur.base];
  if (W.kind === "shield") return gift || (C && closeKind(C) === "melee") ? "off" : null;
  if (!W.slots.includes("main")) return null;
  if (gift || !cur) return "main";
  if (closeKind(C) !== closeKind(W) || healsWith(cur) !== healsWith(it)) return null;
  return "main";
}

function wants(e, o) {
  const F = FLASKS[o.type];
  if (F) return F.want(e) && (e.potions[o.type] ?? 0) < POTION_MAX;
  if (!o.item || o.castoff === e) return false;
  const slot = slotFor(e, o.item, o.gift);
  if (!slot) return false;
  return o.gift || gearScore(o.item) >= gearScore(e.equip[slot]) + UPGRADE;
}

const claimed = (o, e) =>
  o.claim && o.claim !== e && alive(o.claim) && o.claim.mem.loot === o;

function findLoot(world, e, p) {
  let best = null,
    bs = Infinity;
  for (const o of world.entities) {
    if (o.removed || o.dragging || o.z > 0 || !has(o, "pickup")) continue;
    if (dist(o, p) > LOOK || claimed(o, e) || !wants(e, o)) continue;
    if (!world.los(e.x, e.y, o.x, o.y)) continue;
    const s = dist(o, e) - (o.gift ? 100 : 0);
    if (s < bs) {
      bs = s;
      best = o;
    }
  }
  return best;
}

function take(world, e, o) {
  world.remove(o);
  if (FLASKS[o.type]) {
    e.potions[o.type] = (e.potions[o.type] ?? 0) + 1;
    return say(world, e, LINES.potion);
  }
  const it = o.item,
    slot = slotFor(e, it, o.gift),
    old = e.equip[slot];
  e.equip[slot] = it;
  if (old) drop(world, "item", e.x, e.y, old).castoff = e;
  say(world, e, o.gift ? LINES.gift : LINES.loot);
  world.emit("loot", { actor: e, item: it, slot, gift: !!o.gift });
}

function scavenge(world, e, p) {
  const m = e.mem;
  if (world.time >= (m.lootAt ?? 0)) {
    m.lootAt = world.time + SEEK_EVERY * 2;
    m.loot = findLoot(world, e, p);
  }
  const o = m.loot;
  if (!o || o.removed || o.dragging || dist(o, p) > LOOK + 1 || !wants(e, o)) {
    m.loot = null;
    return null;
  }
  o.claim = e;
  if (dist(e, o) < GRAB) {
    take(world, e, o);
    m.loot = null;
    return {};
  }
  return { move: norm(o.x - e.x, o.y - e.y) };
}

function drink(world, e) {
  for (const [k, F] of Object.entries(FLASKS)) {
    if (!e.potions[k] || !F.need(e) || !cooldownReady(world, e, "drink", 1.5))
      continue;
    if (defs.stacks[k].use(world, e) === false) continue;
    e.potions[k]--;
    return say(world, e, LINES.drink);
  }
}

export function npcBrain(world, e, dt) {
  const p = world.player;
  drink(world, e);
  if (e.windT > 0)
    return {
      aim: e.mem.target
        ? norm(e.mem.target.x - e.x, e.mem.target.y - e.y)
        : null,
    };
  switch (e.mode) {
    case "hired": {
      if (!alive(p)) return { move: wander(e, dt) };
      if (isSupport(e)) return medic(world, e, p);
      const seen = guard(world, e, p);
      if (!seen) return scavenge(world, e, p) || follow(world, e, p);

      if (!seen.see) return { ...follow(world, e, p), aim: seen.dir };
      return fight(world, e, seen);
    }
    case "hunt":
    case "traitor": {
      const seen = perceive(world, e);
      if (!seen || !e.mem.aggro) return { move: wander(e, dt) };
      return fight(world, e, seen);
    }
    default: {
      if (e.mem.aggro) {
        const seen = perceive(world, e);
        if (seen && e.mem.aggro) return fight(world, e, seen);
      }
      const h = e.home,
        d = Math.hypot(h.x - e.x, h.y - e.y);
      return d > 0.4 ? { move: norm(h.x - e.x, h.y - e.y) } : {};
    }
  }
}

export const canTalk = (e) =>
  alive(e) && (!!e.def.talk || (has(e, "npc") && e.mode !== "traitor"));

export function talkTarget(world) {
  const p = world.player;
  if (!alive(p)) return null;
  let best = null,
    bd = TALK_RANGE;
  for (const e of world.entities) {
    if (!canTalk(e)) continue;
    const d = dist(e, p);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

export function upkeep(depth, size = 1) {
  const rate = Math.max(BULK_FLOOR, 1 / (1 + BULK * (size - 1)));
  return Math.max(1, Math.round((UPKEEP_BASE + UPKEEP_DEPTH * depth) * rate));
}

function options(npc) {
  if (npc.mode === "hired")
    return [
      npc.owed > 0
        ? { id: "pay", label: "pay " + npc.owed + "g" }
        : { id: "chat", label: "chat" },
      { id: "dismiss", label: "dismiss" },
      { id: "leave", label: "leave" },
    ];
  return [
    { id: "hire", label: "hire for " + npc.price + "g" },
    { id: "chat", label: "chat" },
    { id: "leave", label: "leave" },
  ];
}

function greeting(npc) {
  if (npc.mode === "hired")
    return pick(npc.owed > 0 ? LINES.unpaid : LINES.hired);
  return pick(LINES[npc.mode] || LINES.idle);
}

export function openTalk(world, npc) {
  if (npc.def.talk) return { npc, sel: 0, ...npc.def.talk.open(world, npc) };
  return { npc, text: greeting(npc), options: options(npc), sel: 0 };
}

export function chooseTalk(world, talk, id) {
  const npc = talk.npc,
    p = world.player;
  if (!canTalk(npc) || id === "leave") return null;
  if (npc.def.talk) {
    Object.assign(talk, npc.def.talk.choose(world, npc, id));
    talk.sel = Math.min(talk.sel, talk.options.length - 1);
    return talk;
  }
  if (id === "chat") talk.text = pick(LINES.chat);
  else if (id === "hire" && npc.mode !== "hired") {
    if (p.gold < npc.price)
      talk.text = pick(LINES.poor) + " (" + npc.price + "g)";
    else {
      p.gold -= npc.price;
      hire(world, npc);
      const size = world.query((e) => e.mode === "hired" && alive(e)).length;
      talk.text =
        pick(LINES.hire) + " (" + upkeep(world.depth + 1, size) + "g/floor)";
    }
  } else if (id === "pay" && npc.mode === "hired" && npc.owed > 0) {
    if (p.gold < npc.owed)
      talk.text = pick(LINES.broke) + " (" + npc.owed + "g)";
    else {
      p.gold -= npc.owed;
      settle(npc);
      talk.text = pick(LINES.paid);
    }
  } else if (id === "dismiss" && npc.mode === "hired") {
    dismiss(world, npc);
    talk.text = pick(LINES.dismiss);
  }
  talk.options = options(npc);
  talk.sel = Math.min(talk.sel, talk.options.length - 1);
  return talk;
}

export function hire(world, npc) {
  npc.mode = "hired";
  npc.team = "player";
  npc.mem = { aggro: false, target: null };
  settle(npc);
  npc.gearDrop = 1;
  world.emit("hired", { actor: npc });
}

function settle(npc) {
  npc.owed = 0;
  npc.unpaid = 0;
  npc.betrayT = rnd(...BROOD);
}

export function payUpkeep(world) {
  const p = world.player,
    party = world.query((e) => e.mode === "hired" && alive(e));
  if (!party.length) return;
  const fee = upkeep(world.depth, party.length);
  let paid = 0,
    short = 0;
  party.sort((a, b) => (b.unpaid || 0) - (a.unpaid || 0));
  for (const e of party) {
    const due = (e.owed || 0) + fee;
    if (p.gold >= due) {
      p.gold -= due;
      paid += due;
      settle(e);
    } else {
      e.owed = due;
      e.unpaid = (e.unpaid || 0) + 1;
      short++;
    }
  }
  const owing =
    short > 1
      ? short + " unpaid"
      : short
        ? party.find((e) => e.owed).name + " unpaid"
        : "";
  world.say(
    "upkeep: paid " + paid + "g" + (owing ? ", " + owing : ""),
    short ? 3 : 2,
  );
  world.emit("upkeep", { paid, short });
}

export function dismiss(world, npc) {
  settle(npc);
  npc.mode = "idle";
  npc.team = "neutral";
  npc.home = { x: npc.x, y: npc.y };
  npc.mem = { aggro: false, target: null };
  npc.price = hirePrice(npc, world.depth);
}

export function betray(world, npc) {
  npc.mode = "traitor";
  npc.team = "monster";
  npc.mem = { aggro: true, target: world.player };
  world.say(npc.name + " turns on you!", 2.5);
  world.emit("popup", {
    x: npc.x,
    y: npc.y,
    z: 14,
    text: pick(LINES.betray),
    color: "m",
  });
  world.emit("betray", { actor: npc });
}

export const memberOf = (e) =>
  structuredClone(Object.fromEntries(MEMBER_KEYS.map((k) => [k, e[k]])));

on("tick", ({ dt }, world) => {
  const p = world.player;
  for (const e of world.entities) {
    if (e.mode !== "hired" || !(e.unpaid > 0) || !alive(e)) continue;
    const weak = alive(p) && p.hp < p.maxhp * 0.35 && dist(e, p) < 3;
    e.betrayT -= dt * (weak ? 4 : 1);
    if (e.betrayT > 0) continue;
    e.betrayT = rnd(...BROOD);
    if (Math.random() < Math.min(BETRAY_CAP, BETRAY_CHANCE * e.unpaid))
      betray(world, e);
  }
});

on("descend", (ev, world) => {
  world.player.party = world
    .query((e) => e.mode === "hired" && alive(e))
    .map(memberOf);
});

on("death", ({ target }, world) => {
  if (target.mode === "hired") world.say(target.name + " died", 1.5);
  if (has(target, "npc"))
    for (const [k, n] of Object.entries(target.potions ?? {}))
      for (let i = 0; i < n; i++) drop(world, k, target.x, target.y);
});

on("levelGenerated", (ev, world) => {
  const p = world.player,
    r0 = world.rooms[0];
  for (const m of p.party || []) {
    const c = roomCell(world, r0);
    world.spawn("npc", c.x, c.y, {
      member: {
        ...m,
        hp: Math.min(m.maxhp, m.hp + Math.ceil((m.maxhp - m.hp) / 2)),
      },
    });
  }
  p.party = [];
  payUpkeep(world);
  if (world.safe || world.lair) return;

  let n = 0;
  world.rooms.forEach((r, i) => {
    if (
      i === 0 ||
      r === world.stairRoom ||
      n >= MAX_PER_FLOOR ||
      Math.random() >= ROOM_CHANCE
    )
      return;
    const c = roomCell(world, r),
      e = world.spawn("npc", c.x, c.y);
    n++;

    if (e.mode === "idle")
      for (const m of world.query((o) => o.team === "monster" && inRoom(o, r)))
        world.remove(m);
  });
  world.sweep();
});

const inRoom = (o, r) =>
  o.x >= r.x && o.y >= r.y && o.x < r.x + r.w && o.y < r.y + r.h;
