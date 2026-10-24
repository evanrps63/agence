// La base de campagnes : chaque fiche a son statut, les liens de l'index existent, et le contrôle sait signaler une erreur
import fs from 'fs';
import os from 'os';
import path from 'path';
import { verifierFiches } from '../scripts/verifier-fiches.mjs';
import { verifier, bilan, code } from './outils.mjs';

console.log('La base réelle');
const reelle = verifierFiches();
verifier(reelle.fiches >= 20, `la base compte ${reelle.fiches} fiches de campagne`);
verifier(reelle.erreurs.length === 0, 'chaque fiche a son statut et chaque lien de l\'index existe' + (reelle.erreurs.length ? ' (' + reelle.erreurs.join(' ; ') + ')' : ''));

console.log('Le contrôle sait signaler les erreurs');
const racine = fs.mkdtempSync(path.join(os.tmpdir(), 'test-fiches-'));
const dossier = path.join(racine, 'campagnes');
fs.mkdirSync(dossier);
fs.writeFileSync(path.join(dossier, 'sans-statut.md'), '# Une fiche\n\nTexte.\n');
fs.writeFileSync(path.join(dossier, 'avec-statut.md'), '# Une fiche\n\n> Statut : faits à vérifier.\n\nTexte.\n');
fs.writeFileSync(path.join(dossier, 'synthese.md'), '# Synthèse\n');
const index = path.join(racine, 'index.md');
fs.writeFileSync(index, '- [Cassé](docs/campagnes/inexistante.md)\n');
const r = verifierFiches({ dossier, index: index });
verifier(r.erreurs.some(e => /sans-statut\.md : pas de statut/.test(e)), 'une fiche sans statut est signalée');
verifier(!r.erreurs.some(e => /avec-statut/.test(e)), 'une fiche avec statut n\'est pas signalée');
verifier(r.erreurs.some(e => /lien cassé dans l'index : docs\/campagnes\/inexistante\.md/.test(e)), 'un lien cassé dans l\'index est signalé (chemin relatif au dépôt)');
verifier(r.fiches === 2, 'la synthèse n\'est pas comptée comme une fiche');
fs.rmSync(racine, { recursive: true, force: true });
bilan();
