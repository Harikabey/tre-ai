export interface TreosCommand {
  name: string;
  description: string;
}

export interface TreosCommandGroup {
  name: string;
  dangerous?: boolean;
  commands: TreosCommand[];
}

export const TREOS_COMMAND_GROUPS: TreosCommandGroup[] = [
  {
    name: 'Güvenli / Okuma',
    commands: [
      { name: 'ls', description: 'Klasör içeriğini listeler' },
      { name: 'cat', description: 'Dosya içeriğini gösterir' },
      { name: 'pwd', description: 'Geçerli klasörü gösterir' },
      { name: 'echo', description: 'Metni ekrana yazar' },
      { name: 'dir', description: 'Klasör içeriğini listeler' },
      { name: 'type', description: 'Dosya içeriğini gösterir' },
    ],
  },
  {
    name: 'Dosya İşlemleri',
    commands: [
      { name: 'mkdir', description: 'Klasör oluşturur' },
      { name: 'touch', description: 'Boş dosya oluşturur veya zamanını günceller' },
      { name: 'cp', description: 'Dosya veya klasörü kopyalar' },
      { name: 'mv', description: 'Dosya veya klasörü taşır/yeniden adlandırır' },
    ],
  },
  {
    name: 'Sistem Bilgisi',
    commands: [
      { name: 'whoami', description: 'Geçerli kullanıcı adını gösterir' },
      { name: 'date', description: 'Tarih ve saati gösterir' },
      { name: 'uname', description: 'İşletim sistemi bilgisini gösterir' },
      { name: 'ipconfig', description: 'Ağ yapılandırmasını gösterir' },
    ],
  },
  {
    name: 'Tehlikeli Komutlar',
    dangerous: true,
    commands: [
      { name: 'rm', description: 'Dosya/dizin siler (GERİ ALINAMAZ)' },
      { name: 'del', description: 'Dosya siler (GERİ ALINAMAZ)' },
      { name: 'format', description: 'Sürücüyü biçimlendirir (VERİ KAYBI)' },
      { name: 'mkfs', description: 'Dosya sistemini oluşturur (VERİ KAYBI)' },
      { name: 'shutdown', description: 'Bilgisayarı kapatır' },
      { name: 'reboot', description: 'Bilgisayarı yeniden başlatır' },
    ],
  },
];

export const DEFAULT_TREOS_COMMANDS = TREOS_COMMAND_GROUPS[0].commands.map(({ name }) => name);
export const DANGEROUS_TREOS_COMMANDS = new Set(
  TREOS_COMMAND_GROUPS.find(({ dangerous }) => dangerous)!.commands.map(({ name }) => name),
);

