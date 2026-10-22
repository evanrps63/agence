// Le suivi des projets : étape du circuit, date de rendu, grille du prof, trames
import fs from 'fs';
import path from 'path';
import { avancement, dateRendu, ETAPES } from '../scripts/suivi.mjs';
import { demarrer, verifier, bilan, code } from './outils.mjs';

console.log('Étapes du circuit');
verifier(avancement([]).courante === 'Brief' && avancement([]).faites === 0, 'un projet vide en est au brief');
const a1 = avancement(['brief.md', 'insights.md', 'strategie.md']);
verifier(a1.courante === 'Idée créative' && a1.faites === 3, 'après la stratégie, l\'idée créative est la suite');
verifier(avancement(['brief.md', 'dispositif-social.md']).courante === 'Insights', 'une étape passée avant les précédentes ne compte pas pour la suite');
const dispo = ['brief.md', 'insights.md', 'strategie.md', 'idee-creative.md'];
verifier(avancement([...dispo, 'dispositif-social.md']).courante === 'Dispositif social et média', 'le dispositif n\'est pas fait tant que Nora n\'a pas écrit le sien');
verifier(avancement([...dispo, 'dispositif-social.md', 'dispositif-media.md']).courante === 'Relecture du Jury', 'le dispositif est fait quand Sam et Nora ont écrit');
verifier(avancement([...dispo, 'dispositif-social.md', 'dispositif-media.md', 'relecture.md', 'reco.md', 'site.html']).courante === null, 'un site compte comme livrable : tout est prêt');
verifier(avancement([]).total === ETAPES.length, 'le total suit la liste des étapes');

console.log('Date de rendu');
verifier(dateRendu('**Date de rendu** : 2026-12-12\n') === '2026-12-12', 'la date du brief est lue');
verifier(dateRendu('**Date de rendu** :\n') === null, 'une date vide ne compte pas');
verifier(dateRendu('Pas de ligne ici') === null, 'sans ligne : rien');
verifier(dateRendu('**Date de rendu** : le 12 décembre, à midi') === 'le 12 décembre, à midi', 'une date écrite en mots est gardée telle quelle');

console.log('Projets de cours : grille du prof et date');
const a = await demarrer();
try {
  // La trame de la grille du prof est copiée à la création d'un cours
  fs.mkdirSync(path.join(a.racine, 'projets', '_modeles'), { recursive: true });
  fs.copyFileSync(path.join(code, 'projets', '_modeles', 'consignes-prof.md'), path.join(a.racine, 'projets', '_modeles', 'consignes-prof.md'));
  const r = await a.api('/api/brief', { nom: 'Cours marketing', type: 'cours', texte: 'Faire une reco.', rendu: '2026-12-12' });
  verifier(r.statut === 202, 'un brief de cours est accepté avec une date de rendu');
  await a.auRepos('agence:cours-marketing');
  const dossier = path.join(a.racine, 'projets', 'cours-marketing');
  verifier(fs.readFileSync(path.join(dossier, 'brief.md'), 'utf8').includes('**Date de rendu** : 2026-12-12'), 'la date de rendu est dans brief.md');
  verifier(fs.existsSync(path.join(dossier, 'consignes-prof.md')), 'un cours reçoit sa grille du prof (trame vide)');
  const projet = (await a.api('/api/etat')).json.projets.find(p => p.slug === 'cours-marketing');
  verifier(projet.rendu === '2026-12-12' && projet.consignes === true, 'l\'état indique la date et la grille');
  verifier(projet.avancement.courante === 'Insights' && projet.avancement.faites === 1, 'le brief est compté comme fait');
  verifier(typeof projet.cout === 'number', 'le coût du projet est donné');

  const r2 = await a.api('/api/brief', { nom: 'Perso sans date', type: 'perso', texte: 'Un projet perso.', rendu: 'demain' });
  verifier(r2.statut === 202, 'une date mal écrite n\'empêche pas le brief');
  await a.auRepos('agence:perso-sans-date');
  const brief2 = fs.readFileSync(path.join(a.racine, 'projets', 'perso-sans-date', 'brief.md'), 'utf8');
  verifier(!brief2.includes('Date de rendu') && !fs.existsSync(path.join(a.racine, 'projets', 'perso-sans-date', 'consignes-prof.md')), 'sans date valide : pas de ligne de date, et pas de grille pour un projet perso');
} catch (e) { verifier(false, 'exception : ' + e.stack); } finally { a.arreter(); }
bilan();
