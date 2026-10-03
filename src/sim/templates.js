import { rnd, norm, clamp, wrapAngle } from "../lib/math.js";
import { setupActor, tickActor } from "./actor.js";
import { defs } from "./defs.js";
import { alive, has, isHostile, touches } from "./entity.js";
import { strike, tryBlock } from "./combat.js";
import { effectColor } from "./items.js";
import { resolve } from "./physics.js";

const withTags = (d, base) => [...base, ...(d.tags || [])];

export function creature(d) {
  return {
    team: "monster",
    r: 0.3,
    mass: 1,
    spd: 1,
    wind: 0.3,
    update: tickActor,
    ...d,
    look: { renderer: "creature", ...d.look },
    tags: withTags(d, ["creature", "body"]),
    setup(world, e, init) {
      setupActor(world, e);
      d.setup?.(world, e, init);
    },
  };
}

export function prop(d) {
  return {
    team: "object",
    r: 0.3,
    update(world, o, dt) {
      o.flash -= dt;
    },
    ...d,
    look: { renderer: "prop", ...d.look },
    tags: withTags(d, ["obstacle", "breakable"]),
  };
}

export function pickup(d) {
  return {
    r: 0.2,
    update: tickPickup,
    ...d,
    look: { renderer: "pickup", ...d.look },
    tags: withTags(d, ["pickup"]),
    setup(world, o, init) {
      Object.assign(o, {
        z: 4,
        vz: rnd(40, 60),
        vx: rnd(-1, 1),
        vy: rnd(-1, 1),
        rest: 0,
        t: rnd(0, 6),
        item: init.item ?? null,
      });
      d.setup?.(world, o, init);
    },
  };
}

function tickPickup(world, o, dt) {
  o.t += dt;
  if (o.z > 0 || o.vz > 0) {
    o.vz -= 230 * dt;
    o.z += o.vz * dt;
    const nx = o.x + o.vx * dt,
      ny = o.y + o.vy * dt;
    if (world.solidAt(nx + Math.sign(o.vx) * o.r, o.y)) o.vx *= -0.5;
    else o.x = nx;
    if (world.solidAt(o.x, ny + Math.sign(o.vy) * o.r)) o.vy *= -0.5;
    else o.y = ny;
    resolve(world, o);
    if (o.z <= 0) {
      o.z = 0;
      if (o.vz < -30) o.vz = -o.vz * 0.4;
      else o.vz = o.vx = o.vy = 0;
    }
  } else o.rest += dt;
  const p = world.player;
  if (o.def.manual || !p || p.dead) return;
  const dx = p.x - o.x,
    dy = p.y - o.y,
    d = Math.hypot(dx, dy);
  if (o.rest > 0.25 && d < 1.4) {
    o.x += (dx / d) * 4 * dt;
    o.y += (dy / d) * 4 * dt;
  }
  if (d < 0.35 && o.rest > 0.1 && o.def.onCollect(world, p, o) !== false)
    world.remove(o);
}

export function projectile(d) {
  return {
    speed: 8,
    life: 2.5,
    kb: 3,
    z: 5,
    color: "w",
    update: tickProjectile,
    ...d,
    look: { renderer: "projectile", ...d.look },
    tags: withTags(d, ["projectile"]),

    setup(
      world,
      q,
      {
        source,
        dir,
        speed,
        amount,
        kb,
        item,
        elem = null,
        edmg = 0,
        sprite = null,
        mark = null,
      },
    ) {
      const spd = speed ?? q.def.speed;
      Object.assign(q, {
        source,
        team: source.team,
        z: q.def.z,
        vx: dir.x * spd,
        vy: dir.y * spd,
        life: q.def.life,
        hit: { amount, kb: kb ?? q.def.kb, item, elem, edmg },
        sprite,
        color: elem
          ? defs.elements[elem].col
          : item?.effects?.length
            ? effectColor(item.effects[0])
            : q.def.color,
        tinted: elem ? !!q.def.tint : !!item?.effects?.length,
        seekT: 0,
        prey: null,
        mark,
      });
      d.setup?.(world, q);
    },
  };
}

function tickProjectile(world, q, dt) {
  q.life -= dt;
  if (q.def.homing) home(world, q, dt);
  q.x += q.vx * dt;
  q.y += q.vy * dt;
  let dead = q.life <= 0;
  const u = norm(q.vx, q.vy);
  if (!dead && world.solidAt(q.x, q.y)) {
    dead = true;
    q.x -= u.x * 0.15;
    q.y -= u.y * 0.15;
    world.emit("impact", {
      x: q.x,
      y: q.y,
      z: q.z,
      dir: { x: -u.x, y: -u.y },
      color: q.color,
    });
    if (q.hit.elem)
      defs.elements[q.hit.elem].onImpact?.(world, q.source, q.x, q.y, q.hit);
  }
  if (!dead)
    for (const t of world.entities) {
      if (!isHostile(q.team, t) || passesBy(q, t)) continue;
      if (
        t.blocking &&
        touches(t, q.x, q.y, 0.4) &&
        tryBlock(world, t, u, 1, q.source)
      ) {
        dead = true;
        break;
      }
      if (touches(t, q.x, q.y, has(t, "creature") ? 0.15 : 0.1)) {
        strike(world, q.source, t, { ...q.hit, dir: u, blockable: false });
        dead = true;
        break;
      }
    }
  if (!dead) return;
  if (q.def.breaks) world.emit("shatter", { x: q.x, y: q.y, z: q.z, dir: u });
  q.def.burst?.(world, q);
  world.remove(q);
}

const passesBy = (q, t) => !!q.mark && !!t.boss && t.boss === q.mark.boss && t !== q.mark && alive(q.mark);

const SEEK_RANGE = 7;

function home(world, q, dt) {
  q.seekT -= dt;
  if (q.seekT <= 0) {
    q.seekT = 0.1;
    let best = null,
      bd = SEEK_RANGE;
    for (const t of world.entities) {
      if (!has(t, "creature") || !isHostile(q.team, t)) continue;
      const d = Math.hypot(t.x - q.x, t.y - q.y);
      if (d < bd && world.los(q.x, q.y, t.x, t.y)) {
        bd = d;
        best = t;
      }
    }
    q.prey = best;
  }
  if (!alive(q.prey)) return;
  const spd = Math.hypot(q.vx, q.vy),
    cur = Math.atan2(q.vy, q.vx),
    want = Math.atan2(q.prey.y - q.y, q.prey.x - q.x),
    turn = q.def.homing * dt,
    ang = cur + clamp(wrapAngle(want - cur), -turn, turn);
  q.vx = Math.cos(ang) * spd;
  q.vy = Math.sin(ang) * spd;
}
