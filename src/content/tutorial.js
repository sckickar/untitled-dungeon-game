import { MW, MH } from "../config.js";
import { dist } from "../lib/math.js";
import { terrainIndex } from "../sim/defs.js";
import { alive } from "../sim/entity.js";
import { makeItem, addEffect } from "../sim/items.js";

const MAP = [
  "#######################",
  "#.......###..........p#",
  "#...1...###.2....D....#",
  "#..@..................#",
  "#..................D..#",
  "#.......###...........#",
  "#.......###......D....#",
  "###########..........p#",
  "###############..######",
  "###############..######",
  "###############..######",
  "#pp....c###...........#",
  "#p......###...3.......#",
  "#.....7.###...........#",
  "#..h..................#",
  "#...........sg..ba.tn.#",
  "#.m.h...###.....kK.zm.#",
  "#p....c.###.4...5...6.#",
  "###..######...........#",
  "###..##################",
  "###..########.........#",
  "#.....o..####.........#",
  "#.8..o...####.9.......#",
  "#..o..H...............#",
  "#......o.........>....#",
  "#...o....####.........#",
  "#p......p####.........#",
  "#############........p#",
  "#######################",
];

export const PAGE_ORDER = [
  "controls",
  "training",
  "gear",
  "steel",
  "ranged",
  "magic",
  "supplies",
  "hirelings",
  "stairs",
];

const GEAR = {
  s: "spear",
  g: "shield",
  b: "bow",
  k: "throwingknife",
  t: "staff",
  n: "magicwand",
};
const DROPS = {
  h: "potion",
  m: "manapotion",
  a: "arrows",
  K: "knives",
  o: "coin",
};
const PROPS = { p: "pot", c: "crate" };
const SPECIAL = {
  z: () => addEffect(makeItem("staff"), "of sparks"),
};

const HIRE_PRICE = 5;

export const SIGN_RANGE = 1.75;

const card = (title, icon, text, touchText) => {
  const items = (body) => [
    { icon, x: 16, y: 24, grow: [24, 36] },
    { text: title, x: 30, y: 4, col: "m" },
    { wrap: body, x: 30, y: 13, w: 92, col: "w" },
  ];
  return { items: items(text), touch: touchText && items(touchText) };
};

const column = (cx, icon, label, keys, flip = false) => [
  { icon, x: cx, y: icon === "wasd" ? 16 : 17, flip },
  { text: label, x: cx, y: 28, col: "w", center: true },
  { text: keys, x: cx, y: 37, col: "y", center: true },
];

export const PAGES = {
  controls: {
    items: [
      ...column(22, "wasd", "move", "or arrows"),
      ...column(64, "mouse", "attack", "lmb or z"),
      ...column(106, "mouse", "off hand", "rmb or x", true),
    ],
    touch: card(
      "controls",
      "sword",
      "drag on the {left} to move. {A} uses your {main hand}, {B} your {off hand}.",
    ).items,
  },
  training: card(
    "training",
    "trainingdummy",
    "go on, hit it. you swing toward the {cursor}. a {!} is a {crit}, double damage.",
    "go on, hit it. you swing the way you {face}. a {!} is a {crit}, double damage.",
  ),
  gear: card(
    "gear",
    "mouse",
    "drag {gear} off the floor onto a {hand slot}. {i} opens your {bag}.",
    "{gear} dropped here is yours to take. {I} opens your {bag}.",
  ),
  steel: card(
    "steel",
    "shield",
    "{spears} hit from afar. hold {off hand} with a {shield} to {block}. blocks wear it down.",
  ),
  ranged: card(
    "ranged",
    "bow",
    "{bows} fire the {arrows} in your bag. {thrown blades} run out with your stack.",
  ),
  magic: card(
    "magic",
    "staff",
    "{staffs} and {wands} burn {mp}, which slowly refills. {blood wands} burn {hp}.",
  ),
  supplies: card(
    "supplies",
    "potion",
    "{q} drinks a {potion}, {r} a {mana potion}. smash {pots} and {crates} for {loot}.",
    "{P} drinks a {potion}, {M} a {mana potion}. smash {pots} and {crates} for {loot}.",
  ),
  hirelings: card(
    "hirelings",
    "coin",
    "press {e} to talk. {hire} a blade, then pay {upkeep} each floor or they turn on you.",
    "tap {E} to talk. {hire} a blade, then pay {upkeep} each floor or they turn on you.",
  ),
  stairs: card(
    "stairs",
    "stairs0",
    "the {stairs} are the only way on. each floor is harder than the last. good luck.",
  ),
};

export const TUTORIAL = {
  signpost: {
    r: 0.2,
    name: "sign",
    tags: ["obstacle", "sign"],
    look: { renderer: "prop", sprite: "signpost", yOff: 1 },
    setup(world, e, { page }) {
      e.page = PAGES[page];
    },
  },
  trainingdummy: {
    team: "object",
    r: 0.3,
    hp: 999,
    name: "training dummy",
    tags: ["obstacle"],
    look: { renderer: "prop", sprite: "trainingdummy", yOff: 1, hurt: "dummy" },
    update(world, o, dt) {
      o.flash -= dt;
      o.hp = o.maxhp;
      o.kx = o.ky = 0;
    },
  },
};

export function signAt(world) {
  const p = world.player;
  if (!alive(p)) return null;
  let best = null,
    bd = SIGN_RANGE;
  for (const e of world.entities) {
    if (!e.page || e.removed) continue;
    const d = dist(e, p);
    if (d < bd) {
      bd = d;
      best = e;
    }
  }
  return best;
}

const place = (world, type, x, y, init) =>
  Object.assign(world.spawn(type, x, y, init), { z: 0, vz: 0, vx: 0, vy: 0 });

export function buildTutorial(world, { carry = null } = {}) {
  const FLOOR = terrainIndex("floor"),
    ox = Math.floor((MW - MAP[0].length) / 2),
    oy = Math.floor((MH - MAP.length) / 2),
    at = {};
  world.tiles.fill(terrainIndex("wall"));
  MAP.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === "#") return;
      world.setTile(ox + x, oy + y, FLOOR);
      if (ch !== ".") (at[ch] ??= []).push({ x: ox + x, y: oy + y });
    }),
  );
  const [start] = at["@"],
    [down] = at[">"],
    around = (c) => ({ x: c.x - 1, y: c.y - 1, w: 3, h: 3, cx: c.x, cy: c.y });
  world.rooms = [around(start), around(down)];
  world.stairRoom = world.rooms[1];
  world.player = world.spawn("player", start.x + 0.5, start.y + 0.5, { carry });
  world.spawn("stairs", down.x + 0.5, down.y + 0.5);

  for (const [ch, cells] of Object.entries(at))
    for (const { x, y } of cells) {
      const cx = x + 0.5,
        cy = y + 0.5;
      if (PAGE_ORDER[ch - 1])
        world.spawn("signpost", cx, cy, { page: PAGE_ORDER[ch - 1] });
      else if (ch === "D") world.spawn("trainingdummy", cx, cy);
      else if (PROPS[ch]) world.spawn(PROPS[ch], cx, cy);
      else if (DROPS[ch]) place(world, DROPS[ch], cx, cy);
      else if (GEAR[ch])
        place(world, "item", cx, cy, { item: makeItem(GEAR[ch]) });
      else if (SPECIAL[ch])
        place(world, "item", cx, cy, { item: SPECIAL[ch]() });
      else if (ch === "H")
        world.spawn("npc", cx, cy, { mode: "idle" }).price = HIRE_PRICE;
    }
}
