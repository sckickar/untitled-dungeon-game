import { loadContent } from "../sim/defs.js";
import { FACTIONS } from "./factions.js";
import { TERRAIN } from "./terrain.js";
import { BIOMES } from "./biomes.js";
import { STATUSES } from "./statuses.js";
import { ELEMENTS } from "./elements.js";
import { WEAPON_KINDS, WEAPONS, PROJECTILES } from "./weapons.js";
import { PREFIXES, SUFFIXES } from "./affixes.js";
import { SPELLS, SPELL_ENTITIES } from "./spells.js";
import { CREATURES } from "./creatures.js";
import { PROPS } from "./props.js";
import { PICKUPS, STACKS } from "./pickups.js";
import { LOOT } from "./loot.js";
import { BRAINS } from "./brains.js";
import { NPCS, npcBrain } from "./npcs.js";
import { SANCTUM, vendorBrain } from "./sanctum.js";
import { TUTORIAL } from "./tutorial.js";
import { BOSSES, BOSS_SPELLS } from "./bosses/index.js";

loadContent({
  factions: FACTIONS,
  terrain: TERRAIN,
  biomes: BIOMES,
  statuses: STATUSES,
  elements: ELEMENTS,
  weaponKinds: WEAPON_KINDS,
  weapons: WEAPONS,
  prefixes: PREFIXES,
  suffixes: SUFFIXES,
  spells: { ...SPELLS, ...BOSS_SPELLS },
  stacks: STACKS,
  loot: LOOT,
  brains: { ...BRAINS, npc: npcBrain, vendor: vendorBrain },
  entities: { ...CREATURES, ...NPCS, ...SANCTUM, ...TUTORIAL, ...PROPS, ...PICKUPS, ...PROJECTILES, ...SPELL_ENTITIES, ...BOSSES },
});

import "./rules/progress.js";
import "./rules/breeding.js";
import "./rules/curse.js";
import "./bosses/rules.js";
