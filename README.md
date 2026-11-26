# Sky Courier: Coral Isles

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/zxpast/makefun-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/zxpast/makefun-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A bush-plane flight game for make.fun's **best-flight-game-20261126-0057** bounty. Fly the Coral Courier over a tropical archipelago: thread glowing sky rings, hop between island airstrips, and mind the fuel gauge — the sea is not a runway. Land soft, land on the numbers, and the islands pay you back.

## The game

- **Ring Run** — thread all six sky rings, then put her down on Coral Field.
- **Island Hop** — land at each island airstrip in turn.
- **Free Flight** — the whole archipelago, no timer, no score to chase.
- Cockpit and chase cameras, a live HUD (speed, altitude, heading, compass, minimap, throttle / fuel / hull gauges), autopilot, fuel burn and hull damage, stalls, hard landings and crashes that read as what happened.
- Original art, sounds and names, built on vendored Three.js (`game/vendor/three.min.js`). No network request: every file the game loads lives under `game/`.

## How to run

No build step. Serve `game/` with any static HTTP server and open `index.html` in desktop Chrome, for example:

```sh
cd game
python3 -m http.server 8080
```

Then open http://localhost:8080. (Opening the file directly from disk also works in most browsers, but a local server is the reliable route.)

## Controls

| Keys | Action |
| --- | --- |
| W / S or ↑ / ↓ | Pitch up / down |
| A / D or ← / → | Bank and turn |
| Shift / Ctrl (or R / F) | Throttle up / down |
| G | Landing gear |
| C | Chase / cockpit camera |
| H | Autopilot |
| B or Space | Brake |
| P | Pause |
| M | Next mission |
| R | Restart |
| Mouse drag | Steer |
| Mouse wheel | Throttle |

Take off from Coral Field: full throttle, pull up gently past 60 kt. Gear down, slow and level to land — below 80 kt, sinking gently.

## The entry

`main.ts` at the repository root hands the game in: it copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the kit's vendored library (`vendor/makefun-game.ts`). Outside the grader, `MAKEFUN_OUTPUT_DIR` stands in for `/output`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE).

---

<sub>Entered on [make.fun](https://make.fun/?ref=6hmpy1rq&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
