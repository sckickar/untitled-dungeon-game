import { World } from "../sim/world.js";
import { generateLevel } from "../sim/level.js";
import { snapshot } from "../sim/actor.js";
import { countOf } from "../sim/items.js";
import { WorldView } from "../view/WorldView.js";
import { setupInput, readInput } from "./input.js";
import { pickAt, getAt, pickMobAt } from "./inventory.js";
import {
  talkTarget,
  openTalk,
  chooseTalk,
  canTalk,
  TALK_RANGE,
} from "../content/npcs.js";
import { signAt } from "../content/tutorial.js";
import { dist } from "../lib/math.js";
import { alive } from "../sim/entity.js";

export class Game extends Phaser.Scene {
  constructor() {
    super("game");
  }

  init(data) {
    this.depth = data.depth ?? 0;
    this.carry = data.carry || null;
    this.restarting = false;
  }

  create() {
    this.cameras.main.setBackgroundColor("#000000");
    Object.assign(this, {
      hitstop: 0,
      wipe: 0,
      reveal: 0.35,
      over: false,
      overT: 0,
      invOpen: false,
      talk: null,
      trade: null,
      invNote: null,
      touchE: false,
      drag: null,
      ptrEaten: false,
      clickMain: false,
      clickOff: false,
      clickAim: null,
      touchVec: null,
      touchA: false,
      touchB: false,
      touchP: false,
      touchM: false,
      touchI: false,
      touchAHeld: false,
      touchBHeld: false,
      camPt: null,
      victoryT: 0,
    });
    this.world = new World({ depth: this.depth });
    generateLevel(this.world, { carry: this.carry });
    this.view = new WorldView(this, this.world);
    this.world.on("death", ({ target }) => {
      if (target !== this.world.player) return;
      this.invOpen = false;
      this.overT = 0;
      this.world.say("you died", 99);
    });
    setupInput(this);
    if (!this.scene.isActive("ui")) this.scene.launch("ui");
    this.scene.bringToTop("ui");
    const note = this.world.message;
    if (this.depth > 0) this.world.say(this.depth === 1 ? "descend!" : "floor B" + this.depth, 2.5);
    if (note.t > 0) this.world.sayNext(note.text, note.t);
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30) * (this.timeScale ?? 1),
      world = this.world,
      view = this.view,
      p = world.player,
      JD = Phaser.Input.Keyboard.JustDown;
    view.pops.update(dt);
    if (this.invNote) this.invNote.t -= dt;
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return view.camera.update(dt, this.camTarget(dt));
    }
    if (this.talk) {
      this.updateTalk();
      return view.camera.update(dt, this.camTarget(dt));
    }
    if (
      !p.dead &&
      !this.invOpen &&
      !world.descending &&
      (JD(this.keys.E) || this.touchE)
    ) {
      const npc = talkTarget(world);
      if (npc) {
        this.talk = openTalk(world, npc);
        this.touchE = false;
        return view.camera.update(dt, this.camTarget(dt));
      }
    }
    this.touchE = false;
    if (!p.dead && (JD(this.keys.I) || JD(this.keys.TAB) || this.touchI))
      this.invOpen = !this.invOpen;
    else if (this.invOpen && JD(this.keys.ESC)) this.invOpen = false;
    this.touchI = false;
    const t = this.trade;
    if (t && (!canTalk(t) || dist(t, p) > TALK_RANGE + 0.5)) this.invOpen = false;
    if (!this.invOpen) this.trade = null;
    if (this.invOpen) return view.camera.update(dt, this.camTarget(dt));
    if (this.reveal > 0) this.reveal -= dt;
    if (world.descending) {
      this.wipe += dt / 0.35;
      if (this.wipe >= 1 && !this.restarting) {
        this.restarting = true;
        this.scene.restart({ depth: this.depth + 1, carry: snapshot(p) });
        return;
      }
    }
    if (p.dead) {
      this.overT += dt;
      if (this.overT > 1.4) this.over = true;
      if (this.over && (JD(this.keys.R) || JD(this.keys.Z))) this.restartGame();
      world.input = null;
    } else world.input = world.descending ? null : readInput(this);
    world.step(dt);
    view.sync(dt);
    if (world.victory && (this.victoryT += dt) > 3) return this.endRun();
    view.camera.update(dt, this.camTarget(dt));
  }

  camTarget(dt) {
    const p = this.world.player,
      cs = this.world.cutscene,
      b = this.world.boss,
      fight = !cs && b?.state === "fight" && !p.dead && dist(b, p) < 10,
      want = cs ? cs.focus : fight ? { x: p.x + (b.x - p.x) * 0.35, y: p.y + (b.y - p.y) * 0.35 } : p;
    if (!cs && !fight && !this.camPt) return p;
    this.camPt ??= { x: p.x, y: p.y };
    const k = Math.min(1, dt * (cs ? 3 : 8));
    this.camPt.x += (want.x - this.camPt.x) * k;
    this.camPt.y += (want.y - this.camPt.y) * k;
    if (!cs && !fight && dist(this.camPt, p) < 0.2) this.camPt = null;
    return this.camPt ?? p;
  }

  endRun() {
    if (this.restarting) return;
    this.restarting = true;
    const w = this.world,
      p = w.player,
      run = w.run ?? {};
    this.scene.stop("ui");
    this.scene.start("ending", {
      depth: this.depth,
      lv: p.lv,
      kills: p.kills,
      gold: p.gold,
      time: (run.time ?? 0) + w.time,
      slain: run.slain ?? [],
      party: w.query((e) => e.mode === "hired" && alive(e)).map((e) => e.name),
    });
  }

  updateTalk() {
    const k = this.keys,
      JD = Phaser.Input.Keyboard.JustDown,
      t = this.talk,
      n = t.options.length;
    if (!canTalk(t.npc) || dist(t.npc, this.world.player) > TALK_RANGE + 0.5)
      return (this.talk = null);
    if (JD(k.ESC) || JD(k.E) || JD(k.X) || JD(k.K) || JD(k.I) || JD(k.TAB))
      return (this.talk = null);
    if (JD(k.W) || JD(k.UP)) t.sel = (t.sel + n - 1) % n;
    if (JD(k.S) || JD(k.DOWN)) t.sel = (t.sel + 1) % n;
    const num = [k.ONE, k.TWO, k.THREE, k.FOUR].findIndex((key) => JD(key));
    if (num >= 0 && num < n) return this.talkPick(num);
    if (JD(k.Z) || JD(k.J) || JD(k.SPACE) || JD(k.ENTER)) this.talkPick(t.sel);
  }

  talkPick(i) {
    const t = this.talk;
    if (!t || !t.options[i]) return;
    t.sel = i;
    this.talk = chooseTalk(this.world, t, t.options[i].id);
    if (this.talk?.trade) {
      this.trade = this.talk.npc;
      this.talk = null;
      this.invOpen = true;
    }
  }

  get talkable() {
    return this.talk || this.invOpen || this.world.player.dead
      ? null
      : talkTarget(this.world);
  }

  restartGame() {
    if (this.restarting) return;
    this.restarting = true;
    this.scene.restart({ depth: 0 });
  }

  get sign() {
    return this.talk || this.invOpen || this.over ? null : signAt(this.world);
  }

  get p() {
    return this.world?.player;
  }
  get lvl() {
    return this.depth;
  }
  get msgT() {
    return this.world.message.t;
  }
  get msgText() {
    return this.world.message.text;
  }
  get descending() {
    return this.world.descending;
  }
  countOf(base) {
    return countOf(this.world.player, base);
  }
  getAt(t) {
    return getAt(this, t);
  }
  pickAt(ptr) {
    return pickAt(this, ptr);
  }
  pickMobAt(ptr) {
    return pickMobAt(this, ptr);
  }
}
