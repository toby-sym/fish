# Aquarium Wallpaper

A small, low-poly freshwater ecosystem for Lively Wallpaper. Fish are individual TypeScript objects rendered from procedural Three.js geometry. Species profiles provide the starting shape, colour, water needs, and compatibility group; seeded traits vary the appearance of each fish.

## What is in this skeleton

- A procedural 3D tank with fish, plants, a snail, shrimp, pebbles, and bubbles.
- An on-demand care panel to select, name, feed, add, and remove fish; add and remove plants and invertebrates; and review or refresh the water chemistry.
- Manual breeding for healthy adult fish from the same authored compatibility group. The starter group includes guppies and Endler's livebearers, with platies and swordtails defined for later additions.
- A starter ecosystem simulation for waste, filtration, plant uptake, oxygen, hunger, and fish health. The coefficients are placeholders for future balancing.
- Versioned IndexedDB saves for the tank and its organisms.

## Local development

Requires Node.js 22.12 or newer and pnpm 11.25.0.

```powershell
pnpm install
pnpm dev
```

Quality and packaging commands:

```powershell
pnpm lint
pnpm test:run
pnpm build
pnpm package
```

`pnpm package` builds the site and writes `release/aquarium-wallpaper.zip`. The ZIP contains the built page, its local assets, and `LivelyInfo.json`; it does not need a network connection at runtime.

## Import into Lively

1. Build the ZIP with `pnpm package`.
2. Drag `release/aquarium-wallpaper.zip` into the Lively window to import it.
3. Set the wallpaper from the Lively library. The wallpaper is authored for Lively's WebView2 web player and uses `--pause-event true` to stop its own render loop when Lively pauses playback.
4. Open **Settings → Wallpaper → Web Browser → Engine** and select **WebView2** if Lively is using another web engine. Current Lively builds include the WebView2 runtime on Windows; some older installer builds may require the WebView2 player plugin.

The application saves through IndexedDB. WebView2 is the supported host for persistence; CEF may discard browser storage when it closes. On a first run, the wallpaper starts with a seeded tank if no compatible save is present. Closing or pausing the wallpaper does not advance the simulation clock.

## CI

GitHub Actions runs separate lint, unit-test, and production-package jobs for pull requests into `main`, pushes to `main` and the `capability/`, `story/`, or `defect/` branch families, and manual runs. A successful build job uploads the Lively ZIP as an artifact for 14 days. The workflow follows Atlas's practice of isolating quality checks into distinct jobs, adapted to this project's pnpm and Vite toolchain.

## Project layout

```text
src/
  data/        species, plant, and invertebrate profiles; seeded starter tank
  domain/      organism classes, tank, breeding, and ecosystem rules
  rendering/   Three.js scene and procedural low-poly meshes
  storage/     versioned IndexedDB repository
  main.ts      wallpaper lifecycle and control-panel wiring
scripts/       Lively ZIP packaging
.github/       GitHub Actions workflow
```

## Current limitations

This is an architectural skeleton, not a balanced aquarium simulator. The chemistry and health rules are intentionally simple, plant care and fish mortality are not modelled, and breeding is a manual one-click action that creates a single juvenile. The UI has no detailed inventory or settings system yet. Lively import and IndexedDB persistence still need a smoke check in the packaged WebView2 wallpaper runtime.
