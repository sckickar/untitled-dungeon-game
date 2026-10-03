export const xpForLevel = (lv) => Math.floor(10 * Math.pow(lv, 1.4));

export function gainXP(world, a, n) {
  a.xp += n;
  while (a.xp >= a.next) {
    a.xp -= a.next;
    a.lv++;
    a.next = xpForLevel(a.lv);
    a.maxhp += 5;
    a.maxmp += 2;
    a.atk += 1;
    a.hp = a.maxhp;
    a.mp = a.maxmp;
    if (a === world.player) world.say("fuck yeah!");
    world.emit("levelUp", { actor: a });
  }
}
