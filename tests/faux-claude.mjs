#!/usr/bin/env node
// Faux Claude Code pour les tests : imite la sortie stream-json de « claude -p ».
// Note chaque appel dans $FAUX_CLAUDE_JOURNAL (une ligne JSON par appel).
import fs from 'fs';

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log('  --agents --agent --tools --allowedTools --disallowedTools --restricted --setting-sources --strict-mcp-config --permission-mode (choices: "dontAsk") --resume');
  process.exit(0);
}
const val = o => { const i = args.indexOf(o); return i >= 0 ? args[i + 1] : null; };
let entree = '';
process.stdin.on('data', d => { entree += d; });
process.stdin.on('end', async () => {
  if (process.env.FAUX_CLAUDE_JOURNAL) fs.appendFileSync(process.env.FAUX_CLAUDE_JOURNAL, JSON.stringify({ args, entree }) + '\n');
  const sortir = m => process.stdout.write(JSON.stringify(m) + '\n');
  const session = val('--resume') || 'session-' + Math.random().toString(16).slice(2, 8);
  const agent = val('--agent');
  const consigne = val('--append-system-prompt') || '';
  const projet = (consigne.match(/Dossier : projets\/([a-z0-9-]+)\//) || [])[1];
  sortir({ type: 'system', subtype: 'init', session_id: session });
  if (entree.includes('LENT')) await new Promise(r => setTimeout(r, 8000));
  const texte = (t, parent = null) => sortir({ type: 'assistant', parent_tool_use_id: parent, session_id: session, message: { content: [{ type: 'text', text: t }] } });
  const outil = (id, name, input, parent = null) => sortir({ type: 'assistant', parent_tool_use_id: parent, session_id: session, message: { content: [{ type: 'tool_use', id, name, input }] } });
  let final;
  if (agent !== 'clientele') {
    final = `Bonjour Evan, ici ${agent}. Verdict : OK`;
  } else if (/je choisis/i.test(entree)) {
    final = `Bien noté. Voici la reco.\n\n<<<FICHIER projets/${projet}/reco.md\n# Recommandation\n\nLe plan **validé**.\nFICHIER>>>`;
  } else {
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
    final = `Voici la reformulation.\n\n<<<CHOIX\n{"question": "Quelle cible ?", "options": [{"titre": "Les 18-25 ans", "detail": "Plus large.", "conseil": true}, {"titre": "Les étudiants", "detail": "Plus précis."}]}\nCHOIX>>>\n\n<<<FICHIER projets/${projet}/insights.md\n# Insights\n\n- Fait : <script>alert(1)</script>\nFICHIER>>>\n\n<<<FICHIER projets/${projet}/../../evil.md\npiège\nFICHIER>>>\n\n<<<FICHIER projets/autre-projet/x.md\npiège\nFICHIER>>>`;
  }
  sortir({ type: 'result', subtype: 'success', is_error: false, result: final, session_id: session, total_cost_usd: 0.0123 });
});
