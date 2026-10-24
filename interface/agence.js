'use strict';
// Les locaux de l'agence : bureaux, chat du patron, fenêtres des propositions, choix et fichiers à valider.
// Parle au serveur local (scripts/agence.mjs). Le jeton arrive dans l'adresse (#jeton=…).

const JETON = (location.hash.match(/jeton=([0-9a-f]+)/) || [])[1] || '';
const E = {
  equipe: [], pilote: 'clientele', projets: [], fils: {}, enCours: new Set(), fil: 'agence:-', projet: null,
  actifs: new Map(), live: {}, pret: true, github: false, charge: false, demo: false
};
const PRODUCTION = { id: 'production', prenom: 'Studio', poste: 'Poste de production', piece: 'studio', couleur: '#57534e', description: 'Rédige les livrables. Chaque fichier t\'est montré avant d\'être écrit : tu valides ou tu refuses.' };
const CIRCUIT = [
  { nom: 'Brief', agents: [], texte: 'Tu donnes le brief à l\'accueil.' },
  { nom: 'Reformulation', agents: ['clientele'], texte: 'Claire reformule le brief, cadre le livrable et les consignes du prof.' },
  { nom: 'Insights', agents: ['etudes'], texte: 'Inès cherche les faits : marché, concurrents, cible. Chaque chiffre est sourcé.' },
  { nom: 'Stratégie', agents: ['planning'], texte: 'Max pose la problématique, l\'insight, la tension et le positionnement, puis écrit le brief créatif.' },
  { nom: 'Idée créative', agents: ['redaction', 'direction-artistique'], texte: 'Hugo et Léa trouvent le concept : les mots et l\'image.' },
  { nom: 'Dispositif', agents: ['social', 'media'], texte: 'Sam et Nora bâtissent le dispositif : plateformes, médias, budget, KPI.' },
  { nom: 'Relecture', agents: ['jury'], texte: 'Le Jury relit comme un prof : cohérence, sources, méthode, orthographe.' },
  { nom: 'Livrable', agents: ['digital'], texte: 'Jade met la reco en forme au studio : présentation ou site en HTML. Tu valides chaque fichier.' }
];
const ORIENTER = [
  ['redaction', 'Une accroche, un slogan'], ['etudes', 'Des chiffres, un benchmark'],
  ['planning', 'Une question de méthode'], ['jury', 'Faire relire un travail'],
  ['social', 'Une idée de post'], ['media', 'Un budget, des KPI'],
  ['direction-artistique', 'Une piste visuelle'], ['digital', 'Un site, une présentation'], ['motion', 'Une vidéo, un storyboard'], ['clientele', 'Je ne sais pas à qui demander']
];

// ---------- Outils ----------
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const filAgence = () => 'agence:' + (E.projet || '-');
const estAgence = f => f.startsWith('agence:');
const agent = id => id === 'production' ? PRODUCTION : (E.equipe.find(e => e.id === id) || { id, prenom: id, poste: '', couleur: '#57534e', piece: 'openspace', description: '' });
const messages = f => (E.fils[f] ||= { messages: [], cout: 0 }).messages;
function memoire(cle, val) {
  try { if (val === undefined) return localStorage.getItem(cle); if (val === null) localStorage.removeItem(cle); else localStorage.setItem(cle, val); } catch { return null; }
}
async function api(chemin, corps) {
  const r = await fetch(chemin, corps === undefined ? { headers: { 'X-Jeton': JETON } }
    : { method: 'POST', headers: { 'X-Jeton': JETON, 'Content-Type': 'application/json' }, body: JSON.stringify(corps) });
  let json = {}; try { json = await r.json(); } catch {}
  if (r.status === 403 && json.erreur === 'jeton refusé') perimee();
  if (!r.ok) throw new Error(json.erreur || 'erreur ' + r.status);
  return json;
}
// L'agence a été relancée (nouveau jeton) ou fermée : cet onglet ne peut plus rien faire
function perimee() {
  toast('Cette page n\'est plus reliée à l\'agence (elle a été relancée ou fermée). Ferme cet onglet : npm run agence ouvre la bonne page.', 0);
}
let minuterieToast;
function toast(texte, duree = 3500) {
  const t = $('#toast'); t.textContent = texte; t.hidden = false;
  clearTimeout(minuterieToast);
  if (duree) minuterieToast = setTimeout(() => { t.hidden = true; }, duree);
}

