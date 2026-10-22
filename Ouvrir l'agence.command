#!/bin/bash
# Double-clic : ouvre l'agence (la page des locaux s'ouvre toute seule dans le navigateur).
cd "$(dirname "$0")" || exit 1
if ! command -v npm >/dev/null 2>&1; then
  echo "Il manque Node.js. Installe la version « LTS » depuis https://nodejs.org, puis double-clique à nouveau."
  read -p "Appuie sur Entrée pour fermer."
  exit 1
fi
[ -d node_modules ] || npm install
npm run agence
