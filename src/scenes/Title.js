import { VW } from "../config.js";
import { pick, ri, rnd } from "../lib/math.js";
import { World } from "../sim/world.js";
import { terrainIndex } from "../sim/defs.js";
import { alive, has } from "../sim/entity.js";
import { WorldView } from "../view/WorldView.js";
import { txt } from "../view/assets/fonts.js";
import { sfx, music, setListener } from "../audio/engine.js";

const ARENA = { x: 18, y: 18, w: 8, h: 8 },
  DEPTH = 3,
  HIRELINGS = 3,
  WAVE = [3, 6],
  FOES = ["slime", "slime", "bat", "bat", "snake", "skel", "cult", "ghoul", "brute"],
  WAVE_GAP = 1.5,
  HIRE_GAP = 2.5,
  LITTER = 4,
  FADE = { every: 0.5, alpha: 0.1 };

export class Title extends Phaser.Scene {
  constructor() {
    super("title");
  }

  create() {
    const floor = +new URLSearchParams(location.search).get("floor");
    if (floor > 0 && !Title.skipped) {
      Title.skipped = true;
      return this.scene.start("game", { depth: floor });
    }
    this.cameras.main.setBackgroundColor("#000000");
    setListener(null);
    music("title", 1.5);
    this.hitstop = 0;
    this.waveT = 0.6;
    this.hireT = HIRE_GAP;
    this.fadeT = FADE.every;
    this.world = arena();
    this.focus = { x: ARENA.x + ARENA.w / 2 - 0.8, y: ARENA.y + ARENA.h / 2 - 0.8 };
    this.view = new WorldView(this, this.world, this.focus);
    for (let i = 0; i < HIRELINGS; i++) this.spawnAtEdge("npc", { mode: "hunt" });

    const center = (t) => {
      t.x = Math.round((VW - t.width) / 2);
      return t.setScrollFactor(0).setDepth(2e5);
    };
    center(txt(this, 0, 4, "sprite", "m").setScale(2));
    center(txt(this, 0, 21, "dungeon", "c"));
    const touch = this.sys.game.device.input.touch,
      go = center(txt(this, 0, 117, touch ? "tap to start" : "press z or click to start", "w"));
    this.time.addEvent({ delay: 420, loop: true, callback: () => go.setVisible(!go.visible) });

    const start = () => {
      if (this.started) return;
      this.started = true;
      sfx("select2");
      this.scene.start("game", { depth: 0 });
    };
    this.input.keyboard.on("keydown", (e) => {
      if (["z", "Z", " ", "Enter", "j", "J"].includes(e.key)) start();
    });
    this.input.on("pointerdown", start);
  }

  spawnAtEdge(type, init) {
    const A = ARENA,
      side = ri(0, 3),
      along = rnd(0.5, (side % 2 ? A.h : A.w) - 0.5),
      x = side === 0 ? A.x + along : side === 1 ? A.x + 0.5 : side === 2 ? A.x + along : A.x + A.w - 0.5,
      y = side === 0 ? A.y + 0.5 : side === 1 ? A.y + along : side === 2 ? A.y + A.h - 0.5 : A.y + along;
    return this.world.spawn(type, x, y, init);
  }

  update(time, delta) {
    const dt = Math.min(delta / 1000, 1 / 30),
      w = this.world,
      v = this.view;
    v.pops.update(dt);
    if (this.hitstop > 0) {
      this.hitstop -= dt;
      return v.camera.update(dt, this.focus);
    }
    const foes = w.entities.some((e) => e.team === "monster" && has(e, "creature") && alive(e)),
      crew = w.entities.filter((e) => has(e, "npc") && alive(e)).length;
    if (foes) this.waveT = WAVE_GAP;
    else if ((this.waveT -= dt) <= 0)
      for (let n = ri(...WAVE); n > 0; n--) this.spawnAtEdge(pick(FOES));
    if (crew >= HIRELINGS) this.hireT = HIRE_GAP;
    else if ((this.hireT -= dt) <= 0) {
      this.spawnAtEdge("npc", { mode: "hunt" });
      this.hireT = HIRE_GAP;
    }
    for (const o of w.entities) {
      if (has(o, "pickup") && o.rest > LITTER) w.remove(o);
      else if (o.mem?.target && alive(o.mem.target)) o.mem.aggro = true;
    }
    if ((this.fadeT -= dt) <= 0) {
      this.fadeT = FADE.every;
      v.rt.fill(0x000000, FADE.alpha);
    }
    w.step(dt);
    v.sync(dt);
    v.camera.update(dt, this.focus);
  }
}

function arena() {
  const w = new World({ depth: DEPTH }),
    FLOOR = terrainIndex("floor");
  w.tiles.fill(terrainIndex("wall"));
  for (let y = ARENA.y; y < ARENA.y + ARENA.h; y++)
    for (let x = ARENA.x; x < ARENA.x + ARENA.w; x++) w.setTile(x, y, FLOOR);
  return w;
}
