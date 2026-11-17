#!/usr/bin/env python3
"""Run Rigout behind a loopback-only MCP proxy with an explicit CORS origin allowlist."""

from __future__ import annotations

import http.client
import json
import os
import re
import runpy
import signal
import socket
import subprocess
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit


PROXY_HOST = "127.0.0.1"
PROXY_PORT = 8765
RIGOUT_HOST = "127.0.0.1"
RIGOUT_PORT = 8766
MCP_PATH = "/mcp"
HEALTH_PATH = "/healthz"
RIGOUT_CHILD_FLAG = "--treos-rigout-child"
MAX_REQUEST_SIZE = 2 * 1024 * 1024
MAX_RESPONSE_SIZE = 2 * 1024 * 1024
ALLOWED_HEADERS = {
    "accept",
    "authorization",
    "content-type",
    "last-event-id",
    "mcp-protocol-version",
    "mcp-session-id",
}
FORWARDED_REQUEST_HEADERS = {
    "accept": "Accept",
    "authorization": "Authorization",
    "content-type": "Content-Type",
    "last-event-id": "Last-Event-ID",
    "mcp-protocol-version": "MCP-Protocol-Version",
    "mcp-session-id": "Mcp-Session-Id",
}
FORWARDED_RESPONSE_HEADERS = {
    "cache-control",
    "content-type",
    "last-event-id",
    "mcp-protocol-version",
    "mcp-session-id",
    "retry-after",
}
TOKEN_PATTERN = re.compile(
    r"""(?:bearer\s+)?(?:access\s+)?token["']?\s*[:=]\s*["']?([A-Za-z0-9._~+/-]{8,}={0,})""",
    re.IGNORECASE,
)
DEFAULT_ALLOWED_ORIGINS = (
    "https://tre-ai-app.vercel.app",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
)


def parse_allowed_origins(value: str | None) -> frozenset[str]:
    """Load exact origins; production origins must be explicitly configured."""
    entries = value.split(",") if value and value.strip() else DEFAULT_ALLOWED_ORIGINS
    origins: set[str] = set()
    for entry in entries:
        origin = entry.strip().rstrip("/")
        if not origin:
            continue
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.path
            or parsed.query
            or parsed.fragment
            or parsed.username
            or parsed.password
            or parsed.hostname is None
            or parsed.port is not None and not 1 <= parsed.port <= 65535
        ):
            raise ValueError(f"Invalid origin in TREOS_ALLOWED_ORIGINS: {origin!r}")
        if parsed.scheme != "https" and parsed.hostname not in {
            "localhost",
            "127.0.0.1",
            "::1",
        }:
            raise ValueError("Non-loopback TREOS_ALLOWED_ORIGINS entries must use HTTPS.")
        scheme = parsed.scheme.lower()
        hostname = parsed.hostname.lower()
        if ":" in hostname:
            hostname = f"[{hostname}]"
        port = parsed.port
        if port is not None and not (
            (scheme == "http" and port == 80)
            or (scheme == "https" and port == 443)
        ):
            hostname = f"{hostname}:{port}"
        origins.add(f"{scheme}://{hostname}")
    if not origins:
        raise ValueError("TREOS_ALLOWED_ORIGINS must contain at least one allowed origin.")
    return frozenset(origins)


def write_config(token: str) -> None:
    app_directory = (
        Path(sys.executable).resolve().parent
        if getattr(sys, "frozen", False)
        else Path(__file__).resolve().parent
    )
    config_path = app_directory / "rigout-config.json"
    temp_path = config_path.with_suffix(".json.tmp")
    temp_path.write_text(
        json.dumps({"url": f"http://{PROXY_HOST}:{PROXY_PORT}{MCP_PATH}", "token": token}),
        encoding="utf-8",
    )
    if os.name != "nt":
        temp_path.chmod(0o600)
    os.replace(temp_path, config_path)
    print(f"Rigout baglanti bilgisi yazildi: {config_path}", flush=True)


