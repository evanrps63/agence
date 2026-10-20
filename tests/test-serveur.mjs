// Le serveur de l'agence : protections, brief, travail des agents, choix, validation des fichiers
import fs from 'fs';
import path from 'path';
import http from 'http';
import { demarrer, verifier, bilan, attendre } from './outils.mjs';

const a = await demarrer();
const { api, base } = a;
try {
  console.log('Protections');
  const brut = (chemin, entetes = {}) => new Promise(ok => {
    const req = http.request({ host: '127.0.0.1', port: a.port, path: chemin, headers: entetes }, r => { r.resume(); ok(r.statusCode); });
    req.end();
  });
  verifier(await brut('/api/etat', { Host: 'exemple.com', 'X-Jeton': a.jeton }) === 403, 'un autre nom d\'hôte est refusé');
  verifier((await api('/api/etat', undefined, { Origin: 'http://pirate.example' })).statut === 403, 'une autre origine est refusée');
  verifier((await fetch(base + '/api/etat')).status === 403, 'sans jeton : refusé');
  verifier((await fetch(base + '/api/etat', { headers: { 'X-Jeton': 'x'.repeat(48) } })).status === 403, 'mauvais jeton : refusé');
  const page = await fetch(base + '/');
  verifier(page.status === 200 && /default-src 'self'/.test(page.headers.get('content-security-policy')), 'la page est servie avec ses protections');
  verifier(!(await page.text()).includes(a.jeton), 'le jeton n\'est jamais dans la page');
  verifier((await fetch(base + '/../package.json')).status === 404, 'aucun autre fichier n\'est servi');
  verifier(a.sortie().includes('127.0.0.1') && !a.sortie().includes('0.0.0.0'), 'écoute seulement 127.0.0.1');

  console.log('État');
  const etat = (await api('/api/etat')).json;
  verifier(etat.equipe.length === 8, '8 agents dans l\'équipe');
  verifier(etat.equipe.find(e => e.id === 'planning').prenom === 'Max', 'le prénom vient de la fiche de l\'agent');
  verifier(etat.pret === true, 'Claude Code reconnu');

  console.log('Nouveau brief');
  verifier((await api('/api/brief', { nom: '', type: 'cours', texte: 'x' })).statut === 400, 'un brief sans nom est refusé');
  verifier((await api('/api/brief', { nom: 'X', type: 'pirate', texte: 'x' })).statut === 400, 'un type inconnu est refusé');
  const r = await api('/api/brief', { nom: 'Oasis été 2027', type: 'cours', texte: 'Faire une reco pour Oasis. Rendu le 12 décembre.' });
  verifier(r.statut === 202 && r.json.projet === 'oasis-ete-2027', 'le projet est créé avec un nom de dossier propre');
  const dossier = path.join(a.racine, 'projets', 'oasis-ete-2027');
  verifier(fs.readFileSync(path.join(dossier, 'brief.md'), 'utf8').includes('Rendu le 12 décembre'), 'brief.md contient le texte d\'Evan');
  verifier(JSON.parse(fs.readFileSync(path.join(dossier, 'projet.json'), 'utf8')).type === 'cours', 'projet.json garde le type');
  verifier((await api('/api/brief', { nom: 'Oasis été 2027', type: 'cours', texte: 'x' })).statut === 409, 'deux projets du même nom : refusé');

  const fil = 'agence:oasis-ete-2027';
  const fin = await a.auRepos(fil);
  const msgs = fin.fils[fil].messages;
  const appel = a.journalLu()[0].args;
  const val = o => appel[appel.indexOf(o) + 1];
  console.log('Lancement de Claude Code');
  verifier(val('--agent') === 'clientele', 'Claire pilote l\'agence');
  verifier(appel.includes('--restricted') && appel.includes('--strict-mcp-config'), 'mode restreint, sans serveurs MCP');
  verifier(val('--permission-mode') === 'dontAsk', 'aucune demande de permission en arrière-plan');
  const outils = val('--tools').split(',');
  verifier(!outils.some(o => ['Bash', 'Edit', 'Write', 'NotebookEdit'].includes(o)), 'aucun outil d\'écriture ni de commande');
  verifier(outils.includes('Agent') && outils.includes('WebSearch'), 'Claire peut appeler les agents, la recherche web est permise');
  verifier(/Bash/.test(val('--disallowedTools')) && /Write/.test(val('--disallowedTools')), 'Bash et Write explicitement interdits');
  const defs = JSON.parse(val('--agents'));
  verifier(Object.keys(defs).length === 8 && !defs.redaction.tools.includes('WebSearch'), 'chaque agent garde ses outils');
  verifier(/projet de COURS/.test(val('--append-system-prompt')), 'la règle des projets de cours est transmise');

  console.log('Ce qui sort');
  verifier(msgs[0].de === 'evan' && msgs[0].texte.includes('Oasis'), 'le brief apparaît dans le chat');
  verifier(msgs.some(m => m.de === 'etape' && m.agent === 'etudes' && /Claire passe le dossier à Inès/.test(m.texte)), 'étape : Claire passe le dossier à Inès');
  verifier(msgs.some(m => m.de === 'etape' && /Inès cherche sur le web « marché des boissons/.test(m.texte)), 'étape : Inès cherche sur le web');
  const prop = msgs.find(m => m.de === 'proposition');
  verifier(msgs.filter(m => m.de === 'proposition' && m.agent === 'etudes').length === 1, 'chaque rapport ne s\'affiche qu\'une fois');
  verifier(prop && prop.agent === 'etudes' && prop.texte.startsWith('## Marché') && !prop.texte.includes('agentId'), 'la proposition d\'Inès arrive, nettoyée');
  verifier(!msgs.some(m => /Async agent launched/.test(m.texte || '')), 'le message technique d\'un agent en arrière-plan n\'est pas affiché');
  const pj = msgs.find(m => m.de === 'proposition' && m.agent === 'jury');
  verifier(pj && pj.texte === 'Note 14 sur 20 : la cible est claire.', 'le rapport d\'un agent en arrière-plan arrive quand il a fini');
  verifier(/premier plan/.test(val('--append-system-prompt')), 'Claire attend le rapport de chaque agent');
  const rep = msgs.find(m => m.de === 'agent');
  verifier(rep && rep.texte === 'Voici la reformulation.', 'la réponse de Claire, sans les blocs spéciaux');
  const choix = msgs.find(m => m.de === 'choix');
  verifier(choix && choix.options.length === 2 && choix.options[0].conseil, 'le choix arrive avec la recommandation');
  const fichiers = msgs.filter(m => m.de === 'fichier');
  verifier(fichiers.length === 1 && fichiers[0].chemin === 'projets/oasis-ete-2027/insights.md', 'seul le fichier du projet est proposé');
  verifier(msgs.filter(m => m.alerte).length === 2, 'les deux chemins piégés sont refusés et signalés');
  verifier(!fs.existsSync(path.join(dossier, 'insights.md')), 'rien n\'est écrit avant le clic');
  verifier(!fs.existsSync(path.join(a.racine, 'evil.md')), 'rien n\'est écrit hors du projet');

  console.log('Validation au studio');
  verifier((await api('/api/fichier', { fil, id: fichiers[0].id, decision: 'peutetre' })).statut === 400, 'une décision inconnue est refusée');
  verifier((await api('/api/fichier', { fil, id: fichiers[0].id, decision: 'valider' })).statut === 200, 'Evan valide le fichier');
  verifier(fs.readFileSync(path.join(dossier, 'insights.md'), 'utf8').startsWith('# Insights'), 'insights.md est écrit');
  verifier((await api('/api/fichier', { fil, id: fichiers[0].id, decision: 'refuser' })).statut === 400, 'on ne décide pas deux fois');
  verifier((await api('/api/fichier?projet=oasis-ete-2027&nom=insights.md')).json.contenu.includes('Insights'), 'le dossier du projet se relit');
  verifier((await api('/api/fichier?projet=oasis-ete-2027&nom=..%2F..%2Fjournal.jsonl')).statut === 400, 'pas de lecture hors du projet');

  console.log('Choix');
  verifier((await api('/api/choisir', { fil, id: choix.id, option: 9 })).statut === 400, 'une option inconnue est refusée');
  verifier((await api('/api/choisir', { fil, id: choix.id, option: 1, precision: 'surtout en BTS' })).statut === 202, 'Evan clique sur une option');
  verifier((await api('/api/choisir', { fil, id: choix.id, option: 0 })).statut >= 400, 'on ne choisit pas deux fois');
  const apres = (await a.auRepos(fil)).fils[fil].messages;
  const second = a.journalLu()[1];
  verifier(second.entree.includes('je choisis : Les étudiants') && second.entree.includes('surtout en BTS'), 'le choix et la précision partent à l\'agence');
  verifier(second.entree.includes('insights.md validé'), 'l\'agence apprend ce qu\'Evan a validé au studio');
  verifier(second.args.includes('--resume'), 'la conversation reprend là où elle était');
  const reco = apres.filter(m => m.de === 'fichier').pop();
  verifier(reco.chemin.endsWith('reco.md'), 'la reco est proposée');
  verifier((await api('/api/fichier', { fil, id: reco.id, decision: 'refuser' })).statut === 200 && !fs.existsSync(path.join(dossier, 'reco.md')), 'refuser n\'écrit rien');

  console.log('Message direct à un agent');
  verifier((await api('/api/message', { fil: 'inconnu', texte: 'x' })).statut === 400, 'un agent inconnu est refusé');
  verifier((await api('/api/message', { fil: 'jury', texte: '/commande' })).statut === 400, 'les commandes en / sont refusées');
  verifier((await api('/api/message', { fil: 'jury', texte: 'Relis mon plan' })).statut === 202, 'Evan écrit au Jury');
  const j = (await a.auRepos('jury')).fils.jury.messages;
  verifier(j[1] && j[1].texte.includes('ici jury'), 'le Jury répond');
  const argsJury = a.journalLu().pop().args;
  verifier(argsJury[argsJury.indexOf('--agent') + 1] === 'jury' && !argsJury[argsJury.indexOf('--tools') + 1].includes('Agent'), 'un agent seul ne peut pas en appeler d\'autres');

  console.log('Arrêter');
  await api('/api/message', { fil: 'media', texte: 'LENT' });
  await attendre(400);
  verifier((await api('/api/message', { fil: 'media', texte: 'encore' })).statut === 409, 'un seul travail à la fois par fil');
  await api('/api/arreter', { fil: 'media' });
  const m = (await a.auRepos('media', 5000)).fils.media.messages.pop();
  verifier(m.erreur && /Arrêté à ta demande/.test(m.texte), 'Arrêter coupe le travail');

  console.log('GitHub');
  verifier((await api('/api/github', { fil })).statut === 400, 'sans dépôt relié : refusé proprement');
  verifier(fs.existsSync(path.join(a.racine, '.claude', 'agence', 'conversations.json')), 'les conversations sont gardées sur le Mac');
} catch (e) {
  verifier(false, 'exception : ' + e.stack);
} finally {
  a.arreter();
}
bilan();
