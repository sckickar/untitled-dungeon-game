export const defs = {
  entities: {},
  weapons: {},
  weaponKinds: {},
  spells: {},
  statuses: {},
  elements: {},
  prefixes: {},
  suffixes: {},
  stacks: {},
  terrain: {},
  terrainList: [],
  biomes: {},
  factions: {},
  brains: {},
  loot: {},
};

const KINDS = Object.keys(defs).filter((k) => k !== "terrainList");
const PLAIN = new Set(["factions", "brains", "loot"]);

export function loadContent(parts) {
  for (const kind of KINDS) {
    const src = parts[kind];
    if (!src) continue;
    for (const [id, def] of Object.entries(src)) {
      if (defs[kind][id]) throw new Error(`Duplicate ${kind} id "${id}"`);
      defs[kind][id] = PLAIN.has(kind) ? def : Object.assign(def, { id });
    }
  }
  defs.terrainList = Object.values(defs.terrain);
  defs.terrainList.forEach((t, i) => (t.index = i));
  const problems = validate();
  if (problems.length) throw new Error("Content errors:\n  " + problems.join("\n  "));
}

export const terrainIndex = (id) => {
  const t = defs.terrain[id];
  if (!t) throw new Error(`Unknown terrain "${id}"`);
  return t.index;
};

function validate() {
  const P = [];
  const need = (ok, msg) => ok || P.push(msg);
  const { terrain, biomes, entities, weapons, weaponKinds, spells, statuses, elements, prefixes, suffixes, factions, brains, loot, stacks } = defs;

  for (const [id, e] of Object.entries(entities)) {
    need(typeof e.update === "function" || e.update === undefined, `entity "${id}": update must be a function`);
    if (e.team != null) need(factions[e.team], `entity "${id}": unknown team "${e.team}"`);
    if (e.brain) need(brains[e.brain], `entity "${id}": unknown brain "${e.brain}"`);
    if (e.loot) need(loot[e.loot], `entity "${id}": unknown loot table "${e.loot}"`);
    for (const b of e.spawn?.only || []) need(biomes[b], `entity "${id}": spawn.only has unknown biome "${b}"`);
    for (const s of e.gear?.spells || []) need(spells[s], `entity "${id}": gear.spells has unknown spell "${s}"`);
    if (e.minions) need(entities[e.minions.type], `entity "${id}": unknown minion "${e.minions.type}"`);
    if (e.ability) need(spells[e.ability.spell]?.onCast, `entity "${id}": ability "${e.ability.spell}" must be a cast (not channelled) spell`);
    for (const slot of ["main", "off"]) {
      const w = e.equip?.[slot];
      if (w) need(weapons[w], `entity "${id}": equip.${slot} "${w}" is not a weapon`);
      for (const g of e.gear?.[slot] || []) need(weapons[g] && !weapons[g].natural, `entity "${id}": gear.${slot} "${g}" is not a droppable weapon`);
    }
    need(e.look, `entity "${id}": missing look (how it is drawn)`);
  }
  for (const [id, k] of Object.entries(weaponKinds))
    need(k.windup ? typeof k.release === "function" : typeof k.use === "function", `weapon kind "${id}": needs ${k.windup ? "release()" : "use()"}`);
  for (const [id, w] of Object.entries(weapons)) {
    need(weaponKinds[w.kind], `weapon "${id}": unknown kind "${w.kind}"`);
    need(Array.isArray(w.slots) && w.slots.length, `weapon "${id}": slots must list "main" and/or "off"`);
    if (w.projectile) need(entities[w.projectile], `weapon "${id}": unknown projectile "${w.projectile}"`);
    if (w.ammo) need(stacks[w.ammo], `weapon "${id}": ammo "${w.ammo}" is not a stack item`);
    if (w.spell) need(spells[w.spell], `weapon "${id}": unknown spell "${w.spell}"`);
    if (w.elem) need(elements[w.elem], `weapon "${id}": unknown element "${w.elem}"`);
    if (w.kind === "thrown") need(stacks[w.ammo], `weapon "${id}": thrown weapons need a stack as ammo`);
    if (w.kind === "wand") need(w.bolts && Object.keys(w.bolts).length, `weapon "${id}": wands need bolts`);
    for (const [b, B] of Object.entries(w.bolts || {})) {
      need(elements[B.elem], `weapon "${id}": bolt "${b}" has unknown element "${B.elem}"`);
      need(entities[B.projectile ?? w.projectile], `weapon "${id}": bolt "${b}" has no projectile`);
    }
  }
  for (const [id, s] of Object.entries(spells))
    need(typeof (s.channel ? s.onChannel : s.onCast) === "function", `spell "${id}": needs ${s.channel ? "onChannel" : "onCast"}()`);
  for (const [id, s] of Object.entries(statuses)) {
    need(s.duration > 0, `status "${id}": needs a duration`);
    if (s.tick) need(typeof s.onTick === "function", `status "${id}": has tick but no onTick()`);
  }
  for (const [id, el] of Object.entries(elements)) need(typeof el.onHit === "function", `element "${id}": needs onHit()`);
  for (const [word, a] of [...Object.entries(prefixes), ...Object.entries(suffixes)])
    for (const base of [...(a.only || []), ...(a.not || [])]) need(weapons[base], `affix "${word}": unknown weapon "${base}"`);
  for (const [word, s] of Object.entries(suffixes)) {
    if (s.elem) need(elements[s.elem], `suffix "${word}": unknown element "${s.elem}"`);
    if (s.status) need(statuses[s.status], `suffix "${word}": unknown status "${s.status}"`);
    need(s.elem || s.status || s.onHit, `suffix "${word}": needs elem, status or onHit`);
  }
  for (const [id, rel] of Object.entries(factions))
    for (const [other, how] of Object.entries(rel)) {
      need(factions[other], `faction "${id}": unknown faction "${other}"`);
      need(how === "hostile" || how === "ignore", `faction "${id}" -> "${other}": must be "hostile" or "ignore"`);
    }
  for (const [id, rows] of Object.entries(loot))
    for (const r of rows) need(r.drop === "item" || entities[r.drop], `loot "${id}": unknown drop "${r.drop}"`);
  for (const [id, st] of Object.entries(stacks)) need(st.max > 0, `stack "${id}": needs max`);
  need(defs.terrainList.length > 0, "no terrain defined");
  for (const [id, b] of Object.entries(biomes)) {
    need(b.when === undefined || typeof b.when === "function", `biome "${id}": when must be a function`);
    for (const t of Object.keys(b.terrain || {})) need(terrain[t], `biome "${id}": unknown terrain "${t}"`);
  }
  return P;
}
