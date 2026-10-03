import { FALLER } from "./common.js";
import { OCTO } from "./octo.js";
import { LICH, LICH_SPELLS } from "./lich.js";
import { NYARL } from "./nyarl.js";

export const BOSSES = { ...OCTO, ...LICH, ...NYARL, ...FALLER };
export const BOSS_SPELLS = { ...LICH_SPELLS };
