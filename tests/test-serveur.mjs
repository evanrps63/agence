// Le serveur de l'agence : protections, brief, travail des agents, choix, validation des fichiers, GitHub
// Chaque piège trouvé par la relecture de sécurité a son test ici.
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawnSync } from 'child_process';
import { demarrer, verifier, bilan, attendre, git, code } from './outils.mjs';

const a = await demarrer();
const { api, base } = a;
const messagesDe = async fil => (await api('/api/etat')).json.fils[fil].messages;
try {
  console.log('Protections');
  const requete = (chemin, entetes = {}) => new Promise(ok => {
    const req = http.request({ host: '127.0.0.1', port: a.port, path: chemin, headers: entetes }, r => { r.resume(); ok(r.statusCode); });
    req.on('error', () => ok(0));
    req.end();
  });
  verifier(await requete('/api/etat', { Host: 'exemple.com', 'X-Jeton': a.jeton }) === 403, 'un autre nom d\'hôte est refusé');
  verifier((await api('/api/etat', undefined, { Origin: 'http://pirate.example' })).statut === 403, 'une autre origine est refusée');
  verifier((await fetch(base + '/api/etat')).status === 403, 'sans jeton : refusé');
  verifier((await fetch(base + '/api/etat', { headers: { 'X-Jeton': 'x'.repeat(48) } })).status === 403, 'mauvais jeton : refusé');
  const page = await fetch(base + '/');
  verifier(page.status === 200 && /default-src 'self'/.test(page.headers.get('content-security-policy')), 'la page est servie avec ses protections');
  verifier(!(await page.text()).includes(a.jeton), 'le jeton n\'est jamais dans la page');
  verifier((await fetch(base + '/../package.json')).status === 404, 'aucun autre fichier n\'est servi');
  verifier(a.sortie().includes('127.0.0.1') && !a.sortie().includes('0.0.0.0'), 'écoute seulement 127.0.0.1');

  console.log('Le serveur ne tombe pas');
  verifier(await requete('/api/etat?jeton=' + encodeURIComponent('é'.repeat(48))) === 403 && await a.vivant(), 'un jeton de 48 « é » (image piégée d\'un autre site) : refusé, le serveur tient');
  await a.brut([`GET //[x HTTP/1.1\r\nHost: 127.0.0.1:${a.port}\r\n\r\n`]);
  verifier(await a.vivant(), 'une adresse invalide (GET //[x) ne fait pas tomber le serveur');
  await a.brut([`GET http://[x HTTP/1.1\r\nHost: 127.0.0.1:${a.port}\r\n\r\n`]);
  verifier(await a.vivant(), 'une adresse invalide (GET http://[x) ne fait pas tomber le serveur');
  verifier((await api('/api/message', 'null')).statut === 400 && await a.vivant(), 'un corps « null » est refusé, le serveur tient');
  verifier((await api('/api/brief', '[1,2]')).statut === 400, 'un corps qui n\'est pas un objet est refusé');
  verifier((await api('/api/message', '{"fil": "jury", "texte": "' + 'x'.repeat(250000) + '"}')).statut === 413, 'un corps trop gros reçoit 413 et un message, sans couper la connexion');

  console.log('État');
  const etat = (await api('/api/etat')).json;
  verifier(etat.equipe.length === 9 && etat.equipe.some(e => e.id === 'digital' && e.prenom === 'Jade'), '9 agents dans l\'équipe, dont Jade au studio digital');
  verifier(etat.equipe.find(e => e.id === 'planning').prenom === 'Max', 'le prénom vient de la fiche de l\'agent');
  verifier(etat.pret === true && typeof etat.actifs === 'object', 'Claude Code reconnu, agents actifs donnés au chargement');

  console.log('Nouveau brief');
  verifier((await api('/api/brief', { nom: '', type: 'cours', texte: 'x' })).json.erreur === 'Donne un nom au projet.', 'un brief sans nom : message clair');
  verifier((await api('/api/brief', { nom: 'X', type: 'pirate', texte: 'x' })).statut === 400, 'un type inconnu est refusé');
  verifier(/au moins une lettre/.test((await api('/api/brief', { nom: '東京', type: 'perso', texte: 'x' })).json.erreur), 'un nom sans lettre latine : message clair');
  const long = await api('/api/brief', { nom: 'Long', type: 'perso', texte: 'x'.repeat(35000) });
  verifier(long.statut === 413 && /trop long/.test(long.json.erreur), 'un brief trop long : message clair');
  const r = await api('/api/brief', { nom: 'Oasis été 2027', type: 'cours', texte: 'Faire une reco pour Oasis. Rendu le 12 décembre.' });
  verifier(r.statut === 202 && r.json.projet === 'oasis-ete-2027', 'le projet est créé avec un nom de dossier propre');
  const dossier = path.join(a.racine, 'projets', 'oasis-ete-2027');
  verifier(fs.readFileSync(path.join(dossier, 'brief.md'), 'utf8').includes('Rendu le 12 décembre'), 'brief.md contient le texte d\'Evan');
  verifier(JSON.parse(fs.readFileSync(path.join(dossier, 'projet.json'), 'utf8')).type === 'cours', 'projet.json garde le type');
  verifier((await api('/api/brief', { nom: 'Oasis été 2027', type: 'cours', texte: 'x' })).statut === 409, 'deux projets du même nom : refusé');
  // Un « é » coupé entre deux paquets
  const corps = Buffer.from(JSON.stringify({ nom: 'Accents', type: 'perso', texte: 'Étude des cafés été' }));
  const coupe = corps.indexOf(Buffer.from('é')) + 1;
  await a.brut([`POST /api/brief HTTP/1.1\r\nHost: 127.0.0.1:${a.port}\r\nX-Jeton: ${a.jeton}\r\nContent-Type: application/json\r\nContent-Length: ${corps.length}\r\nConnection: close\r\n\r\n`, corps.subarray(0, coupe), corps.subarray(coupe)]);
  await a.auRepos('agence:accents');
  verifier(fs.readFileSync(path.join(a.racine, 'projets', 'accents', 'brief.md'), 'utf8').includes('Étude des cafés été'), 'un accent coupé entre deux paquets reste intact');

  const fil = 'agence:oasis-ete-2027';
  const fin = await a.auRepos(fil);
  const msgs = fin.fils[fil].messages;
  const appel = a.appels().find(j => j.entree.includes('oasis-ete-2027')).args;
  const val = o => appel[appel.indexOf(o) + 1];
  console.log('Lancement de Claude Code');
  verifier(val('--agent') === 'clientele', 'Claire pilote l\'agence');
  verifier(appel.includes('--restricted') && appel.includes('--strict-mcp-config'), 'mode restreint, sans serveurs MCP');
  verifier(val('--permission-mode') === 'dontAsk', 'aucune demande de permission en arrière-plan');
  const outils = val('--tools').split(',');
  verifier(!outils.some(o => ['Bash', 'Edit', 'Write', 'NotebookEdit'].includes(o)), 'aucun outil d\'écriture ni de commande');
  verifier(outils.includes('Agent') && outils.includes('WebSearch'), 'Claire peut appeler les agents, la recherche web est permise');
  const interdits = val('--disallowedTools');
  verifier(/Bash/.test(interdits) && /Write/.test(interdits), 'Bash et Write explicitement interdits');
  verifier(interdits.includes('Read(./.git/**)') && interdits.includes('Read(./.claude/agence/**)'), 'les conversations et le dossier git sont interdits en lecture');
  verifier(!/(^|,)(Read|Grep|Glob)(,|$)/.test(val('--allowedTools')), 'la lecture n\'est pas pré-autorisée (elle reste limitée au dossier)');
  const reglages = JSON.parse(val('--settings'));
  const garde = reglages.hooks.PreToolUse[0];
  verifier(garde.matcher === 'Agent|Task' && garde.hooks[0].command.includes('garde-agents.mjs') && garde.hooks[0].command.includes('jury'), 'le garde-fou des appels d\'agents est branché');
  const defs = JSON.parse(val('--agents'));
  verifier(Object.keys(defs).length === 9 && defs.digital.model === 'opus' && !defs.redaction.tools.includes('WebSearch'), 'chaque agent garde ses outils');
  verifier(val('--model') === 'sonnet' && defs.planning.model === 'opus' && defs.social.model === 'haiku', 'chaque agent travaille avec son modèle (Claire sonnet, Max opus, Sam haiku)');
  verifier(/Sois économe/.test(val('--append-system-prompt')), 'la consigne d\'économie est transmise');
  verifier(/projet de COURS/.test(val('--append-system-prompt')), 'la règle des projets de cours est transmise');
  verifier(/premier plan/.test(val('--append-system-prompt')), 'Claire attend le rapport de chaque agent');

  console.log('Ce qui sort');
  verifier(msgs.find(m => m.de === 'evan').texte.includes('Oasis'), 'le brief apparaît dans le chat');
  verifier(msgs.some(m => m.de === 'etape' && m.agent === 'etudes' && /Claire passe le dossier à Inès/.test(m.texte)), 'étape : Claire passe le dossier à Inès');
  verifier(msgs.some(m => m.de === 'etape' && /Inès cherche sur le web « marché des boissons/.test(m.texte)), 'étape : Inès cherche sur le web');
  const prop = msgs.filter(m => m.de === 'proposition' && m.agent === 'etudes');
  verifier(prop.length === 1, 'chaque rapport ne s\'affiche qu\'une fois');
  verifier(prop[0].texte.startsWith('## Marché') && !prop[0].texte.includes('agentId'), 'la proposition d\'Inès arrive, nettoyée');
  verifier(!msgs.some(m => /Async agent launched/.test(m.texte || '')), 'le message technique d\'un agent en arrière-plan n\'est pas affiché');
  const pj = msgs.find(m => m.de === 'proposition' && m.agent === 'jury');
  verifier(pj && pj.texte === 'Note 14 sur 20 : la cible est claire.', 'le rapport d\'un agent en arrière-plan arrive quand il a fini');
  const rep = msgs.find(m => m.de === 'agent');
  verifier(rep && rep.texte.includes('Brief reformulé.') && rep.texte.includes('Voici la reformulation.') && !rep.texte.includes('<<<'), 'toute la réponse de Claire, sans les blocs spéciaux');
  const choix = msgs.find(m => m.de === 'choix');
  verifier(choix && choix.options.length === 2 && choix.options[0].conseil, 'un choix entouré de ``` est bien lu, avec la recommandation');
  const fichiers = msgs.filter(m => m.de === 'fichier');
  verifier(fichiers.map(f => f.chemin).join() === 'projets/oasis-ete-2027/brief-reformule.md,projets/oasis-ete-2027/insights.md', 'un fichier proposé avant un appel d\'agent n\'est pas perdu');
  verifier(!fs.existsSync(path.join(dossier, 'insights.md')), 'rien n\'est écrit avant le clic');

  console.log('Validation au studio');
  const ins = fichiers[1], bref = fichiers[0];
  verifier((await api('/api/fichier', { fil, id: ins.id, decision: 'peutetre' })).statut === 400, 'une décision inconnue est refusée');
  verifier((await api('/api/fichier', { fil, id: ins.id, decision: 'valider' })).statut === 200, 'Evan valide le fichier');
  verifier(fs.readFileSync(path.join(dossier, 'insights.md'), 'utf8').startsWith('# Insights'), 'insights.md est écrit');
  verifier((await api('/api/fichier', { fil, id: ins.id, decision: 'refuser' })).statut === 409, 'on ne décide pas deux fois');
  await attendre(20);
  fs.writeFileSync(path.join(dossier, 'brief-reformule.md'), 'écrit à la main par Evan\n');
  const ecrase = await api('/api/fichier', { fil, id: bref.id, decision: 'valider' });
  verifier(ecrase.statut === 409 && /modifié depuis/.test(ecrase.json.erreur), 'un fichier modifié depuis la proposition n\'est pas écrasé');
  verifier(fs.readFileSync(path.join(dossier, 'brief-reformule.md'), 'utf8') === 'écrit à la main par Evan\n', 'la version d\'Evan est intacte');
  verifier((await api('/api/fichier', { fil, id: bref.id, decision: 'refuser' })).statut === 200, 'refuser reste possible');
  verifier((await api('/api/fichier?projet=oasis-ete-2027&nom=insights.md')).json.contenu.includes('Insights'), 'le dossier du projet se relit');
  verifier((await api('/api/fichier?projet=oasis-ete-2027&nom=..%2F..%2Fjournal.jsonl')).statut === 400, 'pas de lecture hors du projet');

  console.log('Choix');
  verifier((await api('/api/choisir', { fil, id: choix.id, option: 9 })).statut === 400, 'une option inconnue est refusée');
  verifier((await api('/api/choisir', { fil, id: choix.id, option: 1, precision: 'surtout en BTS' })).statut === 202, 'Evan clique sur une option');
  verifier((await api('/api/choisir', { fil, id: choix.id, option: 0 })).statut >= 400, 'on ne choisit pas deux fois');
  const apres = (await a.auRepos(fil)).fils[fil].messages;
  const second = a.appels().filter(j => j.args.includes('--resume') && j.entree.includes('je choisis')).pop();
  verifier(second && second.entree.includes('je choisis : Les étudiants') && second.entree.includes('surtout en BTS'), 'le choix et la précision partent à l\'agence');
  verifier(second && second.entree.includes('insights.md validé') && second.entree.includes('brief-reformule.md refusé'), 'l\'agence apprend ce qu\'Evan a validé ou refusé au studio');
  const reco = apres.filter(m => m.de === 'fichier').pop();
  verifier(reco.chemin.endsWith('reco.md'), 'la reco est proposée');
  verifier(apres.some(m => m.alerte && /choix proposé est illisible/.test(m.texte)), 'un choix mal formé est signalé');
  verifier(apres.filter(m => m.de === 'agent').pop().texte.includes('Le "vrai" goût'), 'le choix mal formé reste lisible dans la réponse');
  const tropLong = await api('/api/fichier', { fil, id: reco.id, decision: 'valider', contenu: 'x'.repeat(410000) });
  verifier(tropLong.statut === 413 && /trop long/.test(tropLong.json.erreur), 'un fichier modifié trop long : message clair, rien d\'écrit');

  console.log('Versions d\'un même fichier');
  await api('/api/message', { fil, texte: 'je choisis encore une version' });
  const v2 = (await a.auRepos(fil)).fils[fil].messages;
  verifier(v2.find(m => m.id === reco.id).statut === 'remplace', 'l\'ancienne proposition de reco.md est marquée remplacée');
  verifier((await api('/api/fichier', { fil, id: reco.id, decision: 'valider' })).statut === 409, 'l\'ancienne version ne peut plus écraser la nouvelle');
  const nouvelle = v2.filter(m => m.de === 'fichier').pop();
  const grand = '# Reco\n\n' + 'Une très longue reco, corrigée à la main. '.repeat(1500);
  verifier((await api('/api/fichier', { fil, id: nouvelle.id, decision: 'valider', contenu: grand })).statut === 200, 'une version corrigée de plus de 60 000 caractères se valide');
  verifier(fs.readFileSync(path.join(dossier, 'reco.md'), 'utf8').length > 60000, 'et elle est bien écrite');

  console.log('Choix dépassé');
  await api('/api/brief', { nom: 'Deux', type: 'perso', texte: 'Un autre brief.' });
  const filDeux = 'agence:deux';
  const c1 = (await a.auRepos(filDeux)).fils[filDeux].messages.find(m => m.de === 'choix');
  await api('/api/message', { fil: filDeux, texte: 'Attends, change d\'abord la cible.' });
  await a.auRepos(filDeux);
  verifier((await messagesDe(filDeux)).find(m => m.id === c1.id).depasse === true, 'un choix laissé sans réponse est dépassé quand Evan écrit autre chose');
  verifier((await api('/api/choisir', { fil: filDeux, id: c1.id, option: 0 })).statut === 409, 'un choix dépassé ne peut plus être cliqué');

  console.log('Fichiers piégés');
  await api('/api/message', { fil, texte: 'PIEGES' });
  const p = (await a.auRepos(fil)).fils[fil].messages;
  const tour = p.slice(p.map(m => m.texte).lastIndexOf('PIEGES'));
  verifier(tour.filter(m => m.alerte).length === 5, 'les 5 chemins piégés sont refusés et signalés');
  verifier(tour.some(m => m.alerte && /sort du dossier/.test(m.texte)) && tour.some(m => m.alerte && /réservé/.test(m.texte)) && tour.some(m => m.alerte && /minuscules/.test(m.texte)), 'chaque refus dit pourquoi');
  verifier(tour.some(m => m.de === 'proposition' && m.titre && m.texte.includes('Ma stratégie précieuse')), 'le contenu d\'un fichier refusé n\'est pas perdu');
  verifier(!fs.existsSync(path.join(a.racine, 'evil.md')) && !fs.readdirSync(dossier).some(f => /claude/i.test(f)), 'rien n\'est écrit hors du projet, ni de CLAUDE.md');

  console.log('Studio digital : présentation HTML');
  await api('/api/message', { fil, texte: 'SITE' });
  const s = (await a.auRepos(fil)).fils[fil].messages;
  const tourSite = s.slice(s.map(m => m.texte).lastIndexOf('SITE'));
  const pres = tourSite.find(m => m.de === 'fichier');
  verifier(pres && pres.chemin === 'projets/oasis-ete-2027/presentation.html' && pres.agent === 'digital', 'la présentation de Jade arrive directement au studio');
  const rapportJade = tourSite.find(m => m.de === 'proposition' && m.agent === 'digital');
  verifier(rapportJade && rapportJade.texte.includes('Voici la présentation') && !rapportJade.texte.includes('<!doctype'), 'son rapport reste lisible, sans le code');
  const ap = await api('/api/apercu', { fil, id: pres.id });
  verifier(ap.statut === 200 && /^\/apercu\/[0-9a-f]{36}$/.test(ap.json.adresse) && !ap.json.adresse.includes(a.jeton), 'l\'aperçu a sa propre adresse, sans le jeton');
  const pageApercu = await fetch(base + ap.json.adresse);
  const csp = pageApercu.headers.get('content-security-policy') || '';
  verifier(pageApercu.status === 200 && (await pageApercu.text()).includes('La reco Oasis'), 'l\'aperçu affiche la présentation');
  verifier(/^sandbox allow-scripts/.test(csp) && !/allow-same-origin/.test(csp) && /connect-src 'none'/.test(csp), 'l\'aperçu est isolé : son code ne peut pas parler à l\'agence');
  verifier((await fetch(base + '/apercu/' + '0'.repeat(36))).status === 404, 'une adresse d\'aperçu inventée ne donne rien');
  verifier((await fetch(base + '/api/apercu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fil, id: pres.id }) })).status === 403, 'sans jeton, pas d\'aperçu');
  verifier((await api('/api/fichier', { fil, id: pres.id, decision: 'valider' })).statut === 200 && fs.readFileSync(path.join(dossier, 'presentation.html'), 'utf8').includes('La reco Oasis'), 'Evan valide : presentation.html est écrit dans le projet');
  const ap2 = await api('/api/apercu', { projet: 'oasis-ete-2027', nom: 'presentation.html' });
  verifier(ap2.statut === 200 && (await (await fetch(base + ap2.json.adresse)).text()).includes('La reco Oasis'), 'le fichier enregistré se revoit en aperçu');
  verifier((await api('/api/apercu', { projet: 'oasis-ete-2027', nom: '../../journal.jsonl' })).statut === 400, 'pas d\'aperçu hors du projet');
  verifier((await api('/api/etat')).json.projets.find(p => p.slug === 'oasis-ete-2027').fichiers.includes('presentation.html'), 'le dossier du projet liste la présentation');

  console.log('Accents dans une très longue réponse');
  await api('/api/message', { fil, texte: 'ACCENTS' });
  const acc = (await a.auRepos(fil)).fils[fil].messages.filter(m => m.de === 'agent').pop().texte;
  verifier(acc.startsWith('Début ') && !acc.includes('�') && acc.includes('é€à'), 'aucun caractère abîmé dans une ligne de plus de 64 Ko');

  console.log('Recréer un projet du même nom');
  fs.rmSync(path.join(a.racine, 'projets', 'deux'), { recursive: true });
  await api('/api/brief', { nom: 'Deux', type: 'cours', texte: 'Tout autre sujet.' });
  const recree = (await a.auRepos(filDeux)).fils[filDeux].messages;
  verifier(recree[0].de === 'evan' && recree[0].texte.includes('Tout autre sujet') && !recree.some(m => m.texte === 'Attends, change d\'abord la cible.'), 'le nouveau projet repart d\'une conversation vide');
  verifier(!a.appels().pop().args.includes('--resume'), 'et d\'une nouvelle session Claude');

  console.log('Message direct à un agent');
  verifier((await api('/api/message', { fil: 'inconnu', texte: 'x' })).statut === 400, 'un agent inconnu est refusé');
  verifier((await api('/api/message', { fil: 'jury', texte: '/commande' })).statut === 400, 'les commandes en / sont refusées');
  verifier((await api('/api/message', { fil: 'jury', texte: 'Relis mon plan' })).statut === 202, 'Evan écrit au Jury');
  const j = (await a.auRepos('jury')).fils.jury.messages;
  verifier(j[1] && j[1].texte.includes('ici jury'), 'le Jury répond');
  const argsJury = a.appels().pop().args;
  verifier(argsJury[argsJury.indexOf('--agent') + 1] === 'jury' && !argsJury[argsJury.indexOf('--tools') + 1].includes('Agent'), 'un agent seul ne peut pas en appeler d\'autres');

  console.log('Arrêter');
  await api('/api/message', { fil: 'media', texte: 'LENT' });
  await attendre(400);
  verifier((await api('/api/message', { fil: 'media', texte: 'encore' })).statut === 409, 'un seul travail à la fois par fil');
  await api('/api/arreter', { fil: 'media' });
  const m = (await a.auRepos('media', 5000)).fils.media.messages.pop();
  verifier(m.erreur && /Arrêté à ta demande/.test(m.texte), 'Arrêter coupe le travail');

  console.log('GitHub sans dépôt');
  verifier((await api('/api/github', { fil })).statut === 400, 'sans dépôt relié : refusé proprement');
  verifier(fs.existsSync(path.join(a.racine, '.claude', 'agence', 'conversations.json')), 'les conversations sont gardées sur le Mac');

  console.log('Fermer la fenêtre du Terminal');
  await api('/api/message', { fil: 'social', texte: 'LENT' });
  await attendre(500);
  a.processus.kill('SIGHUP');
  await attendre(9000);
  verifier(a.journalLu().filter(l => l.fin === 'LENT').length === 0, 'les agents en cours s\'arrêtent avec le serveur');
} catch (e) {
  verifier(false, 'exception : ' + e.stack);
} finally {
  a.arreter();
}

console.log('Claude Code trop ancien (sans --restricted)');
const ancien = await demarrer({ env: { FAUX_SANS_RESTREINT: '1' } });
try {
  verifier((await ancien.api('/api/etat')).json.pret === false, 'l\'agence se dit non prête');
  const refus = await ancien.api('/api/message', { fil: 'jury', texte: 'Bonjour' });
  verifier(refus.statut === 503 && /claude update/.test(refus.json.erreur), 'aucun agent n\'est lancé, avec la marche à suivre');
  verifier(ancien.appels().length === 0, 'Claude Code n\'a jamais été appelé');
} catch (e) { verifier(false, 'exception : ' + e.stack); } finally { ancien.arreter(); }

console.log('Garde-fou des appels d\'agents');
const garde = entree => {
  const r = spawnSync(process.execPath, [path.join(code, 'scripts', 'garde-agents.mjs'), 'clientele,etudes,jury'], { input: JSON.stringify(entree), encoding: 'utf8' });
  return r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput.permissionDecision : 'permis';
};
verifier(garde({ tool_name: 'Agent', tool_input: { subagent_type: 'etudes', prompt: 'x' } }) === 'permis', 'appeler Inès : permis');
verifier(garde({ tool_name: 'Agent', tool_input: { subagent_type: 'general-purpose', prompt: 'x' } }) === 'deny', 'appeler un agent hors de l\'équipe : refusé');
verifier(garde({ tool_name: 'Agent', tool_input: { subagent_type: 'etudes', isolation: 'worktree' } }) === 'deny', 'une copie git (isolation) : refusée');
verifier(garde({ tool_name: 'Task', tool_input: { subagent_type: 'statusline-setup' } }) === 'deny', 'l\'ancien nom de l\'outil est couvert aussi');

console.log('Envoyer sur GitHub');
const g = await demarrer({ git: true });
try {
  await g.api('/api/brief', { nom: 'Nike', type: 'client', texte: 'Brief Nike.' });
  const filNike = 'agence:nike';
  const ms = (await g.auRepos(filNike)).fils[filNike].messages;
  await g.api('/api/fichier', { fil: filNike, id: ms.find(m => m.de === 'fichier' && m.chemin.endsWith('insights.md')).id, decision: 'valider' });
  const envoi = await g.api('/api/github', { fil: filNike });
  verifier(envoi.statut === 200 && envoi.json.message === 'Envoyé sur GitHub.', 'le dossier du projet est envoyé');
  const surGithub = git(g.distant, 'log', '--name-only', '--format=%s', '-1', 'main').sortie;
  verifier(surGithub.includes('Projet Nike : livrables validés') && surGithub.includes('projets/nike/insights.md'), 'GitHub reçoit le commit du projet');
  fs.writeFileSync(path.join(g.racine, 'autre.txt'), 'x');
  git(g.racine, 'add', 'autre.txt');
  const rien = await g.api('/api/github', { fil: filNike });
  verifier(rien.statut === 200 && /Rien de nouveau/.test(rien.json.message), 'un autre fichier indexé ne bloque pas l\'envoi');
  verifier(!git(g.distant, 'ls-tree', '-r', '--name-only', 'main').sortie.includes('autre.txt'), 'et il ne part pas');
  git(g.racine, 'reset', '-q', 'autre.txt');
  fs.writeFileSync(path.join(g.racine, 'scripts', 'code.js'), '// code changé par une session\n');
  git(g.racine, 'commit', '-q', '-am', 'changement de code non relu');
  const avant = git(g.distant, 'rev-parse', 'main').sortie;
  const bloque = await g.api('/api/github', { fil: filNike });
  verifier(bloque.statut === 409 && /Je n'envoie rien/.test(bloque.json.erreur), 'un commit de code en attente bloque l\'envoi, avec explication');
  verifier(git(g.distant, 'rev-parse', 'main').sortie === avant, 'rien n\'est parti sur GitHub');
  // GitHub a avancé ailleurs
  const autreClone = g.racine + '-clone';
  git(path.dirname(g.racine), 'clone', '-q', g.distant, autreClone);
  git(autreClone, '-c', 'user.email=t@t.fr', '-c', 'user.name=T', 'commit', '-q', '--allow-empty', '-m', 'ailleurs');
  git(autreClone, 'push', '-q', 'origin', 'main');
  const retard = await g.api('/api/github', { fil: filNike });
  verifier(retard.statut === 409 && /git pull/.test(retard.json.erreur), 'si GitHub a avancé ailleurs : message « git pull »');
  fs.rmSync(autreClone, { recursive: true, force: true });
  verifier(await g.vivant(), 'le serveur répond pendant et après les envois');
} catch (e) { verifier(false, 'exception : ' + e.stack); } finally { g.arreter(); }
bilan();
