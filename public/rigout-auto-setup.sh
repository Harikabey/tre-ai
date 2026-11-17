#!/usr/bin/env bash
set -u

wait_for_exit() {
  printf '%s' "Cikmak icin Enter'a basin..."
  read -r _
}

if ! chmod +x "$0"; then
  echo "Betik icin calistirma izni ayarlanamadi. chmod +x \"$0\" komutunu calistirin."
  wait_for_exit
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
config_file="$script_dir/rigout-config.json"

if command -v python3 >/dev/null 2>&1; then
  python_cmd=python3
elif command -v python >/dev/null 2>&1; then
  python_cmd=python
else
  echo "Python 3 bulunamadi. Python 3 kurup bu betigi yeniden calistirin."
  wait_for_exit
  exit 1
fi

if ! "$python_cmd" -m pip install --upgrade rigout; then
  echo "Rigout kurulumu basarisiz oldu. Internet baglantinizi ve Python pip kurulumunu kontrol edin."
  wait_for_exit
  exit 1
fi

log_file="$(mktemp "${TMPDIR:-/tmp}/treos-rigout.XXXXXX")"
nohup "$python_cmd" -u -m rigout >"$log_file" 2>&1 </dev/null &
rigout_pid=$!

if ! config_result=$("$python_cmd" - "$log_file" "$config_file" "$rigout_pid" <<'PY'
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

log_file = Path(sys.argv[1])
config_file = Path(sys.argv[2])
rigout_pid = int(sys.argv[3])
url_pattern = re.compile(r"https?://[^\s\"'<>]+", re.I)
token_pattern = re.compile(
    r"""(?:bearer\s+)?(?:access\s+)?token["']?\s*[:=]\s*["']?([A-Za-z0-9._~+/-]{8,}={0,})""",
    re.I,
)
url = "http://127.0.0.1:8765/mcp"
token = ""
deadline = time.monotonic() + 60

while time.monotonic() < deadline and not token:
    try:
        os.kill(rigout_pid, 0)
    except ProcessLookupError:
        print("Rigout process exited before providing a token.", file=sys.stderr)
        sys.exit(1)
    try:
        output = log_file.read_text(errors="replace")
    except FileNotFoundError:
        output = ""
    url_match = url_pattern.search(output)
    if url_match:
        candidate = url_match.group(0).rstrip(".,)")
        parsed_url = urlsplit(candidate)
        if parsed_url.scheme == "https" or (
            parsed_url.scheme == "http"
            and parsed_url.hostname in {"127.0.0.1", "localhost", "::1"}
        ):
            url = candidate
    token_match = token_pattern.search(output)
    if token_match:
        token = token_match.group(1)
        break
    time.sleep(2)

if not token:
    print("Rigout did not provide a token within 60 seconds.", file=sys.stderr)
    sys.exit(1)

config_file.write_text(json.dumps({"url": url, "token": token}), encoding="utf-8")
config_file.chmod(0o600)
print("TOKEN_FOUND")
PY
); then
  rm -f -- "$log_file"
  echo "Rigout baslatilamadi veya token 60 saniye icinde bulunamadi. Python kurulumu ve Rigout ciktisini kontrol edin."
  wait_for_exit
  exit 1
fi

rm -f -- "$log_file"
echo "Kurulum tamamlandi, TreOS'a donun."
echo "Yapilandirma: $config_file"
echo "TreOS'ta rigout-config.json dosyasini secerek baglanin."
wait_for_exit
