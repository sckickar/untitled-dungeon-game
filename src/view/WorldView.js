import { RENDERERS } from "./renderers/index.js";
import { buildFloor, updateCutaway } from "./floor.js";
import { Gore } from "./gore.js";
import { Pops, Beams } from "./fx.js";
import { Camera } from "./camera.js";
import { bindReactions } from "./reactions.js";
import { MobLabel } from "./mobLabel.js";

export class WorldView {
  constructor(scene, world, focus = world.player) {
    this.scene = scene;
    this.world = world;
    this.recs = new Map();
    this.low = new Set();
    this.hoverPick = null;
    buildFloor(this);
    this.gore = new Gore(this);
    this.pops = new Pops(scene);
    this.beams = new Beams(scene);
    this.camera = new Camera(scene, focus);
    this.swordStamp = scene.make.image({ key: "sword" }, false).setOrigin(0.15, 0.5);
    for (const e of world.entities) this.add(e);
    world.on("spawn", ({ entity }) => this.add(entity));
    world.on("removed", ({ entity }) => this.remove(entity));
    bindReactions(this);
    this.hoverMob = null;
    this.mobLabel = new MobLabel(this);
  }

  add(e) {
    const name = e.def.look.renderer,
      R = RENDERERS[name];
    if (!R) throw new Error(`entity "${e.type}": unknown renderer "${name}"`);
    const rec = R.create(this, e);
    rec.R = R;
    this.recs.set(e.id, rec);
    R.update(this, e, rec, 0);
  }

  remove(e) {
    const rec = this.recs.get(e.id);
    if (!rec) return;
    rec.R.destroy(this, e, rec);
    this.recs.delete(e.id);
  }

  spriteOf(e) {
    return this.recs.get(e.id)?.spr;
  }

  sync(dt) {
    for (const e of this.world.entities) {
      const rec = this.recs.get(e.id);
      if (rec) rec.R.update(this, e, rec, dt);
    }
    this.gore.update(dt);
    this.beams.update(dt);
    updateCutaway(this);
  }
}
