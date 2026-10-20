#!/bin/sh
# Roda na subida do container nginx (/docker-entrypoint.d, rotasaude/wpda#2).
# Só WPDA_ALLOW_DESKTOP=1 libera o fluxo do cidadão no desktop (staging);
# sem a variável (produção), o arquivo bloqueia. Mesma imagem nos dois.
set -eu
dir="${WPDA_HTML_DIR:-/usr/share/nginx/html/wpda}"
allow=false
[ "${WPDA_ALLOW_DESKTOP:-}" = "1" ] && allow=true
printf 'window.__WPDA_RUNTIME__ = { allowDesktop: %s };\n' "$allow" > "$dir/runtime-config.js"