// ---------- Texte mis en forme (Markdown simple, tout est échappé d'abord) ----------
const LIEN = (url, texte) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${texte}</a>`;
function enLigne(t) {
  // Une ligne géante n'est pas mise en forme (évite de figer la page)
  if (t.length > 5000) return esc(t);
  return esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>')
    // Liens [texte](url) et adresses nues en une seule passe : le HTML produit n'est jamais relu
    .replace(/\[([^\[\]]+)\]\((https?:\/\/[^\s()"<>]+)\)|(^|[\s(])(https?:\/\/[^\s()"<>]+)/g,
      (tout, texte, url, avant, nue) => texte !== undefined ? LIEN(url, texte) : avant + LIEN(nue, nue));
}
function md(source, profondeur = 0) {
  const l = String(source || '').replace(/\r/g, '').split('\n');
  const out = [];
  const debutBloc = s => /^(```|#{1,4}\s|>\s?|\s*([-*+]|\d+[.)])\s+|\|)/.test(s) || /^(-{3,}|\*{3,})\s*$/.test(s);
  for (let i = 0; i < l.length;) {
    const s = l[i];
    if (!s.trim()) { i++; continue; }
    if (s.startsWith('```')) {
      const code = []; i++;
      while (i < l.length && !l[i].startsWith('```')) code.push(l[i++]);
      i++; out.push(`<pre><code>${esc(code.join('\n'))}</code></pre>`); continue;
    }
    let m = s.match(/^(#{1,4})\s+(.*)$/);
    if (m) { out.push(`<h${m[1].length}>${enLigne(m[2])}</h${m[1].length}>`); i++; continue; }
    if (/^(-{3,}|\*{3,})\s*$/.test(s)) { out.push('<hr>'); i++; continue; }
    if (/^>\s?/.test(s)) {
      const q = [];
      while (i < l.length && /^>\s?/.test(l[i])) q.push(l[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${profondeur < 6 ? md(q.join('\n'), profondeur + 1) : `<p>${esc(q.join(' '))}</p>`}</blockquote>`); continue;
    }
    if (s.trim().startsWith('|') && l[i + 1] && /^\s*\|?\s*:?-{2,}/.test(l[i + 1])) {
      const cellules = x => x.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const tete = cellules(s); i += 2;
      const lignes = [];
      while (i < l.length && l[i].trim().startsWith('|')) lignes.push(cellules(l[i++]));
      out.push(`<table><thead><tr>${tete.map(c => `<th>${enLigne(c)}</th>`).join('')}</tr></thead><tbody>${lignes.map(r => `<tr>${r.map(c => `<td>${enLigne(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    m = s.match(/^\s*([-*+]|\d+[.)])\s+/);
    if (m) {
      const ordonnee = /\d/.test(m[1]);
      const items = [];
      while (i < l.length && /^\s*([-*+]|\d+[.)])\s+/.test(l[i])) {
        let item = l[i++].replace(/^\s*([-*+]|\d+[.)])\s+/, '');
        while (i < l.length && /^\s{2,}\S/.test(l[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(l[i])) item += ' ' + l[i++].trim();
        items.push(`<li>${enLigne(item)}</li>`);
      }
      out.push(ordonnee ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`); continue;
    }
    const p = [];
    while (i < l.length && l[i].trim() && !(p.length && debutBloc(l[i]))) p.push(enLigne(l[i++]));
    out.push(`<p>${p.join('<br>')}</p>`);
  }
  return out.join('');
}
// md() protégé : en cas d'erreur, le texte brut reste lisible
function mdSur(t) { try { return md(t); } catch (e) { console.error(e); return `<pre>${esc(t)}</pre>`; } }
const apercu = t => String(t || '').replace(/[#*`>|_]/g, '').replace(/\s+/g, ' ').trim().slice(0, 180);

// ---------- Avatars (dessinés dans la page : symboles #av-<agent>) ----------
function avatar(id, taille = 36) {
  return `<svg class="avatar" width="${taille}" height="${taille}" aria-hidden="true"><use href="#av-${esc(id)}"/></svg>`;
}

// ---------- Les locaux (décor isométrique, une personne = [data-agent]) ----------
function enAttente() {
  return messages(filAgence()).filter(m => m.de === 'fichier' && m.statut === 'attente').length;
}
// Chaque agent a son bureau dans les locaux (Jade et Nino au Studio)
const POSTE = {};
function poste(id) { return document.querySelector(`.locaux [data-agent="${CSS.escape(POSTE[id] || id)}"]`); }
// Ajuste les pastilles et les bulles à la largeur de leur texte
function ajusterEtiquette(e) {
  for (const g of e.querySelectorAll('.court, .long')) {
    const cache = getComputedStyle(g).display === 'none';
    if (cache) g.style.display = 'inline';
    const pr = g.querySelector('.prenom'), ro = g.querySelector('.role'), fond = g.querySelector('.pastille'), puce = g.querySelector('.puce');
    if (pr && fond) {
      const l = Math.max(pr.getComputedTextLength(), ro ? ro.getComputedTextLength() : 0);
      const total = Math.ceil(l + (ro ? 30 : 27)), x0 = -total / 2, dx = ro ? 10.5 : 10;
      fond.setAttribute('x', x0); fond.setAttribute('width', total);
      if (puce) { if (puce.tagName === 'circle') puce.setAttribute('cx', x0 + dx); else puce.setAttribute('x', x0 + dx - 3.5); }
      pr.setAttribute('x', x0 + dx + 8.5); if (ro) ro.setAttribute('x', x0 + dx + 8.5);
    }
    if (cache) g.style.display = '';
  }
  const b = e.querySelector('.bulle-texte');
  if (b) {
    const loupe = e.querySelector('.loupe');
    const lb = b.getComputedTextLength(), pad = loupe ? 30 : 14, wb = Math.ceil(lb + pad + 14), xb = -wb / 2;
    const r = e.querySelector('.bulle-fond');
    if (r) { r.setAttribute('x', xb); r.setAttribute('width', wb); }
    b.setAttribute('x', xb + pad);
    if (loupe) loupe.setAttribute('transform', `translate(${xb + 15},-51.5)`);
  }
}
function rendreLocaux() {
  for (const p of document.querySelectorAll('.locaux [data-agent]')) {
    const a = agent(p.dataset.agent);
    p.setAttribute('aria-label', `${a.prenom}, ${a.poste}. Clique pour lui écrire.`);
    const pr = p.querySelector('.court .prenom');
    if (pr && p.dataset.agent !== 'production') pr.textContent = a.prenom;
    const e = p.querySelector('.etiquette');
    if (e) ajusterEtiquette(e);
  }
  majPostes();
}
function estActif(id) {
  for (const s of E.actifs.values()) if (s.has(id)) return true;
  if (id === E.pilote && [...E.enCours].some(estAgence)) return true;
  if (id === 'production') return enAttente() > 0 || estActif('digital');
  return E.enCours.has(id);
}
function majPostes() {
  for (const p of document.querySelectorAll('.locaux [data-agent]')) {
    const id = p.dataset.agent;
    // Pendant la démo du circuit, c'est elle qui allume les bureaux
    if (!E.demo) p.classList.toggle('actif', estActif(id));
    if (id === 'production') {
      const n = enAttente();
      p.dataset.attente = n;
      if (n) texteBulle(p, n === 1 ? '1 fichier à valider' : `${n} fichiers à valider`);
    }
  }
}
function texteBulle(p, texte) {
  const b = p.querySelector('.bulle-texte');
  if (!b) return;
  const court = texte.length > 46 ? texte.slice(0, 44) + '…' : texte;
  b.textContent = court;
  ajusterEtiquette(p.querySelector('.etiquette'));
}
// Une phrase qui s'affiche quelques secondes au-dessus de la personne
function bulle(id, texte) {
  const p = poste(id);
  if (!p) return;
  texteBulle(p, texte);
  p.classList.add('parle');
  clearTimeout(p._bulle);
  p._bulle = setTimeout(() => p.classList.remove('parle'), 5000);
}
// Le dossier jaune vole jusqu'au bureau de la personne
function envolerDossier(id) {
  const p = poste(id), d = $('#dossier-vol');
  if (!p || !d) return;
  const t = (p.querySelector('.etiquette')?.getAttribute('transform') || '').match(/translate\(([-\d.]+),\s*([-\d.]+)\)/);
  if (!t) return;
  d.style.transform = `translate(${Number(t[1]) + 26}px, ${Number(t[2]) + 52}px)`;
  d.classList.add('visible');
}
function etapeDe(id) { return CIRCUIT.findIndex(e => e.agents.includes(id)); }
const TUILE = '<svg class="tuile" viewBox="0 0 52 34" width="52" height="34" aria-hidden="true"><polygon class="t-g" points="2,13 26,26 26,33 2,20"/><polygon class="t-d" points="26,26 50,13 50,20 26,33"/><polygon class="t-h" points="26,0 50,13 26,26 2,13"/></svg>';
const COCHE = '<svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true"><path d="M2.5,6.5 L5,9 L9.5,3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function rendreCircuit() {
  $('#circuit').innerHTML = CIRCUIT.map((e, i) => `<li data-i="${i}"><span class="pied">${TUILE}<b>${i + 1}</b></span><span class="etape-nom">${esc(e.nom)}</span><span class="qui">${(e.agents.length ? e.agents : ['clientele']).map(a => avatar(a, 18)).join('')}</span></li>`).join('');
}
function marquerCircuit(encours, faits = []) {
  for (const li of document.querySelectorAll('#circuit li')) {
    const i = Number(li.dataset.i);
    const fait = faits.includes(i) && !encours.includes(i);
    li.classList.toggle('encours', encours.includes(i));
    li.classList.toggle('fait', fait);
    li.querySelector('b').innerHTML = fait ? COCHE : String(i + 1);
    if (encours.includes(i)) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current');
  }
}
function majCircuitDirect() {
  if (E.demo) return;
  const f = filAgence();
  const enMarche = E.enCours.has(f);
  const vus = new Set();
  for (const m of messages(f)) if (m.de === 'proposition' || m.de === 'etape') { const i = etapeDe(m.agent); if (i >= 0) vus.add(i); }
  if (messages(f).length) vus.add(0);
  if (messages(f).some(m => m.de === 'agent')) vus.add(1);
  if (messages(f).some(m => m.de === 'fichier' && m.statut === 'valide')) vus.add(7);
  const encours = [...(E.actifs.get(f) || [])].map(etapeDe).filter(i => i >= 0);
  if (enMarche && !encours.length) encours.push(1);
  marquerCircuit(encours, [...vus]);
  $('#legende').textContent = enMarche
    ? (encours.length ? `Étape ${encours[encours.length - 1] + 1} sur 8 · ${CIRCUIT[encours[encours.length - 1]].texte}` : 'L\'agence travaille.')
    : 'Clique sur une personne pour lui écrire.';
}
async function jouerCircuit() {
  if (E.demo) return;
  E.demo = true;
  for (const p of document.querySelectorAll('.locaux [data-agent]')) p.classList.remove('actif');
  const faits = [];
  for (let i = 0; i < CIRCUIT.length; i++) {
    const e = CIRCUIT[i];
    marquerCircuit([i], faits);
    $('#legende').textContent = `Étape ${i + 1} sur 8 · ${e.texte}`;
    const qui = e.agents.length ? e.agents : ['clientele'];
    envolerDossier(qui[0]);
    for (const id of qui) { poste(id)?.classList.add('actif'); bulle(id, e.nom); }
    await new Promise(r => setTimeout(r, 2300));
    for (const id of qui) poste(id)?.classList.remove('actif');
    faits.push(i);
  }
  marquerCircuit([], faits);
  $('#legende').textContent = 'Voilà le circuit d\'une reco. À chaque étape, les décisions te reviennent.';
  await new Promise(r => setTimeout(r, 2500));
  $('#dossier-vol').classList.remove('visible');
  E.demo = false;
  majPostes();
  majCircuitDirect();
}

// ---------- Le chat ----------
function rendreTete() {
  const f = E.fil;
  if (estAgence(f)) {
    const p = E.projets.find(x => x.slug === E.projet);
    const pile = ['clientele', 'etudes', 'planning', 'redaction', 'direction-artistique'].map(a => avatar(a, 26)).join('');
    $('#destinataire').innerHTML = `<div class="pile">${pile}<span class="plus">+3</span></div><div class="titre"><strong>L'agence</strong><span>${p ? esc(p.nom) + ' · ' + esc(p.type) : 'Sans projet'} · Claire pilote, tu décides</span></div>`;
    $('#texte').placeholder = 'Écris à l\'agence… (Maj + Entrée : nouvelle ligne)';
  } else {
    const a = agent(f);
    $('#destinataire').innerHTML = `<button class="retour" data-a="retour">← L'agence</button>${avatar(f, 32)}<div class="titre"><strong>${esc(a.prenom)}</strong><span>${esc(a.poste)} · message direct, en lecture seule</span></div>`;
    $('#texte').placeholder = `Écris à ${a.prenom}…`;
  }
}
function rendreMessage(m, f) {
  try { return rendreMessageBrut(m, f); }
  catch (e) { console.error(e); return `<div class="ligne-action alerte"><p>Message illisible : ${esc(String(m && (m.texte || m.question || m.chemin) || '').slice(0, 200))}</p></div>`; }
}
const heure = t => t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
const LOUPE = '<svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M13,13 L17.5,17.5" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>';
const MINI_DOSSIER = '<svg class="mini-dossier" viewBox="0 0 20 16" width="18" height="14" aria-hidden="true"><path d="M1,3 h6 l2,2 h10 v10 h-18 z" fill="#f6c344"/><path d="M1,6 h18 v9 h-18 z" fill="#e2a92a"/></svg>';
function rendreMessageBrut(m, f) {
  const a = agent(m.agent);
  switch (m.de) {
    case 'evan': {
      const [tete, ...reste] = String(m.texte).split('\n');
      return `<div class="msg-evan"><p class="${reste.length ? 'fort' : ''}">${esc(tete)}</p>${reste.length ? `<p>${esc(reste.join('\n').trim())}</p>` : ''}<span class="heure">Toi · ${heure(m.t)}</span></div>`;
    }
    case 'etape': {
      if (m.alerte) return `<div class="ligne-action alerte"><span class="icone-action">!</span><p>${esc(m.texte)}</p></div>`;
      const passe = m.texte.match(/^(.+?) passe le dossier (à|au) (.+?)( : .*)?$/);
      if (passe) return `<div class="ligne-etape"><span class="passe">${avatar(E.pilote, 24)}${MINI_DOSSIER}${avatar(m.agent, 24)}</span><p><b>${esc(passe[1])}</b> passe le dossier ${passe[2]} <b>${esc(passe[3])}</b>${esc(passe[4] || '')}</p></div>`;
      const prenom = a.prenom;
      const suite = m.texte.startsWith(prenom) ? m.texte.slice(prenom.length) : ' ' + m.texte;
      const icone = /web|consulte/.test(m.texte) ? `<span class="icone-action">${LOUPE}</span>` : avatar(m.agent, 24);
      return `<div class="ligne-action">${icone}<p><b>${esc(m.texte.startsWith(prenom) ? prenom : '')}</b>${esc(m.texte.startsWith(prenom) ? suite : m.texte)}</p></div>`;
    }
    case 'agent': {
      const pied = m.cout ? `<div class="pied-msg">${heure(m.t)} · ${Math.round((m.duree || 0) / 1000)} s · ${m.cout.toFixed(2)} $</div>` : '';
      const qui = m.agent || f;
      return `<div class="msg-agent${m.erreur ? ' erreur' : ''}">${avatar(qui, 32)}<div class="bulle-agent"><div class="qui-parle">${esc(agent(qui).prenom)}</div><div class="md">${md(m.texte)}</div>${pied}</div></div>`;
    }
    case 'proposition':
      return `<article class="carte proposition" style="--accent:${esc(a.couleur)}" data-a="ouvrir" data-v="${esc(m.id)}" tabindex="0">${avatar(m.agent)}<div class="carte-corps"><span class="sur-titre">${esc(m.titre || 'Proposition de ' + a.prenom)}</span><p>${esc(apercu(m.texte))}</p><span class="meta">${esc(a.poste)}</span></div><span class="bouton petit">Ouvrir</span></article>`;
    case 'choix': {
      const fait = m.reponse !== null && m.reponse !== undefined;
      const ferme = fait || m.depasse;
      const etat = fait ? '<span class="etat valide">Choisi</span>' : m.depasse ? '<span class="etat">Dépassé</span>' : '<span class="badge">À toi de choisir</span>';
      const options = m.options.map((o, i) => `<button class="option${fait && m.reponse === i ? ' choisie' : ''}" type="button" data-a="choisir" data-v="${i}" data-id="${esc(m.id)}" ${ferme ? 'disabled' : ''}><span class="rond"></span><span><b>${esc(o.titre)}</b>${o.detail ? `<small>${esc(o.detail.length > 90 ? o.detail.slice(0, 88) + '…' : o.detail)}</small>` : ''}</span>${o.conseil ? '<span class="conseil">Conseillé</span>' : ''}</button>`).join('');
      return `<article class="carte decision" style="--accent:${esc(a.couleur)}" data-fil="${esc(f)}"><header data-a="ouvrir" data-v="${esc(m.id)}">${avatar(m.agent)}<div><span class="sur-titre">Décision : ${esc(m.question)}</span><span class="qui-demande">${ferme ? (fait ? 'Tu as tranché' : 'La conversation a continué depuis') : `${esc(a.prenom)} attend ta réponse`}</span></div>${etat}</header><div class="options">${options}</div></article>`;
    }
    case 'fichier': {
      const etats = { attente: '<span class="etat attente">À valider</span>', valide: '<span class="etat valide">Enregistré</span>', refuse: '<span class="etat refuse">Refusé</span>', remplace: '<span class="etat">Remplacé</span>' };
      return `<article class="carte proposition" style="--accent:${PRODUCTION.couleur}" data-a="ouvrir" data-v="${esc(m.id)}" tabindex="0">${avatar('production')}<div class="carte-corps"><span class="sur-titre">Fichier : ${esc(m.chemin.split('/').pop())}</span><p>${esc(apercu(m.contenu))}</p><span class="meta">Studio · ${esc(m.chemin)}</span></div>${etats[m.statut] || ''}</article>`;
    }
  }
  return '';
}
function rendreFil() {
  const f = E.fil, zone = $('#fil');
  const bas = zone.scrollHeight - zone.scrollTop - zone.clientHeight < 80;
  const liste = messages(f);
  let html = liste.map(m => rendreMessage(m, f)).join('');
  if (E.live[f]) html += `<div class="msg-agent en-direct">${avatar(estAgence(f) ? E.pilote : f, 32)}<div class="bulle-agent"><div class="md">${mdSur(E.live[f])}</div></div></div>`;
  if (!liste.length && !E.live[f]) html = vide();
  zone.innerHTML = html;
  if (bas || !liste.length) zone.scrollTop = zone.scrollHeight;
  const marche = E.enCours.has(f);
  $('#travail').hidden = !marche;
  $('#travail-texte').textContent = estAgence(f) ? 'L\'agence travaille' : `${agent(f).prenom} réfléchit`;
}
function vide() {
  if (!estAgence(E.fil)) {
    const a = agent(E.fil);
    return `<div class="vide">${avatar(E.fil, 64)}<h2>${esc(a.prenom)}</h2><p>${esc(a.description)}</p></div>`;
  }
  if (!E.projet) return `<div class="vide"><h2>Bonjour patron.</h2><p>Donne un brief à l'agence : Claire le reformule, l'équipe s'y met, et chaque décision te revient.</p><button class="bouton principal" data-a="nouveau-brief">Nouveau brief</button></div>`;
  return '<div class="vide"><h2>Le projet est ouvert.</h2><p>Écris à l\'agence pour lancer l\'étape suivante.</p></div>';
}
async function envoyer(texte) {
  texte = texte.trim();
  if (!texte) return;
  if (E.enCours.has(E.fil)) { toast('L\'agence travaille encore. Attends sa réponse ou clique sur Arrêter.'); return; }
  $('#texte').value = ''; ajusterSaisie();
  try { await api('/api/message', { fil: E.fil, texte }); }
  catch (e) { toast(e.message); $('#texte').value = texte; }
}
function ajusterSaisie() {
  const t = $('#texte'); t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 200) + 'px';
}
function changerFil(f) {
  E.fil = f;
  fermerTout(true, true);
  rendreTete(); rendreFil(); majPostes(); majCircuitDirect();
  ouvrirEnAttente();
  $('#texte').focus();
}
function changerProjet(slug) {
  E.projet = slug || null;
  memoire('agence-projet', E.projet);
  $('#choix-projet').value = E.projet || '';
  changerFil(filAgence());
  rendreLocaux();
}
function rendreProjets() {
  const s = $('#choix-projet');
  s.innerHTML = '<option value="">Sans projet (questions libres)</option>' + E.projets.map(p => `<option value="${esc(p.slug)}">${esc(p.nom)} · ${esc(p.type)}</option>`).join('');
  s.value = E.projet || '';
}

// ---------- Les fenêtres ----------
let pile = 0, rang = 10;
function fenetre({ cle, agentId, titre, sous, html, bas = '', importante = false, modale = false, largeur }) {
  const exist = document.querySelector(`.fenetre[data-cle="${CSS.escape(cle)}"]`);
  if (exist) { exist.style.zIndex = ++rang; return exist; }
  const a = agentId ? agent(agentId) : null;
  const w = document.createElement('div');
  w.className = 'fenetre' + (importante ? ' importante' : '');
  w.dataset.cle = cle;
  if (modale) w.dataset.modale = '1';
  w.setAttribute('role', 'dialog');
  w.setAttribute('aria-label', titre);
  if (a) w.style.setProperty('--couleur', a.couleur);
  if (largeur) w.style.width = `min(${largeur}px, calc(100vw - 32px))`;
  const tete = a ? avatar(agentId, 34) : '<svg class="logo" viewBox="0 0 30 30" width="30" height="30" aria-hidden="true"><polygon points="15,2 27,9 15,16 3,9" fill="#b9a6f2"/><polygon points="3,9 15,16 15,29 3,22" fill="#f6a57d"/><polygon points="15,16 27,9 27,22 15,29" fill="#3b3486"/></svg>';
  w.innerHTML = `<div class="titre-fenetre">${tete}<div class="infos"><strong>${esc(titre)}</strong>${sous ? `<span>${esc(sous)}</span>` : ''}</div><button class="fermer" data-a="fermer" aria-label="Fermer">×</button></div><div class="contenu">${html}</div>${bas ? `<div class="bas">${bas}</div>` : ''}`;
  $('#fenetres').appendChild(w);
  const lw = w.offsetWidth, lh = w.offsetHeight;
  if (modale) {
    $('#voile').hidden = false;
    w.style.left = Math.max(16, (innerWidth - lw) / 2) + 'px';
    w.style.top = Math.max(16, (innerHeight - lh) / 2) + 'px';
  } else {
    const n = pile++ % 6;
    w.style.left = Math.max(16, Math.min(innerWidth - lw - 16, 40 + n * 30)) + 'px';
    w.style.top = Math.max(70, Math.min(innerHeight - lh - 16, 90 + n * 30)) + 'px';
  }
  w.style.zIndex = ++rang;
  w.addEventListener('pointerdown', () => { w.style.zIndex = ++rang; });
  // Dès qu'on écrit dedans, la fenêtre ne se ferme plus sans confirmation
  w.addEventListener('input', () => { w.dataset.modifie = '1'; });
  deplacable(w);
  return w;
}
function deplacable(w) {
  const poignee = w.querySelector('.titre-fenetre');
  poignee.addEventListener('pointerdown', ev => {
    if (ev.target.closest('button')) return;
    const x0 = ev.clientX - w.offsetLeft, y0 = ev.clientY - w.offsetTop;
    poignee.setPointerCapture(ev.pointerId);
    const bouge = e => {
      w.style.left = Math.max(-w.offsetWidth + 80, Math.min(innerWidth - 80, e.clientX - x0)) + 'px';
      w.style.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - y0)) + 'px';
    };
    const fin = () => { poignee.removeEventListener('pointermove', bouge); poignee.removeEventListener('pointerup', fin); };
    poignee.addEventListener('pointermove', bouge);
    poignee.addEventListener('pointerup', fin);
  });
}
function fermer(w, force) {
  if (!w) return false;
  if (w.dataset.modifie && !force && !confirm('Fermer cette fenêtre ? Ce que tu y as écrit sera perdu.')) return false;
  w.remove();
  if (!document.querySelector('.fenetre[data-modale]')) $('#voile').hidden = true;
  if (!document.querySelector('.fenetre')) pile = 0;
  return true;
}
function fermerTout(saufModales, saufModifiees) {
  for (const w of document.querySelectorAll('.fenetre')) {
    if (saufModales && w.dataset.modale) continue;
    if (saufModifiees && w.dataset.modifie) continue;
    fermer(w, true);
  }
}
function trouver(id) {
  for (const [f, c] of Object.entries(E.fils)) { const m = c.messages.find(x => x.id === id); if (m) return [f, m]; }
  return [null, null];
}
function ouvrirMessage(m, f) {
  const a = agent(m.agent);
  if (m.de === 'proposition') {
    fenetre({
      cle: m.id, agentId: m.agent, titre: m.titre || `Proposition de ${a.prenom}`, sous: a.poste, html: `<div class="md">${mdSur(m.texte)}</div>`,
      bas: `<span class="aide">Une retouche ? Écris-la dans le chat.</span><button class="bouton" data-a="retoucher" data-v="${esc(m.id)}">Demander une retouche</button><button class="bouton principal" data-a="fermer">Lu</button>`
    });
  } else if (m.de === 'choix') {
    const fait = m.reponse !== null && m.reponse !== undefined;
    const ferme = fait || m.depasse;
    const options = m.options.map((o, i) => `<button class="option${fait && m.reponse === i ? ' choisie' : ''}" data-a="choisir" data-v="${i}" data-id="${esc(m.id)}" ${ferme ? 'disabled' : ''}><span class="rond"></span><span><b>${esc(o.titre)}</b>${o.detail ? `<small>${esc(o.detail)}</small>` : ''}</span>${o.conseil ? '<span class="conseil">Conseillé</span>' : ''}</button>`).join('');
    fenetre({
      cle: m.id, agentId: m.agent, titre: fait ? 'Décision prise' : m.depasse ? 'Décision dépassée' : 'À toi de décider',
      sous: m.depasse && !fait ? 'La conversation a continué depuis' : `${a.prenom} attend ta réponse`, importante: !ferme, largeur: 600,
      html: `<p class="question">${esc(m.question)}</p><div class="options">${options}</div>${ferme ? '' : '<textarea class="precision" placeholder="Une précision pour l\'équipe ? (facultatif)"></textarea>'}`,
      bas: ferme ? '<button class="bouton" data-a="fermer">Fermer</button>' : '<span class="aide">Clique sur l\'option que tu retiens.</span>'
    }).dataset.fil = f;
  } else if (m.de === 'fichier') {
    const attente = m.statut === 'attente';
    const etat = { attente: m.existe ? 'Remplacera la version actuelle' : 'Nouveau fichier', valide: 'Enregistré', refuse: 'Refusé, rien n\'a été écrit', remplace: 'Remplacé par une version plus récente' }[m.statut];
    const web = /\.html$/.test(m.chemin);
    const vue = web ? '<div class="cadre-apercu" data-vue="apercu"><iframe class="apercu" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" title="Aperçu" referrerpolicy="no-referrer"></iframe></div>'
      : `<div class="md" data-vue="apercu">${mdSur(m.contenu)}</div>`;
    const w = fenetre({
      cle: m.id, agentId: m.agent === 'digital' ? 'digital' : 'production', titre: m.chemin.split('/').pop(), sous: `${m.agent === 'digital' ? 'Jade · ' : ''}Studio · ${etat}`, importante: attente, largeur: web ? 1040 : 680,
      html: `<p class="chemin">${esc(m.chemin)}${m.tronque ? ' · trop long, coupé' : ''}${web ? ' · <button class="lien" data-a="grand">Ouvrir en grand ↗</button>' : ''}</p>${web ? resumeAtelier(m.atelier) : ''}${attente ? `<div class="onglets"><button class="actif" data-a="onglet" data-v="apercu">Aperçu</button><button data-a="onglet" data-v="modifier">${web ? 'Code' : 'Modifier'}</button></div>` : ''}${vue}${attente ? `<textarea class="edition" data-vue="modifier" hidden>${esc(m.contenu)}</textarea>` : ''}`,
      bas: attente ? `<span class="aide">Rien n'est écrit sans ton clic.</span><button class="bouton refuser" data-a="decider" data-v="refuser" data-id="${esc(m.id)}">Refuser</button><button class="bouton valider" data-a="decider" data-v="valider" data-id="${esc(m.id)}">Valider et enregistrer</button>` : '<button class="bouton" data-a="fermer">Fermer</button>'
    });
    w.dataset.fil = f;
    if (web) chargerApercu(w, { fil: f, id: m.id });
  }
}
function ouvrirEnAttente() {
  for (const m of messages(E.fil)) {
    if ((m.de === 'choix' && (m.reponse === null || m.reponse === undefined) && !m.depasse) || (m.de === 'fichier' && m.statut === 'attente')) ouvrirMessage(m, E.fil);
  }
}
function fenetreBrief() {
  const types = [['cours', 'Cours', 'l\'agence t\'aide à réfléchir'], ['perso', 'Perso', 'tes projets'], ['client', 'Client', 'un vrai client']];
  fenetre({
    cle: 'brief', titre: 'Accueil · Nouveau brief', sous: 'Claire le lit et oriente vers le bon agent', modale: true, largeur: 620,
    html: `<form id="form-brief">
<label class="champ"><span>Nom du projet</span><input name="nom" maxlength="80" placeholder="Ex. Oasis, campagne été 2027" required></label>
<div class="champ"><span>Type</span><div class="types">${types.map(([v, t, d], i) => `<label><input type="radio" name="type" value="${v}" ${i ? '' : 'checked'}>${t}<small>${d}</small></label>`).join('')}</div></div>
<label class="champ"><span>Date de rendu <small>(facultatif)</small></span><input name="rendu" type="date"></label>
<label class="champ"><span>Le brief</span><textarea name="texte" maxlength="30000" placeholder="Colle le brief : la demande, le livrable, la date de rendu, les consignes et la grille du prof si tu les as." required></textarea></label>
</form>
<div class="separateur">Juste une petite demande ? Va directement au bon bureau</div>
<div class="orienter">${ORIENTER.map(([id, t]) => `<button data-a="orienter" data-v="${id}">${avatar(id, 30)}<span><strong>${esc(agent(id).prenom)}</strong><br>${esc(t)}</span></button>`).join('')}</div>`,
    bas: '<button class="bouton" data-a="fermer">Annuler</button><button class="bouton principal" data-a="envoyer-brief">Donner le brief à Claire</button>'
  });
  setTimeout(() => document.querySelector('#form-brief [name=nom]')?.focus(), 50);
}
async function fenetreDossier() {
  if (!E.projet) { toast('Choisis d\'abord un projet en haut de la page.'); return; }
  const p = E.projets.find(x => x.slug === E.projet);
  fenetre({
    cle: 'dossier:' + E.projet, agentId: 'production', titre: `Dossier : ${p ? p.nom : E.projet}`, sous: `projets/${E.projet}/`,
    html: (p && p.fichiers.length ? `<div class="liste-fichiers">${p.fichiers.map(f => `<button data-a="lire" data-v="${esc(f)}">${esc(f)}</button>`).join('')}</div>` : '<p>Aucun fichier pour l\'instant.</p>') +
      `<div class="separateur">Images du projet (photos, maquettes, visuels générés)</div>
<div class="depot-images" data-zone="images"><p>Glisse tes images ici, ou <button class="lien" data-a="choisir-images">choisis-les</button>. PNG, JPG, WEBP ou GIF, 10 Mo au plus.<br>Jade les utilisera dans les présentations et les sites.</p><input type="file" id="fichiers-images" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden></div>
<div class="galerie">${(p && p.images || []).map(n => `<figure><img src="/api/image?projet=${encodeURIComponent(E.projet)}&nom=${encodeURIComponent(n)}&jeton=${JETON}" alt=""><figcaption>${esc(n)}</figcaption></figure>`).join('')}</div>`,
    bas: '<button class="bouton" data-a="fermer">Fermer</button>'
  });
}
// La Culthèque : les fiches de campagnes de référence, lisibles depuis l'agence
async function fenetreCultheque() {
  let fiches = [];
  try { ({ fiches } = await api('/api/campagnes')); } catch (e) { toast(e.message); return; }
  fenetre({
    cle: 'cultheque', agentId: 'production', titre: 'Culthèque', sous: 'Les campagnes de référence de l\'agence', largeur: 640,
    html: fiches.length
      ? `<div class="liste-fichiers">${fiches.map(f => `<button data-a="lire-campagne" data-v="${esc(f.nom)}">${esc(f.titre)}</button>`).join('')}</div>`
      : '<p>Aucune fiche pour l\'instant.</p>',
    bas: '<button class="bouton" data-a="fermer">Fermer</button>'
  });
}
async function lireCampagne(nom) {
  try {
    const { contenu } = await api(`/api/campagne?nom=${encodeURIComponent(nom)}`);
    fenetre({ cle: 'campagne:' + nom, agentId: 'production', titre: nom.replace(/\.md$/, ''), sous: 'docs/campagnes/', largeur: 680,
      html: `<div class="md">${md(contenu)}</div>`, bas: '<button class="bouton" data-a="fermer">Fermer</button>' });
  } catch (e) { toast(e.message); }
}
// Le suivi : pour chaque projet, l'étape en cours, la date de rendu et le coût (calculés par le serveur)
function fenetreSuivi() {
  const date = d => /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : d;
  const lignes = E.projets.map(p => {
    const a = p.avancement;
    const barre = a.etapes.map(e => `<i class="${e.fait ? 'fait' : ''}" title="${esc(e.nom)}"></i>`).join('');
    return `<button class="suivi-ligne" type="button" data-a="suivre" data-v="${esc(p.slug)}">
<span class="suivi-tete"><strong>${esc(p.nom)}</strong><span class="suivi-type">${esc(p.type)}</span></span>
<span class="suivi-barre" aria-hidden="true">${barre}</span>
<span class="suivi-info">${a.courante ? 'Étape en cours : ' + esc(a.courante) : 'Tout est prêt'} · ${a.faites}/${a.total}</span>
<span class="suivi-info">${p.rendu ? 'Rendu : ' + esc(date(p.rendu)) : 'Pas de date de rendu'}${p.consignes ? ' · grille du prof là' : ''} · ${p.cout.toFixed(2)} $</span>
</button>`;
  }).join('');
  fenetre({
    cle: 'suivi', agentId: 'production', titre: 'Suivi des projets', sous: 'Où en est chaque projet dans le circuit', largeur: 680,
    html: E.projets.length ? `<div class="suivi-liste">${lignes}</div>` : '<p>Aucun projet pour l\'instant. Donne un brief pour commencer.</p>',
    bas: '<button class="bouton" data-a="fermer">Fermer</button>'
  });
}
// Evan ajoute des images au projet : elles vont dans projets/<projet>/images/
async function envoyerImages(liste) {
  for (const f of liste) {
    if (f.size > 10 * 1024 * 1024) { toast(`${f.name} : trop lourde (10 Mo au plus).`); continue; }
    const donnees = await new Promise((ok, ko) => { const l = new FileReader(); l.onload = () => ok(String(l.result).split(',')[1] || ''); l.onerror = ko; l.readAsDataURL(f); });
    try { const r = await api('/api/image', { projet: E.projet, nom: f.name, donnees }); toast(`Image ajoutée : ${r.nom}`); }
    catch (e) { toast(`${f.name} : ${e.message}`); }
  }
  const w = document.querySelector(`.fenetre[data-cle="${CSS.escape('dossier:' + E.projet)}"]`);
  if (w) { fermer(w, true); fenetreDossier(); }
}
document.addEventListener('change', ev => { if (ev.target.id === 'fichiers-images' && ev.target.files.length) envoyerImages([...ev.target.files]); });
document.addEventListener('dragover', ev => { const z = ev.target.closest && ev.target.closest('[data-zone="images"]'); if (z) { ev.preventDefault(); z.classList.add('survol'); } });
document.addEventListener('dragleave', ev => { const z = ev.target.closest && ev.target.closest('[data-zone="images"]'); if (z) z.classList.remove('survol'); });
document.addEventListener('drop', ev => { const z = ev.target.closest && ev.target.closest('[data-zone="images"]'); if (z) { ev.preventDefault(); z.classList.remove('survol'); envoyerImages([...ev.dataTransfer.files].filter(f => /^image\//.test(f.type))); } });
// Ce que l'atelier de rendu a fait avant qu'Evan voie le fichier
function resumeAtelier(a) {
  if (!a) return '';
  if (!a.verifie) return '<p class="atelier alerte">Pas vu au navigateur (Google Chrome introuvable) : vérifie toi-même chaque diapo.</p>';
  const morceaux = ['Vu au navigateur par le studio'];
  if (a.critiques) morceaux.push(`critiqué par Léa${a.critiques > 1 ? ` (${a.critiques} fois)` : ''}`);
  if (a.corrections) morceaux.push(`corrigé par Jade${a.corrections > 1 ? ` (${a.corrections} fois)` : ''}`);
  const defauts = (a.defauts || []).length ? `<br>À regarder : ${a.defauts.slice(0, 3).map(esc).join(' ; ')}${a.defauts.length > 3 ? '…' : ''}` : '<br>Aucun défaut visible repéré.';
  return `<p class="atelier${(a.defauts || []).length ? ' alerte' : ''}">${morceaux.join(' · ')}.${defauts}</p>`;
}
// L'aperçu d'un fichier HTML passe par une adresse à usage limité, servie isolée par le serveur (jamais avec le jeton)
async function chargerApercu(w, source) {
  try {
    const { adresse } = await api('/api/apercu', source);
    w.dataset.adresse = adresse;
    const f = w.querySelector('iframe.apercu');
    if (f) f.src = adresse;
  } catch (e) { toast(e.message); }
}
async function lireFichier(nom) {
  if (/\.html$/.test(nom)) {
    const w = fenetre({ cle: 'lire:' + E.projet + '/' + nom, agentId: 'digital', titre: nom, sous: `projets/${E.projet}/`, largeur: 1040,
      html: `<p class="chemin">projets/${esc(E.projet)}/${esc(nom)} · <button class="lien" data-a="grand">Ouvrir en grand ↗</button></p><div class="cadre-apercu"><iframe class="apercu" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox" title="Aperçu" referrerpolicy="no-referrer"></iframe></div>`,
      bas: '<button class="bouton" data-a="fermer">Fermer</button>' });
    return chargerApercu(w, { projet: E.projet, nom });
  }
  if (/\.mp4$/.test(nom)) {
    const adresse = `/api/video?projet=${encodeURIComponent(E.projet)}&nom=${encodeURIComponent(nom)}&jeton=${JETON}`;
    fenetre({ cle: 'lire:' + E.projet + '/' + nom, agentId: 'motion', titre: nom, sous: `projets/${E.projet}/`, largeur: 680,
      html: `<p class="chemin">projets/${esc(E.projet)}/${esc(nom)}</p><video class="lecteur-video" controls playsinline preload="metadata" src="${adresse}" aria-label="Vidéo du projet"></video>`,
      bas: '<button class="bouton" data-a="fermer">Fermer</button>' });
    return;
  }
  try {
    const { contenu } = await api(`/api/fichier?projet=${encodeURIComponent(E.projet)}&nom=${encodeURIComponent(nom)}`);
    fenetre({ cle: 'lire:' + E.projet + '/' + nom, agentId: 'production', titre: nom, sous: `projets/${E.projet}/`, html: `<div class="md">${md(contenu)}</div>`, bas: '<button class="bouton" data-a="fermer">Fermer</button>', largeur: 680 });
  } catch (e) { toast(e.message); }
}
function menuPoste(id, bouton) {
  document.querySelector('.menu-poste')?.remove();
  const a = agent(id);
  const m = document.createElement('div');
  m.className = 'menu-poste';
  const lignes = id === 'production'
    ? [['ecrire-digital', 'Écrire à Jade (sites, présentations)'], ['fichiers-attente', `Fichiers à valider (${enAttente()})`], ['dossier', 'Dossier du projet']]
    : [['ecrire', `Écrire à ${a.prenom}`], ['fiche', 'Ce que fait ' + a.prenom], ...(id === E.pilote ? [['retour', 'Chat de l\'agence (Claire pilote)']] : [])];
  m.innerHTML = `<div class="entete">${avatar(id, 34)}<div><strong>${esc(a.prenom)}</strong><span>${esc(a.poste)}</span></div></div>` + lignes.map(([act, t]) => `<button data-a="${act}" data-v="${esc(id)}">${esc(t)}</button>`).join('');
  document.body.appendChild(m);
  const r = (bouton.querySelector('.etiquette') || bouton).getBoundingClientRect();
  m.style.left = Math.max(8, Math.min(innerWidth - m.offsetWidth - 8, r.left + r.width / 2 - m.offsetWidth / 2)) + 'px';
  m.style.top = Math.max(8, Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 6)) + 'px';
  m.style.zIndex = ++rang + 100;
}

// ---------- Les clics ----------
document.addEventListener('click', async ev => {
  const cible = ev.target.closest('[data-a]');
  if (!ev.target.closest('.menu-poste') && !ev.target.closest('.locaux [data-agent]')) document.querySelector('.menu-poste')?.remove();
  const perso = ev.target.closest('.locaux [data-agent]');
  if (perso) { menuPoste(perso.dataset.agent, perso); return; }
  if (!cible) return;
  const act = cible.dataset.a, v = cible.dataset.v;
  const w = cible.closest('.fenetre');
  switch (act) {
    case 'nouveau-brief': fenetreBrief(); break;
    case 'circuit': jouerCircuit(); break;
    case 'dossier': document.querySelector('.menu-poste')?.remove(); fenetreDossier(); break;
    case 'suivi': document.querySelector('.menu-poste')?.remove(); fenetreSuivi(); break;
    case 'cultheque': document.querySelector('.menu-poste')?.remove(); fenetreCultheque(); break;
    case 'lire-campagne': lireCampagne(v); break;
    case 'suivre': fermer(w); changerProjet(v); break;
    case 'lire': lireFichier(v); break;
    case 'fermer': fermer(w); break;
    case 'theme': {
      const sombre = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.dataset.theme = sombre ? 'light' : 'dark';
      memoire('agence-theme', document.documentElement.dataset.theme);
      break;
    }
    case 'poste': menuPoste(v, cible); break;
    case 'ecrire': document.querySelector('.menu-poste')?.remove(); changerFil(v); break;
    case 'ecrire-digital': document.querySelector('.menu-poste')?.remove(); changerFil('digital'); break;
    case 'choisir-images': document.getElementById('fichiers-images')?.click(); break;
    case 'grand': if (w && w.dataset.adresse) window.open(w.dataset.adresse, '_blank', 'noopener'); break;
    case 'retour': document.querySelector('.menu-poste')?.remove(); changerFil(filAgence()); break;
    case 'fiche': {
      document.querySelector('.menu-poste')?.remove();
      const a = agent(v);
      fenetre({ cle: 'fiche:' + v, agentId: v, titre: a.prenom, sous: a.poste, html: `<p>${esc(a.description)}</p>${a.web ? '<p class="chemin">Peut chercher sur le web (lecture seule).</p>' : ''}`, bas: `<button class="bouton principal" data-a="ecrire" data-v="${esc(v)}">Écrire à ${esc(a.prenom)}</button>` });
      break;
    }
    case 'fichiers-attente': {
      document.querySelector('.menu-poste')?.remove();
      const liste = messages(filAgence()).filter(m => m.de === 'fichier' && m.statut === 'attente');
      if (!liste.length) toast('Aucun fichier à valider.');
      for (const m of liste) ouvrirMessage(m, filAgence());
      break;
    }
    case 'orienter': fermer(w); changerFil(v); break;
    case 'ouvrir': { const [f, m] = trouver(v); if (m) ouvrirMessage(m, f); break; }
    case 'retoucher': {
      const [, m] = trouver(v);
      fermer(w);
      if (m) { $('#texte').value = `Retouche sur la proposition de ${agent(m.agent).prenom} : `; ajusterSaisie(); $('#texte').focus(); }
      break;
    }
    case 'onglet':
      for (const b of w.querySelectorAll('.onglets button')) b.classList.toggle('actif', b === cible);
      for (const z of w.querySelectorAll('[data-vue]')) z.hidden = z.dataset.vue !== v;
      if (v === 'apercu') {
        const ed = w.querySelector('.edition');
        if (w.querySelector('iframe.apercu')) chargerApercu(w, { fil: w.dataset.fil, id: w.dataset.cle, contenu: ed.value });
        else w.querySelector('.md[data-vue]').innerHTML = md(ed.value);
      }
      break;
    case 'choisir': {
      const boite = cible.closest('.fenetre, .decision');
      const precision = boite.querySelector('.precision')?.value || '';
      for (const b of boite.querySelectorAll('.option')) b.disabled = true;
      cible.classList.add('choisie');
      try {
        await api('/api/choisir', { fil: boite.dataset.fil, id: cible.dataset.id, option: Number(v), precision });
        const fen = document.querySelector(`.fenetre[data-cle="${CSS.escape(cible.dataset.id)}"]`);
        if (fen) setTimeout(() => fermer(fen, true), 600);
      } catch (e) { toast(e.message); for (const b of boite.querySelectorAll('.option')) b.disabled = false; cible.classList.remove('choisie'); }
      break;
    }
    case 'decider': {
      const corps = { fil: w.dataset.fil, id: cible.dataset.id, decision: v };
      const ed = w.querySelector('.edition');
      const [, m] = trouver(cible.dataset.id);
      if (v === 'valider' && ed && m && ed.value !== m.contenu) corps.contenu = ed.value;
      for (const b of w.querySelectorAll('[data-a="decider"]')) b.disabled = true;
      try { await api('/api/fichier', corps); toast(v === 'valider' ? 'Fichier enregistré.' : 'Fichier refusé, rien n\'est écrit.'); fermer(w, true); }
      catch (e) { toast(e.message); for (const b of w.querySelectorAll('[data-a="decider"]')) b.disabled = false; }
      break;
    }
    case 'envoyer-brief': {
      const f = document.getElementById('form-brief');
      if (!f.reportValidity()) return;
      const d = new FormData(f);
      cible.disabled = true;
      try {
        const r = await api('/api/brief', { nom: d.get('nom'), type: d.get('type'), texte: d.get('texte'), rendu: d.get('rendu') || '' });
        fermer(w, true);
        if (!E.projets.some(p => p.slug === r.projet)) E.projets.unshift({ slug: r.projet, nom: d.get('nom'), type: d.get('type'), fichiers: ['brief.md'], rendu: d.get('rendu') || null, consignes: false, cout: 0, avancement: { faites: 0, total: 8, courante: 'Brief', etapes: [] } });
        rendreProjets();
        changerProjet(r.projet);
        toast('Brief transmis à Claire.');
      } catch (e) { toast(e.message); cible.disabled = false; }
      break;
    }
    case 'arreter': try { await api('/api/arreter', { fil: E.fil }); } catch (e) { toast(e.message); } break;
    case 'oublier':
      if (!messages(E.fil).length) break;
      if (!confirm('Effacer cette conversation ? Les fichiers du projet restent.')) break;
      try { await api('/api/oublier', { fil: E.fil }); } catch (e) { toast(e.message); }
      break;
    case 'github': {
      if (!E.projet) { toast('Choisis d\'abord un projet.'); break; }
      if (!E.github) { toast('Ce dossier n\'est relié à aucun dépôt GitHub.'); break; }
      const p = E.projets.find(x => x.slug === E.projet);
      if (!confirm(`Envoyer le dossier « ${p ? p.nom : E.projet} » sur GitHub ?\n\nSeuls des livrables (dossier projets/) partent, jamais le code de l'agence.`)) break;
      cible.disabled = true;
      try { const r = await api('/api/github', { fil: filAgence() }); toast(r.message || 'Envoyé sur GitHub.'); }
      catch (e) { toast(e.message, 8000); }
      cible.disabled = false;
      break;
    }
  }
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape') {
    document.querySelector('.menu-poste')?.remove();
    const ws = [...document.querySelectorAll('.fenetre')].sort((a, b) => b.style.zIndex - a.style.zIndex);
    if (ws[0]) { ev.preventDefault(); fermer(ws[0]); }
  }
  if ((ev.key === 'Enter' || ev.key === ' ') && (ev.target.classList?.contains('carte') || ev.target.matches?.('.locaux [data-agent]'))) {
    ev.preventDefault();
    if (ev.target.matches('.locaux [data-agent]')) menuPoste(ev.target.dataset.agent, ev.target); else ev.target.click();
  }
});
$('#saisie').addEventListener('submit', ev => { ev.preventDefault(); envoyer($('#texte').value); });
$('#texte').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); envoyer($('#texte').value); }
});
$('#texte').addEventListener('input', ajusterSaisie);
$('#choix-projet').addEventListener('change', ev => changerProjet(ev.target.value));
$('#voile').addEventListener('click', () => fermer(document.querySelector('.fenetre[data-modale]')));

// ---------- Le direct ----------
function recevoir(evt) {
  const f = evt.fil;
  switch (evt.type) {
    case 'bonjour': if (E.charge) charger(); break;
    case 'debut': E.enCours.add(f); E.live[f] = ''; break;
    case 'texte': E.live[f] = (E.live[f] ? E.live[f] + '\n\n' : '') + evt.texte; break;
    case 'fin': E.enCours.delete(f); delete E.live[f]; E.actifs.delete(f); break;
    case 'actif': {
      const s = E.actifs.get(f) || new Set();
      if (evt.actif) { s.add(evt.agent); if (f === E.fil) envolerDossier(evt.agent); }
      else s.delete(evt.agent);
      E.actifs.set(f, s);
      break;
    }
    case 'message': {
      const m = evt.message;
      messages(f).push(m);
      if (m.de === 'agent') delete E.live[f];
      if (m.de === 'etape' && m.agent && !m.alerte) {
        const prenom = agent(m.agent).prenom;
        bulle(m.agent, / passe le dossier /.test(m.texte) ? 'reçoit le dossier'
          : m.texte.startsWith(prenom) ? m.texte.slice(prenom.length).replace(/^\s*:?\s*/, '') : m.texte);
      }
      if (m.de === 'fichier') bulle('production', 'Un fichier t\'attend : ' + m.chemin.split('/').pop());
      if (f === E.fil && ['proposition', 'choix', 'fichier'].includes(m.de)) ouvrirMessage(m, f);
      break;
    }
    case 'maj': {
      const liste = messages(f); const i = liste.findIndex(x => x.id === evt.message.id);
      if (i >= 0) liste[i] = evt.message;
      break;
    }
    case 'oubli': E.fils[f] = { messages: [], cout: 0 }; if (f === E.fil) fermerTout(true, true); break;
    case 'projets': E.projets = evt.projets; rendreProjets(); rendreTete(); break;
  }
  if (f === E.fil || evt.type === 'actif' || evt.type === 'fin' || evt.type === 'debut') rendreFil();
  majPostes();
  majCircuitDirect();
}
async function charger() {
  const e = await api('/api/etat');
  Object.assign(E, { equipe: e.equipe, pilote: e.pilote, projets: e.projets, fils: e.fils, enCours: new Set(e.enCours), pret: e.pret, github: e.github });
  if (e.consultation) toast('Mode consultation : aucun agent ne tournera. Le suivi, les fiches et les vidéos restent là.', 6000);
  E.actifs = new Map(Object.entries(e.actifs || {}).map(([f, l]) => [f, new Set(l)]));
  if (E.projet && !E.projets.some(p => p.slug === E.projet)) E.projet = null;
  if (!estAgence(E.fil) && !E.equipe.some(a => a.id === E.fil)) E.fil = filAgence();
  if (estAgence(E.fil)) E.fil = filAgence();
  rendreProjets(); rendreLocaux(); rendreTete(); rendreFil(); majCircuitDirect();
  $('#bouton-github').hidden = !E.github;
  if (!E.pret) toast('Claude Code est absent ou trop ancien : tape « claude update » dans le Terminal, puis relance l\'agence.', 0);
  if (!E.charge) { E.charge = true; ouvrirEnAttente(); }
}

// ---------- Démarrage ----------
(async () => {
  const theme = memoire('agence-theme');
  if (theme === 'dark' || theme === 'light') document.documentElement.dataset.theme = theme;
  E.projet = memoire('agence-projet') || null;
  E.fil = filAgence();
  rendreCircuit();
  if (!JETON) {
    document.querySelector('.plateau').innerHTML = '<div class="vide"><h2>L\'agence est fermée.</h2><p>Ouvre le Terminal dans le dossier de l\'agence et tape <code>npm run agence</code>. La page s\'ouvrira toute seule, avec la bonne adresse.</p></div>';
    return;
  }
  try { await charger(); }
  catch (e) { toast('Impossible de joindre l\'agence : ' + e.message + '. Relance npm run agence.', 0); return; }
  const source = new EventSource('/api/flux?jeton=' + JETON);
  source.onmessage = m => { try { recevoir(JSON.parse(m.data)); } catch (e) { console.error(e); } };
  source.onerror = () => {
    // Fermée pour de bon (jeton refusé : l'agence a été relancée) ou simple coupure qui se répare toute seule
    if (source.readyState === EventSource.CLOSED) perimee();
    else toast('Connexion perdue avec l\'agence. Elle revient toute seule si le Terminal est encore ouvert.', 4000);
  };
})();
