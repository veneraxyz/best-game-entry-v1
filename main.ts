// NOVADRIFT's entry program (Node 22, standard library only).
//
// It hands the game in: it copies this repository's game/ and screenshots/
// to /output and writes /output/dossier.json with the vendored make.fun
// library. Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for
// /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The dossier is byte for byte what buildDossier writes from the copied
// files, so the gate's rebuild matches it exactly.

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The gate's caps, as this competition's gate.json states them. */
const DOSSIER_TEXT_CAP = 163_840;
const SHOTS = { max: 4, max_bytes: 262_144 };
const GAME = { max_files: 993, max_bytes: 50_331_648, path_max_bytes: 1000 };
const DOSSIER_CAP = 1_572_864;

/** Stop with a message on stderr and exit code 1. */
function fail(message: string): never {
  process.stderr.write(`novadrift: ${message}\n`);
  process.exit(1);
}

/** --name <value> out of the arguments, or the fallback. */
function flag(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const joined = process.argv.find((a) => a.startsWith(`--${name}=`));
  return joined === undefined ? fallback : joined.slice(name.length + 3);
}

const outDir = flag('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

/** Copy a directory tree of plain files, refusing symlinks and special files. */
function copyTree(from: string, to: string): string[] {
  if (!existsSync(from)) fail(`no ${from}: the repository must hold game/ and screenshots/`);
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const src = join(from, name);
    const dst = join(to, name);
    const st = statSync(src);
    if (st.isDirectory()) {
      copied.push(...copyTree(src, dst).map((p) => join(name, p)));
    } else if (st.isFile()) {
      copyFileSync(src, dst);
      copied.push(name);
    } else {
      fail(`${src}: a symbolic link or special file — game/ holds plain files only`);
    }
  }
  return copied;
}

const gameFiles = copyTree(join(here, 'game'), join(outDir, 'game'));
const shotFiles = copyTree(join(here, 'screenshots'), join(outDir, 'screenshots'));

if (shotFiles.length < 3 || shotFiles.length > SHOTS.max) {
  fail(`screenshots/ holds ${shotFiles.length} image${shotFiles.length === 1 ? '' : 's'}: hand in 3 or 4`);
}
for (const name of shotFiles) {
  const bytes = statSync(join(outDir, 'screenshots', name)).size;
  if (bytes > SHOTS.max_bytes) {
    fail(`screenshots/${name} is ${bytes} bytes: the gate refuses any image over ${SHOTS.max_bytes}`);
  }
}

const dossier = buildDossier(outDir, {
  text_max_bytes: DOSSIER_TEXT_CAP,
  screenshots: SHOTS,
  game_max_files: GAME.max_files,
  game_max_bytes: GAME.max_bytes,
  game_path_max_bytes: GAME.path_max_bytes,
});
if (dossier.length > DOSSIER_CAP) {
  fail(`dossier.json would be ${dossier.length} bytes, past the ${DOSSIER_CAP}-byte cap`);
}
writeFileSync(join(outDir, 'dossier.json'), dossier);

process.stdout.write(
  `novadrift: copied game/ (${gameFiles.length} files) and screenshots/ (${shotFiles.length} images), ` +
    `wrote ${join(outDir, 'dossier.json')} (${dossier.length} bytes)\n`,
);
