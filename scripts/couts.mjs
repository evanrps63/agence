// Le coût de l'agence, projet par projet et agent par agent, depuis les conversations de l'agence.
// Usage : npm run couts   (ou node scripts/couts.mjs <fichier conversations.json>)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const code = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const FICHIER = path.join(code, '.claude', 'agence', 'conversations.json');

// Résume les conversations : { projets: [{ fil, total, agents: [{ agent, total }] }], total }
export function resumerCouts(conversations) {
  const projets = [];
  for (const [fil, c] of Object.entries(conversations || {})) {
    if (!fil.startsWith('agence:') || fil === 'agence:-') continue;
    const parAgent = {};
    for (const m of c.messages || []) {
      if (m && m.de === 'agent' && Number(m.cout) > 0) {
        const agent = m.agent || 'inconnu';
        parAgent[agent] = (parAgent[agent] || 0) + Number(m.cout);
      }
    }
    const total = Number(c.cout) || 0;
    const agents = Object.entries(parAgent).map(([agent, t]) => ({ agent, total: t })).sort((a, b) => b.total - a.total);
    projets.push({ fil: fil.slice(7) || '(sans projet)', total, agents });
  }
  projets.sort((a, b) => b.total - a.total);
  return { projets, total: projets.reduce((s, p) => s + p.total, 0) };
}

export function formater(resume) {
  if (!resume.projets.length) return 'Aucun coût enregistré : aucun projet n\'a encore tourné.';
  const lignes = [];
  for (const p of resume.projets) {
    lignes.push(`${p.fil} : ${p.total.toFixed(2)} $`);
    for (const a of p.agents) lignes.push(`    ${a.agent.padEnd(22)} ${a.total.toFixed(2)} $`);
  }
  lignes.push('', `Total : ${resume.total.toFixed(2)} $`);
  return lignes.join('\n');
}

// Lancement direct : affiche le résumé
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fichier = process.argv[2] || FICHIER;
  let conversations = {};
  try { conversations = JSON.parse(fs.readFileSync(fichier, 'utf8')); } catch (e) {
    if (e.code !== 'ENOENT') { console.log('Fichier illisible : ' + fichier); process.exit(1); }
  }
  console.log(formater(resumerCouts(conversations)));
}