const BRIDGE_SOURCE = String.raw`import asyncio
import base64
import contextlib
import ipaddress
import os
import socket
import sys
from collections.abc import AsyncIterator
from datetime import datetime, timedelta, timezone
from pathlib import Path

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager
from mcp.server.transport_security import TransportSecuritySettings
from stela_mcp.server import LocalSystemServer
from starlette.applications import Starlette
from starlette.routing import Mount
import uvicorn

HOST = "127.0.0.1"
BASE_PORT = int(os.environ.get("TREOS_BASE_PORT", "8500"))
MAX_PORT = min(BASE_PORT + 99, 65535)
ALLOWED_ORIGIN = base64.b64decode(
    os.environ["TREOS_ALLOWED_ORIGIN_B64"]
).decode("utf-8")
DATA_DIR = Path(os.environ["TREOS_DATA_DIR"])
CERT_FILE = DATA_DIR / "treos-localhost.crt"
KEY_FILE = DATA_DIR / "treos-localhost.key"
STELA = LocalSystemServer()
SESSION_MANAGER = StreamableHTTPSessionManager(
    app=STELA.server,
    security_settings=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


def ensure_certificate():
    if CERT_FILE.is_file() and KEY_FILE.is_file():
        return

    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    certificate = (
        x509.CertificateBuilder()
        .subject_name(name)
        .issuer_name(name)
        .public_key(private_key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1))
        .not_valid_after(now + timedelta(days=3650))
        .add_extension(
            x509.SubjectAlternativeName([
                x509.DNSName("localhost"),
                x509.IPAddress(ipaddress.ip_address("127.0.0.1")),
                x509.IPAddress(ipaddress.ip_address("::1")),
            ]),
            critical=False,
        )
        .add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        .add_extension(
            x509.KeyUsage(
                digital_signature=True,
                content_commitment=False,
                key_encipherment=True,
                data_encipherment=False,
                key_agreement=False,
                key_cert_sign=True,
                crl_sign=True,
                encipher_only=None,
                decipher_only=None,
            ),
            critical=True,
        )
        .add_extension(
            x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]),
            critical=False,
        )
        .sign(private_key, hashes.SHA256())
    )
    KEY_FILE.write_bytes(private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ))
    CERT_FILE.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    if os.name != "nt":
        os.chmod(KEY_FILE, 0o600)


async def handle_streamable_http(scope, receive, send):
    await SESSION_MANAGER.handle_request(scope, receive, send)


@contextlib.asynccontextmanager
async def lifespan(app: Starlette) -> AsyncIterator[None]:
    async with SESSION_MANAGER.run():
        yield


class TreOSOriginGuard:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        origin = headers.get(b"origin", b"").decode("latin-1")
        if origin != ALLOWED_ORIGIN:
            await self._respond(send, 403, [(b"content-type", b"text/plain")], b"Origin not allowed")
            return

        if scope["method"] == "OPTIONS":
            requested_headers = headers.get(
                b"access-control-request-headers",
                b"accept, content-type, mcp-protocol-version, mcp-session-id",
            )
            response_headers = [
                (b"access-control-allow-origin", ALLOWED_ORIGIN.encode("latin-1")),
                (b"access-control-allow-methods", b"GET, POST, DELETE, OPTIONS"),
                (b"access-control-allow-headers", requested_headers),
                (b"access-control-allow-private-network", b"true"),
                (b"access-control-max-age", b"600"),
                (b"vary", b"Origin"),
            ]
            await self._respond(send, 204, response_headers, b"")
            return

        async def send_with_cors(message):
            if message["type"] == "http.response.start":
                headers_out = list(message.get("headers", []))
                headers_out.extend([
                    (b"access-control-allow-origin", ALLOWED_ORIGIN.encode("latin-1")),
                    (b"access-control-expose-headers", b"Mcp-Session-Id, MCP-Protocol-Version"),
                    (b"access-control-allow-private-network", b"true"),
                    (b"vary", b"Origin"),
                ])
                message = {**message, "headers": headers_out}
            await send(message)

        await self.app(scope, receive, send_with_cors)

    @staticmethod
    async def _respond(send, status, headers, body):
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})


def bind_server():
    last_error = None
    for port in range(BASE_PORT, MAX_PORT + 1):
        listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            listener.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            listener.bind((HOST, port))
            listener.listen(128)
            return listener, port
        except OSError as error:
            last_error = error
            listener.close()
    raise OSError(f"{BASE_PORT}-{MAX_PORT} aralığında boş port bulunamadı: {last_error}")


async def main():
    ensure_certificate()
    listener, port = bind_server()
    app = Starlette(
        routes=[Mount("/mcp", app=handle_streamable_http)],
        lifespan=lifespan,
    )
    app = TreOSOriginGuard(app)
    server = uvicorn.Server(uvicorn.Config(
        app,
        log_level="warning",
        access_log=False,
        ssl_certfile=str(CERT_FILE),
        ssl_keyfile=str(KEY_FILE),
    ))
    task = asyncio.create_task(server.serve(sockets=[listener]))
    try:
        while not server.started and not task.done():
            await asyncio.sleep(0.05)
        if task.done():
            await task
        print(
            f"Self-signed TLS certificate: {CERT_FILE}\n"
            f"Trust the .crt file in your OS/browser before connecting from TreOS. "
            f"Never import or share the private key: {KEY_FILE}.",
            flush=True,
        )
        print(
            f"STeLA MCP başlatıldı: https://localhost:{port}/mcp "
            f"(yerel port {port}; durdurmak için Ctrl+C)",
            flush=True,
        )
        await task
    finally:
        if not task.done():
            server.should_exit = True
            await task


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSTeLA MCP durduruldu.", flush=True)
    except Exception as error:
        print(f"STeLA MCP başlatılamadı: {error}", file=sys.stderr, flush=True)
        raise
`;

function toBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

export function readTreosAllowedCommands(): string[] {
  const stored = localStorage.getItem('treos_allowed_commands');
  if (stored === null) return DEFAULT_TREOS_COMMANDS;
  try {
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return DEFAULT_TREOS_COMMANDS;
    const knownCommands = new Set(TREOS_COMMAND_GROUPS.flatMap(({ commands }) =>
      commands.map(({ name }) => name),
    ));
    return [...new Set(parsed.filter(
      (command): command is string => typeof command === 'string' && knownCommands.has(command),
    ))];
  } catch {
    return DEFAULT_TREOS_COMMANDS;
  }
}

export function createTreosSetupScript(
  platform: 'windows' | 'unix',
  commands: string[],
  allowedOrigin: string,
): string {
  const bridgeBase64 = toBase64(BRIDGE_SOURCE);
  const bridgeChunks = bridgeBase64.match(/.{1,3000}/g) ?? [];
  const writeBridgeChunks = bridgeChunks
    .map((chunk, index) =>
      `${index === 0 ? '>' : '>>'} "%TREOS_DATA_DIR%\\treos_stela_http_bridge.b64" echo ${chunk}`,
    )
    .join('\n');
  const originBase64 = toBase64(allowedOrigin);
  const commandList = commands.join(',');

  if (platform === 'windows') {
    return `@echo off
setlocal
cd /d "%~dp0"
set "ALLOWED_COMMANDS=${commandList}"
set "ALLOWED_FLAGS=-l,-a,-h,--help"
set "ALLOWED_DIR=%CD%"
set "ALLOWED_DIRS=%CD%"
set "TREOS_ALLOWED_ORIGIN_B64=${originBase64}"
set "TREOS_BASE_PORT=8500"
set "TREOS_DATA_DIR=%LOCALAPPDATA%\\TreOS\\STeLA"
if not defined LOCALAPPDATA set "TREOS_DATA_DIR=%USERPROFILE%\\AppData\\Local\\TreOS\\STeLA"

python --version >nul 2>nul
if errorlevel 1 (
  echo Python kurulu degil, lutfen python.org'dan indirin.
  goto :failed
)
python -c "import sys; sys.exit(0 if sys.version_info.__ge__((3, 10)) else 1)"
if errorlevel 1 (
  echo Python 3.10 veya uzeri gerekli. Lutfen python.org'dan guncel surumu indirin.
  goto :failed
)
python --version

if not exist "%TREOS_DATA_DIR%" mkdir "%TREOS_DATA_DIR%"
if errorlevel 1 (
  echo TreOS veri klasoru olusturulamadi.
  goto :failed
)
if not exist "%TREOS_DATA_DIR%\\Scripts\\python.exe" (
  python -m venv "%TREOS_DATA_DIR%"
  if errorlevel 1 (
    echo Python sanal ortami olusturulamadi.
    goto :failed
  )
)
set "TREOS_PYTHON=%TREOS_DATA_DIR%\\Scripts\\python.exe"

echo STeLA MCP kuruluyor...
"%TREOS_PYTHON%" -m pip install --upgrade stela-mcp==0.5.0 "mcp[cli]>=1.25,<2" "cryptography>=42"
if errorlevel 1 (
  echo STeLA MCP kurulumu basarisiz. Python pip kurulumunu kontrol edin.
  goto :failed
)
${writeBridgeChunks}
"%TREOS_PYTHON%" -c "import base64,os; d=os.environ['TREOS_DATA_DIR']; p=os.path.join(d,'treos_stela_http_bridge.b64'); f=os.path.join(d,'treos_stela_http_bridge.py'); open(f,'wb').write(base64.b64decode(open(p,'rb').read()))"
if errorlevel 1 (
  del "%TREOS_DATA_DIR%\\treos_stela_http_bridge.b64" >nul 2>nul
  echo Yerel baglanti koprusu olusturulamadi.
  goto :failed
)
del "%TREOS_DATA_DIR%\\treos_stela_http_bridge.b64" >nul 2>nul
echo STeLA MCP baslatiliyor. URL hazir oldugunda asagida gosterilecek.
"%TREOS_PYTHON%" "%TREOS_DATA_DIR%\\treos_stela_http_bridge.py"
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" echo STeLA MCP bir hata ile kapandi.
pause
exit /b %EXIT_CODE%

:failed
pause
exit /b 1
`;
  }

  return `#!/bin/sh
set -eu
cd "$(dirname "$0")"
export ALLOWED_COMMANDS='${commandList}'
export ALLOWED_FLAGS='-l,-a,-h,--help'
export ALLOWED_DIR="$(pwd -P)"
export ALLOWED_DIRS="$ALLOWED_DIR"
export TREOS_ALLOWED_ORIGIN_B64='${originBase64}'
export TREOS_BASE_PORT=8500
export TREOS_DATA_DIR="\${XDG_DATA_HOME:-$HOME/.local/share}/treos-stela"

PYTHON=''
for candidate in python3 python; do
  if command -v "$candidate" >/dev/null 2>&1 && "$candidate" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' >/dev/null 2>&1; then
    PYTHON="$candidate"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "Python kurulu degil veya 3.10'dan eski; lutfen python.org'dan indirin." >&2
  printf '%s' "Kapatmak icin Enter'a basin: "
  read -r _
  exit 1
fi

"$PYTHON" --version
if ! mkdir -p "$TREOS_DATA_DIR"; then
  echo "TreOS veri klasoru olusturulamadi." >&2
  printf '%s' "Kapatmak icin Enter'a basin: "
  read -r _
  exit 1
fi
if [ ! -x "$TREOS_DATA_DIR/venv/bin/python" ]; then
  if ! "$PYTHON" -m venv "$TREOS_DATA_DIR/venv"; then
    echo "Python sanal ortami olusturulamadi." >&2
    printf '%s' "Kapatmak icin Enter'a basin: "
    read -r _
    exit 1
  fi
fi
TREOS_PYTHON="$TREOS_DATA_DIR/venv/bin/python"
echo "STeLA MCP kuruluyor..."
if ! "$TREOS_PYTHON" -m pip install --upgrade stela-mcp==0.5.0 'mcp[cli]>=1.25,<2' 'cryptography>=42'; then
  echo "STeLA MCP kurulumu basarisiz. Python pip kurulumunu kontrol edin." >&2
  printf '%s' "Kapatmak icin Enter'a basin: "
  read -r _
  exit 1
fi

BRIDGE="$TREOS_DATA_DIR/treos_stela_http_bridge.py"
"$TREOS_PYTHON" -c 'import base64,pathlib,sys; pathlib.Path(sys.argv[1]).write_bytes(base64.b64decode(sys.argv[2]))' "$BRIDGE" '${bridgeBase64}'
echo "STeLA MCP baslatiliyor. URL hazir oldugunda asagida gosterilecek."
if "$TREOS_PYTHON" "$BRIDGE"; then
  EXIT_CODE=0
else
  EXIT_CODE=$?
fi
printf '%s' "Kapatmak icin Enter'a basin: "
read -r _
exit "$EXIT_CODE"
`;
}
