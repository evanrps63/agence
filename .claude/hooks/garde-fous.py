#!/usr/bin/env python3
"""Garde-fous de l'Agence (hook PreToolUse, voir .claude/settings.json).

Bloque :
- ajouter tout le dossier à git (`git add -A`, `.`, `--all`, `-u`…) ou `git commit -a` :
  on ajoute ses fichiers par leur nom ;
- modifier .claude/agence/ (conversations : seul le serveur y écrit).
Demande confirmation pour ce qui publie ou efface du travail :
`git push`, `git stash`, `git reset --hard/--keep/--merge`, `git clean`, `git checkout .` / `-f`,
`git restore` (hors `--staged`), `git switch -f`.
Rappelle les règles avant chaque `git commit`.
Les textes entre guillemets et le contenu des « heredoc » (messages de commit) ne sont pas analysés.
"""
import json
import re
import sys


def sortie(decision=None, raison=None, contexte=None):
    corps = {"hookEventName": "PreToolUse"}
    if decision:
        corps["permissionDecision"] = decision
        corps["permissionDecisionReason"] = raison
    if contexte:
        corps["additionalContext"] = contexte
    print(json.dumps({"hookSpecificOutput": corps}, ensure_ascii=False))
    sys.exit(0)


try:
    entree = json.load(sys.stdin)
except Exception:
    sys.exit(0)  # entrée illisible : ne jamais bloquer le travail pour ça
if not isinstance(entree, dict):
    sys.exit(0)
outil = entree.get("tool_name", "")
params = entree.get("tool_input") or {}
if not isinstance(params, dict):
    sys.exit(0)

if outil in ("Edit", "Write", "NotebookEdit"):
    chemin = str(params.get("file_path") or params.get("notebook_path") or "").lower()
    if re.search(r"(^|/)\.claude/agence/", chemin):
        sortie("deny", ".claude/agence/ contient les conversations de l'agence : seul le serveur y écrit.")
    sys.exit(0)

if outil != "Bash":
    sys.exit(0)

cmd = str(params.get("command", ""))
# 1. retirer le contenu des heredoc (<<'EOF' … EOF) et des textes entre guillemets
cmd = re.sub(r"<<-?\s*(['\"]?)(\w+)\1[^\n]*\n.*?\n\s*\2\s*(?=\n|$)", " ", cmd, flags=re.S)
cmd = re.sub(r"'[^']*'", "''", cmd)
cmd = re.sub(r'"(?:\\.|[^"\\])*"', '""', cmd)
# 2. découper en commandes simples
morceaux = re.split(r"&&|\|\||[;|\n()`]|\$\(", cmd)

PREFIXE = re.compile(r"^(?:\w+=\S*\s+)*git(?:\s+(?:-C|-c|--git-dir|--work-tree)\s+\S+|\s+--git-dir=\S+|\s+--work-tree=\S+)*\s+")
commit_vu = False
for brut in morceaux:
    m = brut.strip()
    p = PREFIXE.match(m)
    if not p:
        continue
    reste = m[p.end():] + " "
    sous = reste.split()[0] if reste.split() else ""
    args = reste[len(sous):]
    if sous == "add" and re.search(r"\s(-[a-zA-Z]*[Au][a-zA-Z]*|--all|--update|--no-ignore-removal|\.|\./|:/|\*)(?=\s)", args):
        sortie("deny", "Ajoute tes fichiers par leur nom (git add chemin/fichier) : d'autres sessions travaillent dans le même dossier.")
    if sous == "commit":
        commit_vu = True
        if re.search(r"\s(-[a-zA-Z]*a[a-zA-Z]*|--all)(?=\s)", args):
            sortie("deny", "Pas de git commit -a : ajoute tes fichiers par leur nom, puis git commit.")
    if sous == "push":
        sortie("ask", "git push publie sur GitHub : seulement sur demande d'Evan (bouton « Envoyer sur GitHub »).")
    efface = (
        (sous == "stash" and not re.match(r"\s*(list|show)\b", args))
        or (sous == "reset" and re.search(r"\s--(hard|keep|merge)(?=\s)", args))
        or sous == "clean"
        or (sous == "checkout" and re.search(r"\s(\.|-f|--force|--)(?=\s)", args))
        or (sous == "restore" and "--staged" not in args)
        or (sous == "switch" and re.search(r"\s(-f|--force|--discard-changes)(?=\s)", args))
    )
    if efface:
        sortie("ask", "Cette commande peut effacer du travail non commité, peut-être celui d'une autre session.")

if commit_vu:
    sortie(contexte=(
        "Rappel avant ce commit (CLAUDE.md) : npm test vert, fichiers ajoutés par leur nom, "
        "aucun chiffre sans source dans projets/, et pas de git push sans le clic d'Evan."
    ))
sys.exit(0)
