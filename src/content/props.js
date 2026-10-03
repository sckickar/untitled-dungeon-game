import { prop } from "../sim/templates.js";

const SHARDS = ["shard", "shard2", "shard3"],
  SPLINTERS = ["splint", "splint2", "splint3"];

export const PROPS = {
  pot: prop({
    hp: 1,
    loot: "pot",
    spawn: { wall: true, weight: 6 },
    look: { sprite: "pot", yOff: 2, debris: SHARDS },
  }),
  crate: prop({
    hp: 3,
    loot: "crate",
    spawn: { wall: true, weight: 4 },
    look: { sprite: "crate", yOff: 2, debris: SPLINTERS },
  }),

  stairs: {
    look: { renderer: "effect", sprite: "stairs0", anim: "stairs", depth: -9e4 },
    update(world, s) {
      const p = world.player;
      if (!p || p.dead || world.descending || Math.hypot(p.x - s.x, p.y - s.y) >= 0.35) return;
      world.descending = true;
      world.emit("descend");
      world.say("descending", 1);
    },
  },
};
