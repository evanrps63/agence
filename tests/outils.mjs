// Outils communs aux tests : une agence de test dans un dossier temporaire, avec le faux Claude
import fs from 'fs';
import os from 'os';
import net from 'net';
import path from 'path';
import { spawn, spawnSync } from 'child_process';
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
export function git(dossier, ...args) {
  const r = spawnSync('git', args, { cwd: dossier, encoding: 'utf8' });
  return { ok: r.status === 0, sortie: ((r.stdout || '') + (r.stderr || '')).trim() };
}

// options.git : l'agence de test est un dépôt git relié à un dépôt « GitHub » local (un dépôt nu)
// options.env : variables en plus (par exemple FAUX_SANS_RESTREINT)
export async function demarrer(options = {}) {
  const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'agence-test-'));
  fs.cpSync(path.join(code, '.claude', 'agents'), path.join(racine, '.claude', 'agents'), { recursive: true });
  fs.mkdirSync(path.join(racine, 'projets'));
  let distant = null;
  if (options.git) {
    distant = racine + '-distant.git';
    git(os.tmpdir(), 'init', '-q', '--bare', '-b', 'main', distant);
    git(racine, 'init', '-q', '-b', 'main');
    git(racine, 'config', 'user.email', 'test@exemple.fr');
    git(racine, 'config', 'user.name', 'Test');
    fs.writeFileSync(path.join(racine, '.gitignore'), '.claude/agence/\njournal.jsonl\n');
    fs.mkdirSync(path.join(racine, 'scripts'));
    fs.writeFileSync(path.join(racine, 'scripts', 'code.js'), '// code\n');
    git(racine, 'add', '.gitignore', '.claude/agents', 'scripts/code.js');
    git(racine, 'commit', '-q', '-m', 'départ');
    git(racine, 'remote', 'add', 'origin', distant);
    git(racine, 'push', '-q', '-u', 'origin', 'main');
  }
  const journal = path.join(racine, 'journal.jsonl');
  const port = 4400 + Math.floor(Math.random() * 500);
  const p = spawn(process.execPath, [path.join(code, 'scripts', 'agence.mjs')], {
    env: { ...process.env, AGENCE_RACINE: racine, AGENCE_PORT: String(port), AGENCE_SANS_NAVIGATEUR: '1', CLAUDE_BIN: path.join(code, 'tests', 'faux-claude.mjs'), FAUX_CLAUDE_JOURNAL: journal, ...(options.env || {}) },
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
      : { method: 'POST', headers: { 'X-Jeton': jeton, 'Content-Type': 'application/json', ...entetes }, body: typeof corps === 'string' ? corps : JSON.stringify(corps) });
    let json = null; try { json = await r.json(); } catch {}
    return { statut: r.status, json };
  };
  // Requête HTTP écrite à la main, envoyée en plusieurs morceaux (pour couper un caractère, ou envoyer une adresse invalide)
  const brut = (morceaux, pause = 60) => new Promise(ok => {
    const s = net.connect(port, '127.0.0.1');
    let rep = '';
    s.on('data', d => { rep += d; });
    s.on('close', () => ok(rep));
    s.on('error', () => ok(rep));
    (async () => { for (const m of morceaux) { s.write(m); await attendre(pause); } })();
    setTimeout(() => s.destroy(), 3000);
  });
  const vivant = async () => { try { return (await api('/api/etat')).statut === 200; } catch { return false; } };
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
  const appels = () => journalLu().filter(j => j.args);
  return {
    racine, distant, port, jeton, adresse, base, api, brut, vivant, auRepos, journalLu, appels, processus: p, sortie: () => sortie,
    arreter: () => { p.kill(); fs.rmSync(racine, { recursive: true, force: true }); if (distant) fs.rmSync(distant, { recursive: true, force: true }); }
  };
}
