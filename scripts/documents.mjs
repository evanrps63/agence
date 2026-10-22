// Fabrique les fichiers que l'agence propose au studio et qu'Evan valide :
// - Word (.docx) : du Markdown simple devient un vrai document Word (un zip de fichiers XML), sans aucune dépendance ;
// - PDF (.pdf) : la mise en page HTML est imprimée par Chrome sans affichage (pas de script, réseau limité aux polices Google et aux images du projet).
// Les autres formats (md, html, csv, txt) sont écrits tels quels par le serveur.
import { trouverChrome, chargerPuppeteer, PERMIS } from './rendu.mjs';

// ---------- Word ----------
const ECHAP = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Les caractères de contrôle ne passent pas dans un fichier XML
const CONTROLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

// Gras (**texte**) et italique (*texte*) ; le reste est du texte
function morceaux(texte) {
  return String(texte).split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/).filter(Boolean).map(m => {
    let propre = m, pr = '';
    if (/^\*\*[^*]+\*\*$/.test(m)) { propre = m.slice(2, -2); pr = '<w:b/>'; }
    else if (/^\*[^*]+\*$/.test(m)) { propre = m.slice(1, -1); pr = '<w:i/>'; }
    return `<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${ECHAP(propre.replace(CONTROLE, ''))}</w:t></w:r>`;
  }).join('');
}
function paragraphe(texte, { style = '', indent = '' } = {}) {
  const pr = (style ? `<w:pStyle w:val="${style}"/>` : '') + indent;
  return `<w:p>${pr ? `<w:pPr>${pr}</w:pPr>` : ''}${morceaux(texte)}</w:p>`;
}
// Une ligne de Markdown devient un paragraphe Word (titres, listes, citations, tableaux en texte)
function ligne(l) {
  let m;
  if (!l.trim()) return '';
  if ((m = l.match(/^(#{1,3})\s+(.*)$/))) return paragraphe(m[2], { style: `Titre${m[1].length}` });
  if ((m = l.match(/^\s*[-*]\s+(.*)$/))) return paragraphe('• ' + m[1], { indent: '<w:ind w:left="360" w:hanging="360"/>' });
  if ((m = l.match(/^\s*(\d+)[.)]\s+(.*)$/))) return paragraphe(`${m[1]}. ${m[2]}`, { indent: '<w:ind w:left="360" w:hanging="360"/>' });
  if ((m = l.match(/^>\s?(.*)$/))) return paragraphe(m[1], { indent: '<w:ind w:left="567"/>' });
  if (/^\s*\|?\s*:?-{2,}/.test(l) && l.includes('|')) return '';
  if (/^\s*\|.*\|\s*$/.test(l)) return paragraphe(l.trim().slice(1, -1).split('|').map(c => c.trim()).join('  ·  '));
  if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) return '';
  return paragraphe(l);
}
const ENTETE_XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
const NS_W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const NS_PKG = 'http://schemas.openxmlformats.org/package/2006/relationships';
const STYLES = `${ENTETE_XML}<w:styles xmlns:w="${NS_W}">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault>
<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
<w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="360" w:after="160"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:color w:val="1F2A44"/><w:sz w:val="36"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titre2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="280" w:after="120"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:color w:val="1F2A44"/><w:sz w:val="28"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Titre3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="200" w:after="80"/><w:outlineLvl w:val="2"/></w:pPr><w:rPr><w:b/><w:color w:val="3B3486"/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`;

// Le texte Markdown (titres, listes, gras, italique) devient un .docx A4 : le fichier Word s'ouvre dans Word, Pages et Google Docs
export function versDocx(markdown) {
  const lignes = String(markdown).replace(/\r\n/g, '\n').split('\n').map(ligne).filter(Boolean);
  const corps = lignes.length ? lignes.join('') : '<w:p/>';
  const document = `${ENTETE_XML}<w:document xmlns:w="${NS_W}" xmlns:r="${NS_R}"><w:body>${corps}` +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>' +
    '</w:body></w:document>';
  return zip([
    { nom: '[Content_Types].xml', donnees: `${ENTETE_XML}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>` },
    { nom: '_rels/.rels', donnees: `${ENTETE_XML}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_R}/officeDocument" Target="word/document.xml"/></Relationships>` },
    { nom: 'word/document.xml', donnees: document },
    { nom: 'word/styles.xml', donnees: STYLES },
    { nom: 'word/_rels/document.xml.rels', donnees: `${ENTETE_XML}<Relationships xmlns="${NS_PKG}"><Relationship Id="rId1" Type="${NS_R}/styles" Target="styles.xml"/></Relationships>` }
  ]);
}

// Un zip sans compression (le format de Word et de tout zip) : chaque fichier, puis le sommaire
const TABLE_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(octets) {
  let c = 0xffffffff;
  for (const o of octets) c = TABLE_CRC[(c ^ o) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
// fichiers : [{ nom, donnees }]. La date est fixée au 1er janvier 1980 : le résultat ne change pas d'un jour à l'autre.
export function zip(fichiers) {
  const morceaux = [], sommaire = [];
  let decalage = 0;
  for (const f of fichiers) {
    const nom = Buffer.from(f.nom, 'utf8');
    const donnees = Buffer.from(f.donnees, 'utf8');
    const crc = crc32(donnees);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8); local.writeUInt16LE(0, 10); local.writeUInt16LE(0x21, 12);
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(donnees.length, 18); local.writeUInt32LE(donnees.length, 22);
    local.writeUInt16LE(nom.length, 26); local.writeUInt16LE(0, 28);
    morceaux.push(local, nom, donnees);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(donnees.length, 20); central.writeUInt32LE(donnees.length, 24);
    central.writeUInt16LE(nom.length, 28); central.writeUInt16LE(0, 30); central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34); central.writeUInt16LE(0, 36); central.writeUInt32LE(0, 38); central.writeUInt32LE(decalage, 42);
    sommaire.push(central, nom);
    decalage += local.length + nom.length + donnees.length;
  }
  const taille = sommaire.reduce((s, b) => s + b.length, 0);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0); fin.writeUInt16LE(fichiers.length, 8); fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(taille, 12); fin.writeUInt32LE(decalage, 16);
  return Buffer.concat([...morceaux, ...sommaire, fin]);
}

// ---------- PDF ----------
// adresse : l'aperçu isolé de la page HTML (le serveur la sert). Renvoie { octets } ou { erreur }.
export async function versPdf({ code, adresse }) {
  const chrome = trouverChrome();
  const puppeteer = chargerPuppeteer(code);
  if (!chrome || !puppeteer) return { erreur: !chrome ? 'Google Chrome est introuvable (installe-le sur ce Mac)' : "l'outil de fabrication est absent (lance npm install)" };
  const origine = new URL(adresse).origin;
  const args = ['--mute-audio'];
  if (process.getuid && process.getuid() === 0) args.push('--no-sandbox');
  const nav = await puppeteer.launch({ executablePath: chrome, headless: true, args });
  try {
    const page = await nav.newPage();
    // Un PDF n'a pas besoin de script : il est coupé, et seules les polices Google et les images du projet sont chargées
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', r => {
      const u = r.url();
      if (u.startsWith(origine + '/') || PERMIS.test(u)) return r.continue();
      r.abort();
    });
    await page.goto(adresse, { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    const octets = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true, margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' } });
    return { octets: Buffer.from(octets) };
  } catch (e) {
    return { erreur: 'le navigateur a échoué : ' + String(e.message || e).slice(0, 150) };
  } finally {
    await nav.close().catch(() => {});
  }
}
