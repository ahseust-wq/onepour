#!/usr/bin/env bash
# Replaces the __CONTACT_EMAIL__ placeholder on every page.
# Usage: CONTACT_EMAIL='you@example.com' ./set-contact-email.sh
set -euo pipefail
: "${CONTACT_EMAIL:?Set CONTACT_EMAIL first}"
cd "$(dirname "$0")"
for f in index.html privacy.html impressum.html; do
  sed -i.bak "s|__CONTACT_EMAIL__|${CONTACT_EMAIL}|g" "$f" && rm -f "$f.bak"
done
echo "Contact email set in index.html, privacy.html, impressum.html"
