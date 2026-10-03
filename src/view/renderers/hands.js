import { clamp, wrapAngle } from "../../lib/math.js";
import { defs } from "../../sim/defs.js";
import { sprOf } from "../../sim/items.js";

const SWING_T = 0.13;

export function createHands(scene, rec) {
  Object.assign(rec, {
    hand: {
      main: scene.add.image(0, 0, "sword").setOrigin(0.15, 0.5).setVisible(false),
      off: scene.add.image(0, 0, "sword").setOrigin(0.15, 0.5).setVisible(false),
    },
    held: { main: null, off: null },
    swordAng: Math.atan2(1, 0) + 1.3,
    rest: 1,
    swingT: 0,
    swingAim: 0,
    swingFrom: 0,
    offSwingT: 0,
    spinT: 0,
    spinDur: 1,
    spinFrom: 0,
    spinDir: 1,
  });
}

export function destroyHands(rec) {
  if (!rec.hand) return;
  rec.hand.main.destroy();
  rec.hand.off.destroy();
}

export function hideHands(rec) {
  if (!rec.hand) return;
  rec.hand.main.setVisible(false);
  rec.hand.off.setVisible(false);
}

export function swingHands(rec, { slot, dir, spin }) {
  if (spin) {
    rec.spinFrom = rec.swordAng;
    rec.spinDir = rec.rest;
    rec.rest = -rec.rest;
    rec.spinT = rec.spinDur = spin;
  } else if (slot === "main") {
    rec.swingAim = Math.atan2((dir.x + dir.y) * 0.5, dir.x - dir.y);
    rec.swingFrom = rec.rest;
    rec.rest = -rec.rest;
    rec.swingT = SWING_T;
  } else rec.offSwingT = SWING_T;
}

export function drawHands(view, e, rec, sp, bodySpr, moving, vis, dt) {
  const sx = e.face.x - e.face.y,
    sy = e.face.x + e.face.y,
    front = sy >= -0.01,
    aim = Math.atan2(sy * 0.5, sx),
    hy = e.def.look.handY ?? 2;
  showHeld(e, rec);
  drawMain(view, e, rec, sp, hy, aim, front, moving, vis, bodySpr, dt);
  drawOff(e, rec, sp, hy, aim, front, vis, bodySpr, dt);
}

function showHeld(e, rec) {
  for (const slot of ["main", "off"]) {
    let it = e.equip[slot];
    if (it && defs.weapons[it.base].natural) it = null;
    const h = rec.hand[slot];
    if (it !== rec.held[slot]) {
      rec.held[slot] = it;
      if (it) {
        const W = defs.weapons[it.base];
        h.setTexture(sprOf(it)).setOrigin(...(W.grip || defs.weaponKinds[W.kind].grip || [0.5, 0.5]));
      }
    }
    if (!it) h.setVisible(false);
  }
}

function drawMain(view, e, rec, sp, hy, aim, front, moving, vis, bodySpr, dt) {
  const h = rec.hand.main,
    it = rec.held.main;
  if (!it) return;
  const W = defs.weapons[it.base];
  if (W.back && e.useT.main <= 0) return drawSlung(e, rec, h, W, sp, hy, "main", front, vis, bodySpr);
  let ang,
    hand = aim;
  if (W.kind === "melee" || W.kind === "spin") {
    if (rec.spinT > 0) {
      rec.spinT -= dt;
      const t = clamp(1 - rec.spinT / rec.spinDur, 0, 1),
        k = 1 - Math.pow(1 - t, 2);
      ang = rec.spinFrom + rec.spinDir * 6.283 * k;
      rec.swordAng = ang;
      hand = ang;
    } else if (rec.swingT > 0) {
      rec.swingT -= dt;
      const t = clamp(1 - rec.swingT / SWING_T, 0, 1),
        k = 1 - Math.pow(1 - t, 3);
      ang = rec.swingAim + rec.swingFrom * 1.9 * (1 - 2 * k);
      rec.swordAng = ang;
    } else {
      const target = aim + rec.rest * 1.25 + (moving ? Math.sin(view.scene.time.now / 90) * 0.12 : 0);
      rec.swordAng += wrapAngle(target - rec.swordAng) * Math.min(1, dt * 14);
      ang = rec.swordAng;
    }
  } else {
    rec.swordAng += wrapAngle(aim - rec.swordAng) * Math.min(1, dt * 14);
    ang = rec.swordAng;
  }
  const hx = sp.x + Math.round(Math.cos(hand) * 2),
    hyy = sp.y - hy + Math.round(Math.sin(hand));
  const dz = W.back ? (front ? 0.03 : -0.03) : Math.sin(ang) > -0.15 ? 0.02 : -0.02;
  h.setPosition(hx, hyy).setRotation(ang).setFlipX(false).setVisible(vis).setDepth(e.x + e.y + dz);
}

function drawOff(e, rec, sp, hy, aim, front, vis, bodySpr, dt) {
  const h = rec.hand.off,
    it = rec.held.off;
  if (!it) return;
  const W = defs.weapons[it.base];
  if (W.back && e.useT.off <= 0) return drawSlung(e, rec, h, W, sp, hy, "off", front, vis, bodySpr);
  const kind = W.kind,
    side = aim + 1.57;
  let ox = Math.cos(side) * 3,
    oy = Math.sin(side),
    dz = Math.sin(side) > 0 ? 0.02 : -0.02,
    ang;
  if (rec.offSwingT > 0) {
    rec.offSwingT -= dt;
    const k = Math.sin(Math.PI * (1 - Math.max(0, rec.offSwingT) / SWING_T));
    ox = Math.cos(aim) * (2 + 3 * k);
    oy = Math.sin(aim) * (1 + 1.5 * k);
    ang = aim;
    dz = 0.03;
  } else if (kind === "shield") {
    ang = 0;
    if (e.blocking) {
      ox = Math.cos(aim) * 3;
      oy = Math.sin(aim) * 1.5;
      dz = front ? 0.03 : -0.03;
    }
  } else if (kind === "staff" || kind === "wand") ang = e.castT > 0 ? aim : -1.4;
  else if (kind === "melee") ang = aim - 1.25;
  else ang = aim;
  if (W.back) dz = front ? 0.03 : -0.03;
  h.setPosition(sp.x + Math.round(ox), sp.y - hy + Math.round(oy))
    .setRotation(ang)
    .setFlipX(kind === "shield" && Math.cos(aim) < 0)
    .setVisible(vis)
    .setDepth(e.x + e.y + dz);
}

function drawSlung(e, rec, h, W, sp, hy, slot, front, vis, bodySpr) {
  const flip = bodySpr.flipX ? -1 : 1,
    side = slot === "main" ? -1 : 1,
    rot = W.backRot * flip * side;
  h.setPosition(sp.x + side * flip, sp.y - hy - 2)
    .setRotation(rot)
    .setFlipX(false)
    .setVisible(vis)
    .setDepth(e.x + e.y + (front ? -0.03 : 0.03));
  if (slot === "main") rec.swordAng = rot;
}