def make_handler(allowed_origins: frozenset[str]) -> type[BaseHTTPRequestHandler]:
    class McpProxyHandler(BaseHTTPRequestHandler):
        protocol_version = "HTTP/1.1"
        server_version = "TreOSBridge"
        sys_version = ""

        def log_message(self, format_string: str, *args: object) -> None:
            print(f"[proxy] {format_string % args}", flush=True)

        def _origin_is_allowed(self) -> bool:
            origin = self.headers.get("Origin")
            return origin in allowed_origins

        def _host_is_local(self) -> bool:
            return self.headers.get("Host", "").lower() in {
                f"127.0.0.1:{PROXY_PORT}",
                f"localhost:{PROXY_PORT}",
                f"[::1]:{PROXY_PORT}",
            }

        def _add_cors_headers(self) -> None:
            origin = self.headers.get("Origin")
            if origin in allowed_origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Private-Network", "true")

        def _send_error_response(self, status: int, message: str) -> None:
            body = json.dumps({"error": message}).encode("utf-8")
            self.send_response(status)
            self._add_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)
            self.close_connection = True

        def _validate_browser_request(self, allow_health: bool = False) -> bool:
            if not self._host_is_local():
                self._send_error_response(403, "Local proxy host is not allowed.")
                return False
            if not self._origin_is_allowed():
                self._send_error_response(403, "Request origin is not allowed.")
                return False
            allowed_paths = {MCP_PATH, HEALTH_PATH} if allow_health else {MCP_PATH}
            if self.path not in allowed_paths:
                self._send_error_response(404, "Only the MCP endpoint is available.")
                return False
            return True

        def do_OPTIONS(self) -> None:
            if not self._validate_browser_request(allow_health=True):
                return
            requested_method = self.headers.get("Access-Control-Request-Method", "").upper()
            if requested_method not in {"GET", "POST"}:
                self._send_error_response(405, "Only GET and POST preflight requests are allowed.")
                return
            requested_headers = {
                header.strip().lower()
                for header in self.headers.get("Access-Control-Request-Headers", "").split(",")
                if header.strip()
            }
            if not requested_headers.issubset(ALLOWED_HEADERS):
                self._send_error_response(400, "A requested CORS header is not allowed.")
                return

            self.send_response(204)
            self._add_cors_headers()
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header(
                "Access-Control-Allow-Headers",
                "Accept, Authorization, Content-Type, Last-Event-ID, "
                "MCP-Protocol-Version, Mcp-Session-Id",
            )
            self.send_header("Access-Control-Max-Age", "600")
            self.send_header("Content-Length", "0")
            self.end_headers()

        def do_GET(self) -> None:
            if self.path == HEALTH_PATH:
                self._send_health()
                return
            self._proxy_request()

        def do_POST(self) -> None:
            self._proxy_request()

        def _send_health(self) -> None:
            if not self._validate_browser_request(allow_health=True):
                return
            try:
                with socket.create_connection((RIGOUT_HOST, RIGOUT_PORT), timeout=1):
                    rigout_available = True
            except OSError:
                rigout_available = False
            body = json.dumps({
                "bridge": "online",
                "rigout": "online" if rigout_available else "offline",
            }).encode("utf-8")
            self.send_response(200 if rigout_available else 503)
            self._add_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body)
            self.close_connection = True

        def _proxy_request(self) -> None:
            if not self._validate_browser_request():
                return
            try:
                content_length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self._send_error_response(400, "Invalid Content-Length.")
                return
            if content_length < 0 or content_length > MAX_REQUEST_SIZE:
                self._send_error_response(413, "Request body exceeds the allowed size.")
                return
            if self.headers.get("Transfer-Encoding"):
                self._send_error_response(400, "Transfer-Encoding is not supported.")
                return

            body = self.rfile.read(content_length) if self.command == "POST" else None
            headers = {
                upstream_name: self.headers[client_name]
                for client_name, upstream_name in FORWARDED_REQUEST_HEADERS.items()
                if self.headers.get(client_name) is not None
            }

            connection = http.client.HTTPConnection(
                RIGOUT_HOST,
                RIGOUT_PORT,
                timeout=30,
            )
            try:
                connection.request(self.command, MCP_PATH, body=body, headers=headers)
                response = connection.getresponse()
                response_body = response.read(MAX_RESPONSE_SIZE + 1)
                if len(response_body) > MAX_RESPONSE_SIZE:
                    self._send_error_response(502, "Rigout response exceeds the allowed size.")
                    return

                self.send_response(response.status, response.reason)
                self._add_cors_headers()
                for name, value in response.getheaders():
                    if name.lower() in FORWARDED_RESPONSE_HEADERS:
                        self.send_header(name, value)
                self.send_header("Content-Length", str(len(response_body)))
                self.send_header("Connection", "close")
                self.end_headers()
                if response_body:
                    self.wfile.write(response_body)
                self.close_connection = True
            except (OSError, http.client.HTTPException) as error:
                self._send_error_response(502, f"Rigout is unavailable: {error}")
            finally:
                connection.close()

    return McpProxyHandler


