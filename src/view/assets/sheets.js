const seq = (prefix, n, from = 0) =>
  Array.from({ length: n }, (_, i) => prefix + (i + from));

export const CHAR_SHEETS = {
  slime: {
    size: [8, 6],
    frames: ["sl0", "sl1"],
    anims: { slime: { frames: [0, 1], rate: 3 } },
  },
  bat: {
    size: [8, 8],
    frames: ["bt0", "bt1"],
    anims: { bat: { frames: [0, 1], rate: 10 } },
  },
  skel: {
    size: [8, 11],
    frames: ["sk0", "sk1"],
    anims: { skel: { frames: [0, 1], rate: 5 } },
  },
  cult: {
    size: [8, 8],
    frames: ["cu0", "cu1"],
    anims: { cult: { frames: [0, 0, 1], rate: 3 } },
  },
  brute: {
    size: [16, 16],
    frames: ["br0", "br1"],
    anims: { brute: { frames: [0, 1], rate: 10 } },
  },
  snake: {
    size: [7, 6],
    frames: ["sn_h0", "sn_h1"],
    anims: { snake: { frames: [0, 0, 1], rate: 6 } },
  },
  
  bees: {
    size: [8, 8],
    frames: ["be0", "be1"],
    anims: { bee: { frames: [0, 1], rate: 14 } },
  },
  fleshling: {
    size: [8, 8],
    frames: seq("fg", 4),
    anims: {
      fleshling_f: { frames: [0, 1], rate: 6 },
      fleshling_b: { frames: [2, 3], rate: 6 },
    },
  },
  fleshking: {
    size: [24, 24],
    frames: seq("fk", 4),
    anims: {
      fleshking_f: { frames: [0, 1], rate: 3 },
      fleshking_b: { frames: [2, 3], rate: 3 },
    },
  },
  merchant: {
    size: [8, 8],
    frames: seq("mc", 4),
    anims: {
      merchant_f: { frames: [0, 1], rate: 3 },
      merchant_b: { frames: [2, 3], rate: 3 },
    },
  },
  cult2: {
    size: [8, 8],
    frames: seq("cv", 4),
    anims: {
      cult2_f: { frames: [0, 0, 1], rate: 3 },
      cult2_b: { frames: [2, 2, 3], rate: 3 },
    },
  },
  skel2: {
    size: [8, 8],
    frames: seq("sk2_", 4),
    anims: {
      skel2_f: { frames: [0, 1], rate: 6 },
      skel2_b: { frames: [2, 3], rate: 6 },
    },
  },
  necromancer: {
    size: [8, 8],
    frames: seq("nc", 4),
    anims: {
      necromancer_f: { frames: [0, 0, 1], rate: 3 },
      necromancer_b: { frames: [2, 2, 3], rate: 3 },
    },
  },
  fastbrute: {
    size: [16, 16],
    frames: seq("fb", 4),
    anims: {
      fastbrute_f: { frames: [0, 1], rate: 12 },
      fastbrute_b: { frames: [2, 3], rate: 12 },
    },
  },
  lizardbrute: {
    size: [16, 16],
    frames: seq("lz", 2),
    anims: { lizardbrute: { frames: [0, 1], rate: 6 } },
  },
  acollade: {
    size: [16, 16],
    frames: seq("acl", 6),
    anims: {
      acollade_f: { frames: [0, 1], rate: 4 },
      acollade_b: { frames: [2, 3], rate: 4 },
    },
  },
  snake_seg: { size: [8, 5], frames: ["sn_s", "sn_s2"] },
  snake_tail: { size: [6, 6], frames: ["sn_t"] },
};

