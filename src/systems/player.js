import { MW, iso, unIso, rnd, ri, pick, norm } from "../core/constants.js";
import { PF } from "../data/sheets.js";
import { WDEF, ELEMENTS } from "../data/items.js";
import { hitSlot } from "../data/layout.js";
import { OUTLINE } from "./outline.js";

export const player = {
  makePlayer() {
    const r = this.rooms[0],
      c = this.carry;
    this.p = Object.assign(
      {
        hp: 24,
        maxhp: 24,
        mp: 10,
        maxmp: 10,
        atk: 4,
        lv: 1,
        xp: 0,
        next: 10,
        gold: 0,
        kills: 0,
      },
      c || {},
      {
        x: r.cx + 0.5,
        y: r.cy + 0.5,
        r: 0.26,
        kx: 0,
        ky: 0,
        face: norm(1, 1),
        cds: {
          main: 0,
          off: 0,
        },
        blocking: false,
        flameT: 0,
        useT: { main: 0, off: 0 },
        channeling: false,
        castT: 0,
        offSwingT: 0,
        inv: 0,
        atkT: 0,
        bloody: 0,
        stepD: 0,
        side: 1,
        drip: 0,
        mpT: 0,
        dead: false,
        swing: 1,
        swingT: 0,
        swingAim: 0,
        swordAng: 0,
        rest: 1,
      },
    );
    this.p.spr = this.add.sprite(0, 0, "player", PF.front).setOrigin(0.5, 1);
    this.p.hand = {
      main: this.add.image(0, 0, "sword").setOrigin(0.15, 0.5),
      off: this.add.image(0, 0, "sword").setOrigin(0.15, 0.5),
    };
    this.p.swordAng = Math.atan2(1, 0) + 1.3;
    if (!c) {
      this.p.equip = { main: this.makeItem("sword"), off: null };
      this.p.bag = Array(21).fill(null);
      this.p.bag[0] = { base: "potion", qty: 1 };
    }
    this.refreshHands();
    this.addOutline(this.p.spr, OUTLINE.player);
  },

  stats() {
    const p = this.p;
    return {
      hp: p.hp,
      maxhp: p.maxhp,
      mp: p.mp,
      maxmp: p.maxmp,
      atk: p.atk,
      lv: p.lv,
      xp: p.xp,
      next: p.next,
      gold: p.gold,
      equip: structuredClone(p.equip),
      bag: structuredClone(p.bag),
      kills: p.kills,
    };
  },

  setupInput() {
    this.keys = this.input.keyboard.addKeys(
      "W,A,S,D,UP,DOWN,LEFT,RIGHT,Z,X,J,K,Q,E,R,I,TAB,SPACE,ENTER",
    );
    if (this.input.mouse) this.input.mouse.disableContextMenu();
    this.input.on("pointerdown", (ptr) => {
      if (ptr.wasTouch) return;
      if (this.over) {
        this.restartGame();
        return;
      }
      if (this.p.dead || this.descending) return;
      if (this.onInvPointerDown(ptr)) return;
      if (this.invOpen) return;
      this.p.face = this.aimAt(ptr);
      if (ptr.rightButtonDown()) this.clickOff = true;
      else this.clickMain = true;
    });
    const up = (ptr) => {
      this.ptrEaten = false;
      if (this.drag) this.placeDrag(hitSlot(ptr.x, ptr.y, this.invOpen));
    };
    this.input.on("pointerup", up);
    this.input.on("pointerupoutside", up);
  },

  aimAt(ptr) {
    const w = ptr.positionToCamera(this.cameras.main),
      t = unIso(w.x, w.y + 5);
    return norm(t.x - this.p.x, t.y - this.p.y);
  },

  restartGame() {
    if (this.restarting) return;
    this.restarting = true;
    this.scene.restart({ depth: 1 });
  },

  say(t, d = 2) {
    this.msgText = t;
    this.msgT = d;
  },

  updatePlayer(dt) {
    const p = this.p,
      k = this.keys,
      JD = Phaser.Input.Keyboard.JustDown;
    p.cds.main -= dt;
    p.cds.off -= dt;
    p.useT.main -= dt;
    p.useT.off -= dt;
    p.castT -= dt;
    p.inv -= dt;
    p.atkT -= dt;
    let mx = 0,
      my = 0;
    if (!this.descending) {
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
      const tv = this.touchVec;
      if (tv && (tv.x || tv.y)) {
        const a = tv.x / 8,
          b = tv.y / 4;
        mx = (a + b) / 2;
        my = (b - a) / 2;
      }
    }
    const l = Math.hypot(mx, my),
      moving = l > 0.01;
    if (moving) {
      mx /= l;
      my /= l;
      p.face = { x: mx, y: my };
    }
    const spd =
      3.1 * (p.atkT > 0 ? 0.4 : 1) * (p.blocking || p.channeling ? 0.5 : 1);
    const ox = p.x,
      oy = p.y;
    p.x += (mx * spd + p.kx) * dt;
    p.y += (my * spd + p.ky) * dt;
    const dec = Math.pow(0.002, dt);
    p.kx *= dec;
    p.ky *= dec;
    this.resolve(p);

    p.blocking = p.channeling = false;
    if (!this.descending && !this.invOpen) {
      const ptr = this.input.activePointer,
        mouse = !ptr.wasTouch && ptr.isDown && !this.drag && !this.ptrEaten;
      const zj = JD(k.Z) || JD(k.J) || JD(k.SPACE),
        xk = JD(k.X) || JD(k.K);
      const held = {
        main:
          (mouse && ptr.leftButtonDown()) ||
          k.Z.isDown ||
          k.J.isDown ||
          k.SPACE.isDown ||
          this.touchAHeld,
        off:
          (mouse && ptr.rightButtonDown()) ||
          k.X.isDown ||
          k.K.isDown ||
          this.touchBHeld,
      };
      const pressed = {
        main: this.clickMain || zj || this.touchA,
        off: this.clickOff || xk || this.touchB,
      };
      if (mouse && (held.main || held.off)) p.face = this.aimAt(ptr);
      this.useSlot("main", pressed.main, held.main, p.face, dt);
      this.useSlot("off", pressed.off, held.off, p.face, dt);
      if (JD(k.Q) || this.touchP) this.drink();
    }
    this.touchA = this.touchB = this.touchP = false;
    this.clickMain = this.clickOff = false;

    p.mpT += dt;
    if (p.mpT > 2.5) {
      p.mpT = 0;
      p.mp = Math.min(p.maxmp, p.mp + 1);
    }

    const moved = Math.hypot(p.x - ox, p.y - oy);
    const gi = Math.floor(p.y * 4) * MW * 4 + Math.floor(p.x * 4);
    if (this.bloodGrid[gi] >= 2) p.bloody = 16;
    p.stepD += moved;
    if (p.stepD > 0.2) {
      p.stepD = 0;
      p.side = -p.side;
      if (p.bloody > 0) {
        p.bloody--;
        this.stamp("d_m1", p.x - my * 0.07 * p.side, p.y + mx * 0.07 * p.side);
      }
    }
    if (p.hp < p.maxhp * 0.35) {
      p.drip -= dt;
      if (p.drip <= 0) {
        p.drip = 0.35;
        this.spray(p.x, p.y, 4, 0, 0, 1, "m", 3.14, 0.3);
      }
    }

    if (
      !this.descending &&
      Math.hypot(p.x - this.stairs.x, p.y - this.stairs.y) < 0.35
    ) {
      this.descending = true;
      this.wipe = 0;
      this.say("descending", 1);
    }

    const sp = iso(p.x, p.y),
      sx = p.face.x - p.face.y,
      sy = p.face.x + p.face.y,
      front = sy >= -0.01;
    const anim = front ? "p_f" : "p_b";
    if (moving) {
      if (p.spr.anims.currentAnim?.key !== anim || !p.spr.anims.isPlaying)
        p.spr.play(anim);
    } else {
      p.spr.stop();
      p.spr.setFrame(front ? PF.front : PF.back);
    }
    p.spr
      .setFlipX(sx < 0)
      .setPosition(sp.x, sp.y)
      .setDepth(p.x + p.y);
    const vis = !(p.inv > 0 && Math.floor(p.inv * 20) % 2 === 0);
    p.spr.setVisible(vis);
    this.syncOutline(p.spr);

    const aim = Math.atan2(sy * 0.5, sx);
    this.drawMain(sp, aim, front, moving, vis, dt);
    this.drawOff(sp, aim, front, vis, dt);
    // let ang;
    // if (p.swingT > 0) {
    //   p.swingT -= dt;
    //   const t = Phaser.Math.Clamp(1 - p.swingT / 0.13, 0, 1),
    //     e = 1 - Math.pow(1 - t, 3);
    //   ang = p.swingAim + p.swingFrom * 1.9 * (1 - 2 * e);
    //   p.swordAng = ang;
    // } else {
    //   const target =
    //     aim +
    //     p.rest * 1.25 +
    //     (moving ? Math.sin(this.time.now / 90) * 0.12 : 0);
    //   p.swordAng +=
    //     Phaser.Math.Angle.Wrap(target - p.swordAng) * Math.min(1, dt * 14);
    //   ang = p.swordAng;
    // }
    // const hx = sp.x + Math.round(Math.cos(aim) * 2),
    //   hy = sp.y - 2 + Math.round(Math.sin(aim));
    // p.sword
    //   .setPosition(hx, hy)
    //   .setRotation(ang)
    //   .setVisible(vis)
    //   .setDepth(p.x + p.y + (Math.sin(ang) > -0.15 ? 0.02 : -0.02));
  },

  drawMain(sp, aim, front, moving, vis, dt) {
    const p = this.p,
      h = p.hand.main,
      it = p.equip.main;
    if (!it) return h.setVisible(false);
    if (WDEF[it.base].back && p.useT.main <= 0)
      return this.drawSlung(h, it, sp, "main", front, vis);
    let ang;
    if (WDEF[it.base].kind === "melee") {
      if (p.swingT > 0) {
        p.swingT -= dt;
        const t = Phaser.Math.Clamp(1 - p.swingT / 0.13, 0, 1),
          e = 1 - Math.pow(1 - t, 3);
        ang = p.swingAim + p.swingFrom * 1.9 * (1 - 2 * e);
        p.swordAng = ang;
      } else {
        const target =
          aim +
          p.rest * 1.25 +
          (moving ? Math.sin(this.time.now / 90) * 0.12 : 0);
        p.swordAng +=
          Phaser.Math.Angle.Wrap(target - p.swordAng) * Math.min(1, dt * 14);
        ang = p.swordAng;
      }
    } else {
      p.swordAng +=
        Phaser.Math.Angle.Wrap(aim - p.swordAng) * Math.min(1, dt * 14);
      ang = p.swordAng;
    }
    const hx = sp.x + Math.round(Math.cos(aim) * 2),
      hy = sp.y - 2 + Math.round(Math.sin(aim));
    h.setPosition(hx, hy)
      .setRotation(ang)
      .setVisible(vis)
      .setDepth(
        p.x +
          p.y +
          (WDEF[it.base].back
            ? front
              ? 0.03
              : -0.03
            : Math.sin(ang) > -0.15
              ? 0.02
              : -0.02),
      );
  },

  drawOff(sp, aim, front, vis, dt) {
    const p = this.p,
      h = p.hand.off,
      it = p.equip.off;
    if (!it) return h.setVisible(false);
    if (WDEF[it.base].back && p.useT.off <= 0)
      return this.drawSlung(h, it, sp, "off", front, vis);

    const kind = WDEF[it.base].kind,
      side = aim + 1.57;
    let ox = Math.cos(side) * 3,
      oy = Math.sin(side),
      dz = Math.sin(side) > 0 ? 0.02 : -0.02,
      ang;
    if (p.offSwingT > 0) {
      // offhand melee = quick thrust out and back
      p.offSwingT -= dt;
      const e = Math.sin(Math.PI * (1 - Math.max(0, p.offSwingT) / 0.13));
      ox = Math.cos(aim) * (2 + 3 * e);
      oy = Math.sin(aim) * (1 + 1.5 * e);
      ang = aim;
      dz = 0.03;
    } else if (kind === "shield") {
      ang = 0;
      if (p.blocking) {
        ox = Math.cos(aim) * 3;
        oy = Math.sin(aim) * 1.5;
        dz = front ? 0.03 : -0.03;
      }
    } else if (kind === "staff") ang = p.castT > 0 ? aim : -1.4;
    else if (kind === "melee") ang = aim - 1.25;
    else ang = aim; // bow
    if (WDEF[it.base].back) dz = front ? 0.03 : -0.03;
    h.setPosition(sp.x + Math.round(ox), sp.y - 2 + Math.round(oy))
      .setRotation(ang)
      .setFlipX(kind === "shield" && Math.cos(aim) < 0)
      .setVisible(vis)
      .setDepth(p.x + p.y + dz);
  },

  drawSlung(h, it, sp, slot, front, vis) {
    const p = this.p,
      flip = p.spr.flipX ? -1 : 1,
      side = slot === "main" ? -1 : 1,
      rot = WDEF[it.base].backRot * flip * side;
    h.setPosition(sp.x + side * flip, sp.y - 4)
      .setRotation(rot)
      .setFlipX(false)
      .setVisible(vis)
      .setDepth(p.x + p.y + (front ? -0.03 : 0.03));
    if (slot === "main") p.swordAng = rot;
  },

  slash(dir, it, slot) {
    const p = this.p;
    if (p.cds[slot] > 0 || p.dead) return;
    const D = WDEF[it.base];
    p.cds[slot] = it.cd;
    p.atkT = 0.14;
    if (slot === "main") {
      p.swing = -p.swing;
      p.swingAim = Math.atan2((dir.x + dir.y) * 0.5, dir.x - dir.y);
      p.swingFrom = p.rest;
      p.rest = -p.rest;
      p.swingT = 0.13;
    } else p.offSwingT = 0.13;
    p.kx += dir.x * 1.5;
    p.ky += dir.y * 1.5;
    const sp = iso(p.x + dir.x * 0.45, p.y + dir.y * 0.45),
      ang = Math.atan2((dir.x + dir.y) * 0.5, dir.x - dir.y);
    const fx = this.add
      .image(sp.x, sp.y - 5, "slash0")
      .setRotation(ang)
      .setFlipY(slot === "main" ? p.swingFrom > 0 : false)
      .setDepth(p.x + p.y + dir.x + dir.y + 0.3);
    this.time.delayedCall(60, () => fx.setTexture("slash1"));
    this.time.delayedCall(130, () => fx.destroy());
    const hitTest = (o) =>
      this.bodyPts(o).some((b) => {
        const dx = b.x - p.x,
          dy = b.y - p.y,
          d = Math.hypot(dx, dy);
        return (
          d < D.reach + (b.r || o.r) &&
          (d < 0.45 || (dx * dir.x + dy * dir.y) / d > D.arc)
        );
      });
    let any = false;
    for (const e of [...this.enemies])
      if (hitTest(e)) {
        any = true;
        const crit = Math.random() < it.crit,
          dmg = (p.atk + it.atk + ri(0, 2)) * (crit ? 2 : 1),
          u = norm(e.x - p.x, e.y - p.y);
        this.hurtEnemy(e, dmg, u.x, u.y, crit ? 6 : 4, crit);
        this.applyElem(e, it.elem, it.edmg, u.x, u.y);
        const heal = Math.round(dmg * it.leech);
        if (heal > 0) p.hp = Math.min(p.maxhp, p.hp + heal);
      }
    for (const o of [...this.props])
      if (hitTest(o)) {
        any = true;
        const u = norm(o.x - p.x, o.y - p.y);
        this.hurtProp(o, p.atk + it.atk, u.x, u.y);
      }
    if (any) this.shake(1, 0.08);
  },

  useSlot(slot, pressed, held, dir, dt) {
    const it = this.p.equip[slot];
    if (!it) return;
    if ((pressed || held) && WDEF[it.base].back) this.p.useT[slot] = 0.6;

    switch (WDEF[it.base].kind) {
      case "melee":
        if (pressed) this.slash(dir, it, slot);
        break;
      case "bow":
        if (pressed) this.shoot(dir, it, slot);
        break;
      case "staff":
        this.cast(it, slot, pressed, held, dir, dt);
        break;
      case "shield":
        if (held) this.p.blocking = true;
        break;
    }
  },

  shoot(dir, it, slot) {
    const p = this.p;
    if (p.cds[slot] > 0 || p.dead) return;
    if (!this.takeStack("arrow")) {
      this.say("no arrows", 0.8);
      return;
    }
    p.cds[slot] = it.cd;
    p.atkT = 0.1;
    this.fire(p.x, p.y, dir.x, dir.y, "p", p.atk + it.atk + ri(0, 2), {
      key: "arrow",
      spd: WDEF.bow.spd,
      rot: true,
      col: it.elem ? ELEMENTS[it.elem].col : "w",
      kb: 2,
      elem: it.elem,
      edmg: it.edmg,
    });
  },

  drink() {
    const p = this.p;
    if (p.dead) return;
    if (this.countOf("potion") <= 0) {
      this.say("no potions", 0.8);
      return;
    }
    if (p.hp >= p.maxhp) {
      this.say("hp is full", 0.8);
      return;
    }
    this.takeStack("potion");
    const h = 10 + p.lv * 2;
    p.hp = Math.min(p.maxhp, p.hp + h);
    this.pop(p.x, p.y, 14, "+" + h, "c");
    for (let i = 0; i < 10; i++)
      this.addPart({
        x: p.x + rnd(-0.3, 0.3),
        y: p.y + rnd(-0.3, 0.3),
        z: rnd(0, 6),
        vx: 0,
        vy: 0,
        vz: rnd(12, 26),
        key: pick(["d_c1", "d_w1"]),
        float: true,
        life: rnd(0.4, 0.8),
      });
  },

  gainXP(n) {
    const p = this.p;
    p.xp += n;
    while (p.xp >= p.next) {
      p.xp -= p.next;
      p.lv++;
      p.next = Math.floor(10 * Math.pow(p.lv, 1.4));
      p.maxhp += 5;
      p.maxmp += 2;
      p.atk += 1;
      p.hp = p.maxhp;
      p.mp = p.maxmp;
      this.say("fuck yeah!");
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * 6.283;
        this.addPart({
          x: p.x + Math.cos(a) * 0.5,
          y: p.y + Math.sin(a) * 0.5,
          z: 2,
          vx: 0,
          vy: 0,
          vz: 20,
          key: i % 2 ? "d_w1" : "d_c1",
          float: true,
          life: 0.6,
        });
      }
    }
  },
};
