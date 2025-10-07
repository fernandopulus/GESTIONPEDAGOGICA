#!/usr/bin/env bash
set -euo pipefail

# Aplica configuración CORS al bucket de Firebase Storage
# Requisitos: gsutil instalado y autenticado (gcloud auth login)

BUCKET="${1:-}"
if [[ -z "${BUCKET}" ]]; then
  # Intenta leer del .env o infiere desde firebase.json
  if grep -q "VITE_FIREBASE_PROJECT_ID" .env 2>/dev/null; then
    PID=$(grep -E "^VITE_FIREBASE_PROJECT_ID=" .env | sed 's/^VITE_FIREBASE_PROJECT_ID=//')
    BUCKET="${PID}.appspot.com"
  fi
fi

if [[ -z "${BUCKET}" ]]; then
  echo "Uso: $0 <bucket-name>  # Ej: plania-clase.appspot.com" >&2
  exit 1
fi

if ! command -v gsutil >/dev/null 2>&1; then
  echo "ERROR: gsutil no está instalado. Instala Google Cloud SDK: https://cloud.google.com/sdk/docs/install" >&2
  exit 2
fi

if [[ ! -f cors.json ]]; then
  echo "ERROR: No se encuentra cors.json en el directorio actual" >&2
  exit 3
fi

set -x
# Ver política actual
gsutil cors get "gs://${BUCKET}" || true
# Aplicar política
gsutil cors set cors.json "gs://${BUCKET}"
# Verificar
gsutil cors get "gs://${BUCKET}"
set +x

echo "CORS aplicado correctamente al bucket ${BUCKET}"
