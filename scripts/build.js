import { build } from "esbuild";
import {
  rmSync,
  mkdirSync,
  cpSync,
  readFileSync,
  writeFileSync,
  statSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

const OUT = "dist";

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  minify: true,
  format: "esm",
  target: "es2020",
  legalComments: "none",
  drop: ["debugger"],
  define: { "globalThis.DEBUG_PANEL": "false" },
  outfile: join(OUT, "game.js"),
});

cpSync("assets", join(OUT, "assets"), {
  recursive: true,
  filter: (src) => !/ - Copy\b/.test(src),
});

const html = readFileSync("index.html", "utf8")
  .replace('src="src/main.js"', 'src="game.js"')
  .replace(
    /<style>([\s\S]*?)<\/style>/,
    (_, css) =>
      `<style>${css
        .replace(/\s+/g, " ")
        .replace(/\s*([{}:;,])\s*/g, "$1")
        .trim()}</style>`,
  )
  .replace(/>\s+</g, "><");
writeFileSync(join(OUT, "index.html"), html);

const size = (p) =>
  statSync(p).isDirectory()
    ? readdirSync(p).reduce((n, f) => n + size(join(p, f)), 0)
    : statSync(p).size;
console.log(
  `dist/ built — game.js ${(size(join(OUT, "game.js")) / 1024).toFixed(1)} KB, total ${(size(OUT) / 1024).toFixed(1)} KB`,
);
