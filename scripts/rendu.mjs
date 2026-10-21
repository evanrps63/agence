// Le studio ouvre un site ou une présentation HTML dans un vrai navigateur (Chrome sans affichage) :
// il photographie chaque diapo (ou la page en ordinateur et en téléphone), repère les défauts visibles
// (texte qui déborde, erreurs, ressources bloquées) et compose des planches contact que les agents lisent.
// Le fichier est chargé depuis l'aperçu isolé du serveur : son code ne peut ni lire le disque, ni appeler l'agence.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createRequire } from 'module';

const CHROMES = [process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);

export function trouverChrome() {
  if (process.env.CHROME_BIN) return fs.existsSync(process.env.CHROME_BIN) ? process.env.CHROME_BIN : null;
  return CHROMES.find(c => { try { return fs.statSync(c).isFile(); } catch { return false; } }) || null;
}
function chargerPuppeteer(code) {
  try { return createRequire(path.join(code, 'package.json'))('puppeteer-core'); } catch { return null; }
}
const attendre = ms => new Promise(r => setTimeout(r, ms));
const empreinte = b => crypto.createHash('sha1').update(b).digest('hex');
const PERMIS = /^(data:|blob:|about:|https:\/\/fonts\.googleapis\.com\/|https:\/\/fonts\.gstatic\.com\/)/;

// Ce qui déborde ou se coupe dans l'écran visible (zone de largeur l, hauteur h)
function defauts(l, h) {
  const out = [];
  for (const e of document.querySelectorAll('body *')) {
    const st = getComputedStyle(e);
    if (st.visibility === 'hidden' || st.display === 'none' || +st.opacity === 0) continue;
    const texte = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim();
    if (!texte) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // Élément de l'écran courant seulement (les diapos cachées sont souvent hors champ ou transparentes)
    let p = e, cache = false;
    while (p && p !== document.body) { const s = getComputedStyle(p); if (+s.opacity === 0 || s.visibility === 'hidden') { cache = true; break; } p = p.parentElement; }
    if (cache) continue;
    const dehors = r.right > l + 2 || r.bottom > h + 2 || r.left < -2 || r.top < -2;
    const visible = r.right > 0 && r.bottom > 0 && r.left < l && r.top < h;
    const coupe = (e.scrollWidth > e.clientWidth + 2 && ['hidden', 'clip'].includes(st.overflowX)) || (e.scrollHeight > e.clientHeight + 2 && ['hidden', 'clip'].includes(st.overflowY));
    if (visible && dehors) out.push(`texte qui sort de l'écran : « ${texte.slice(0, 60)} »`);
    else if (coupe) out.push(`texte coupé dans son cadre : « ${texte.slice(0, 60)} »`);
    const taille = parseFloat(st.fontSize);
    if (visible && taille && taille < 12 && l >= 1200) out.push(`texte très petit (${Math.round(taille)} px) : « ${texte.slice(0, 40)} »`);
    if (out.length > 12) break;
  }
  return out;
}

