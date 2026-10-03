import "./content/index.js";
import { VW, VH, MAX_ZOOM } from "./config.js";
import { Boot } from "./scenes/Boot.js";
import { Title } from "./scenes/Title.js";
import { Game } from "./scenes/Game.js";
import { UI } from "./scenes/UI.js";
import { Ending } from "./scenes/Ending.js";

for (const C of Object.values(Phaser.GameObjects))
  if (C?.prototype?.setDepth)
    C.prototype.setDepth = function (value = 0) {
      if (this._depth !== value) this.depth = value;
      return this;
    };

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  width: VW,
  height: VH,
  backgroundColor: "#000000",
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  input: { activePointers: 3 },
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [Boot, Title, Game, UI, Ending],
});

function fit() {
  const s = Math.floor(Math.min(window.innerWidth, window.innerHeight) / VH);
  game.scale.setZoom(Math.max(1, Math.min(MAX_ZOOM, s)));
}

window.addEventListener("resize", fit);
game.events.once("ready", fit);
window.game = game;

if (globalThis.DEBUG_PANEL !== false) import("./debug/panel.js").catch((e) => console.warn("debug panel failed to load:", e));
