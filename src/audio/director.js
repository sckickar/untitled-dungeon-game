import { defs } from "../sim/defs.js";
import { alive, has } from "../sim/entity.js";
import { pick } from "../lib/math.js";
import {
  sfx,
  hold,
  music,
  prefetch,
  setListener,
  releaseHolds,
} from "./engine.js";

const BIOME_MUSIC = {
  safe: "safe",
  stone: "crypt",
  soul: "soul",
  flesh: "flesh",
};
const LAIR_MUSIC = { lich: "lichlair", octo: "octolair", nyarl: "nyarlylair" };
const BOSS_MUSIC = {
  lich: "lichbossbattle",
  octo: "octobossbattle",
  nyarl: "nyarlybossbattle",
};
const GROWL = {
  lich: ["lichgrowl", 1],
  octo: ["octogrowl", 1],
  nyarl: ["octogrowl", 0.7],
};
const BOSS_LIVE = new Set(["intro", "fight", "dying"]);

const FADE_IN = {
  death: 0.6,
  lichbossbattle: 1,
  octobossbattle: 1,
  nyarlybossbattle: 1,
  sanctum: 1.2,
};
const SETTLE = 0.3,
  BEE_RANGE = 9;

const DEATH_BY_TYPE = {
  slime: () => pick(["slimedeath", "slimedeath2"]),
  bee: "slimedeath",
  rotcorpse: "rottingcorpsedeath",
  skel: "bones",
  risen: "bones",
  pot: "potdestroyed",
  crate: "crate",
};
const DEATH_BY_BLOOD = {
  w: "bones",
  c: "slimedeath2",
  m: "rottingcorpsedeath",
};

const SHOT = {
  arrow: ["bow"],
  magicmissile: ["wand"],
  voidbolt: ["wand", { rate: 0.6, vol: 1.4 }],
  fireball: ["flame2", { rate: 1.2 }],
  thrown: ["swing", { rate: 1.3 }],
  hexbolt: ["cursed"],
  mendCircle: ["heal"],
  fire: ["fire"],
};

const PICKUP = {
  coin: "coin",
  potion: "pickupwep",
  manapotion: "pickupwep",
  arrows: "pickupwep",
  knives: "pickupwep",
  axes: "pickupwep",
};

const inRoom = (r, p) =>
  !!r && p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

function deathSound(t) {
  if (t.boss) return "rottingcorpsedeath";
  const by = DEATH_BY_TYPE[t.type];
  if (by) return typeof by === "function" ? by() : by;
  if (t.def.look.debris) return "crate";
  return DEATH_BY_BLOOD[t.def.look.blood] ?? "rottingcorpsedeath";
}

