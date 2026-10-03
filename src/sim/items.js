import { defs } from "./defs.js";
import { pick, ri } from "../lib/math.js";
import { stow } from "./grid.js";

const BASE_CRIT = 0.12;

export function makeItem(base) {
  const W = defs.weapons[base];
  if (!W) throw new Error(`makeItem: unknown weapon "${base}"`);
  const it = { base, name: base, atk: 0, cd: W.cd || 0, crit: BASE_CRIT + (W.crit || 0), leech: 0, effects: [] };
  if (W.spell) it.spell = W.spell;
  if (W.bolts) it.bolt = Object.keys(W.bolts)[0];
  if (W.variants) Object.assign(it, W.variants[0]);
  if (W.dur) it.dur = it.maxDur = W.dur[0];
  return it;
}

export const sprOf = (it) => it.spr ?? defs.weapons[it.base].spr;
export const iconOf = (it) => defs.stacks[it.base]?.icon ?? sprOf(it);

const droppable = () => Object.keys(defs.weapons).filter((b) => !defs.weapons[b].natural);
const randomBase = () => weighted(droppable(), (b) => defs.weapons[b].dropWeight ?? 1);

const allowed = (a, base) => (!a.only || a.only.includes(base)) && !(a.not && a.not.includes(base));

export function rollItem(depth, base = randomBase(), { spells } = {}) {
  const W = defs.weapons[base];
  const pre = pick(Object.values(defs.prefixes).filter((a) => allowed(a, base)));
  const m = pre.mods || {};
  const it = {
    base,
    prefix: pre.id,
    atk: W.atk ? Math.max(0, ri(W.atk[0], W.atk[1]) + Math.floor(depth / 2) + (m.atk || 0)) : 0,
    cd: (W.cd || 0) * (m.cdMul || 1),
    crit: BASE_CRIT + (W.crit || 0) + (m.crit || 0),
    leech: m.leech || 0,
    effects: [],
  };
  if (W.bolts) it.bolt = pick(Object.keys(W.bolts));
  if (W.variants) Object.assign(it, pick(W.variants));
  if (W.kind === "staff") {
    it.spell = pick(spells ?? Object.keys(defs.spells).filter((k) => !defs.spells[k].innate));
    const S = defs.spells[it.spell];
    it.cd = (S.cd || 0) * (m.cdMul || 1);
    if (S.tick) it.tick = S.tick * (m.cdMul || 1);
  }
  if (W.dur) it.dur = it.maxDur = Math.max(1, Math.round(ri(W.dur[0], W.dur[1]) * (m.durMul || 1)));
  const suffixes = Object.values(defs.suffixes).filter((a) => allowed(a, base));
  if (W.suffixChance && suffixes.length && Math.random() < W.suffixChance) {
    do addEffect(it, weighted(suffixes), depth);
    while (it.effects.length < MAX_EFFECTS && Math.random() < (W.extraSuffixChance || 0));
  }
  it.name = itemName(it);
  return it;
}

export const MAX_EFFECTS = 3;

const weighted = (list, weightOf = (a) => a.weight ?? 1) => {
  let r = Math.random() * list.reduce((n, a) => n + weightOf(a), 0);
  for (const a of list) if ((r -= weightOf(a)) < 0) return a;
  return list[list.length - 1];
};

export function addEffect(it, suffix, depth = 1) {
  const S = typeof suffix === "string" ? defs.suffixes[suffix] : suffix;
  const power = S.dmg ? ri(S.dmg[0], S.dmg[1]) + Math.floor(depth / 3) : S.dur ? ri(S.dur[0], S.dur[1]) : null;
  const have = it.effects.find((fx) => fx.id === S.id);
  if (have) have.power = have.power == null ? null : have.power + power;
  else it.effects.push({ id: S.id, power });
  it.name = itemName(it);
  return it;
}

export const baseName = (it) => it.base + (it.plus ? "+" + it.plus : "");

export const itemName = (it) => [it.prefix, baseName(it), ...(it.effects || []).map((fx) => fx.id)].filter(Boolean).join(" ");

export const effectColor = (fx) => {
  const S = defs.suffixes[fx.id];
  return S.elem ? defs.elements[S.elem].col : S.col || "w";
};

export const isStack = (it) => !!(it && defs.stacks[it.base]);

export const countOf = (a, base) => (a.bag || []).reduce((n, c) => n + (c && c.base === base ? c.qty : 0), 0);

export function addStack(a, base, n) {
  const bag = a.bag,
    max = defs.stacks[base].max;
  for (const c of bag)
    if (n > 0 && c && c.base === base && c.qty < max) {
      const k = Math.min(n, max - c.qty);
      c.qty += k;
      n -= k;
    }
  while (n > 0) {
    const k = Math.min(n, max);
    if (stow(bag, { base, qty: k }) < 0) break;
    n -= k;
  }
  return n;
}

export function takeStack(a, base, n = 1) {
  if (countOf(a, base) < n) return false;
  const bag = a.bag;
  for (let i = bag.length - 1; i >= 0 && n > 0; i--) {
    const c = bag[i];
    if (!c || c.base !== base) continue;
    const k = Math.min(n, c.qty);
    c.qty -= k;
    n -= k;
    if (c.qty <= 0) bag[i] = null;
  }
  return true;
}

export const useAmmo = (a, base) => !a.bag || takeStack(a, base);

export function valueOf(it) {
  if (isStack(it)) return (defs.stacks[it.base].price ?? 1) * it.qty;
  const W = defs.weapons[it.base];
  return (W.price ?? 12) + 5 * (it.atk || 0) + 8 * (it.plus || 0) + (it.maxDur || 0) + 15 * (it.effects?.length || 0);
}
export const sellPrice = (it) => Math.max(1, Math.floor(valueOf(it) / 3));
