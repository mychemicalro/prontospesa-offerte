#!/bin/bash
# Script per aggiornare il sito GitHub Pages con le ultime offerte
set -e

REPO_DIR="$HOME/prontospesa-offerte"

# 1. Aggiorna i dati
cd "$REPO_DIR"
python3 update_data.py

# 2. Git push se ci sono cambiamenti
git add data/
if git diff --cached --quiet; then
    echo "Nessuna modifica da pubblicare"
else
    git commit -m "📊 Aggiornamento offerte $(date '+%Y-%m-%d')"
    git push origin master
    echo "✅ Pubblicato su GitHub Pages"
fi
