import { defs } from "../sim/defs.js";
import { snapshot } from "../sim/actor.js";
import { damage, kill } from "../sim/combat.js";
import { alive } from "../sim/entity.js";
import { gainXP } from "../sim/progression.js";
import { makeItem } from "../sim/items.js";
import { drop } from "../sim/loot.js";
import { LAIR_DEPTHS } from "../content/bosses/lair.js";
import { spring } from "../sim/burial.js";

const IMGUI = "https://cdn.jsdelivr.net/npm/@mori2003/jsimgui@0.14.0/build/imgui.js";
const TOGGLE = "`";

const { ImGui, ImGuiImplWeb, ImVec2, ImGuiCond } = await import(IMGUI);

const canvas = document.createElement("canvas");
canvas.id = "imgui";
Object.assign(canvas.style, { position: "fixed", inset: "0", width: "100vw", height: "100vh", zIndex: 10, pointerEvents: "none" });
document.body.appendChild(canvas);

ImGuiImplWeb.SetLoadIniSettingsFn(() => localStorage.getItem("debug-imgui") ?? "");
ImGuiImplWeb.SetSaveIniSettingsFn((ini) => localStorage.setItem("debug-imgui", ini));
await ImGuiImplWeb.Init({ canvas, backend: "webgl2" });
const io = ImGui.GetIO(),
  gl = canvas.getContext("webgl2");

window.addEventListener(
  "pointermove",
  (e) => {
    const r = canvas.getBoundingClientRect();
    io.AddMousePosEvent(e.clientX - r.left, e.clientY - r.top);
  },
  true,
);
for (const t of ["keydown", "keyup"]) canvas.addEventListener(t, (e) => io.WantCaptureKeyboard && e.stopPropagation());

let shown = localStorage.getItem("debug-shown") !== "0";
window.addEventListener("keydown", (e) => {
  if (e.key !== TOGGLE) return;
  shown = !shown;
  localStorage.setItem("debug-shown", shown ? "1" : "0");
});

const S = {
  god: [false],
  freeze: [false],
  timeScale: [1],
  paused: [false],
  floor: [1],
  monster: [0],
  count: [1],
  weapon: [0],
  trapChance: [defs.biomes.soul?.traps?.chance ?? 0],
};

const gameScene = () => {
  const s = window.game?.scene.getScene("game");
  return s?.sys.isActive() && s.world?.player ? s : null;
};

function combo(label, items, ref) {
  if (!ImGui.BeginCombo(label, items[ref[0]] ?? "")) return;
  items.forEach((s, i) => {
    if (ImGui.Selectable(s, i === ref[0])) ref[0] = i;
  });
  ImGui.EndCombo();
}

const text = (s) => ImGui.Text(String(s).replace(/%/g, "%%"));
const grey = (s) => ImGui.TextDisabled(String(s).replace(/%/g, "%%"));

function near(world, x, y, d = 1.5) {
  for (let t = 0; t < 24; t++) {
    const a = Math.random() * 6.283,
      px = x + Math.cos(a) * d,
      py = y + Math.sin(a) * d;
    if (!world.solidAt(px, py)) return { x: px, y: py };
  }
  return { x, y };
}

function goToFloor(gs, depth) {
  gs.scene.restart({ depth: Math.max(0, depth), carry: snapshot(gs.world.player) });
}

