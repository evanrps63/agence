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
  { nom: 'Livrable', agents: ['production'], texte: 'Le studio rédige les fichiers. Tu valides chacun avant qu\'il soit écrit.' }
];
const ORIENTER = [
  ['redaction', 'Une accroche, un slogan'], ['etudes', 'Des chiffres, un benchmark'],
  ['planning', 'Une question de méthode'], ['jury', 'Faire relire un travail'],
  ['social', 'Une idée de post'], ['media', 'Un budget, des KPI'],
  ['direction-artistique', 'Une piste visuelle'], ['clientele', 'Je ne sais pas à qui demander']
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

// ---------- Avatars ----------
const PEAUX = ['#f1c7a5', '#c58c63', '#8d5a3b', '#e8b48f', '#6b4029', '#f5d0b5', '#d9a27a', '#ecc19c'];
const CHEVEUX = ['#2b1d14', '#6b3e1f', '#121212', '#b0702d', '#3b2a20', '#c9a25e', '#1f1a17', '#5a3825'];
function avatar(id) {
  const a = agent(id);
  const c = esc(a.couleur);
  if (id === 'production') {
    return `<svg class="avatar" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="23" fill="${c}"/><rect x="11" y="12" width="26" height="18" rx="2" fill="#fff"/><rect x="14" y="16" width="20" height="2" rx="1" fill="${c}"/><rect x="14" y="20" width="14" height="2" rx="1" fill="${c}"/><rect x="14" y="24" width="17" height="2" rx="1" fill="${c}"/><rect x="21" y="30" width="6" height="5" fill="#fff"/><rect x="15" y="35" width="18" height="2.5" rx="1" fill="#fff"/></svg>`;
  }
  const i = Math.max(0, E.equipe.findIndex(e => e.id === id));
  const peau = PEAUX[i % 8];
  const ch = id === 'jury' ? '#a8a29e' : CHEVEUX[i % 8];
  const style = id === 'jury' ? 0 : i % 4;
  const arriere = style === 1 ? `<path d="M13 22c0-8 5-12 11-12s11 4 11 12v12h-22z" fill="${ch}"/>`
    : style === 2 ? `<circle cx="24" cy="9.5" r="4.2" fill="${ch}"/>`
    : style === 3 ? `<g fill="${ch}"><circle cx="16" cy="15" r="4"/><circle cx="21" cy="11.5" r="4.2"/><circle cx="27" cy="11.5" r="4.2"/><circle cx="32" cy="15" r="4"/></g>` : '';
  const devant = style === 3 ? '' : `<path d="M14.5 21.5c0-7 4.3-11 9.5-11s9.5 4 9.5 11c-2-3.2-5.3-5-9.5-5s-7.5 1.8-9.5 5z" fill="${ch}"/>`;
  const lunettes = id === 'jury' ? '<g fill="none" stroke="#1c1917" stroke-width="1.1"><circle cx="20.5" cy="22.5" r="2.7"/><circle cx="27.5" cy="22.5" r="2.7"/><path d="M23.2 22.5h1.6"/></g>' : '';
  return `<svg class="avatar" viewBox="0 0 48 48" aria-hidden="true"><defs><clipPath id="r-${esc(id)}"><circle cx="24" cy="24" r="23"/></clipPath></defs>
<g clip-path="url(#r-${esc(id)})"><rect width="48" height="48" fill="${c}" fill-opacity=".18"/>${arriere}
<path d="M8 50c1-9 7-14 16-14s15 5 16 14z" fill="${c}"/><rect x="21" y="28" width="6" height="8" fill="${peau}"/>
<ellipse cx="24" cy="22" rx="9" ry="10" fill="${peau}"/>${devant}
<circle cx="20.5" cy="22.5" r="1.1" fill="#1c1917"/><circle cx="27.5" cy="22.5" r="1.1" fill="#1c1917"/>${lunettes}
<path d="M21 27q3 2 6 0" stroke="#1c1917" stroke-width="1.1" fill="none" stroke-linecap="round"/></g></svg>`;
}

// ---------- Les locaux ----------
function enAttente() {
  return messages(filAgence()).filter(m => m.de === 'fichier' && m.statut === 'attente').length;
}
function rendreLocaux() {
  const occupants = {};
  for (const a of [...E.equipe, PRODUCTION]) (occupants[a.piece] ||= []).push(a);
  for (const piece of document.querySelectorAll('.piece')) {
    const liste = occupants[piece.dataset.piece] || [];
    piece.querySelector('.bureaux').innerHTML = liste.map(a => {
      const badge = a.id === 'production' && enAttente() ? `<span class="badge" title="Fichiers à valider">${enAttente()}</span>` : '';
      return `<button class="poste${estActif(a.id) ? ' actif' : ''}" data-a="poste" data-v="${esc(a.id)}" style="--couleur:${esc(a.couleur)}" aria-label="${esc(a.prenom)}, ${esc(a.poste)}">
${avatar(a.id)}<span class="table"></span><span class="nom">${esc(a.prenom)}</span><span class="role">${esc(a.poste)}</span>${badge}</button>`;
    }).join('');
  }
}
function estActif(id) {
  for (const s of E.actifs.values()) if (s.has(id)) return true;
  if (id === E.pilote && [...E.enCours].some(estAgence)) return true;
  if (id === 'production' && enAttente()) return false;
  return E.enCours.has(id);
}
function majPostes() {
  for (const b of document.querySelectorAll('.poste')) b.classList.toggle('actif', estActif(b.dataset.v));
  const studio = document.querySelector('.poste[data-v="production"]');
  if (studio) {
    const n = enAttente();
    let badge = studio.querySelector('.badge');
    if (n && !badge) { badge = document.createElement('span'); badge.className = 'badge'; studio.appendChild(badge); }
    if (badge) { if (n) badge.textContent = n; else badge.remove(); }
  }
}
function poste(id) { return document.querySelector(`.poste[data-v="${CSS.escape(id)}"]`); }
function bulle(id, texte) {
  const p = poste(id);
  if (!p) return;
  p.querySelector('.bulle')?.remove();
  const b = document.createElement('span');
  b.className = 'bulle';
  b.textContent = texte.length > 90 ? texte.slice(0, 88) + '…' : texte;
  p.appendChild(b);
  // Toujours dans l'écran, même pour un bureau au bord
  const r = b.getBoundingClientRect();
  if (r.left < 8) b.style.marginLeft = (8 - r.left) + 'px';
  else if (r.right > innerWidth - 8) b.style.marginLeft = (innerWidth - 8 - r.right) + 'px';
  setTimeout(() => b.remove(), 5000);
}
function envolerDossier(id) {
  const p = poste(id), d = $('#dossier-vol'), im = $('#immeuble');
  if (!p) return;
  const r = p.getBoundingClientRect(), ri = im.getBoundingClientRect();
  d.style.transform = `translate(${r.left - ri.left + r.width / 2 + 18}px, ${r.top - ri.top + 30}px)`;
  d.classList.add('visible');
}
function etapeDe(id) { return CIRCUIT.findIndex(e => e.agents.includes(id)); }
function rendreCircuit() {
  $('#circuit').innerHTML = CIRCUIT.map((e, i) => `<li data-i="${i}">${esc(e.nom)}</li>`).join('');
}
function marquerCircuit(encours, faits = []) {
  for (const li of document.querySelectorAll('#circuit li')) {
    const i = Number(li.dataset.i);
    li.classList.toggle('encours', encours.includes(i));
    li.classList.toggle('fait', faits.includes(i) && !encours.includes(i));
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
    ? (encours.length ? CIRCUIT[encours[encours.length - 1]].texte : 'L\'agence travaille.')
    : 'Clique sur un bureau pour écrire à son agent.';
}
async function jouerCircuit() {
  if (E.demo) return;
  E.demo = true;
  const faits = [];
  for (let i = 0; i < CIRCUIT.length; i++) {
    const e = CIRCUIT[i];
    marquerCircuit([i], faits);
    $('#legende').textContent = `${i + 1}. ${e.nom} : ${e.texte}`;
    const qui = e.agents.length ? e.agents : ['clientele'];
    envolerDossier(qui[0]);
    for (const id of qui) { poste(id)?.classList.add('actif'); bulle(id, e.texte); }
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
    $('#destinataire').innerHTML = `<span class="logo" aria-hidden="true">A</span><div><strong>L'agence</strong><span>${p ? esc(p.nom) + ' · ' + esc(p.type) : 'Sans projet'} · Claire pilote, tu décides</span></div>`;
    $('#texte').placeholder = 'Écris à l\'agence… (Maj + Entrée : nouvelle ligne)';
  } else {
    const a = agent(f);
    $('#destinataire').innerHTML = `<button class="retour" data-a="retour">← L'agence</button>${avatar(f)}<div><strong>${esc(a.prenom)}</strong><span>${esc(a.poste)} · message direct, en lecture seule</span></div>`;
    $('#texte').placeholder = `Écris à ${a.prenom}…`;
  }
}
function rendreMessage(m, f) {
  try { return rendreMessageBrut(m, f); }
  catch (e) { console.error(e); return `<div class="etape alerte"><span class="pastille"></span>Message illisible : ${esc(String(m && (m.texte || m.question || m.chemin) || '').slice(0, 200))}</div>`; }
}
function rendreMessageBrut(m, f) {
  const a = agent(m.agent);
  const style = `style="--couleur:${esc(a.couleur)}"`;
  switch (m.de) {
    case 'evan': return `<div class="msg evan">${esc(m.texte)}</div>`;
    case 'etape': return `<div class="etape${m.alerte ? ' alerte' : ''}" ${style}><span class="pastille"></span>${esc(m.texte)}</div>`;
    case 'agent': {
      const pied = m.cout ? `<div class="pied">${Math.round((m.duree || 0) / 1000)} s · ${m.cout.toFixed(2)} $</div>` : '';
      return `<div class="msg agent${m.erreur ? ' erreur' : ''}${estAgence(f) ? '' : ' direct'}">${avatar(m.agent || f)}<div class="corps"><div class="qui">${esc(agent(m.agent || f).prenom)}</div><div class="md">${md(m.texte)}</div>${pied}</div></div>`;
    }
    case 'proposition':
      return `<div class="carte" ${style} data-a="ouvrir" data-v="${esc(m.id)}" role="button" tabindex="0">${avatar(m.agent)}<div class="infos"><div class="titre">${esc(m.titre || 'Proposition de ' + a.prenom)}</div><div class="apercu">${esc(apercu(m.texte))}</div></div><span class="etiquette">Ouvrir</span></div>`;
    case 'choix': {
      const fait = m.reponse !== null && m.reponse !== undefined;
      const etiquette = fait ? `<span class="etiquette valide">Choisi : ${esc(m.options[m.reponse].titre)}</span>`
        : m.depasse ? '<span class="etiquette">Dépassé</span>' : '<span class="etiquette attente">À toi de choisir</span>';
      return `<div class="carte" ${style} data-a="ouvrir" data-v="${esc(m.id)}" role="button" tabindex="0">${avatar(m.agent)}<div class="infos"><div class="titre">Décision : ${esc(m.question)}</div><div class="apercu">${m.options.map(o => esc(o.titre)).join(' · ')}</div></div>${etiquette}</div>`;
    }
    case 'fichier': {
      const etiquettes = { attente: '<span class="etiquette attente">À valider</span>', valide: '<span class="etiquette valide">Enregistré</span>', refuse: '<span class="etiquette refuse">Refusé</span>', remplace: '<span class="etiquette">Remplacé</span>' };
      return `<div class="carte" style="--couleur:${PRODUCTION.couleur}" data-a="ouvrir" data-v="${esc(m.id)}" role="button" tabindex="0">${avatar('production')}<div class="infos"><div class="titre">Fichier : ${esc(m.chemin.split('/').pop())}</div><div class="apercu">${esc(apercu(m.contenu))}</div></div>${etiquettes[m.statut] || ''}</div>`;
    }
  }
  return '';
}
function rendreFil() {
  const f = E.fil, zone = $('#fil');
  const bas = zone.scrollHeight - zone.scrollTop - zone.clientHeight < 80;
  const liste = messages(f);
  let html = liste.map(m => rendreMessage(m, f)).join('');
  if (E.live[f]) html += `<div class="msg agent en-direct">${avatar(estAgence(f) ? E.pilote : f)}<div class="corps"><div class="md">${mdSur(E.live[f])}</div></div></div>`;
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
    return `<div class="vide">${avatar(E.fil).replace('class="avatar"', 'class="avatar" style="width:64px;height:64px"')}<h2>${esc(a.prenom)}</h2><p>${esc(a.description)}</p></div>`;
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
  const tete = a ? avatar(agentId) : '<span class="logo" aria-hidden="true">A</span>';
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
    const options = m.options.map((o, i) => `<button class="option${fait && m.reponse === i ? ' choisie' : ''}" data-a="choisir" data-v="${i}" data-id="${esc(m.id)}" ${ferme ? 'disabled' : ''}>${o.conseil ? '<span class="conseil">Conseillé</span>' : ''}<strong>${esc(o.titre)}</strong><span>${esc(o.detail)}</span></button>`).join('');
    fenetre({
      cle: m.id, agentId: m.agent, titre: fait ? 'Décision prise' : m.depasse ? 'Décision dépassée' : 'À toi de décider',
      sous: m.depasse && !fait ? 'La conversation a continué depuis' : `${a.prenom} attend ta réponse`, importante: !ferme, largeur: 600,
      html: `<p class="question">${esc(m.question)}</p><div class="options">${options}</div>${ferme ? '' : '<textarea class="precision" placeholder="Une précision pour l\'équipe ? (facultatif)"></textarea>'}`,
      bas: ferme ? '<button class="bouton" data-a="fermer">Fermer</button>' : '<span class="aide">Clique sur l\'option que tu retiens.</span>'
    }).dataset.fil = f;
  } else if (m.de === 'fichier') {
    const attente = m.statut === 'attente';
    const etat = { attente: m.existe ? 'Remplacera la version actuelle' : 'Nouveau fichier', valide: 'Enregistré', refuse: 'Refusé, rien n\'a été écrit', remplace: 'Remplacé par une version plus récente' }[m.statut];
    const w = fenetre({
      cle: m.id, agentId: 'production', titre: m.chemin.split('/').pop(), sous: `Studio · ${etat}`, importante: attente, largeur: 680,
      html: `<p class="chemin">${esc(m.chemin)}${m.tronque ? ' · trop long, coupé à 200 000 caractères' : ''}</p>${attente ? '<div class="onglets"><button class="actif" data-a="onglet" data-v="apercu">Aperçu</button><button data-a="onglet" data-v="modifier">Modifier</button></div>' : ''}<div class="md" data-vue="apercu">${mdSur(m.contenu)}</div>${attente ? `<textarea class="edition" data-vue="modifier" hidden>${esc(m.contenu)}</textarea>` : ''}`,
      bas: attente ? `<span class="aide">Rien n'est écrit sans ton clic.</span><button class="bouton refuser" data-a="decider" data-v="refuser" data-id="${esc(m.id)}">Refuser</button><button class="bouton valider" data-a="decider" data-v="valider" data-id="${esc(m.id)}">Valider et enregistrer</button>` : '<button class="bouton" data-a="fermer">Fermer</button>'
    });
    w.dataset.fil = f;
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
<label class="champ"><span>Le brief</span><textarea name="texte" maxlength="30000" placeholder="Colle le brief : la demande, le livrable, la date de rendu, les consignes et la grille du prof si tu les as." required></textarea></label>
</form>
<div class="separateur">Juste une petite demande ? Va directement au bon bureau</div>
<div class="orienter">${ORIENTER.map(([id, t]) => `<button data-a="orienter" data-v="${id}">${avatar(id)}<span><strong>${esc(agent(id).prenom)}</strong><br>${esc(t)}</span></button>`).join('')}</div>`,
    bas: '<button class="bouton" data-a="fermer">Annuler</button><button class="bouton principal" data-a="envoyer-brief">Donner le brief à Claire</button>'
  });
  setTimeout(() => document.querySelector('#form-brief [name=nom]')?.focus(), 50);
}
async function fenetreDossier() {
  if (!E.projet) { toast('Choisis d\'abord un projet en haut de la page.'); return; }
  const p = E.projets.find(x => x.slug === E.projet);
  fenetre({
    cle: 'dossier:' + E.projet, agentId: 'production', titre: `Dossier : ${p ? p.nom : E.projet}`, sous: `projets/${E.projet}/`,
    html: p && p.fichiers.length ? `<div class="liste-fichiers">${p.fichiers.map(f => `<button data-a="lire" data-v="${esc(f)}">${esc(f)}</button>`).join('')}</div>` : '<p>Aucun fichier pour l\'instant.</p>',
    bas: '<button class="bouton" data-a="fermer">Fermer</button>'
  });
}
async function lireFichier(nom) {
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
    ? [['fichiers-attente', `Fichiers à valider (${enAttente()})`], ['dossier', 'Dossier du projet']]
    : [['ecrire', `Écrire à ${a.prenom}`], ['fiche', 'Ce que fait ' + a.prenom], ...(id === E.pilote ? [['retour', 'Chat de l\'agence (Claire pilote)']] : [])];
  m.innerHTML = `<div class="entete"><strong>${esc(a.prenom)}</strong><span>${esc(a.poste)}</span></div>` + lignes.map(([act, t]) => `<button data-a="${act}" data-v="${esc(id)}">${esc(t)}</button>`).join('');
  document.body.appendChild(m);
  const r = bouton.getBoundingClientRect();
  m.style.left = Math.min(innerWidth - m.offsetWidth - 8, r.left) + 'px';
  m.style.top = Math.min(innerHeight - m.offsetHeight - 8, r.bottom + 4) + 'px';
  m.style.zIndex = ++rang + 100;
}

// ---------- Les clics ----------
document.addEventListener('click', async ev => {
  const cible = ev.target.closest('[data-a]');
  if (!ev.target.closest('.menu-poste') && !ev.target.closest('[data-a="poste"]')) document.querySelector('.menu-poste')?.remove();
  if (!cible) return;
  const act = cible.dataset.a, v = cible.dataset.v;
  const w = cible.closest('.fenetre');
  switch (act) {
    case 'nouveau-brief': fenetreBrief(); break;
    case 'circuit': jouerCircuit(); break;
    case 'dossier': document.querySelector('.menu-poste')?.remove(); fenetreDossier(); break;
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
      if (v === 'apercu') w.querySelector('.md[data-vue]').innerHTML = md(w.querySelector('.edition').value);
      break;
    case 'choisir': {
      const precision = w.querySelector('.precision')?.value || '';
      for (const b of w.querySelectorAll('.option')) b.disabled = true;
      cible.classList.add('choisie');
      try { await api('/api/choisir', { fil: w.dataset.fil, id: cible.dataset.id, option: Number(v), precision }); setTimeout(() => fermer(w, true), 600); }
      catch (e) { toast(e.message); for (const b of w.querySelectorAll('.option')) b.disabled = false; cible.classList.remove('choisie'); }
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
        const r = await api('/api/brief', { nom: d.get('nom'), type: d.get('type'), texte: d.get('texte') });
        fermer(w, true);
        if (!E.projets.some(p => p.slug === r.projet)) E.projets.unshift({ slug: r.projet, nom: d.get('nom'), type: d.get('type'), fichiers: ['brief.md'] });
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
  if ((ev.key === 'Enter' || ev.key === ' ') && ev.target.classList?.contains('carte')) { ev.preventDefault(); ev.target.click(); }
});
$('#saisie').addEventListener('submit', ev => { ev.preventDefault(); envoyer($('#texte').value); });
$('#texte').addEventListener('keydown', ev => {
  if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing) { ev.preventDefault(); envoyer($('#texte').value); }
});
$('#texte').addEventListener('input', ajusterSaisie);
$('#choix-projet').addEventListener('change', ev => changerProjet(ev.target.value));
addEventListener('resize', () => { for (const b of document.querySelectorAll('.bulle')) b.remove(); });
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
        bulle(m.agent, m.texte.startsWith(prenom) ? m.texte.slice(prenom.length).replace(/^\s*:?\s*/, '') : m.texte);
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
