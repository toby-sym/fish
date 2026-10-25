import { ZipArchive } from "archiver";
import { createWriteStream, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = process.cwd();
const distribution = resolve(projectRoot, "dist");
const releaseDirectory = resolve(projectRoot, "release");
const archivePath = resolve(releaseDirectory, "aquarium-wallpaper.zip");

if (!existsSync(resolve(distribution, "index.html")) || !existsSync(resolve(distribution, "LivelyInfo.json"))) {
  throw new Error("Build the wallpaper first; dist/index.html or dist/LivelyInfo.json is missing.");
}

mkdirSync(releaseDirectory, { recursive: true });

const archive = new ZipArchive({ zlib: { level: 9 } });
const output = createWriteStream(archivePath);
const written = new Promise((resolveOutput, rejectOutput) => {
  output.on("close", resolveOutput);
  output.on("error", rejectOutput);
  archive.on("error", rejectOutput);
  archive.on("warning", (error) => {
    if (error.code !== "ENOENT") rejectOutput(error);
  });
});
archive.pipe(output);
archive.directory(distribution, false);
await archive.finalize();
await written;
console.log(`Created ${archivePath} (${archive.pointer()} bytes).`);
