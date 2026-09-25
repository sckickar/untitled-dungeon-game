export const WDEF = {
  sword:    { icon: 'inv_sword',    spr: 'sword',    kind: 'melee',  slots: ['main', 'off'], atk: [1, 3], cd: 0.30, reach: 1.15, arc: 0.35 },
  scimitar: { icon: 'inv_scimitar', spr: 'scimitar', kind: 'melee',  slots: ['main', 'off'], atk: [0, 2], cd: 0.22, reach: 1.05, arc: 0.10 },
  spear:    { icon: 'inv_spear',    spr: 'spear',    kind: 'melee',  slots: ['main', 'off'], atk: [2, 4], cd: 0.45, reach: 1.70, arc: 0.75 },
  bow:      { icon: 'inv_bow',      spr: 'bow',      kind: 'bow',    slots: ['main', 'off'], atk: [1, 3], cd: 0.45, spd: 10, back: true, backRot: 0.5 },
  staff:    { icon: 'inv_staff',    spr: 'staff',    kind: 'staff',  slots: ['main', 'off'], atk: [0, 2], back: true, backRot: -1.2 },
  shield:   { icon: 'inv_shield',   spr: 'shield',   kind: 'shield', slots: ['off'], dur: [6, 12] },

};

export const STACKS = { potion: { icon: 'potion', max: 9 }, arrow: { icon: 'inv_arrow', max: 99 } };

export const SPELLS = {
  lightning: { word: 'storm', mp: 3, tick: 0.2, channel: true },
  flame:     { word: 'ember', mp: 4, channel: true },
  heal:      { word: 'mend',  mp: 5, cd: 6 },
};

export const PREFIXES = [
  { word: 'rusty', atk: -1, not: ['shield'] },
  { word: 'sharp', atk: 1, not: ['shield', 'staff'] },
  { word: 'brutal', atk: 2, cd: 1.25, not: ['shield'] },
  { word: 'swift', cd: 0.75, not: ['shield'] },
  { word: 'keen', crit: 0.15, not: ['shield', 'staff'] },
  { word: 'vile', leech: 0.25, not: ['shield'] },
  { word: 'sturdy', dur: 1.6, only: ['shield'] },
  { word: 'cracked', dur: 0.6, only: ['shield'] },
];

export const ELEMENTS = { fire: { col: 'm' }, frost: { col: 'c' }, shock: { col: 'w' } };
export const SUFFIXES = [
  { word: 'of ash',    elem: 'fire',  dmg: [1, 2] },
  { word: 'of frost',  elem: 'frost', dmg: [1, 3] },
  { word: 'of sparks', elem: 'shock', dmg: [1, 2] },
];
export const SUFFIX_CHANCE = 0.4;