const corpse = (name, size) => ({
  size,
  frames: [...seq(`c_${name}_g`, 6), `c_${name}`, `c_${name}_f`],
});
export const GORE_SHEETS = {
  corpse_slime: corpse("slime", [16, 5]),
  corpse_bat: corpse("bat", [14, 5]),
  corpse_snhead: corpse("snhead", [15, 5]),
  corpse_snseg: corpse("snseg", [12, 4]),
  corpse_skel: corpse("skel", [17, 5]),
  corpse_cult: corpse("cult", [18, 6]),
  corpse_brute: corpse("brute", [22, 6]),
  corpse_player: corpse("player", [19, 6]),
  gibs_m: {
    size: [5, 3],
    frames: [...seq("gb_m_", 10), "gib_m", "gib_m2", "gib_m3"],
  },
  gibs_c: {
    size: [5, 3],
    frames: [...seq("gb_c_", 10), "gib_c", "gib_c2", "gib_c3"],
  },
  gibs_w: {
    size: [6, 3],
    frames: [...seq("gb_w_", 10), "bone", "bone2", "bone3"],
  },
  pools_m: {
    size: [26, 9],
    frames: [...seq("cp_m_", 8), "pool_m", "cp_big_m"],
  },
  pools_c: { size: [17, 7], frames: seq("cp_c_", 8) },
  pools_w: { size: [18, 7], frames: seq("cp_w_", 8) },
  runs_m: { size: [6, 1], frames: seq("gr_m_", 10) },
  runs_c: { size: [5, 1], frames: seq("gr_c_", 10) },
  runs_w: { size: [6, 1], frames: seq("gr_w_", 10) },
  blood: {
    size: [3, 3],
    frames: [...seq("d_m", 4, 1), ...seq("d_c", 4, 1), ...seq("d_w", 4, 1)],
  },
  debris: {
    size: [2, 2],
    frames: ["shard", "shard2", "shard3", "splint", "splint2", "splint3"],
  },
};

export const EFFECT_SHEETS = {
  fire:  { size: [7, 8], frames: ['fire0', 'fire1'], anims: { fire: { frames: [0, 1], rate: 6 } } },
  spark: { size: [8, 8], frames: seq('spark', 8), anims: { spark: { frames: [0, 1, 2, 3, 4, 5, 6, 7], rate: 12 } } },
  flame: { size: [8, 8], frames: seq('flame', 6), anims: { flame: { frames: [0, 1, 2, 3, 4, 5], rate: 12, repeat: 0 }, fireball: { frames: [0, 1, 2, 1], rate: 12 } } },
  poisonflame: { size: [16, 16], frames: seq('pf', 6), anims: { poisonflame: { frames: [0, 1, 2, 1, 2, 1, 2, 1, 2, 3, 4, 5], rate: 6, repeat: 0 } } },
  explosion: { size: [12, 16], frames: seq('boom', 5), anims: { explosion: { frames: [0, 1, 2, 3, 4], rate: 14, repeat: 0 } } },
  crater: { size: [20, 16], frames: ['crater0', 'crater1'] },
  magma: { size: [12, 12], frames: seq('magma', 4), anims: { magma: { frames: [0, 1, 2, 3], rate: 12 } } },
  'cursed-flame': { size: [8, 8], frames: seq('cfl', 10), anims: { hexbolt: { frames: [0, 1, 2, 3, 4], rate: 12 }, cursedflame: { frames: [5, 6, 7, 8, 9], rate: 10 } } },
  manabeam: { size: [8, 8], frames: seq('mb', 6), anims: { manabeam: { frames: [0, 1, 2, 3, 4, 5], rate: 10 } } },
  bloodbeam: { size: [8, 8], frames: seq('bb', 5) },
  'heal-pentagram':{ size: [20, 11], frames: seq('pent', 5), anims: { heal: { frames: [0, 1, 2, 3, 4], rate: 8 } } },
};

export const SHEET_GROUPS = { characters: CHAR_SHEETS, gore: GORE_SHEETS, effects: EFFECT_SHEETS };
export const SHEETS = { ...CHAR_SHEETS, ...GORE_SHEETS, ...EFFECT_SHEETS };

const FRAME_OF = {};
for (const [sheet, def] of Object.entries(SHEETS))
  def.frames.forEach((name, i) => {
    FRAME_OF[name] = [sheet, i];
  });

export const tex = (name) => FRAME_OF[name] || [name];

