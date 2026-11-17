#!/usr/bin/env sh
set -eu

script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$script_dir"

if command -v python3 >/dev/null 2>&1; then
  python3 -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)" || {
    printf '%s\n' "Python 3.10 veya daha yeni bir surum gerekli." >&2
    exit 1
  }
  exec python3 "$script_dir/treos_bridge.py"
elif command -v python >/dev/null 2>&1 &&
  python -c "import sys; raise SystemExit(0 if sys.version_info >= (3, 10) else 1)"; then
  exec python "$script_dir/treos_bridge.py"
fi

printf '%s\n' "Python 3.10 veya daha yeni bir surum bulunamadi. Python'u kurup yeniden deneyin." >&2
exit 1
