#!/bin/bash
# Aggiorna sito GitHub Pages con catalogo + offerte Pronto Spesa
set -e

REPO_DIR="$HOME/prontospesa-offerte"

cd "$REPO_DIR"

# 1. Aggiorna i dati (catalogo + offerte)
python3 update_data.py

# 2. Git push se ci sono cambiamenti
git add data/ update_data.py deploy.sh
if git diff --cached --quiet; then
    echo "Nessuna modifica da pubblicare"
else
    git commit -m "📊 Dati $(date '+%Y-%m-%d')"
    git push origin main
    echo "✅ Pubblicato su GitHub Pages"
fi
