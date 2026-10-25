import { readFile, unlink, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

const distribution = resolve(process.cwd(), "dist");
const htmlPath = resolve(distribution, "index.html");
let html = await readFile(htmlPath, "utf8");

function resolveAsset(assetUrl) {
  const assetPath = resolve(distribution, assetUrl.replace(/^\.\//, ""));
  if (assetPath !== distribution && !assetPath.startsWith(`${distribution}${sep}`)) {
    throw new Error(`Wallpaper asset points outside dist/: ${assetUrl}`);
  }
  return assetPath;
}

const scriptTag = html.match(/<script\b([^>]*\bsrc="([^"]+)"[^>]*)>\s*<\/script>/i);
if (!scriptTag || !/\btype="module"/i.test(scriptTag[1])) {
  throw new Error("Could not find the Vite module script in dist/index.html.");
}
const scriptContent = await readFile(resolveAsset(scriptTag[2]), "utf8");
const inlineScript = `<script type="module">${scriptContent.replace(/<\/script/gi, "<\\/script")}</script>`;
html = html.replace(scriptTag[0], () => inlineScript);

const stylesheetTag = html.match(/<link\b([^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*)\s*\/?>/i);
if (!stylesheetTag) throw new Error("Could not find the Vite stylesheet in dist/index.html.");
const stylesheet = await readFile(resolveAsset(stylesheetTag[2]), "utf8");
const inlineStyle = `<style>${stylesheet.replace(/<\/style/gi, "<\\/style")}</style>`;
html = html.replace(stylesheetTag[0], () => inlineStyle);

if (/<script\b[^>]*\bsrc="|<link\b[^>]*\bhref="/i.test(html)) {
  throw new Error("Some built assets remain external; Lively file wallpapers must be self-contained.");
}

await writeFile(htmlPath, html);
await Promise.all([unlink(resolveAsset(scriptTag[2])), unlink(resolveAsset(stylesheetTag[2]))]);
console.log(`Inlined local assets into ${htmlPath}.`);
