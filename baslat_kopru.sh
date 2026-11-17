#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

if command -v python3 >/dev/null 2>&1; then
  python3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" || {
    printf '%s\n' "Python 3.10 veya daha yeni bir surum gerekli." >&2
    exit 1
  }
  python_cmd=python3
elif command -v python >/dev/null 2>&1 &&
  python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)"; then
  python_cmd=python
else
  printf '%s\n' "Python 3.10 veya daha yeni bir surum bulunamadi. Python'u kurup yeniden deneyin." >&2
  exit 1
fi

if [ -z "${TREOS_ALLOWED_ORIGINS:-}" ]; then
  printf '%s' "TreOS sayfa kaynagini girin (bos birakilirsa yayinlanan TreOS ve localhost izinleri kullanilir): "
  IFS= read -r TREOS_ALLOWED_ORIGINS || TREOS_ALLOWED_ORIGINS=
  if [ -n "$TREOS_ALLOWED_ORIGINS" ]; then
    export TREOS_ALLOWED_ORIGINS
  else
    unset TREOS_ALLOWED_ORIGINS
  fi
fi

"$python_cmd" -m pip install --upgrade rigout
exec "$python_cmd" "$script_dir/treos_bridge.py"
