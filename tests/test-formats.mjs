// Les formats de fichiers : Word et PDF fabriqués à la validation, CSV et TXT tels quels, téléchargements, refus des formats inconnus
import fs from 'fs';
import path from 'path';
import { demarrer, verifier, bilan, code } from './outils.mjs';

const FIL = 'agence:formats';
const a = await demarrer();
const { api, base } = a;

// Un projet avec une proposition de chaque format : le faux Claude répond au mot FORMATS
async function proposerFormats(agence) {
  await agence.api('/api/brief', { nom: 'Formats', type: 'perso', texte: 'Tester les formats de fichiers.' });
  await agence.auRepos(FIL);
  await agence.api('/api/message', { fil: FIL, texte: 'FORMATS' });
  const fin = await agence.auRepos(FIL);
  return fin.fils[FIL].messages;
}
const dossierDe = agence => path.join(agence.racine, 'projets', 'formats');
const statutDe = async (agence, id) => (await agence.api('/api/etat')).json.fils[FIL].messages.find(m => m.id === id).statut;

try {
  // Avec Chrome et puppeteer, le PDF est vraiment fabriqué ; sans eux, le serveur doit le dire sans rien écrire
  const pdfPossible = (await api('/api/etat')).json.navigateur && fs.existsSync(path.join(code, 'node_modules', 'puppeteer-core'));

  console.log('Les formats proposés');
  const msgs = await proposerFormats(a);
  const fichiers = msgs.filter(m => m.de === 'fichier');
  const chemins = fichiers.map(m => path.basename(m.chemin));
  verifier(['rapport.docx', 'fiche.pdf', 'donnees.csv', 'notes.txt'].every(n => chemins.includes(n)), 'Word, PDF, CSV et TXT sont proposés au studio');
  verifier(msgs.some(m => m.alerte && /Fichier refusé par le serveur.*macro\.exe/.test(m.texte)), 'un fichier .exe est refusé, avec une explication');
  verifier(!fs.existsSync(path.join(dossierDe(a), 'macro.exe')), 'le fichier refusé n\'est pas écrit');
  const pdf = fichiers.find(m => m.chemin.endsWith('.pdf'));
  const docx = fichiers.find(m => m.chemin.endsWith('.docx'));
  const apercu = await api('/api/apercu', { fil: FIL, id: pdf.id });
  verifier(apercu.statut === 200 && (await (await fetch(base + apercu.json.adresse)).text()).includes('Fiche Oasis'), 'le PDF proposé s\'affiche en aperçu, avant validation');
  verifier(!fs.existsSync(path.join(dossierDe(a), 'fiche.pdf')), 'rien n\'est écrit avant le clic');

  console.log('Le studio fabrique le fichier au moment de la validation');
  const valider = m => api('/api/fichier', { fil: FIL, id: m.id, decision: 'valider' });
  verifier((await valider(docx)).statut === 200, 'Evan valide le Word');
  const word = fs.readFileSync(path.join(dossierDe(a), 'rapport.docx'));
  verifier(word.subarray(0, 2).toString() === 'PK' && word.includes('word/document.xml') && word.includes('<w:pStyle w:val="Titre1"/>'), 'le Word est un vrai document (archive, titre de niveau 1)');
  verifier(word.includes('3 &lt; 5 &amp;') && word.includes('<w:b/>'), 'le texte est échappé et le gras est gardé');
  verifier((await valider(fichiers.find(m => m.chemin.endsWith('.csv')))).statut === 200 && fs.readFileSync(path.join(dossierDe(a), 'donnees.csv'), 'utf8') === 'Cible,Taille\nÉtudiants,12\n', 'le CSV est écrit tel quel');
  verifier((await valider(fichiers.find(m => m.chemin.endsWith('.txt')))).statut === 200 && fs.readFileSync(path.join(dossierDe(a), 'notes.txt'), 'utf8') === 'Notes brutes.\n', 'le TXT est écrit tel quel');
  const vp = await valider(pdf);
  if (pdfPossible) {
    verifier(vp.statut === 200 && fs.readFileSync(path.join(dossierDe(a), 'fiche.pdf')).subarray(0, 5).toString() === '%PDF-', 'Evan valide le PDF : Chrome l\'imprime, c\'est un vrai PDF');
  } else {
    verifier(vp.statut === 503 && /n'a pas pu être fabriqué/.test(vp.json.erreur) && !fs.existsSync(path.join(dossierDe(a), 'fiche.pdf')), 'sans Chrome : le PDF n\'est pas écrit, avec un message clair');
  }

  console.log('Le lecteur et les téléchargements');
  const dossier = (await api('/api/etat')).json.projets.find(p => p.slug === 'formats').fichiers;
  verifier(['rapport.docx', 'donnees.csv', 'notes.txt'].every(n => dossier.includes(n)), 'le dossier du projet liste les nouveaux fichiers');
  const telecharge = await fetch(base + '/api/telecharger?projet=formats&nom=rapport.docx', { headers: { 'X-Jeton': a.jeton } });
  verifier(telecharge.status === 200 && /wordprocessingml/.test(telecharge.headers.get('content-type')) && /attachment; filename="rapport\.docx"/.test(telecharge.headers.get('content-disposition')), 'le Word se télécharge (bon type, pièce jointe)');
  verifier((await fetch(base + '/api/telecharger?projet=formats&nom=rapport.docx')).status === 403, 'sans jeton, pas de téléchargement');
  verifier((await fetch(base + '/api/telecharger?projet=formats&nom=macro.exe', { headers: { 'X-Jeton': a.jeton } })).status === 404, 'un format inconnu ne se télécharge pas');
  verifier((await fetch(base + '/api/telecharger?projet=formats&nom=..%2F..%2Fjournal.jsonl', { headers: { 'X-Jeton': a.jeton } })).status === 404, 'pas de fichier hors du projet');
  if (pdfPossible) {
    const t2 = await fetch(base + '/api/telecharger?projet=formats&nom=fiche.pdf', { headers: { 'X-Jeton': a.jeton } });
    verifier(t2.status === 200 && t2.headers.get('content-type') === 'application/pdf', 'le PDF se télécharge');
  }

  console.log('Les consignes');
  const lancement = a.appels().find(j => j.args && j.args.includes('--agents'));
  const defs = JSON.parse(lancement.args[lancement.args.indexOf('--agents') + 1]);
  verifier(/Formats de fichiers/.test(defs.clientele.prompt) && /\.docx/.test(defs.clientele.prompt) && /\.pdf/.test(defs.digital.prompt), 'chaque agent connaît les formats (Word, PDF, CSV, TXT)');

  console.log('Sans Chrome');
  // Le PDF ne peut pas être fabriqué : Evan est prévenu, rien n'est écrit, la proposition reste à valider
  const sans = await demarrer({ env: { CHROME_BIN: '/nonexistent/chrome' } });
  try {
    const msgsSans = await proposerFormats(sans);
    const pdfSans = msgsSans.find(m => m.de === 'fichier' && m.chemin.endsWith('.pdf'));
    const refus = await sans.api('/api/fichier', { fil: FIL, id: pdfSans.id, decision: 'valider' });
    verifier(refus.statut === 503 && /Google Chrome est introuvable/.test(refus.json.erreur), 'sans Chrome, Evan voit pourquoi le PDF n\'est pas fabriqué');
    verifier(!fs.existsSync(path.join(dossierDe(sans), 'fiche.pdf')) && await statutDe(sans, pdfSans.id) === 'attente', 'le PDF n\'est pas écrit et reste à valider');
    const docxSans = msgsSans.find(m => m.de === 'fichier' && m.chemin.endsWith('.docx'));
    verifier((await sans.api('/api/fichier', { fil: FIL, id: docxSans.id, decision: 'valider' })).statut === 200, 'le Word, lui, se fabrique sans Chrome');
  } finally {
    sans.arreter();
  }
} catch (e) {
  verifier(false, 'exception : ' + e.stack);
} finally {
  a.arreter();
}
bilan();
