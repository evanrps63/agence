// Fabrique une vidéo MP4 à partir d'une composition Remotion (un fichier .tsx du projet).
// Le code vient d'un agent : il n'est rendu qu'après le clic « Valider » d'Evan, et seulement s'il passe les garde-fous ci-dessous.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const code = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Ce qu'une composition a le droit d'importer, et rien d'autre
const IMPORTS_PERMIS = new Set(['react', 'remotion']);
// Ce qu'une composition ne doit jamais contenir : accès aux fichiers, au réseau, au processus, à l'exécution dynamique
const INTERDIT = [/\brequire\s*\(/, /\bprocess\b/, /\beval\s*\(/, /\bFunction\s*\(/, /\bimport\s*\(/, /\bfetch\s*\(/, /XMLHttpRequest/, /\bglobalThis\b/, /\bwindow\b/, /\bdocument\b/];

// Renvoie { erreur } ou { ok: true }
export function verifierComposition(source) {
  for (const m of source.matchAll(/^\s*import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/gm)) {
    if (!IMPORTS_PERMIS.has(m[1])) return { erreur: `import interdit : « ${m[1]} » (seuls react et remotion sont permis)` };
  }
  for (const motif of INTERDIT) {
    if (motif.test(source)) return { erreur: `élément interdit dans une vidéo : ${motif.source}` };
  }
  for (const nom of ['Video', 'duree', 'largeur', 'hauteur', 'fps']) {
    if (!new RegExp(`export\\s+(const|function|let)\\s+${nom}\\b`).test(source)) return { erreur: `il manque « export const ${nom} » dans la composition` };
  }
  return { ok: true };
}

// Trouve un navigateur sans affichage pour Remotion : celui qu'on indique, sinon celui que Remotion télécharge lui-même
function navigateur() {
  return process.env.AGENCE_NAVIGATEUR_VIDEO || undefined;
}

// Rend source (chemin d'un .tsx) vers sortie (chemin d'un .mp4). Renvoie { ok, duree } ou { erreur }.
export async function rendreVideo(source, sortie) {
  const texte = fs.readFileSync(source, 'utf8');
  const verif = verifierComposition(texte);
  if (verif.erreur) return { erreur: verif.erreur };

  const { bundle } = await import(path.join(code, 'node_modules/@remotion/bundler/dist/index.js'));
  const { renderMedia, selectComposition } = await import(path.join(code, 'node_modules/@remotion/renderer/dist/index.js'));

  // Un point d'entrée temporaire qui déclare la composition du fichier
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'agence-video-'));
  try {
    const entree = path.join(dossier, 'entree.tsx');
    fs.writeFileSync(entree, `import React from 'react'
import { registerRoot, Composition } from 'remotion'
import { Video, duree, largeur, hauteur, fps } from ${JSON.stringify(source)}
const Racine = () => React.createElement(Composition, { id: 'video', component: Video, durationInFrames: duree, fps, width: largeur, height: hauteur })
registerRoot(Racine)
`);
    const paquet = await bundle({ entryPoint: entree, onProgress: () => {} });
    const navigateurVideo = navigateur();
    const composition = await selectComposition({ serveUrl: paquet, id: 'video', ...(navigateurVideo ? { browserExecutable: navigateurVideo } : {}) });
    await renderMedia({ composition, serveUrl: paquet, codec: 'h264', outputLocation: sortie, ...(navigateurVideo ? { browserExecutable: navigateurVideo } : {}) });
    return { ok: true, duree: composition.durationInFrames / composition.fps };
  } catch (e) {
    return { erreur: String(e && e.message || e).split('\n')[0].slice(0, 300) };
  } finally {
    fs.rmSync(dossier, { recursive: true, force: true });
  }
}
