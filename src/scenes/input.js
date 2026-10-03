import { unIso } from "../lib/iso.js";
import { norm } from "../lib/math.js";
import { hitSlot, hitTalk } from "./layout.js";
import { onInvPointerDown, placeDrag } from "./inventory.js";

export function setupInput(scene) {
  scene.keys = scene.input.keyboard.addKeys("W,A,S,D,UP,DOWN,LEFT,RIGHT,Z,X,J,K,Q,E,R,I,TAB,SPACE,ENTER,ESC,ONE,TWO,THREE,FOUR");
  if (scene.input.mouse) scene.input.mouse.disableContextMenu();
  scene.input.on("pointerdown", (ptr) => {
    if (ptr.wasTouch) return;
    if (scene.over) return scene.restartGame();
    const p = scene.world.player;
    if (p.dead || scene.world.descending) return;
    if (scene.talk) {
      const i = hitTalk(ptr.x, ptr.y, scene.talk.options.length);
      if (i === null) scene.talk = null;
      else if (i >= 0) scene.talkPick(i);
      scene.ptrEaten = true;
      return;
    }
    if (onInvPointerDown(scene, ptr)) return;
    if (scene.invOpen) return;
    scene.clickAim = aimAt(scene, ptr);
    if (ptr.rightButtonDown()) scene.clickOff = true;
    else scene.clickMain = true;
  });
  const up = (ptr) => {
    scene.ptrEaten = false;
    if (scene.drag) placeDrag(scene, hitSlot(ptr.x, ptr.y, scene.invOpen, !!scene.trade));
  };
  scene.input.on("pointerup", up);
  scene.input.on("pointerupoutside", up);
}

export function aimAt(scene, ptr) {
  const w = ptr.positionToCamera(scene.cameras.main),
    t = unIso(w.x, w.y + 5),
    p = scene.world.player;
  return norm(t.x - p.x, t.y - p.y);
}

export function readInput(scene) {
  const k = scene.keys,
    JD = Phaser.Input.Keyboard.JustDown;
  let mx = 0,
    my = 0;
  if (k.W.isDown || k.UP.isDown) {
    mx -= 1;
    my -= 1;
  }
  if (k.S.isDown || k.DOWN.isDown) {
    mx += 1;
    my += 1;
  }
  if (k.A.isDown || k.LEFT.isDown) {
    mx -= 1;
    my += 1;
  }
  if (k.D.isDown || k.RIGHT.isDown) {
    mx += 1;
    my -= 1;
  }
  const tv = scene.touchVec;
  if (tv && (tv.x || tv.y)) {
    const a = tv.x / 8,
      b = tv.y / 4;
    mx = (a + b) / 2;
    my = (b - a) / 2;
  }
  const l = Math.hypot(mx, my);
  if (l > 0.01) {
    mx /= l;
    my /= l;
  }

  const ptr = scene.input.activePointer,
    mouse = !ptr.wasTouch && ptr.isDown && !scene.drag && !scene.ptrEaten;
  const zj = JD(k.Z) || JD(k.J) || JD(k.SPACE),
    xk = JD(k.X) || JD(k.K);
  const held = {
    main: (mouse && ptr.leftButtonDown()) || k.Z.isDown || k.J.isDown || k.SPACE.isDown || scene.touchAHeld,
    off: (mouse && ptr.rightButtonDown()) || k.X.isDown || k.K.isDown || scene.touchBHeld,
  };
  const pressed = {
    main: scene.clickMain || zj || scene.touchA,
    off: scene.clickOff || xk || scene.touchB,
  };
  let aim = scene.clickAim;
  if (mouse && (held.main || held.off)) aim = aimAt(scene, ptr);
  const drink = JD(k.Q) || scene.touchP,
    sip = JD(k.R) || scene.touchM;
  scene.touchA = scene.touchB = scene.touchP = scene.touchM = false;
  scene.clickMain = scene.clickOff = false;
  scene.clickAim = null;

  const hov = scene.view?.hoverMob;
  return {
    move: { x: mx, y: my },
    aim,
    mark: !ptr.wasTouch && hov?.boss ? hov : null,
    main: { pressed: pressed.main, held: held.main },
    off: { pressed: pressed.off, held: held.off },
    use: drink ? "potion" : sip ? "manapotion" : null,
  };
}
