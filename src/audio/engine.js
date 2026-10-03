import { SFX, MUSIC } from "./sounds.js";

const SFX_VOL = 0.8,
  MUSIC_VOL = 0.5,
  MAX_VOICES = 20,
  HEAR = { near: 4, far: 13 },
  PAN = { span: 10, max: 0.6 },
  HOLD = { release: 0.18, attack: 0.05, fade: 0.15 },
  MUTE_KEY = "sd-muted";

let game = null,
  ctx = null,
  bus = null,
  listener = null,
  current = null;
const voices = [],
  lastPlayed = new Map(),
  holds = new Map(),
  tracks = new Map();

const now = () => performance.now() / 1000;
const keyOf = (k) => "sfx:" + k;
const approach = (v, to, step) => (v < to ? Math.min(to, v + step) : Math.max(to, v - step));

export function preloadAudio(scene) {
  for (const [k, S] of Object.entries(SFX)) scene.load.audio(keyOf(k), `assets/sfx/${S.file}`);
}

export function initAudio(g) {
  if (game) return;
  game = g;
  const snd = g.sound;
  ctx = snd.context ?? null;
  if (ctx) {
    bus = ctx.createGain();
    bus.gain.value = MUSIC_VOL;
    bus.connect(snd.destination ?? ctx.destination);
  }
  try {
    snd.mute = localStorage.getItem(MUTE_KEY) === "1";
  } catch {}
  g.events.on("step", (time, delta) => tick(Math.min(delta / 1000, 0.1)));
  const kick = () => {
    if (ctx?.state === "suspended" && !snd.locked) ctx.resume();
    if (current?.el.paused && !current.el.ended && current.target > 0 && !document.hidden) start(current);
  };
  for (const t of ["pointerdown", "keydown", "touchend"]) window.addEventListener(t, kick, true);
  snd.on?.("unlocked", kick);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) current?.el.pause();
    else kick();
  });
  window.addEventListener("keydown", (e) => {
    if (e.key !== "m" && e.key !== "M") return;
    if (e.repeat || /^(INPUT|TEXTAREA)$/.test(e.target?.tagName)) return;
    toggleMute();
  });
}

export function toggleMute() {
  if (!game) return;
  const m = (game.sound.mute = !game.sound.mute);
  if (!ctx) for (const t of tracks.values()) t.el.muted = m;
  try {
    localStorage.setItem(MUTE_KEY, m ? "1" : "0");
  } catch {}
}

// Where the ears are, in world tiles. null = everything plays centred at full volume.
export function setListener(p) {
  listener = p ? { x: p.x, y: p.y } : null;
}

function spatial(at) {
  if (!at || !listener) return { vol: 1, pan: 0 };
  const d = Math.hypot(at.x - listener.x, at.y - listener.y),
    vol = d <= HEAR.near ? 1 : Math.max(0, 1 - (d - HEAR.near) / (HEAR.far - HEAR.near)),
    sx = at.x - at.y - (listener.x - listener.y);
  return { vol: vol * vol, pan: Math.max(-1, Math.min(1, sx / PAN.span)) * PAN.max };
}

const ready = (k) => !!game && !!SFX[k] && game.cache.audio.exists(keyOf(k));
const detune = (S) => (Math.random() * 2 - 1) * S.jitter;

function prune(t) {
  for (let i = voices.length - 1; i >= 0; i--) {
    const v = voices[i];
    if (!v.snd.isPlaying || t - v.t > v.dur + 0.5) {
      voices.splice(i, 1);
      if (!v.snd.pendingRemove) v.snd.destroy();
    }
  }
}

// One-shot. Dropped (not queued) when the same sound fired too recently or is already
// playing `max` times, so bursts collapse into one hit instead of a wall of noise.
export function sfx(k, { at = null, vol = 1, rate = 1, delay = 0 } = {}) {
  if (!ready(k)) return;
  const S = SFX[k],
    g = S.group ?? k,
    t = now();
  if (t - (lastPlayed.get(g) ?? -Infinity) < S.gap) return;
  const sp = spatial(at),
    gain = S.vol * vol * sp.vol * SFX_VOL;
  if (gain < 0.01) return;
  prune(t);
  let mine = 0;
  for (const v of voices) if (v.g === g) mine++;
  if (mine >= S.max || (voices.length >= MAX_VOICES && !S.prio)) return;
  const snd = game.sound.add(keyOf(k));
  snd.once("complete", () => snd.destroy());
  snd.play({ volume: Math.min(1, gain), rate, detune: detune(S), pan: sp.pan, delay });
  voices.push({ g, snd, t, dur: (snd.duration || 1) / rate + delay });
  lastPlayed.set(g, t);
}

