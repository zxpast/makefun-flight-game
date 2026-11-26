// Sky Courier: Coral Isles — make.fun best-flight-game entry.
// Runs on Node 22 with the standard library only. It collects the game/ and
// screenshots/ folders that sit next to this file, stages them in the output
// directory, and writes a dossier.json there for the judge to read. The
// dossier comes from the vendored make.fun library, so the sealed scorer can
// reproduce it byte for byte and compare the two.
//
// When run outside the grader container, point MAKEFUN_OUTPUT_DIR at a local
// directory instead of /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

// The directory this file lives in — the entry's own root.
const entryRoot = fileURLToPath(new URL('.', import.meta.url));

// Where the hand-in goes. The grader uses /output; a local run can redirect
// it with MAKEFUN_OUTPUT_DIR.
const handInDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's limits for this bounty (kit's RULES.txt, "The gate").
// Only text_max_bytes changes the dossier's bytes; the rest reject an entry
// the scorer would reject anyway: more than 4 screenshots or one over 256 KiB,
// more than 993 files under game/ or 48 MiB of game files in total, or any
// game/ path over 1000 bytes. game/ shares /output's own 1000-entry cap with
// screenshots/ and dossier.json, so these caps leave headroom for them.
const gateCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// Copy a whole directory tree, creating the destination first if needed.
function stageTree(source: string, destination: string): void {
  mkdirSync(destination, { recursive: true });
  cpSync(source, destination, { recursive: true });
}

// Stage the hand-in, in order: the whole game/ tree, an empty screenshots/
// folder so the output always has one, the repository's screenshots/ when
// they exist, and finally the dossier the library builds from the staged
// output.
function stageHandIn(): void {
  mkdirSync(handInDir, { recursive: true });
  stageTree(join(entryRoot, 'game'), join(handInDir, 'game'));
  mkdirSync(join(handInDir, 'screenshots'), { recursive: true });
  if (existsSync(join(entryRoot, 'screenshots'))) {
    cpSync(join(entryRoot, 'screenshots'), join(handInDir, 'screenshots'), { recursive: true });
  }
  writeFileSync(join(handInDir, 'dossier.json'), buildDossier(handInDir, gateCaps));
}

stageHandIn();
