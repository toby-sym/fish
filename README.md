# Aquarium Wallpaper

A full-screen, low-poly freshwater ecosystem for Lively Wallpaper. Fish are individual TypeScript objects rendered from procedural Three.js geometry. Seeded phenotypes vary their body shape, tail shape, colour palette, and markings; waypoint steering lets them explore the available screen area.

## What is in this skeleton

- A full-bleed underwater scene with no visible tank frame, procedural fish, plant beds, a rocky foreground, light shafts, and bubbles.
- Fifteen fish profiles, including guppies, Endler's livebearers, platies, swordtails, mollies, tetras, danios, rasboras, barbs, bettas, corydoras, and angelfish.
- Feeding a fish drops a burst of visible food flakes and steers it toward the food.
- Tetra, danio, rasbora, barb, and corydoras profiles school together, while solitary profiles keep independent routes.
- Six plant forms and four invertebrate profiles, with profile-driven water needs and ecosystem contributions.
- An on-demand care panel to select, name, feed, add, and remove fish; add and remove plants and invertebrates; and review or refresh the water chemistry.
- Manual breeding for healthy adult fish from the same authored compatibility group. Poecilia, Xiphophorus, tetra, and danio profiles each include cross-species pairings.
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
pnpm check
pnpm lint
pnpm test:run
pnpm build
pnpm package
```

`pnpm check` is the one-command local verification used before pushing: it runs lint, domain and rendering tests, and a production build. Tests cover ecosystem rules, authored cross-species breeding, profile and phenotype variety, procedural fish silhouettes, schooling, feeding movement, and seeded viewport swimming. For interactive work, run `pnpm dev` and open the local Vite URL printed in the terminal (normally `http://127.0.0.1:5173`). The **Tank care** drawer is in the upper-right corner. This preview works without Lively; use the ZIP steps below to check the wallpaper host itself.

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

This is an architectural skeleton, not a balanced aquarium simulator. The chemistry and health rules are intentionally simple, plant care and fish mortality are not modelled, and breeding is a manual one-click action that creates a single juvenile. The UI has no detailed inventory or settings system yet. Lively import, pause handling, and IndexedDB persistence still need a smoke check in the packaged WebView2 wallpaper runtime.