function runTab(gs) {
  const w = gs.world,
    p = w.player;
  text(`fps ${io.Framerate.toFixed(0)}   floor B${w.depth} (${w.biome})   entities ${w.entities.length}`);
  text(`player ${p.x.toFixed(2)}, ${p.y.toFixed(2)}   time ${w.time.toFixed(1)}s`);
  ImGui.SliderFloat("time scale", S.timeScale, 0.1, 4, "%.2fx");
  ImGui.SameLine();
  ImGui.Checkbox("pause", S.paused);
  gs.timeScale = S.paused[0] ? 0 : S.timeScale[0];

  ImGui.SeparatorText("floors");
  ImGui.InputInt("floor", S.floor);
  ImGui.SameLine();
  if (ImGui.Button("go")) goToFloor(gs, S.floor[0]);
  if (ImGui.Button("next floor")) goToFloor(gs, w.depth + 1);
  for (const d of LAIR_DEPTHS) {
    ImGui.SameLine();
    if (ImGui.Button("B" + d)) goToFloor(gs, d);
  }
  const order = w.run?.bosses;
  text(`lair order: ${order ? order.join(", ") : "not rolled yet"} (nyarl always B${LAIR_DEPTHS[2]})`);
  if (order) {
    ImGui.SameLine();
    if (ImGui.SmallButton("swap")) order.reverse();
  }

  ImGui.SeparatorText("traps");
  const T = defs.biomes.soul?.traps;
  if (T) {
    ImGui.SliderFloat("soul corridor trap chance", S.trapChance, 0, 1, "%.2f");
    ImGui.SetItemTooltip("chance each soul-biome corridor hides rotting corpses; applies to the next floor generated");
    T.chance = S.trapChance[0];
  }
  const traps = w.traps ?? [];
  text(`trapped corridors here: ${traps.length} (${traps.filter((t) => t.sprung).length} sprung, ${traps.reduce((n, t) => n + t.mobs.filter((m) => m.buried).length, 0)} still buried)`);
  if (traps.length) {
    ImGui.SameLine();
    if (ImGui.SmallButton("spring all")) for (const t of traps) spring(w, t);
  }

  ImGui.SeparatorText("world");
  if (ImGui.Button("kill all monsters"))
    for (const m of w.query((e) => e.team === "monster" && alive(e) && e.hp != null && !e.boss)) kill(w, m, { source: p });
  ImGui.SameLine();
  if (ImGui.Button("play ending")) gs.endRun();
}

function playerTab(gs) {
  const w = gs.world,
    p = w.player;
  text(`lv ${p.lv}   hp ${Math.ceil(p.hp)}/${p.maxhp}   mp ${Math.floor(p.mp)}/${p.maxmp}   atk ${p.atk}   gold ${p.gold}`);
  ImGui.Checkbox("god mode", S.god);
  ImGui.SetItemTooltip("can't be hurt");
  if (ImGui.Button("heal")) Object.assign(p, { hp: p.maxhp, mp: p.maxmp, dead: false });
  ImGui.SameLine();
  if (ImGui.Button("level up")) gainXP(w, p, Math.max(1, p.next - p.xp));
  ImGui.SameLine();
  if (ImGui.Button("+100 gold")) p.gold += 100;
  ImGui.SameLine();
  if (ImGui.Button("+5 potions"))
    for (let i = 0; i < 5; i++) {
      drop(w, "potion", p.x, p.y);
      drop(w, "manapotion", p.x, p.y);
    }
  if (w.boss && ImGui.Button("teleport to boss arena")) {
    const c = near(w, w.boss.arena.cx + 0.5, w.boss.arena.cy + 0.5, 3);
    p.x = c.x;
    p.y = c.y;
  }
}

function spawnTab(gs) {
  const w = gs.world,
    p = w.player,
    monsters = Object.values(defs.entities)
      .filter((d) => d.team === "monster" && d.hp && d.look?.renderer === "creature")
      .map((d) => d.id),
    weapons = Object.keys(defs.weapons).filter((k) => !defs.weapons[k].natural);
  combo("monster", monsters, S.monster);
  ImGui.SliderInt("count", S.count, 1, 10);
  if (ImGui.Button("spawn near player"))
    for (let i = 0; i < S.count[0]; i++) {
      const c = near(w, p.x + p.face.x * 2, p.y + p.face.y * 2, 1);
      w.spawn(monsters[S.monster[0]], c.x, c.y);
    }
  ImGui.SeparatorText("items");
  combo("weapon", weapons, S.weapon);
  if (ImGui.Button("drop it")) drop(w, "item", p.x, p.y, makeItem(weapons[S.weapon[0]]));
  ImGui.SameLine();
  if (ImGui.Button("drop a random roll")) drop(w, "item", p.x, p.y);
}

