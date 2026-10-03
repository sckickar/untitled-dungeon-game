import { on } from "../../sim/rules.js";

on("descend", (ev, world) => {
  if (world.run) world.run.time = (world.run.time ?? 0) + world.time;
});

on("tick", (ev, world) => {
  if (world.cleared || world.safe) return;
  if (world.entities.some((e) => e.team === "monster" && e.tags.has("creature") && !e.dead)) return;
  world.cleared = true;
  world.say("floor clear", 2);
});
