#!/usr/bin/env node
// Garde-fou des sessions lancées par l'agence (hook PreToolUse passé par --settings, appliqué même en mode restreint).
// Claire ne peut appeler que les agents de l'équipe (liste en argument), et jamais dans une copie git (isolation).
// Usage : node garde-agents.mjs clientele,planning,etudes,…  (l'appel de l'outil arrive en JSON sur l'entrée standard)
function refuser(raison) {
  console.log(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: raison } }));
  process.exit(0);
}
let s = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { s += d; });
process.stdin.on('end', () => {
  let e;
  try { e = JSON.parse(s); } catch { refuser('Appel illisible.'); }
  if (!e || typeof e !== 'object') refuser('Appel illisible.');
  if (e.tool_name !== 'Agent' && e.tool_name !== 'Task') process.exit(0);
  const permis = String(process.argv[2] || '').split(',').filter(Boolean);
  const i = e.tool_input && typeof e.tool_input === 'object' ? e.tool_input : {};
  if (i.isolation) refuser("Dans l'agence, un agent travaille toujours dans le dossier, jamais dans une copie git (isolation interdite).");
  if (!permis.includes(i.subagent_type)) refuser(`Seuls les agents de l'équipe peuvent être appelés : ${permis.join(', ')}.`);
  process.exit(0);
});
