// La page des locaux dans un vrai navigateur (Chrome sans affichage) : brief, fenêtres, choix, studio, messages directs
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-core';
import { demarrer, verifier, bilan, attendre, code } from './outils.mjs';

const CHROMES = [process.env.CHROME_BIN, '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  '/usr/bin/chromium', '/usr/bin/google-chrome'].filter(Boolean);
const chrome = CHROMES.find(c => fs.existsSync(c));
if (!chrome) { console.log('Chrome introuvable : test de la page sauté (indique CHROME_BIN).'); console.log('aucune erreur'); process.exit(0); }

const CAPTURES = path.join(code, 'tests', '.captures');
fs.mkdirSync(CAPTURES, { recursive: true });
const a = await demarrer();
const nav = await puppeteer.launch({ executablePath: chrome, headless: true, args: ['--no-sandbox'] });
const erreursConsole = [];
try {
  const page = await nav.newPage();
  page.on('console', m => { if (m.type() === 'error') erreursConsole.push(m.text()); });
  page.on('pageerror', e => erreursConsole.push(String(e)));
  let alerte = false;
  page.on('dialog', d => { if (d.type() === 'alert') alerte = true; d.accept(); });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(a.adresse);
  await page.waitForSelector('.poste');
  const capture = nom => page.screenshot({ path: path.join(CAPTURES, nom + '.png') });

  console.log('Les locaux');
  verifier(await page.$$eval('.poste', l => l.length) === 9, '8 agents et le studio ont leur bureau');
  verifier(await page.$$eval('.piece', l => l.map(p => p.dataset.piece).join()) === 'planning,crea,openspace,brief,studio', 'les 5 pièces de l\'agence');
  verifier(await page.$eval('.piece[data-piece="planning"]', p => p.textContent.includes('Max')), 'Max est au bureau du planning');
  verifier(await page.$$eval('#circuit li', l => l.length) === 8, 'le circuit a 8 étapes');
  verifier(await page.$eval('#fil', f => f.textContent.includes('Bonjour patron')), 'accueil vide honnête');
  await capture('1-accueil-clair');

  console.log('Le circuit animé');
  await page.click('[data-a="circuit"]');
  await attendre(600);
  verifier(await page.$$eval('#circuit li.encours', l => l.length) === 1, 'une étape s\'allume');
  verifier(await page.$eval('#dossier-vol', d => d.classList.contains('visible')), 'le dossier vole de bureau en bureau');
  await capture('2-circuit');

  console.log('Nouveau brief');
  await page.click('.barre [data-a="nouveau-brief"]');
  await page.waitForSelector('#form-brief');
  verifier(await page.$$eval('.orienter button', l => l.length) === 8, 'l\'accueil propose d\'aller au bon bureau');
  await attendre(400);
  await capture('3-nouveau-brief');
  await page.type('#form-brief [name=nom]', 'Oasis été 2027');
  await page.type('#form-brief [name=texte]', 'Faire une reco pour Oasis. Rendu le 12 décembre.');
  await page.click('[data-a="envoyer-brief"]');
  await page.waitForFunction(() => document.querySelectorAll('.fenetre').length >= 3, { timeout: 15000 });
  await attendre(300);
  verifier(await page.$eval('#choix-projet', s => s.value) === 'oasis-ete-2027', 'le nouveau projet est ouvert');
  verifier(await page.$eval('#fil', f => f.textContent.includes('Claire passe le dossier à Inès')), 'on voit Claire passer le dossier à Inès');
  verifier(await page.$eval('#fil', f => f.textContent.includes('Inès cherche sur le web')), 'on voit Inès chercher sur le web');
  const titres = await page.$$eval('.fenetre .titre-fenetre strong', l => l.map(x => x.textContent));
  verifier(titres.includes('Proposition de Inès'), 'la proposition d\'Inès s\'ouvre dans une fenêtre');
  verifier(titres.includes('À toi de décider'), 'le choix s\'ouvre dans une fenêtre');
  verifier(titres.includes('insights.md'), 'le fichier à valider s\'ouvre dans une fenêtre');
  verifier(await page.$eval('.poste[data-v="production"] .badge', b => b.textContent) === '1', 'le studio affiche 1 fichier à valider');
  await capture('4-fenetres');

  console.log('Sécurité de l\'affichage');
  verifier(await page.$$eval('.fenetre .md', l => l.some(x => x.textContent.includes('<script>alert(1)</script>'))), 'un <script> proposé est affiché comme du texte');
  verifier(!alerte && !(await page.$('.fenetre .md script')), 'aucun script injecté ne s\'exécute');

  console.log('Valider au studio');
  const devant = async nom => {
    const poignees = await page.$$('.fenetre .titre-fenetre');
    for (const h of poignees) if (await h.$eval('strong', s => s.textContent) === nom) { const b = await h.boundingBox(); await page.mouse.click(b.x + 200, b.y + 15); }
    await attendre(100);
  };
  await devant('insights.md');
  await page.click('[data-a="decider"][data-v="valider"]');
  await page.waitForFunction(() => !document.querySelector('[data-a="decider"]'), { timeout: 5000 });
  verifier(fs.existsSync(path.join(a.racine, 'projets', 'oasis-ete-2027', 'insights.md')), 'insights.md est écrit après le clic');
  await attendre(200);
  verifier(!(await page.$('.poste[data-v="production"] .badge')), 'plus rien à valider au studio');
  verifier(await page.$eval('#fil', f => f.textContent.includes('Enregistré')), 'le chat montre le fichier enregistré');

  console.log('Choisir');
  await devant('À toi de décider');
  const options = await page.$$('.option');
  verifier(options.length === 2 && await page.$eval('.option .conseil', c => !!c), 'deux options, la recommandée est marquée');
  await page.type('.precision', 'surtout en BTS');
  await page.click('.option[data-v="1"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.fenetre .titre-fenetre strong')].some(s => s.textContent === 'reco.md'), { timeout: 15000 });
  verifier(await page.$eval('#fil', f => f.textContent.includes('Je choisis : Les étudiants')), 'ton choix apparaît dans le chat');
  verifier(await page.$eval('#fil', f => f.textContent.includes('Choisi : Les étudiants')), 'la carte du choix est marquée');
  await page.click('[data-a="onglet"][data-v="modifier"]');
  await page.$eval('.edition', t => { t.value = '# Recommandation\n\nVersion corrigée par Evan.'; });
  await page.click('[data-a="decider"][data-v="valider"]');
  await attendre(500);
  verifier(fs.readFileSync(path.join(a.racine, 'projets', 'oasis-ete-2027', 'reco.md'), 'utf8').includes('corrigée par Evan'), 'Evan peut corriger un fichier avant de le valider');

  console.log('Écrire à un agent depuis son bureau');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.click('.poste[data-v="jury"]');
  await page.waitForSelector('.menu-poste');
  await page.click('.menu-poste [data-a="ecrire"]');
  verifier(await page.$eval('#destinataire', d => d.textContent.includes('Le Jury')), 'le chat passe en message direct au Jury');
  await page.type('#texte', 'Relis mon plan');
  await page.keyboard.press('Enter');
  await page.waitForFunction(() => document.querySelector('#fil').textContent.includes('ici jury'), { timeout: 10000 });
  verifier(true, 'le Jury répond dans le chat');
  await capture('5-message-direct');
  await page.click('[data-a="retour"]');
  verifier(await page.$eval('#destinataire', d => d.textContent.includes('Claire pilote')), 'retour au chat de l\'agence');

  console.log('Dossier du projet');
  await page.click('.barre [data-a="dossier"]');
  await page.waitForSelector('.liste-fichiers');
  verifier(await page.$$eval('.liste-fichiers button', l => l.map(b => b.textContent).join()) === 'brief.md,insights.md,reco.md', 'le dossier liste les fichiers du projet');

  console.log('Sombre et téléphone');
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await attendre(200);
  verifier(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(22, 20, 18)', 'le thème sombre s\'applique');
  await capture('6-sombre');
  await page.setViewport({ width: 390, height: 844 });
  await attendre(200);
  const deborde = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1
    ? [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 5).map(e => e.tagName + '.' + e.className) : []);
  verifier(!deborde.length, 'pas de défilement de côté sur téléphone' + (deborde.length ? ' : ' + deborde.join(', ') : ''));
  await capture('7-telephone');

  console.log('Sans jeton');
  const p2 = await nav.newPage();
  await p2.goto(a.base + '/');
  verifier(await p2.$eval('body', b => b.textContent.includes('L\'agence est fermée')), 'sans le jeton, la page explique comment ouvrir l\'agence');
  verifier(erreursConsole.length === 0, 'aucune erreur dans la console' + (erreursConsole.length ? ' : ' + erreursConsole.join(' | ') : ''));
} catch (e) {
  verifier(false, 'exception : ' + e.stack);
} finally {
  await nav.close();
  a.arreter();
}
bilan();