def stop_rigout(process: subprocess.Popen[str]) -> None:
    if process.poll() is not None:
        return
    try:
        if os.name == "nt":
            process.send_signal(signal.CTRL_BREAK_EVENT)
        else:
            process.terminate()
        process.wait(timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        process.kill()
        process.wait(timeout=5)


def run_packaged_rigout() -> int:
    sys.argv = ["rigout", *sys.argv[2:]]
    runpy.run_module("rigout", run_name="__main__", alter_sys=True)
    return 0


def main() -> int:
    if getattr(sys, "frozen", False) and sys.argv[1:2] == [RIGOUT_CHILD_FLAG]:
        return run_packaged_rigout()

    try:
        allowed_origins = parse_allowed_origins(os.environ.get("TREOS_ALLOWED_ORIGINS"))
        server = ThreadingHTTPServer(
            (PROXY_HOST, PROXY_PORT),
            make_handler(allowed_origins),
        )
    except (OSError, ValueError) as error:
        print(f"TreOS koprusu baslatilamadi: {error}", file=sys.stderr)
        return 1

    creation_flags = subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
    rigout_command = (
        [sys.executable, RIGOUT_CHILD_FLAG, "serve", "--port", str(RIGOUT_PORT)]
        if getattr(sys, "frozen", False)
        else [sys.executable, "-u", "-m", "rigout", "serve", "--port", str(RIGOUT_PORT)]
    )
    try:
        rigout = subprocess.Popen(
            rigout_command,
            stdin=subprocess.DEVNULL,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            creationflags=creation_flags,
        )
    except OSError as error:
        server.server_close()
        print(f"Rigout baslatilamadi: {error}", file=sys.stderr)
        return 1

    def relay_output() -> None:
        assert rigout.stdout is not None
        for line in rigout.stdout:
            match = TOKEN_PATTERN.search(line)
            if match:
                try:
                    write_config(match.group(1))
                except OSError as error:
                    print(f"Yapilandirma dosyasi yazilamadi: {error}", file=sys.stderr)
                line = line[: match.start(1)] + "[redacted]" + line[match.end(1) :]
            print(f"[rigout] {line}", end="", flush=True)

    output_thread = threading.Thread(target=relay_output, name="rigout-output", daemon=True)
    output_thread.start()
    server_thread = threading.Thread(
        target=server.serve_forever,
        kwargs={"poll_interval": 0.25},
        name="treos-proxy",
        daemon=True,
    )
    server_thread.start()
    print(
        f"TreOS koprusu: http://{PROXY_HOST}:{PROXY_PORT}{MCP_PATH} "
        f"(Rigout: http://{RIGOUT_HOST}:{RIGOUT_PORT}{MCP_PATH})",
        flush=True,
    )
    print(
        "Izinli TreOS kaynaklari: " + ", ".join(sorted(allowed_origins)),
        flush=True,
    )

    try:
        while server_thread.is_alive():
            server_thread.join(timeout=1)
            if rigout.poll() is not None:
                print("Rigout sureci beklenmedik sekilde sonlandi.", file=sys.stderr)
                return_code = rigout.returncode or 1
                return return_code
    except KeyboardInterrupt:
        print("\nTreOS koprusu kapatiliyor...", flush=True)
    finally:
        server.shutdown()
        server.server_close()
        stop_rigout(rigout)
        output_thread.join(timeout=2)
    return 0


if __name__ == "__main__":
    packaged_parent = (
        getattr(sys, "frozen", False)
        and sys.argv[1:2] != [RIGOUT_CHILD_FLAG]
    )
    try:
        exit_code = main()
    finally:
        if packaged_parent:
            try:
                input("Çıkmak için ENTER'a basın...")
            except EOFError:
                pass
    raise SystemExit(exit_code)
