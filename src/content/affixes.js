const SHIELDS = ["shield", "greatshield"];

export const PREFIXES = {
  rusty: { mods: { atk: -1 }, not: SHIELDS },
  sharp: { mods: { atk: 1 }, not: [...SHIELDS, "staff", "magicwand", "bloodwand"] },
  brutal: { mods: { atk: 2, cdMul: 1.25 }, not: SHIELDS },
  swift: { mods: { cdMul: 0.75 }, not: SHIELDS },
  keen: { mods: { crit: 0.15 }, not: [...SHIELDS, "staff", "magicwand", "bloodwand"] },
  vile: { mods: { leech: 0.25 }, not: SHIELDS },
  sturdy: { mods: { durMul: 1.6 }, only: SHIELDS },
  cracked: { mods: { durMul: 0.6 }, only: SHIELDS },
};

export const SUFFIXES = {
  "of ash": { elem: "fire", dmg: [1, 2] },
  "of frost": { elem: "frost", dmg: [1, 3] },
  "of sparks": { elem: "shock", dmg: [1, 2] },
  "of gales": { elem: "wind", dmg: [1, 2] },
  "of ruin": { elem: "explosion", dmg: [1, 3], weight: 0.5 },
  "of hexes": { elem: "curse", dmg: [1, 2], weight: 0.5 },
  "of lust": { status: "horny", dur: [6, 10], col: "m", weight: 0.6 },
  "of pride": { status: "gay", col: "c", weight: 0.6 },
};
