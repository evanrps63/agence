// La fabrication de vidéo : garde-fous du code, puis un vrai rendu MP4 (quelques secondes)
import fs from 'fs';
import os from 'os';
import path from 'path';
import { verifierComposition, rendreVideo } from '../scripts/video.mjs';
import { verifier, bilan, code } from './outils.mjs';

// Sur ce conteneur, le navigateur sans affichage est celui de Playwright ; sur un Mac, Remotion le télécharge tout seul
if (!process.env.AGENCE_NAVIGATEUR_VIDEO && fs.existsSync('/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell')) process.env.AGENCE_NAVIGATEUR_VIDEO = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell';

console.log('Garde-fous du code');
const bon = fs.readFileSync(path.join(code, 'tests', 'fixtures', 'video-exemple.tsx'), 'utf8');
verifier(verifierComposition(bon).ok === true, 'une composition correcte passe');
verifier(/import interdit/.test(verifierComposition(bon.replace("from 'remotion'", "from 'fs'")).erreur || ''), 'un import de fs est refusé');
verifier(/élément interdit/.test(verifierComposition(bon + "\nconst x = fetch('http://exemple.fr')").erreur || ''), 'un appel réseau est refusé');
verifier(/élément interdit/.test(verifierComposition(bon + "\nprocess.exit(1)").erreur || ''), 'l\'accès au processus est refusé');
verifier(/il manque/.test(verifierComposition(bon.replace('export const fps = 30', '')).erreur || ''), 'une composition sans fps est refusée');

console.log('Rendu');
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'test-video-'));
const sortie = path.join(dossier, 'exemple.mp4');
const r = await rendreVideo(path.join(code, 'tests', 'fixtures', 'video-exemple.tsx'), sortie);
verifier(r.ok === true && fs.existsSync(sortie) && fs.statSync(sortie).size > 1000, 'un MP4 est fabriqué à partir de la composition' + (r.erreur ? ' (' + r.erreur + ')' : ''));
verifier(r.ok === true && Math.abs(r.duree - 2) < 0.01, 'la durée est celle de la composition (2 secondes)');
fs.rmSync(dossier, { recursive: true, force: true });
bilan();