export function bindGameAudio(scene) {
  const world = scene.world,
    on = (ev, fn) => world.on(ev, fn),
    isPlayer = (e) => e === world.player;
  scene.audio = { want: null, wantT: 0 };

  on("swing", ({ actor: a, item, spin }) => {
    if (a.team === "monster") return;
    const W = item && defs.weapons[item.base],
      big = !!spin || !!W?.big || W?.slash === "slashwind";
    sfx(big ? "slash" : "swing", { at: a, vol: isPlayer(a) ? 1 : 0.7 });
  });
  on(
    "melee",
    ({ actor: a }) => a.team === "monster" && sfx("enemyattack", { at: a }),
  );

  on("damaged", ({ target: t, crit, dir }) => {
    if (isPlayer(t)) return sfx("playerhit");
    if (t.def.look.debris)
      return (
        t.type === "crate" &&
        t.hp > 0 &&
        sfx("crate", { at: t, vol: 0.5, rate: 1.3 })
      );

    if (!dir.x && !dir.y) return sfx("hit", { at: t });
    sfx(pick(["impact1", "impact2"]), {
      at: t,
      vol: crit ? 1.3 : 1,
      rate: crit ? 0.8 : 1,
    });
  });
  on("death", ({ target: t }) => {
    if (isPlayer(t)) return sfx("die");
    sfx(deathSound(t), {
      at: t,
      vol: t.boss ? 1.4 : 1,
      rate: t.boss ? 0.7 : 1,
    });
  });
  on("blocked", ({ target: t }) => sfx("blocked", { at: t }));
  on("shieldBroke", ({ actor: a }) => sfx("crate", { at: a, rate: 0.8 }));

  on("spawn", ({ entity: e }) => {
    if (e.type === "flame" && e.source)
      return hold("flame2", "flame:" + e.source.id, { at: e.source });
    const s = SHOT[e.type];
    if (s) sfx(s[0], { at: e, ...s[1] });
  });

  on("removed", ({ entity: e }) => {
    const k = PICKUP[e.type],
      p = world.player;
    if (
      k &&
      has(e, "pickup") &&
      alive(p) &&
      Math.hypot(e.x - p.x, e.y - p.y) < 0.6
    )
      sfx(k);
  });
  on("loot", ({ actor: a }) => sfx("pickupwep", { at: a, vol: 0.6 }));

  on("beam", ({ key, x0, y0 }) => {
    const at = { x: x0, y: y0 };
    if (key?.startsWith("zap:")) hold("lightning", key, { at });
    else if (key?.startsWith("octo:"))
      hold("lightning", key, { at, rate: 0.6, vol: 0.8 });
    else sfx("lightning", { at, vol: 0.6, rate: 1.2 });
  });
  on("siphon", ({ to }) => sfx("siphon", { at: to }));
  on("boom", ({ x, y, radius = 1 }) =>
    sfx(radius >= 1.5 ? "explosion2" : "explosion", {
      at: { x, y },
      vol: radius < 1 ? 0.7 : 1,
    }),
  );

  on("used", ({ actor: a }) => sfx("potiondrink", { at: a }));
  on("levelUp", ({ actor: a }) => sfx("heal", { at: a, rate: 1.25, vol: 1.2 }));
  on("status:applied", ({ target: t, id, fresh }) => {
    if (!fresh) return;
    if (id === "cursed") sfx("cursed", { at: t, vol: 0.8 });
    else if (id === "horny") sfx("horny", { at: t });
  });
  on("born", ({ child: c }) =>
    sfx("slimedeath2", { at: c, rate: 0.8, vol: 0.6 }),
  );
  on("brood", ({ child: c }) => {
    if (c.type === "risen") sfx("bones", { at: c, rate: 0.8 });
    else if (c.type !== "bee")
      sfx("slimedeath2", { at: c, rate: 0.7, vol: 0.6 });
  });
  on("emerge", ({ actor: a }) => sfx("bones", { at: a, rate: 0.75 }));

  on("bossArrived", ({ boss: b }) => {
    const [k, rate] = GROWL[b.type] ?? GROWL.octo;
    sfx(k, { rate });
  });
  on("bossState", ({ boss: b, state }) => {
    if (state !== "dying") return;
    const [k, rate] = GROWL[b.type] ?? GROWL.octo;
    sfx(k, { rate: rate * 0.8 });
  });
  on("bossBlink", ({ boss: b }) =>
    sfx("cursed", { at: b, rate: 0.7, vol: 1.2 }),
  );

  on("descend", () => sfx("descend"));
  on("doorOpened", ({ door: d }) => {
    sfx("door", { at: d });
    sfx("doorcreak", { at: d, delay: 0.08 });
  });
  on("hired", ({ actor: a }) => {
    sfx("hired", { at: a });
    sfx("coin", { delay: 0.1 });
  });
  on("upkeep", ({ paid }) => paid > 0 && sfx("coin"));
  on("betray", ({ actor: a }) => sfx("cursed", { at: a, rate: 0.7 }));
  on("enchanted", ({ actor: a, service }) => {
    sfx("coin");
    sfx(service === "bless" ? "cursed" : "blocked", {
      at: a,
      rate: service === "bless" ? 1 : 1.3,
      delay: 0.12,
    });
  });

  const w = scene.world;
  if (w.lair) prefetch(BOSS_MUSIC[w.lair]);
  if (w.sanctum) prefetch("sanctum");
  prefetch("death");

  const tick = (time, delta) => updateGameAudio(scene, delta / 1000);
  scene.events.on("update", tick);
  scene.events.once("shutdown", () => {
    scene.events.off("update", tick);
    releaseHolds();
  });
  updateGameAudio(scene, 0, true);
}

function musicFor(world) {
  const p = world.player,
    b = world.boss;
  if (!p || p.dead) return "death";
  if (world.victory) return null;
  if (b && BOSS_LIVE.has(b.state)) return BOSS_MUSIC[b.type];
  if (inRoom(world.sanctum, p)) return "sanctum";
  if (world.lair) return LAIR_MUSIC[world.lair];
  return BIOME_MUSIC[world.biome] ?? "crypt";
}

function updateGameAudio(scene, dt, now = false) {
  const world = scene.world,
    p = world.player,
    a = scene.audio;
  if (p && !p.dead) setListener(p);

  const want = musicFor(world);
  if (want !== a.want) {
    a.want = want;
    a.wantT = 0;
  }
  a.wantT += dt;
  if (
    now ||
    a.wantT >= SETTLE ||
    want === "death" ||
    want?.endsWith("bossbattle")
  )
    music(want, now ? 1 : (FADE_IN[want] ?? (world.victory ? 3 : 2)));

  if (scene.invOpen || scene.talk) return;
  let near = null,
    nd = BEE_RANGE,
    n = 0;
  for (const e of world.entities)
    if (e.type === "bee" && alive(e) && p) {
      const d = Math.hypot(e.x - p.x, e.y - p.y);
      if (d < BEE_RANGE) n++;
      if (d < nd) {
        nd = d;
        near = e;
      }
    }
  if (near)
    hold("bee", "bees", { at: near, vol: Math.min(1.4, 0.7 + 0.15 * n) });
}