// Looping sound kept alive by calling hold() every frame (channelled spells, swarms).
// It fades in on the first call and fades out once the calls stop, so it can't click or pile up.
export function hold(k, id, { at = null, vol = 1, rate = 1 } = {}) {
  if (!ready(k)) return;
  const S = SFX[k],
    sp = spatial(at);
  let h = holds.get(id);
  if (!h) {
    if (sp.vol < 0.02) return;
    const snd = game.sound.add(keyOf(k), { loop: true, volume: 0 });
    snd.play({ loop: true, volume: 0, rate, detune: detune(S) });
    holds.set(id, (h = { snd, cur: 0, peak: S.vol * SFX_VOL }));
  }
  h.target = Math.min(1, S.vol * vol * sp.vol * SFX_VOL);
  h.pan = sp.pan;
  h.until = now() + HOLD.release;
}

export function releaseHolds() {
  for (const h of holds.values()) h.until = 0;
}

function tickHolds(dt) {
  const t = now();
  for (const [id, h] of holds) {
    const want = t < h.until ? h.target : 0;
    h.cur = approach(h.cur, want, (dt * h.peak) / (want > h.cur ? HOLD.attack : HOLD.fade));
    if (want === 0 && h.cur <= 0) {
      h.snd.stop();
      h.snd.destroy();
      holds.delete(id);
      continue;
    }
    h.snd.setVolume(h.cur);
    if (h.snd.pannerNode) h.snd.setPan(h.pan);
  }
}

function track(k) {
  let t = tracks.get(k);
  if (t || !MUSIC[k] || !game) return t ?? null;
  const M = MUSIC[k],
    el = new Audio();
  el.preload = "auto";
  el.loop = M.loop !== false;
  el.src = `assets/music/${M.file}`;
  t = { k, M, el, vol: 0, target: 0, fade: 1, gain: null };
  if (ctx)
    try {
      t.gain = ctx.createGain();
      t.gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(t.gain).connect(bus);
    } catch {
      t.gain = null;
    }
  if (!t.gain) {
    el.volume = 0;
    el.muted = game.sound.mute;
  }
  tracks.set(k, t);
  return t;
}

function start(t) {
  const p = t.el.play();
  if (p?.catch) p.catch(() => {});
}

// Start fetching a track ahead of time so the switch is instant (boss music, sanctum).
export function prefetch(k) {
  track(k);
}

// Crossfade to track `k` (null = silence) over `fade` seconds. Calling again with the
// current track is a no-op, so it is safe to call every frame.
export function music(k, fade = 2) {
  if (!game || (current?.k ?? null) === (k ?? null)) return;
  if (current) {
    current.target = 0;
    current.fade = fade;
  }
  current = k ? track(k) : null;
  if (!current) return;
  if (current.M.restart && current.vol <= 0) current.el.currentTime = 0;
  current.target = 1;
  current.fade = fade;
  if (current.el.paused && !document.hidden) start(current);
}

function tickMusic(dt) {
  for (const t of tracks.values()) {
    if (t.vol === t.target && (t.vol > 0 || t.el.paused)) continue;
    t.vol = approach(t.vol, t.target, dt / Math.max(0.05, t.fade));
    // equal-power curve: two crossing tracks keep a constant loudness instead of dipping mid-fade
    const g = Math.sin((t.vol * Math.PI) / 2);
    if (t.gain) t.gain.gain.setTargetAtTime(g, ctx.currentTime, 0.015);
    else t.el.volume = g;
    if (t.vol <= 0 && t.target <= 0) {
      t.el.pause();
      if (t.M.restart) t.el.currentTime = 0;
    }
  }
}

function tick(dt) {
  tickHolds(dt);
  tickMusic(dt);
}
