import { buildTutorial } from "./tutorial.js";
import { buildLair, lairAt, LAIR_DEPTHS } from "./bosses/lair.js";

export const BIOME_SPRITES = ["fl0", "fl1", "fl2", "wall", "wall_lo"];

const floorTile = (tx, ty) => {
  const h = (tx * 73 + ty * 151) % 17;
  return h < 2 ? "fl1" : h < 4 ? "fl2" : "fl0";
};

const TERRAIN_LOOK = {
  floor: { tile: floorTile },
  wall: { wall: "wall", low: "wall_lo", torchChance: 0 },
};

const LAYOUT = {
  rooms: 11,
  size: [5, 9],
  gap: 2,
  shape: "rect",
  loops: 2,
  bend: 0,
  pillars: "corners",
  pillarChance: 0.6,
  erode: null,
  alcoves: [0, 0],
};

const biomes = (list) => {
  for (const b of Object.values(list)) {
    b.weight ??= 1;
    b.terrain = { ...TERRAIN_LOOK, ...b.terrain };
    b.layout = { ...LAYOUT, ...b.layout };
  }
  return list;
};

export const BIOMES = biomes({
  safe: {
    when: (world) => world.depth === 0,
    safe: true,
    build: buildTutorial,
  },
  stone: {
    when: (world) => world.depth >= 1 && world.depth < LAIR_DEPTHS[0],
    terrain: { wall: { ...TERRAIN_LOOK.wall, torchChance: 0.16 } },
  },
  soul: {
    when: (world) => world.depth > LAIR_DEPTHS[0] && world.depth < LAIR_DEPTHS[1],
    layout: {
      rooms: 15,
      size: [4, 7],
      gap: 1,
      loops: 5,
      bend: 0.3,
      pillars: "rows",
      pillarChance: 0.7,
      alcoves: [1, 3],
    },
    traps: { chance: 0.4, type: "rotcorpse", count: [2, 4] },
  },
  flesh: {
    when: (world) => world.depth > LAIR_DEPTHS[1] && !lairAt(world),
    layout: {
      rooms: 9,
      size: [6, 11],
      gap: 2,
      shape: "blob",
      loops: 3,
      bend: 0.8,
      pillars: "lumps",
      pillarChance: 0.5,
      erode: [2, 0.3],
    },
  },

  lichlair: {
    when: (world) => lairAt(world) === "lich",
    tiles: (world) => (world.depth < LAIR_DEPTHS[1] ? "stone" : "soul"),
    build: (world, opts) => buildLair(world, opts, "lich"),
    terrain: { wall: { ...TERRAIN_LOOK.wall, torchChance: 0.2 } },
    layout: { rooms: 6, size: [4, 7], gap: 1, loops: 2, bend: 0.3, pillars: "rows", pillarChance: 0.6, alcoves: [1, 2] },
  },
  octolair: {
    when: (world) => lairAt(world) === "octo",
    tiles: (world) => (world.depth < LAIR_DEPTHS[1] ? "stone" : "soul"),
    build: (world, opts) => buildLair(world, opts, "octo"),
    terrain: { wall: { ...TERRAIN_LOOK.wall, torchChance: 0.1 } },
    layout: { rooms: 6, size: [5, 8], gap: 2, shape: "blob", loops: 2, bend: 0.6, pillars: "lumps", pillarChance: 0.3, erode: [1, 0.25] },
  },
  nyarllair: {
    when: (world) => lairAt(world) === "nyarl",
    tiles: "flesh",
    build: (world, opts) => buildLair(world, opts, "nyarl"),
    layout: { rooms: 6, size: [6, 9], gap: 2, shape: "blob", loops: 3, bend: 0.8, pillars: "lumps", pillarChance: 0.4, erode: [2, 0.3] },
  },
});

export const tilesOf = (world, b) => (typeof b.tiles === "function" ? b.tiles(world) : b.tiles ?? b.id);
