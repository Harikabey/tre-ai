#!/bin/sh
set -eu

ASSET_BASE_URL="__TREOS_ASSET_BASE_URL__"
EXPECTED_SHA256="86f31cc7cf3dcaed4337e61e26d86e2ded06fa1380d8e844c4ff18259084c572"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 18 veya üzeri gerekli. Node.js'i resmi kaynaktan yükleyip betiği yeniden çalıştırın." >&2
  exit 1
fi
node -e "if (Number(process.versions.node.split('.')[0]) < 18) process.exit(1)" || {
  echo "Node.js 18 veya üzeri gerekli." >&2
  exit 1
}
if ! command -v curl >/dev/null 2>&1; then
  echo "curl bulunamadı; simülatör indirilemedi." >&2
  exit 1
fi

temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT HUP INT TERM
simulator="$temp_dir/treos-local-simulator.mjs"
curl --fail --silent --show-error --location "$ASSET_BASE_URL/treos-local-simulator.mjs" --output "$simulator"

if command -v sha256sum >/dev/null 2>&1; then
  actual_sha256="$(sha256sum "$simulator" | cut -d ' ' -f 1)"
elif command -v shasum >/dev/null 2>&1; then
  actual_sha256="$(shasum -a 256 "$simulator" | cut -d ' ' -f 1)"
else
  echo "SHA-256 doğrulama aracı bulunamadı; simülatör çalıştırılmadı." >&2
  exit 1
fi
if [ "$actual_sha256" != "$EXPECTED_SHA256" ]; then
  echo "Simülatör dosyasının SHA-256 doğrulaması başarısız; dosya çalıştırılmadı." >&2
  exit 1
fi

node "$simulator"
