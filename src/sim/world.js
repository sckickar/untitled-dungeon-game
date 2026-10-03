import { MW, MH } from "../config.js";
import { defs } from "./defs.js";
import { runRules } from "./rules.js";
import { separate } from "./physics.js";
import { tickStatuses } from "./status.js";
import { bfs } from "./nav.js";

const MAX_EVENT_DEPTH = 24;
const OUTSIDE = { id: "outside", solid: true };

export class World {
  constructor({ depth = 1 } = {}) {
    this.depth = depth;
    this.time = 0;
    this.entities = [];
    this.byId = new Map();
    this.nextId = 0;
    this.listeners = new Map();
    this.eventDepth = 0;

    this.tiles = new Uint8Array(MW * MH);
    this.biome = null;
    this.rooms = [];
    this.stairRoom = null;
    this.player = null;
    this.input = null;
    this.message = { text: "", t: 0 };
    this.nextMessage = null;
    this.descending = false;
    this.cleared = false;
    this.safe = false;
    this.flow = null;
    this.flowT = 0;
  }

  spawn(type, x, y, init = {}) {
    const def = defs.entities[type];
    if (!def) throw new Error(`world.spawn: unknown entity "${type}"`);
    const e = {
      id: ++this.nextId,
      type,
      def,
      x,
      y,
      z: 0,
      r: def.r ?? 0.3,
      kx: 0,
      ky: 0,
      t: 0,
      flash: 0,
      team: def.team ?? null,
      tags: new Set(def.tags || []),
      status: new Map(),
      dead: false,
      removed: false,
    };
    if (def.hp != null) e.hp = e.maxhp = def.hp;
    def.setup?.(this, e, init);
    this.entities.push(e);
    this.byId.set(e.id, e);
    this.emit("spawn", { entity: e });
    return e;
  }

  remove(e) {
    e.removed = true;
    this.pendingRemoval = true;
  }

  sweep() {
    if (!this.pendingRemoval) return;
    this.pendingRemoval = false;
    const gone = this.entities.filter((e) => e.removed);
    this.entities = this.entities.filter((e) => !e.removed);
    for (const e of gone) {
      this.byId.delete(e.id);
      this.emit("removed", { entity: e });
    }
  }

  query(pred) {
    return this.entities.filter((e) => !e.removed && pred(e));
  }

  step(dt) {
    this.time += dt;
    if (this.message.t > 0) this.message.t -= dt;
    else if (this.nextMessage) {
      this.message = this.nextMessage;
      this.nextMessage = null;
    }
    this.flowT -= dt;
    if (this.flowT <= 0) {
      this.flowT = 0.25;
      if (this.player && !this.player.dead) this.flow = bfs(this, Math.floor(this.player.x), Math.floor(this.player.y));
    }
    for (const e of [...this.entities]) if (!e.removed) e.def.update?.(this, e, dt);
    separate(this);
    tickStatuses(this, dt);
    this.emit("tick", { dt });
    this.sweep();
  }

  emit(event, payload = {}) {
    if (this.eventDepth >= MAX_EVENT_DEPTH) {
      console.warn(`event "${event}" skipped: rules are nested ${MAX_EVENT_DEPTH} deep (a rule is probably triggering itself)`);
      return payload;
    }
    this.eventDepth++;
    try {
      runRules(event, payload, this);
      const list = this.listeners.get(event);
      if (list) for (const fn of [...list]) fn(payload, this);
    } finally {
      this.eventDepth--;
    }
    return payload;
  }

  on(event, fn) {
    const list = this.listeners.get(event) || [];
    list.push(fn);
    this.listeners.set(event, list);
    return () => list.splice(list.indexOf(fn), 1);
  }

  say(text, t = 2) {
    this.message = { text, t };
  }

  sayNext(text, t = 2) {
    this.nextMessage = { text, t };
  }

  terrain(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return OUTSIDE;
    return defs.terrainList[this.tiles[ty * MW + tx]];
  }

  terrainAt(x, y) {
    return this.terrain(Math.floor(x), Math.floor(y));
  }

  solid(tx, ty) {
    return this.terrain(tx, ty).solid;
  }

  solidAt(x, y) {
    return this.solid(Math.floor(x), Math.floor(y));
  }

  setTile(tx, ty, index) {
    if (tx >= 0 && ty >= 0 && tx < MW && ty < MH) this.tiles[ty * MW + tx] = index;
  }

  los(x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0),
      n = Math.ceil(d * 4);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (this.solidAt(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return false;
    }
    return true;
  }
}