function bossTab(gs) {
  const w = gs.world,
    b = w.boss;
  if (!b) {
    grey(`no boss on this floor (lairs are B${LAIR_DEPTHS.join(", B")})`);
    return;
  }
  text(`${b.def.name}: ${b.state}   pace ${b.pace}x${b.immune > 0 ? "   IMMUNE " + b.immune.toFixed(1) + "s" : ""}`);
  text(b.attack ? `move: ${b.attack.id} (${b.attack.t.toFixed(1)}s)` : `next move in ${Math.max(0, b.cd).toFixed(1)}s`);
  ImGui.Checkbox("freeze ai", S.freeze);
  ImGui.SetItemTooltip("it only does the moves you press below");
  if (b.state === "dormant" && ImGui.Button("wake it")) {
    const c = near(w, b.x + 2.5, b.y + 2.5, 0.5);
    Object.assign(w.player, c);
  }
  if (b.state === "intro" && ImGui.Button("skip intro")) b.stateT = 99;
  if (b.state === "fight") {
    for (const [id, M] of Object.entries(b.def.moves)) {
      if (ImGui.Button(M.name)) {
        b.attack = { id, M, t: 0, ft: 0, fired: false };
        M.start?.(w, b, b.attack);
        w.say(M.name, 1.5);
      }
      ImGui.SameLine();
    }
    ImGui.NewLine();
  }
  ImGui.SeparatorText("parts");
  for (const e of b.parts) {
    if (!alive(e)) continue;
    ImGui.PushID(String(e.id));
    ImGui.ProgressBar(e.hp / e.maxhp, new ImVec2(140, 0), `${Math.ceil(e.hp)}/${e.maxhp}`);
    ImGui.SameLine();
    text((e.name ?? e.def.name) + (e === b.core ? " (core)" : ""));
    ImGui.SameLine();
    if (ImGui.SmallButton("-25%")) damage(w, e, { amount: Math.ceil(e.maxhp / 4), source: w.player });
    ImGui.SameLine();
    if (ImGui.SmallButton("kill")) damage(w, e, { amount: e.hp + 1e6, source: w.player });
    ImGui.PopID();
  }
}

function hoverTab(gs) {
  const m = gs.view.hoverMob;
  if (!m) return grey("hover a creature in the game");
  text(`${m.name ?? m.def.name ?? m.type} (${m.type}, id ${m.id}, team ${m.team})`);
  text(`hp ${Math.ceil(m.hp)}/${m.maxhp}   at ${m.x.toFixed(2)}, ${m.y.toFixed(2)}`);
  if (m.status.size) text("status: " + [...m.status.values()].map((s) => `${s.id} ${s.t.toFixed(1)}s`).join(", "));
  if (m.mem) text(`aggro ${m.mem.aggro}   target ${m.mem.target?.type ?? "-"}`);
  if (m.equip?.main) text(`main: ${m.equip.main.base}`);
}

function frame() {
  requestAnimationFrame(frame);
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  canvas.style.display = shown ? "block" : "none";
  const gs = gameScene();
  if (gs) {
    if (S.god[0]) gs.world.player.invuln = 1;
    const b = gs.world.boss;
    if (S.freeze[0] && b && !b.attack) b.cd = Math.max(b.cd, 1);
  }
  if (!shown) return void (canvas.style.pointerEvents = "none");
  ImGuiImplWeb.BeginRender();
  ImGui.SetNextWindowPos(new ImVec2(10, 10), ImGuiCond.FirstUseEver);
  ImGui.SetNextWindowSize(new ImVec2(420, 300), ImGuiCond.FirstUseEver);
  if (ImGui.Begin("debug  (` to hide)")) {
    if (!gs) grey("start a run to use the panel");
    else if (ImGui.BeginTabBar("tabs")) {
      for (const [name, tab] of [["run", runTab], ["player", playerTab], ["spawn", spawnTab], ["boss", bossTab], ["hover", hoverTab]])
        if (ImGui.BeginTabItem(name)) {
          tab(gs);
          ImGui.EndTabItem();
        }
      ImGui.EndTabBar();
    }
  }
  ImGui.End();
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  ImGuiImplWeb.EndRender();
  canvas.style.pointerEvents = io.WantCaptureMouse ? "auto" : "none";
}
requestAnimationFrame(frame);
