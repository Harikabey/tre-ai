#!/usr/bin/env bash
set -u

script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
config_file="$script_dir/rigout-config.json"

if command -v python3 >/dev/null 2>&1; then
  python_cmd=python3
elif command -v python >/dev/null 2>&1; then
  python_cmd=python
else
  echo "Python 3 bulunamadi. Python 3 kurup bu betigi yeniden calistirin."
  read -r -p "Cikmak icin Enter'a basin..."
  exit 1
fi

if ! "$python_cmd" -m pip install rigout; then
  echo "Rigout kurulumu basarisiz oldu. Internet baglantinizi ve Python pip kurulumunu kontrol edin."
  read -r -p "Cikmak icin Enter'a basin..."
  exit 1
fi

log_file="$(mktemp "${TMPDIR:-/tmp}/treos-rigout.XXXXXX")"
nohup "$python_cmd" -u -m rigout >"$log_file" 2>&1 </dev/null &

if ! config_result=$("$python_cmd" - "$log_file" "$config_file" <<'PY'
import json
import re
import sys
import time
from pathlib import Path

log_file = Path(sys.argv[1])
config_file = Path(sys.argv[2])
url_pattern = re.compile(r"https?://(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?(?:/[^\s]*)?", re.I)
token_pattern = re.compile(
    r"""(?:bearer\s+)?(?:access\s+)?token["']?\s*[:=]\s*["']?([A-Za-z0-9._~+/-]{8,}={0,})""",
    re.I,
)
url = "http://127.0.0.1:8765/mcp"
token = ""
deadline = time.monotonic() + 60

while time.monotonic() < deadline and not token:
    try:
        output = log_file.read_text(errors="replace")
    except FileNotFoundError:
        output = ""
    url_match = url_pattern.search(output)
    if url_match:
        url = url_match.group(0).rstrip(".,)")
    token_match = token_pattern.search(output)
    if token_match:
        token = token_match.group(1)
        break
    time.sleep(2)

config_file.write_text(json.dumps({"url": url, "token": token}), encoding="utf-8")
config_file.chmod(0o600)
print("TOKEN_FOUND" if token else "TOKEN_MISSING")
PY
); then
  rm -f -- "$log_file"
  echo "Rigout yapilandirma dosyasi olusturulamadi."
  read -r -p "Cikmak icin Enter'a basin..."
  exit 1
fi

rm -f -- "$log_file"
echo "Kurulum tamamlandi, TreOS'a donun."
echo "Yapilandirma: $config_file"
if [ "$config_result" = "TOKEN_MISSING" ]; then
  echo "Token otomatik algilanamadi; TreOS'ta elle girmeniz gerekebilir."
fi
read -r -p "Kapatmak icin Enter'a basin..."
