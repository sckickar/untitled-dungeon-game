import { MW, MH } from "../../config.js";
import { ri, pick } from "../../lib/math.js";
import { carve, roomCell, wallProps } from "../../sim/level.js";
import { bfs } from "../../sim/nav.js";

export const LAIR_DEPTHS = [5, 10, 15];

export function lairAt(world) {
  const i = LAIR_DEPTHS.indexOf(world.depth);
  if (i < 0) return null;
  if (i === 2) return "nyarl";
  const run = (world.run ??= {});
  run.bosses ??= Math.random() < 0.5 ? ["lich", "octo"] : ["octo", "lich"];
  return run.bosses[i];
}

const LAIRS = {
  octo: { arena: [15, 15], shape: "blob", guards: ["slime", "slime", "snake", "bat", "bat"], say: "daijobou" },
  lich: { arena: [15, 15], shape: "rect", guards: ["skel", "skel", "risen", "risen", "cult"], say: "bones rattling" },
  nyarl: { arena: [21, 21], shape: "blob", guards: ["fleshling", "fleshling", "brute", "fleshking"], say: "it comes" },
};

export function buildLair(world, { carry = null } = {}, id) {
  const L = LAIRS[id],
    [w, h] = L.arena;
  world.lair = id;
  let A, rest;
  for (let tries = 0; ; tries++) {
    const x = Math.random() < 0.5 ? 3 : MW - 3 - w,
      y = Math.random() < 0.5 ? 3 : MH - 3 - h;
    carve(world, { fixed: [{ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1), shape: L.shape }] });
    [A, ...rest] = world.rooms;
    if (rest.length >= 3 || tries >= 8) break;
  }
  const d = bfs(world, A.cx, A.cy),
    far = (r) => d[r.cy * MW + r.cx];
  const start = rest.reduce((best, r) => (far(r) > far(best) ? r : best), rest[0]);
  world.rooms = [start, ...rest.filter((r) => r !== start), A];
  world.stairRoom = A;
  world.player = world.spawn("player", start.cx + 0.5, start.cy + 0.5, { carry });
  const props = wallProps(world);
  for (const r of rest) {
    props(r, ri(1, 3));
    if (r === start) continue;
    for (let n = ri(1, 3); n > 0; n--) {
      const c = roomCell(world, r);
      world.spawn(pick(L.guards), c.x, c.y);
    }
  }
  world.spawn(id, A.cx + 0.5, A.cy + 0.5, { arena: A });
  world.say(L.say, 3);
}
