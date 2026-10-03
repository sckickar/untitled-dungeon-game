import { SPRITE_KEYS, UI_SPRITE_KEYS, WEAPON_SPRITE_KEYS, PROJECTILE_SPRITES, BOSS_SPRITES } from '../view/assets/manifest.js';
import { SHEETS } from '../view/assets/sheets.js';
import { buildFonts } from '../view/assets/fonts.js';
import { buildAnimations } from '../view/assets/animations.js';
import { buildManual } from '../view/assets/manual.js';
import { PAPERDOLL_SHEETS } from '../view/assets/paperdoll.js';
import { defs } from '../sim/defs.js';
import { BIOME_SPRITES } from '../content/biomes.js';
import { VW, VH } from '../config.js';

const BAR = { x: 8, y: 18, w: 44, h: 3 };

export class Boot extends Phaser.Scene {
  constructor() {
    super({ key: 'boot', pack: { files: [{ type: 'image', key: 'loading', url: 'assets/loading.png' }] } });
  }
  preload() {
    this.drawLoader();
    this.load.image('fontsrc', 'assets/better_small_font.png');
    for (const [key, { size: [frameWidth, frameHeight] }] of Object.entries(SHEETS))
      this.load.spritesheet(key, `assets/sheets/${key}.png`, { frameWidth, frameHeight });
    for (const key of Object.values(PAPERDOLL_SHEETS)) this.load.image(key, `assets/sheets/${key}.png`);
    for (const key of SPRITE_KEYS) this.load.image(key, `assets/sprites/${key}.png`);
    for (const key of UI_SPRITE_KEYS) this.load.image(key, `assets/${key}.png`);
    for (const b of Object.values(defs.biomes))
      if (!b.tiles)
        for (const name of BIOME_SPRITES) this.load.image(`${b.id}/${name}`, `assets/sprites/biomes/${b.id}/${name}.png`);
    for (const [key, { dir, frame }] of Object.entries(BOSS_SPRITES)) {
      const url = `assets/sprites/bosses/${dir}/${key}.png`;
      if (frame) this.load.spritesheet(key, url, { frameWidth: frame[0], frameHeight: frame[1] });
      else this.load.image(key, url);
    }
    for (const key of WEAPON_SPRITE_KEYS) this.load.image(key, `assets/sprites/weapons/${key}.png`);
    for (const key of PROJECTILE_SPRITES) this.load.image(key, `assets/sprites/${key}.png`);
    this.load.on('loaderror', f => console.error('Missing asset:', f.src));
  }
  drawLoader() {
    const img = this.add.image(Math.floor(VW / 2), Math.floor(VH / 2), 'loading');
    const ox = img.x - Math.floor(img.width / 2) + BAR.x, oy = img.y - Math.floor(img.height / 2) + BAR.y;
    const g = this.add.graphics();
    const draw = (p) => {
      const w = Math.round(BAR.w * p);
      g.clear();
      if (!w) return;
      const c = Phaser.Display.Color.HSVToRGB(p / 3, 0.85, 0.9);
      const shade = (k) => Phaser.Display.Color.GetColor(c.r * k, c.g * k, c.b * k);
      g.fillStyle(shade(1)).fillRect(ox, oy, w, BAR.h);
      g.fillStyle(Phaser.Display.Color.GetColor(Math.min(255, c.r + 70), Math.min(255, c.g + 70), Math.min(255, c.b + 70))).fillRect(ox, oy, w, 1);
      g.fillStyle(shade(0.6)).fillRect(ox, oy + BAR.h - 1, w, 1);
    };
    draw(0);
    this.load.on('progress', draw);
  }
  create() {
    buildFonts(this);
    buildAnimations(this);
    buildManual(this);
    this.scene.start('title');
  }
}
