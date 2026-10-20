// Outils communs aux tests : une agence de test dans un dossier temporaire, avec le faux Claude
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

export const code = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let erreurs = 0;
export function verifier(condition, message) {
  if (condition) console.log('  ok  ' + message);
  else { erreurs++; console.log('  ÉCHEC  ' + message); }
}
export function bilan() {
  console.log(erreurs ? `${erreurs} erreur(s)` : 'aucune erreur');
  process.exit(erreurs ? 1 : 0);
}
export const attendre = ms => new Promise(r => setTimeout(r, ms));

export async function demarrer() {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'agence-test-'));
  fs.cpSync(path.join(code, '.claude', 'agents'), path.join(racine, '.claude', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'projets'));
  const journal = path.join(racine, 'journal.jsonl');
  const port = 4400 + Math.floor(Math.random() * 500);
  const p = spawn(process.execPath, [path.join(code, 'scripts', 'agence.mjs')], {
    env: { ...process.env, AGENCE_RACINE: racine, AGENCE_PORT: String(port), AGENCE_SANS_NAVIGATEUR: '1', CLAUDE_BIN: path.join(code, 'tests', 'faux-claude.mjs'), FAUX_CLAUDE_JOURNAL: journal },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let sortie = '';
  const adresse = await new Promise((ok, ko) => {
    const t = setTimeout(() => ko(new Error('le serveur ne démarre pas : ' + sortie)), 15000);
    p.stdout.on('data', d => { sortie += d; const m = sortie.match(/http:\/\/127\.0\.0\.1:\d+\/#jeton=([0-9a-f]+)/); if (m) { clearTimeout(t); ok(m[0]); } });
    p.stderr.on('data', d => { sortie += d; });
  });
  const jeton = adresse.split('#jeton=')[1];
  const base = `http://127.0.0.1:${port}`;
  const api = async (chemin, corps, entetes = {}) => {
    const r = await fetch(base + chemin, corps === undefined ? { headers: { 'X-Jeton': jeton, ...entetes } }
      : { method: 'POST', headers: { 'X-Jeton': jeton, 'Content-Type': 'application/json', ...entetes }, body: JSON.stringify(corps) });
    let json = null; try { json = await r.json(); } catch {}
    return { statut: r.status, json };
  };
  const auRepos = async (fil, max = 15000) => {
    const debut = Date.now();
    while (Date.now() - debut < max) {
      const { json } = await api('/api/etat');
      if (!json.enCours.includes(fil)) return json;
      await attendre(100);
    }
    throw new Error('toujours en cours : ' + fil);
  };
  const journalLu = () => { try { return fs.readFileSync(journal, 'utf8').trim().split('\n').map(l => JSON.parse(l)); } catch { return []; } };
  return { racine, port, jeton, adresse, base, api, auRepos, journalLu, sortie: () => sortie, arreter: () => { p.kill(); fs.rmSync(racine, { recursive: true, force: true }); } };
}
