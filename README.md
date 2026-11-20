# gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/PrivatePope/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/PrivatePope/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Solmar Bay** — a complete open-world crime game in the spirit of GTA 6, built for the [Make GTA 6 bounty](https://make.fun/bounty/gta6-01) on make.fun.

Jax Carter is back in Solmar Bay after three years — and he owes loan shark Vic Marlowe $50,000. Fixer Lena Cruz feeds him jobs: drive, fight, and work the debt down, job by job, until the city is his again.

## What it is

- **An open world** — a sun-soaked coastal city of avenues, streets, a park, a beach and a marina, explored on foot and by car, with traffic that drives the grid and pedestrians who walk the sidewalks and run from trouble.
- **Cars to steal and drive** — walk up to any car and press E. Parked cars are free; stealing one with a driver brings the heat. Five models, from taxis to the Comet GT sports car, with arcade driving, drifting and crashes.
- **A wanted level and police who respond** — one to five stars. Police cars chase and ram; foot cops chase and try to arrest you. Lose them by breaking line of sight, or pay Sunshine Spray $500 for a respray and a clean slate.
- **Combat** — fists, pistol, SMG and shotgun, bought at Ironworks Arms; enemies who shoot back; health and body armour.
- **Six story missions** — with dialogue, objectives, markers and rewards: a dockside run, a getaway, a warehouse shootout, a grand theft, and the final settling of the debt.
- **Side work** — taxi fares (drive a cab, press H, beat the clock), twenty hidden Sunset Postcards ($150 each), and a rank that climbs from Small Timer to King of Solmar.
- **HUD with a minimap** — wanted stars, cash, health and armour, weapon and ammo, speed, the current objective, and a live minimap with the mission marker, police blips and the next job.
- **Start screen and save** — the game saves itself as you play (missions, fares, finds, purchases) and continues where you left off. All sound is synthesised in the browser: engine, sirens, gunshots, chimes — no audio files, no network.

## Run it

Any static server rooted at `game/` works, for example:

```sh
cd game && python3 -m http.server 8080
```

Then open http://localhost:8080. No network needed — the game fetches nothing.

## Controls

| Keys | Action |
| --- | --- |
| WASD / Arrows | Move on foot, drive the car |
| Shift | Run |
| E | Interact — enter or steal a car, talk, use a shop |
| Mouse | Aim, click to shoot |
| 1–4 | Weapons (fists, pistol, SMG, shotgun) |
| H | Taxi fare (while driving a taxi) / honk |
| P / Esc | Pause |
| M | Sound on/off |

## Structure

The game is plain ES modules under `game/src/`, one clear job per file:

- `config.js` — every tuning number and colour
- `random.js` — the seeded RNG (same seed, same city)
- `input.js` — keyboard and mouse
- `audio.js` — synthesised sound (WebAudio, no files)
- `city.js` — the city: streets, blocks, buildings, beach, marina, shops
- `vehicles.js` — driving, traffic AI, police pursuit, parked cars
- `people.js` — pedestrians, enemies, foot police
- `combat.js` — weapons, bullets, damage
- `missions.js` — the six story missions and their steps
- `activities.js` — taxi fares, postcards, shops
- `world.js` — the game state and the one step function
- `render.js` — drawing the world
- `hud.js` — the HUD, minimap, dialogue, menus
- `save.js` — saving to localStorage
- `shots.js` — the four screenshot scenes
- `main.js` — boot and the game loop

`main.ts` at the root hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored make.fun library. Run it with `MAKEFUN_OUTPUT_DIR=out node main.ts`.

## Screenshots

The four screenshots in `screenshots/` are real renders of the game's own code in a headless browser, staged by `game/src/shots.js` (`?shot=chase|street|mission|night&seed=1`): the police chase at dusk (cover), a busy avenue on foot, the marina shootout, and a night taxi fare.

---

<sub>Entered on [make.fun](https://make.fun/?ref=isaiah-jeffery&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
