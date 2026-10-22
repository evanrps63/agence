#!/usr/bin/env node
// Faux Claude Code pour les tests : imite la sortie stream-json de « claude -p ».
// Note chaque appel dans $FAUX_CLAUDE_JOURNAL (une ligne JSON par appel).
// Mots-clés dans le message : LENT (8 s), PIEGES (chemins de fichiers piégés), ACCENTS (très longue ligne accentuée),
// je choisis (suite du circuit, avec un choix mal formé).
import fs from 'fs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  const options = ['--agents', '--agent', '--tools', '--allowedTools', '--disallowedTools', '--setting-sources', '--strict-mcp-config', '--permission-mode (choices: "dontAsk")', '--resume', '--settings'];
  if (!process.env.FAUX_SANS_RESTREINT) options.push('--restricted');
  console.log('  ' + options.join(' '));
  process.exit(0);
}
const val = o => { const i = args.indexOf(o); return i >= 0 ? args[i + 1] : null; };
let entree = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { entree += d; });
process.stdin.on('end', async () => {
  if (process.env.FAUX_CLAUDE_JOURNAL) fs.appendFileSync(process.env.FAUX_CLAUDE_JOURNAL, JSON.stringify({ args, entree }) + '\n');
  const sortir = m => process.stdout.write(JSON.stringify(m) + '\n');
  const session = val('--resume') || 'session-' + Math.random().toString(16).slice(2, 8);
  const agent = val('--agent');
  const consigne = val('--append-system-prompt') || '';
  const projet = (consigne.match(/Dossier : projets\/([a-z0-9-]+)\//) || [])[1];
  sortir({ type: 'system', subtype: 'init', session_id: session });
  if (entree.includes('LENT')) {
    await new Promise(r => setTimeout(r, 8000));
    // Trace de fin : un faux Claude arrêté à temps ne l'écrit jamais
    if (process.env.FAUX_CLAUDE_JOURNAL) fs.appendFileSync(process.env.FAUX_CLAUDE_JOURNAL, JSON.stringify({ fin: 'LENT' }) + '\n');
  }
  const texte = (t, parent = null) => sortir({ type: 'assistant', parent_tool_use_id: parent, session_id: session, message: { content: [{ type: 'text', text: t }] } });
  const outil = (id, name, input, parent = null) => sortir({ type: 'assistant', parent_tool_use_id: parent, session_id: session, message: { content: [{ type: 'tool_use', id, name, input }] } });
  let final;
  if (agent === 'direction-artistique' && entree.includes('Critique du rendu')) {
    // Léa regarde la planche, puis critique
    const planche = (entree.match(/planches contact ([^\s,(]+\.png)/) || [])[1];
    outil('l1', 'Read', { file_path: planche });
    final = `Le titre de couverture manque de force.\n1. Agrandir le titre de la couverture.\nVerdict : À retravailler`;
  } else if (agent === 'digital' && entree.includes('Correction de ton rendu')) {
    const projetC = (entree.match(/projets\/([a-z0-9-]+)\//) || [])[1];
    outil('j1', 'Read', { file_path: 'planche' });
    final = `J'ai agrandi le titre.\n<<<FICHIER projets/${projetC}/presentation.html\n<!doctype html><html lang="fr"><head><title>Reco</title></head><body style="margin:0"><h1 style="font-size:120px">La reco Oasis, version 2</h1><img src="images/test.png" alt="test"><script>document.body.dataset.ok = "1"; fetch("/api/etat").catch(() => {});</script></body></html>\nFICHIER>>>\nVerdict : OK`;
  } else if (agent !== 'clientele') {
    final = `Bonjour Evan, ici ${agent}. Verdict : OK`;
  } else if (entree.includes('SITE')) {
    // Jade rend une présentation HTML directement dans son rapport
    outil('d1', 'Agent', { subagent_type: 'digital', description: 'Mettre la reco en forme', prompt: 'x' });
    const html = '<!doctype html><html lang="fr"><head><title>Reco</title></head><body style="margin:0"><h1>La reco Oasis</h1><img src="images/test.png" alt="test"><img src="https://exemple.invalid/pub.png" alt="pub"><div style="position:absolute;left:1800px;top:40px;white-space:nowrap;font-size:40px">Un titre beaucoup trop long qui déborde</div><script>document.body.dataset.ok = "1"; fetch("/api/etat").catch(() => {});</script></body></html>';
    sortir({ type: 'user', parent_tool_use_id: null, session_id: session, message: { content: [{ type: 'tool_result', tool_use_id: 'd1', content: [{ type: 'text', text: '[Subagent hand-back] The report follows:\n  Voici la présentation.\n  <<<FICHIER projets/' + projet + '/presentation.html\n  ' + html + '\n  FICHIER>>>\n  Verdict : OK\nagentId: d1' }] }] } });
    final = 'Jade a fini la présentation : elle t\'attend au studio.';
  } else if (entree.includes('ACCENTS')) {
    // Une ligne stream-json de plus de 64 Ko : le tube la coupe en plusieurs morceaux, parfois au milieu d'un caractère
    final = 'Début ' + 'é€à'.repeat(40000) + ' fin';
  } else if (entree.includes('PIEGES')) {
    final = `Voici des fichiers.\n\n<<<FICHIER projets/${projet}/../../evil.md\npiège 1\nFICHIER>>>\n\n<<<FICHIER projets/autre-projet/x.md\npiège 2\nFICHIER>>>\n\n<<<FICHIER projets/${projet}/CLAUDE.md\npiège 3\nFICHIER>>>\n\n<<<FICHIER projets/${projet}/claude.md\npiège 4\nFICHIER>>>\n\n<<<FICHIER projets/${projet}/Stratégie.md\n# Ma stratégie précieuse\nFICHIER>>>`;
  } else if (entree.includes('FORMATS')) {
    // Une proposition de chaque format (Word et PDF fabriqués à la validation), plus un format interdit
    final = `Voici les fichiers.\n\n<<<FICHIER projets/${projet}/rapport.docx\n# Rapport\n\nLe **constat** : 3 < 5 & « ça » marche.\n- Une piste\nFICHIER>>>\n\n<<<FICHIER projets/${projet}/fiche.pdf\n<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiche</title></head><body><h1>Fiche Oasis</h1><p>Un paragraphe.</p></body></html>\nFICHIER>>>\n\n<<<FICHIER projets/${projet}/donnees.csv\nCible,Taille\nÉtudiants,12\nFICHIER>>>\n\n<<<FICHIER projets/${projet}/notes.txt\nNotes brutes.\nFICHIER>>>\n\n<<<FICHIER projets/${projet}/macro.exe\npiège\nFICHIER>>>`;
  } else if (/je choisis/i.test(entree)) {
    final = `Bien noté. Voici la reco.\n\n<<<FICHIER projets/${projet}/reco.md\n# Recommandation\n\nLe plan **validé**.\nFICHIER>>>\n\n<<<CHOIX\n{"question": "Le "vrai" goût ?", "options": [{"titre": "A"}, {"titre": "B"}]}\nCHOIX>>>`;
  } else {
    // Un bloc FICHIER écrit AVANT un appel d'agent, dans un message intermédiaire
    texte(`Brief reformulé.\n\n<<<FICHIER projets/${projet}/brief-reformule.md\n# Brief reformulé\nFICHIER>>>`);
    outil('t1', 'Agent', { subagent_type: 'etudes', description: 'Chercher les chiffres du marché', prompt: 'x' });
    outil('t2', 'WebSearch', { query: 'marché des boissons sans alcool France 2025' }, 't1');
    outil('t3', 'Read', { file_path: '/x/projets/brief.md' }, 't1');
    // Comme le vrai : la notification de fin arrive avant le rapport, pour un agent au premier plan
    sortir({ type: 'system', subtype: 'task_notification', task_id: 'abc', tool_use_id: 't1', status: 'completed', summary: 'résumé' });
    sortir({ type: 'user', parent_tool_use_id: null, session_id: session, message: { content: [{ type: 'tool_result', tool_use_id: 't1', content: [{ type: 'text', text: '[Subagent hand-back] Cadre. The report follows:\n  ## Marché\n  **Fait** : à vérifier.\n  Verdict : OK\nagentId: abc\n<usage>x</usage>' }] }] } });
    texte('Inès a fini.');
    outil('t4', 'Agent', { subagent_type: 'jury', description: 'Relire', prompt: 'x', run_in_background: true });
    sortir({ type: 'user', parent_tool_use_id: null, session_id: session, message: { content: [{ type: 'tool_result', tool_use_id: 't4', content: [{ type: 'text', text: 'Async agent launched successfully. (internal)\nagentId: zz' }] }] } });
    texte('Note 14 sur 20 : la cible est claire.', 't4');
    sortir({ type: 'system', subtype: 'task_notification', task_id: 'zz', tool_use_id: 't4', status: 'completed', summary: 'résumé court' });
    // Le choix entouré de guillemets de code, comme le font parfois les modèles
    final = `Voici la reformulation.\n\n<<<CHOIX\n\`\`\`json\n{"question": "Quelle cible ?", "options": [{"titre": "Les 18-25 ans", "detail": "Plus large.", "conseil": true}, {"titre": "Les étudiants", "detail": "Plus précis."}]}\n\`\`\`\nCHOIX>>>\n\n<<<FICHIER projets/${projet}/insights.md\n# Insights\n\n- Fait : <script>alert(1)</script>\n- Lien : [piège](https://a.fr/(https://b.fr/style=color:red;)\nFICHIER>>>`;
  }
  // Le vrai Claude envoie le dernier texte comme message, puis le répète dans « result »
  texte(final);
  sortir({ type: 'result', subtype: 'success', is_error: false, result: final, session_id: session, total_cost_usd: 0.0123 });
});
