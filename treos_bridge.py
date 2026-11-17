#!/usr/bin/env python3
"""Serve a minimal local health endpoint for TreOS."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer


HOST = "127.0.0.1"
PORT = 8765
ALLOWED_ORIGIN = "https://tre-ai-app.vercel.app"


class HealthHandler(BaseHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def do_GET(self) -> None:
        if self.path != "/healthz":
            self.send_error(404, "Not Found")
            return

        body = json.dumps({"bridge": "online"}).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        if self.path != "/healthz":
            self.send_error(404, "Not Found")
            return

        self.send_response(204)
        self.send_header("Content-Length", "0")
        self.end_headers()


def main() -> None:
    server = HTTPServer((HOST, PORT), HealthHandler)
    print(f"TreOS health endpoint: http://{HOST}:{PORT}/healthz", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nTreOS health server stopping.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
