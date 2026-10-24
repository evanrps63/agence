// Le mode consultation : pas d'agent, mais le suivi, la Culthèque et l'état restent accessibles
import { demarrer, verifier, bilan } from './outils.mjs';

console.log('Mode consultation');
const a = await demarrer({ env: { AGENCE_CONSULTER: '1' } });
try {
  const etat = await a.api('/api/etat');
  verifier(etat.json.consultation === true, 'l\'état annonce le mode consultation');
  const brief = await a.api('/api/brief', { nom: 'Test', type: 'perso', texte: 'Un brief.' });
  verifier(brief.statut === 423 && /aucun agent/.test(brief.json.erreur), 'un nouveau brief est refusé, avec une explication');
  const message = await a.api('/api/message', { fil: 'agence:-', texte: 'Bonjour' });
  verifier(message.statut === 423, 'un message au chat est refusé');
  const choix = await a.api('/api/choisir', { fil: 'agence:-', id: 'x', option: 0 });
  verifier(choix.statut === 423, 'un choix envoyé à un agent est refusé');
  const cultheque = await fetch(a.base + '/api/campagnes', { headers: { 'X-Jeton': a.jeton } });
  verifier(cultheque.status === 200, 'la Culthèque reste accessible');
} catch (e) { verifier(false, 'exception : ' + e.stack); } finally { a.arreter(); }
bilan();