// Planche contact : les vignettes numérotées en grille, sur une seule image
async function planche(page, images, dossier, nom, colonnes, largeur) {
  const vignettes = images.map((im, i) => `<figure><img src="data:image/jpeg;base64,${im.toString('base64')}"><figcaption>${i + 1}</figcaption></figure>`).join('');
  await page.setViewport({ width: colonnes * largeur + (colonnes + 1) * 16, height: 400, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><style>body{margin:0;padding:16px;background:#222;display:grid;grid-template-columns:repeat(${colonnes},${largeur}px);gap:16px;font:600 16px system-ui;color:#fff}figure{margin:0}img{width:${largeur}px;display:block;border-radius:4px;background:#fff}figcaption{padding-top:4px}</style>${vignettes}`, { waitUntil: 'load' });
  const f = path.join(dossier, nom);
  await page.screenshot({ path: f, fullPage: true });
  return f;
}

// adresse : URL de l'aperçu isolé ; dossier : où ranger les photos ; nom : nom du fichier HTML
export async function photographier({ code, adresse, dossier, nom }) {
  const chrome = trouverChrome();
  const puppeteer = chargerPuppeteer(code);
  if (!chrome || !puppeteer) return { indisponible: !chrome ? 'navigateur introuvable (installe Google Chrome)' : 'outil de capture absent (lance npm install)' };
  fs.rmSync(dossier, { recursive: true, force: true });
  fs.mkdirSync(dossier, { recursive: true });
  const args = ['--hide-scrollbars', '--mute-audio'];
  if (process.getuid && process.getuid() === 0) args.push('--no-sandbox');
  const nav = await puppeteer.launch({ executablePath: chrome, headless: true, args });
  const problemes = new Set(), erreurs = new Set(), bloques = new Set();
  try {
    const page = await nav.newPage();
    await page.setRequestInterception(true);
    page.on('request', r => {
      const u = r.url();
      // L'icône d'onglet que Chrome demande tout seul n'est pas un défaut du fichier
      if (/\/favicon\.ico$/.test(u)) return r.respond({ status: 204, body: '' });
      if (u.startsWith(adresse.replace(/\/$/, '')) || PERMIS.test(u)) return r.continue();
      try { bloques.add(new URL(u).hostname); } catch {}
      r.abort();
    });
    page.on('pageerror', e => erreurs.add(String(e.message || e).slice(0, 160)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR_FAILED|blocked/i.test(m.text())) erreurs.add(m.text().slice(0, 160)); });
    page.on('dialog', d => d.dismiss().catch(() => {}));
    await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
    await page.goto(adresse, { waitUntil: 'load', timeout: 20000 }).catch(e => erreurs.add('chargement : ' + e.message.slice(0, 100)));
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    await attendre(1500);
    const imagesCassees = await page.evaluate(() => [...document.images].filter(i => i.complete && !i.naturalWidth).map(i => i.getAttribute('src'))).catch(() => []);
    for (const s of imagesCassees) problemes.add(`image introuvable : ${String(s).slice(0, 80)}`);
    const hauteur = await page.evaluate(() => document.documentElement.scrollHeight).catch(() => 1080);
    const presentation = /presentation|diapo|slides?/.test(nom) || hauteur <= 1090;
    const sortie = { presentation, photos: [], planches: [] };

    if (presentation) {
      // On avance diapo par diapo ; on garde le dernier état de chaque diapo (après ses étapes)
      const photos = [];
      let courante = await page.screenshot({ type: 'jpeg', quality: 80 });
      let hash = await page.evaluate(() => location.hash);
      let identiques = 0, n = 1;
      const noter = async () => { for (const d of await page.evaluate(defauts, 1920, 1080)) problemes.add(`diapo ${n} : ${d}`); };
      await noter();
      for (let i = 0; i < 90 && photos.length < 30; i++) {
        await page.keyboard.press('ArrowRight');
        await attendre(950);
        const img = await page.screenshot({ type: 'jpeg', quality: 80 });
        const h = await page.evaluate(() => location.hash);
        if (empreinte(img) === empreinte(courante) && h === hash) { if (++identiques >= 3) break; continue; }
        identiques = 0;
        if (h !== hash || !hash) { photos.push(courante); n++; }
        courante = img; hash = h;
        await noter();
      }
      photos.push(courante);
      photos.forEach((p, i) => { const f = path.join(dossier, `diapo-${String(i + 1).padStart(2, '0')}.jpg`); fs.writeFileSync(f, p); sortie.photos.push(f); });
      for (let i = 0; i < photos.length; i += 12) sortie.planches.push(await planche(page, photos.slice(i, i + 12), dossier, `planche-${i / 12 + 1}.png`, 4, 440));
    } else {
      const ordi = await page.screenshot({ type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 1920, height: Math.min(hauteur, 7000) } });
      for (const d of await page.evaluate(defauts, 1920, Math.min(hauteur, 7000))) problemes.add(`ordinateur : ${d}`);
      await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
      await attendre(800);
      const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
      if (largeur > 392) problemes.add(`téléphone : la page déborde sur le côté (${largeur} px pour 390)`);
      const hm = await page.evaluate(() => document.documentElement.scrollHeight);
      const tel = await page.screenshot({ type: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: 390, height: Math.min(hm, 6000) } });
      for (const d of await page.evaluate(defauts, 390, Math.min(hm, 6000))) problemes.add(`téléphone : ${d}`);
      fs.writeFileSync(path.join(dossier, 'ordinateur.jpg'), ordi); fs.writeFileSync(path.join(dossier, 'telephone.jpg'), tel);
      sortie.photos.push(path.join(dossier, 'ordinateur.jpg'), path.join(dossier, 'telephone.jpg'));
      sortie.planches.push(await planche(page, [ordi], dossier, 'planche-ordinateur.png', 1, 960), await planche(page, [tel], dossier, 'planche-telephone.png', 1, 390));
    }
    for (const b of bloques) problemes.add(`ressource extérieure bloquée : ${b} (seules les polices Google sont permises)`);
    for (const e of erreurs) problemes.add(`erreur JavaScript : ${e}`);
    sortie.problemes = [...problemes].slice(0, 30);
    return sortie;
  } catch (e) {
    return { indisponible: 'le navigateur a échoué : ' + String(e.message || e).slice(0, 150) };
  } finally {
    await nav.close().catch(() => {});
  }
}
