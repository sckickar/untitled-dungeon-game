import { ri } from "../lib/math.js";

export const PARTS = { body: 39, head: 52, helmet: 49 };
export const HELMET_CHANCE = 0.6;

export function rollAppearance() {
  return {
    body: ri(0, PARTS.body - 1),
    head: ri(0, PARTS.head - 1),
    helmet: Math.random() < HELMET_CHANCE ? ri(0, PARTS.helmet - 1) : -1,
  };
}
