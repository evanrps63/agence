// Contrôle la base de campagnes : statut « vérifié / à vérifier », liens de l'index, chiffres sans source.
// Usage : npm run fiches   (erreurs = code 1 ; chiffres sans source = avertissements seulement)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const code = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DOSSIER = path.join(code, 'docs', 'campagnes');
const INDEX = path.join(code, 'docs', 'references-campagnes.md');
// Les synthèses ne sont pas des fiches de campagne
const SYNTHESE = /synth/i;
// Un chiffre suivi d'une unité (%, M, Md, millions, €, $, points, ans…)
const CHIFFRE = /\d[\d\s.,]*\s*(%|M\b|Md\b|millions?|milliards?|€|\$|points?|ans\b|fois\b|vues\b|burgers\b|cartes\b)/i;
// Une ligne qui dit d'où vient le chiffre
const SOURCE = /(source|selon|effie|stratégies|strategies|one club|lovethework|cb news|réclame|reclame|media ?leader|llllitl|warc|ipsos|http|\(.*\d{4}.*\)|non communiqu|non documenté|à vérifier)/i;

export function verifierFiches({ dossier = DOSSIER, index = INDEX } = {}) {
  const erreurs = [];
  const avertissements = [];
  const fiches = fs.readdirSync(dossier).filter(f => f.endsWith('.md') && !SYNTHESE.test(f));

  for (const nom of fiches) {
    const texte = fs.readFileSync(path.join(dossier, nom), 'utf8');
    const statut = texte.split('\n').find(l => /^>\s*Statut\s*:/i.test(l)) || '';
    if (!/(à vérifier|vérifi)/i.test(statut)) erreurs.push(`${nom} : pas de statut « à vérifier » ou « vérifié » en tête de fiche`);

    let dansYaml = false;
    texte.split('\n').forEach((ligne, i) => {
      // Le bloc technique du début (```yaml) n'est pas un texte à sourcer
      if (/^```yaml/.test(ligne)) { dansYaml = true; return; }
      if (dansYaml) { if (/^```/.test(ligne)) dansYaml = false; return; }
      if (/^\s*(\||#|```|>)/.test(ligne) || ligne.trim() === '') return;
      if (CHIFFRE.test(ligne) && !SOURCE.test(ligne)) {
        avertissements.push(`${nom}:${i + 1} chiffre sans source visible : ${ligne.trim().slice(0, 90)}`);
      }
    });
  }

  // Les liens de l'index doivent pointer vers un fichier qui existe
  const liens = fs.readFileSync(index, 'utf8').matchAll(/\]\((docs\/[^)]+)\)/g);
  for (const m of liens) {
    if (!fs.existsSync(path.join(code, m[1]))) erreurs.push(`lien cassé dans l'index : ${m[1]}`);
  }

  return { fiches: fiches.length, erreurs, avertissements };
}

// Lancement direct : affiche le rapport
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = verifierFiches();
  console.log(`${r.fiches} fiches contrôlées.`);
  for (const e of r.erreurs) console.log('ERREUR  ' + e);
  for (const a of r.avertissements.slice(0, 40)) console.log('attention  ' + a);
  if (r.avertissements.length > 40) console.log(`… et ${r.avertissements.length - 40} autres avertissements.`);
  console.log(r.erreurs.length ? `${r.erreurs.length} erreur(s).` : 'Aucune erreur.');
  process.exit(r.erreurs.length ? 1 : 0);
}
