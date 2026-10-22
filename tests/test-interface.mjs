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
  let alerte = false, confirmations = 0, repondre = true;
  page.on('dialog', d => {
    if (d.type() === 'alert') alerte = true;
    if (d.type() === 'confirm') { confirmations++; return repondre ? d.accept() : d.dismiss(); }
    d.accept();
  });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(a.adresse);
  await page.waitForSelector('.locaux [data-agent]');
  const capture = nom => page.screenshot({ path: path.join(CAPTURES, nom + '.png') });

  console.log('Les locaux');
  verifier(await page.$$eval('.locaux [data-agent]', l => new Set(l.map(x => x.dataset.agent)).size) === 9, '8 agents et le studio ont leur bureau');
  const enseignes = await page.$eval('.locaux', l => l.textContent);
  verifier(['BUREAU DU PLANNING', 'SALLE DE CRÉA', 'OPEN SPACE', 'SALLE DU BRIEF', 'STUDIO'].every(n => enseignes.includes(n)), 'les 5 pièces de l\'agence');
  verifier(await page.$eval('.locaux [data-agent="planning"]', p => p.textContent.includes('Max')), 'Max est à son poste, avec son prénom');
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
  verifier(await page.$$eval('.orienter button', l => l.length) === 9, 'l\'accueil propose d\'aller au bon bureau');
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
  verifier(titres.includes('brief-reformule.md'), 'un fichier proposé avant l\'appel d\'un agent s\'ouvre aussi');
  verifier(await page.$eval('.locaux [data-agent="production"]', b => b.dataset.attente === '2' && b.textContent.includes('2 fichiers à valider')), 'le studio annonce 2 fichiers à valider');
  await capture('4-fenetres');

  console.log('Sécurité de l\'affichage');
  verifier(await page.$$eval('.fenetre .md', l => l.some(x => x.textContent.includes('<script>alert(1)</script>'))), 'un <script> proposé est affiché comme du texte');
  verifier(!alerte && !(await page.$('.fenetre .md script')), 'aucun script injecté ne s\'exécute');
  const liens = await page.$$eval('.fenetre .md a', l => l.map(a => a.getAttributeNames().sort().join(',')));
  verifier(liens.length > 0 && liens.every(n => n === 'href,rel,target'), 'un lien piégé ne glisse aucun attribut en plus');
  const essais = await page.evaluate(() => {
    const t0 = performance.now(); md('['.repeat(60000)); const crochets = performance.now() - t0;
    let profond = 'ok'; try { md('>'.repeat(5000) + ' x'); } catch (e) { profond = String(e); }
    const d = document.createElement('div');
    d.innerHTML = md('[a](https://a.fr/(https://b.fr/style=color:red;)');
    const lienPropre = [...d.querySelectorAll('a')].every(a => a.getAttributeNames().sort().join(',') === 'href,rel,target' && !a.querySelector('a') && /^https:\/\/[^"]+$/.test(a.getAttribute('href')));
    return { crochets, profond, lienPropre };
  });
  verifier(essais.crochets < 300, `une ligne de 60 000 « [ » se met en forme vite (${Math.round(essais.crochets)} ms)`);
  verifier(essais.profond === 'ok', '5 000 citations imbriquées ne font pas planter la page');
  verifier(essais.lienPropre, 'un lien dans un lien ne casse pas le HTML');

  console.log('Valider au studio');
  const devant = async nom => {
    const poignees = await page.$$('.fenetre .titre-fenetre');
    for (const h of poignees) if (await h.$eval('strong', s => s.textContent) === nom) { const b = await h.boundingBox(); await page.mouse.click(b.x + 200, b.y + 15); }
    await attendre(100);
  };
  await devant('brief-reformule.md');
  console.log('Une fenêtre modifiée ne se perd pas');
  await page.evaluate(() => { const w = [...document.querySelectorAll('.fenetre')].find(w => w.querySelector('strong').textContent === 'brief-reformule.md'); w.querySelector('[data-v="modifier"]').click(); });
  await page.evaluate(() => { const w = [...document.querySelectorAll('.fenetre')].find(w => w.querySelector('strong').textContent === 'brief-reformule.md'); const e = w.querySelector('.edition'); e.focus(); });
  await page.keyboard.type(' ajout');
  repondre = false;
  await page.keyboard.press('Escape');
  await attendre(100);
  verifier(confirmations === 1 && await page.evaluate(() => [...document.querySelectorAll('.fenetre strong')].some(s => s.textContent === 'brief-reformule.md')), 'Échap demande confirmation, et « Annuler » garde la fenêtre et le texte');
  repondre = true;
  await page.evaluate(() => { const w = [...document.querySelectorAll('.fenetre')].find(w => w.querySelector('strong').textContent === 'brief-reformule.md'); w.querySelector('[data-v="refuser"]').click(); });
  await attendre(300);
  await devant('insights.md');
  await page.click('[data-a="decider"][data-v="valider"]');
  await page.waitForFunction(() => !document.querySelector('[data-a="decider"]'), { timeout: 5000 });
  verifier(fs.existsSync(path.join(a.racine, 'projets', 'oasis-ete-2027', 'insights.md')), 'insights.md est écrit après le clic');
  await attendre(200);
  verifier(await page.$eval('.locaux [data-agent="production"]', b => b.dataset.attente === '0' && !b.classList.contains('actif')), 'plus rien à valider au studio');
  verifier(await page.$eval('#fil', f => f.textContent.includes('Enregistré')), 'le chat montre le fichier enregistré');

  console.log('Choisir');
  await devant('À toi de décider');
  const options = await page.$$('.fenetre .option');
  verifier(options.length === 2 && await page.$eval('.fenetre .option .conseil', c => !!c), 'deux options, la recommandée est marquée');
  verifier(await page.$$eval('#fil .decision .option', l => l.length) === 2, 'les options sont aussi cliquables dans le chat');
  await page.type('.precision', 'surtout en BTS');
  await page.click('.fenetre .option[data-v="1"]');
  await page.waitForFunction(() => [...document.querySelectorAll('.fenetre .titre-fenetre strong')].some(s => s.textContent === 'reco.md'), { timeout: 15000 });
  verifier(await page.$eval('#fil', f => f.textContent.includes('Je choisis : Les étudiants')), 'ton choix apparaît dans le chat');
  verifier(await page.$eval('#fil .decision .option.choisie', o => o.textContent.includes('Les étudiants')), 'la carte du choix est marquée');
  await page.click('[data-a="onglet"][data-v="modifier"]');
  await page.$eval('.edition', t => { t.value = '# Recommandation\n\nVersion corrigée par Evan.'; });
  await page.click('[data-a="decider"][data-v="valider"]');
  await attendre(500);
  verifier(fs.readFileSync(path.join(a.racine, 'projets', 'oasis-ete-2027', 'reco.md'), 'utf8').includes('corrigée par Evan'), 'Evan peut corriger un fichier avant de le valider');

  console.log('Écrire à un agent depuis son bureau');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.click('.locaux [data-agent="jury"] .court .pastille');
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

  console.log('Studio digital');
  // Une image du projet, ajoutée comme le ferait Evan
  await page.evaluate(async jeton => {
    const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    await fetch('/api/image', { method: 'POST', headers: { 'X-Jeton': jeton, 'Content-Type': 'application/json' }, body: JSON.stringify({ projet: 'oasis-ete-2027', nom: 'test.png', donnees: PNG }) });
  }, a.jeton);
  await page.type('#texte', 'SITE');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.fenetre iframe.apercu[src^="/apercu/"]', { timeout: 60000 });
  await attendre(800);
  const cadre = page.frames().find(fr => fr.url().includes('/apercu/'));
  verifier(cadre && await cadre.evaluate(() => document.body.dataset.ok === '1' && document.querySelector('h1').textContent.startsWith('La reco Oasis') && document.images[0].naturalWidth > 0), 'la présentation de Jade s\'affiche en vrai dans la fenêtre du studio, avec l\'image du projet');
  verifier(!(await page.$eval('.fenetre iframe.apercu', f => f.src)).includes('jeton'), 'l\'aperçu ne connaît pas le jeton');
  await capture('8-studio-digital');
  await page.click('.fenetre [data-a="decider"][data-v="valider"]');
  await attendre(400);
  for (let i = 0; i < 6; i++) await page.keyboard.press('Escape');

  console.log('Dossier du projet');
  await page.click('.barre [data-a="dossier"]');
  await page.waitForSelector('.liste-fichiers');
  verifier(await page.$$eval('.liste-fichiers button', l => l.map(b => b.textContent).join()) === 'brief.md,insights.md,presentation.html,reco.md', 'le dossier liste les fichiers du projet');

  console.log('Le lecteur');
  await page.click('.liste-fichiers button[data-v="presentation.html"]');
  await page.waitForSelector('.cadre-lecteur iframe[src]', { timeout: 10000 });
  verifier(await page.$eval('.cadre-lecteur iframe', f => f.getAttribute('src').startsWith('/apercu/')), 'le HTML s\'ouvre dans le lecteur, par une adresse d\'aperçu isolée');
  verifier(await page.$eval('.cadre-lecteur', c => c.getBoundingClientRect().height > 300), 'le lecteur a une vraie hauteur (la page est lisible)');
  await attendre(600);
  await capture('9-lecteur');
  await page.click('.cadre-lecteur .plein-ecran');
  await attendre(300);
  const plein = await page.evaluate(() => document.fullscreenElement && document.fullscreenElement.classList.contains('cadre-lecteur'));
  verifier(plein, 'le bouton « Plein écran » affiche la page sur tout l\'écran');
  if (plein) { await page.evaluate(() => document.exitFullscreen()); await attendre(300); }
  await page.evaluate(() => [...document.querySelectorAll('.fenetre')].forEach(w => w.querySelector('.fermer')?.click()));
  await page.click('.locaux [data-agent="production"]');
  await page.waitForSelector('.menu-poste');
  verifier(await page.$eval('.menu-poste', m => m.textContent.includes('Lire le produit (HTML)')), 'le studio propose « Lire le produit (HTML) »');
  await page.evaluate(() => [...document.querySelectorAll('.menu-poste button')].find(b => b.dataset.a === 'lecteur').click());
  await page.waitForSelector('.cadre-lecteur iframe[src]', { timeout: 10000 });
  verifier(await page.$eval('.fenetre[data-cle^="lire:"] .titre-fenetre strong', s => s.textContent) === 'presentation.html', 'le raccourci ouvre la présentation du projet');

  console.log('Sombre et téléphone');
  await page.keyboard.press('Escape');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await attendre(200);
  verifier(await page.evaluate(() => getComputedStyle(document.body).backgroundColor) === 'rgb(18, 17, 28)', 'le thème sombre s\'applique');
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
  // L'aperçu de la présentation a tenté d'appeler l'agence : l'isolement doit l'avoir bloqué
  verifier(erreursConsole.some(e => /connect-src 'none'/.test(e) && /api\/etat/.test(e)), 'le code d\'une présentation ne peut pas appeler l\'agence (bloqué)');
  const autres = erreursConsole.filter(e => !/connect-src 'none'|violates the document's Content Security Policy/.test(e));
  verifier(autres.length === 0, 'aucune autre erreur dans la console' + (autres.length ? ' : ' + autres.join(' | ') : ''));
} catch (e) {
  verifier(false, 'exception : ' + e.stack);
} finally {
  await nav.close();
  a.arreter();
}
bilan();
