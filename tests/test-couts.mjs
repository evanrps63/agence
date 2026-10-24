// Le suivi des coûts : résumé par projet et par agent, à partir d'un fichier de conversations
import fs from 'fs';
import os from 'os';
import path from 'path';
import { resumerCouts, formater } from '../scripts/couts.mjs';
import { verifier, bilan, code } from './outils.mjs';

console.log('Résumé des coûts');
const conv = {
  'agence:oasis': { cout: 1.5, messages: [
    { de: 'agent', agent: 'planning', cout: 0.9 },
    { de: 'etape', agent: 'planning', texte: 'Max réfléchit' },
    { de: 'agent', agent: 'digital', cout: 0.4 },
    { de: 'agent', agent: 'planning', cout: 0.2 },
  ] },
  'agence:cours': { cout: 0.25, messages: [{ de: 'agent', agent: 'clientele', cout: 0.25 }] },
  'agence:-': { cout: 9, messages: [] },
  'jury': { cout: 3, messages: [] },
};
const r = resumerCouts(conv);
verifier(r.projets.length === 2 && r.projets[0].fil === 'oasis', 'les projets sont classés du plus cher au moins cher, sans le chat libre ni les messages directs');
verifier(Math.abs(r.total - 1.75) < 1e-9, 'le total est la somme des projets');
const oasis = r.projets[0];
verifier(oasis.agents[0].agent === 'planning' && Math.abs(oasis.agents[0].total - 1.1) < 1e-9, 'le coût d\'un agent additionne ses réponses (Max : 1,10 $)');
verifier(/oasis : 1\.50 \$/.test(formater(r)) && /Total : 1\.75 \$/.test(formater(r)), 'l\'affichage donne le coût du projet et le total');
verifier(/Aucun coût/.test(formater(resumerCouts({}))), 'sans conversation, le message le dit clairement');

console.log('Lecture du fichier');
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'test-couts-'));
const f = path.join(dossier, 'conversations.json');
fs.writeFileSync(f, JSON.stringify(conv));
const { execFileSync } = await import('child_process');
const sortie = execFileSync(process.execPath, [path.join(code, 'scripts', 'couts.mjs'), f], { encoding: 'utf8' });
verifier(sortie.includes('oasis : 1.50 $'), 'la commande lit un fichier et affiche le résumé');
fs.rmSync(dossier, { recursive: true, force: true });
bilan();
