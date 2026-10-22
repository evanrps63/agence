// Le suivi des projets : à quelle étape du circuit en est chaque projet, d'après les fichiers qu'il contient.
// Une étape est faite quand chacun de ses besoins est là (un besoin peut être rempli par l'un de plusieurs fichiers).

export const ETAPES = [
  { nom: 'Brief', besoin: [['brief.md']] },
  { nom: 'Insights', besoin: [['insights.md']] },
  { nom: 'Stratégie', besoin: [['strategie.md']] },
  { nom: 'Idée créative', besoin: [['idee-creative.md']] },
  { nom: 'Dispositif social et média', besoin: [['dispositif-social.md'], ['dispositif-media.md']] },
  { nom: 'Relecture du Jury', besoin: [['relecture.md']] },
  { nom: 'Reco écrite', besoin: [['reco.md']] },
  { nom: 'Présentation ou site', besoin: [['presentation.html', 'site.html']] }
];

// Renvoie { faites, total, courante, etapes } : courante est le nom de la première étape pas faite, ou null si tout est là.
export function avancement(fichiers = []) {
  const etapes = ETAPES.map(e => ({ nom: e.nom, fait: e.besoin.every(groupe => groupe.some(f => fichiers.includes(f))) }));
  const courante = etapes.find(e => !e.fait)?.nom ?? null;
  return { faites: etapes.filter(e => e.fait).length, total: etapes.length, courante, etapes };
}

// La date de rendu écrite dans brief.md : « **Date de rendu** : 2026-11-30 ». Renvoie le texte, ou null si elle est vide.
export function dateRendu(brief = '') {
  const m = String(brief).match(/^\*\*Date de rendu\*\*\s*:[ \t]*(.*)$/m);
  const valeur = m ? m[1].trim().slice(0, 60) : '';
  return valeur || null;
}
