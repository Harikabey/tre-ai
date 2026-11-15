#!/usr/bin/env python3
import argparse
import asyncio
import ipaddress
import json
import os
import re
import socket
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, quote_plus, unquote, urlsplit, urlunsplit

import uvicorn
from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from playwright.async_api import Browser, BrowserContext, Page, async_playwright


HOST = "127.0.0.1"
PORT = 8501
MAX_PAGE_TEXT = 8_000
DATA_DIR = Path(".")
ACTION_PATH = re.compile(
    r"(?:^|/)(?:checkout|purchase|buy|order|payment|pay|cart|unsubscribe|logout|delete|remove|transfer|submit|confirm)(?:/|$)",
    re.IGNORECASE,
)
browser: Browser | None = None
context: BrowserContext | None = None
page: Page | None = None
page_lock = asyncio.Lock()


def default_data_dir() -> Path:
    if os.environ.get("TREOS_DATA_DIR"):
        return Path(os.environ["TREOS_DATA_DIR"]).expanduser()
    if os.name == "nt":
        return Path(os.environ.get("USERPROFILE", Path.home())) / "AppData" / "Local" / "TreOS" / "STeLA"
    return Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share")) / "treos-stela"


def validate_origin(value: str) -> str:
    origin = urlsplit(value)
    if (
        origin.scheme not in {"https", "http"}
        or not origin.hostname
        or origin.username
        or origin.password
        or origin.path not in {"", "/"}
        or origin.query
        or origin.fragment
        or (origin.scheme == "http" and origin.hostname not in {"localhost", "127.0.0.1", "::1"})
    ):
        raise ValueError("Origin HTTPS olmalı; HTTP yalnızca localhost geliştirme adreslerinde kullanılabilir.")
    return urlunsplit((origin.scheme, origin.netloc, "", "", ""))


async def validate_public_url(value: str) -> str:
    url = urlsplit(value)
    if url.scheme != "https" or not url.hostname or url.username or url.password:
        raise ValueError("Yalnızca kimlik bilgisi içermeyen HTTPS web sayfaları açılabilir.")
    normalized_path = url.path
    for _ in range(2):
        normalized_path = unquote(normalized_path)
    if ACTION_PATH.search(normalized_path) or any(
        ACTION_PATH.search(f"/{key}/") or (
            key.lower() in {"action", "cmd", "command", "do", "intent", "operation"} and
            any(ACTION_PATH.search(f"/{value}/") for value in values)
        )
        for key, values in parse_qs(url.query).items()
    ):
        raise ValueError("İşlem veya satın alma uç noktalarına gezinme engellendi.")

    hostname = url.hostname.rstrip(".").lower()
    if hostname == "localhost" or hostname.endswith(".localhost"):
        raise ValueError("Yerel ağ adreslerine erişim engellendi.")
    try:
        literal_ip = ipaddress.ip_address(hostname)
        addresses = [literal_ip]
    except ValueError:
        try:
            resolved = await asyncio.get_running_loop().getaddrinfo(
                hostname,
                url.port or 443,
                type=socket.SOCK_STREAM,
            )
        except OSError as error:
            raise ValueError("Web adresinin DNS çözümlemesi başarısız oldu.") from error
        addresses = [ipaddress.ip_address(record[4][0]) for record in resolved]

    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Yerel veya özel ağ adreslerine erişim engellendi.")
    return value


async def guard_browser_request(route: Any) -> None:
    try:
        if route.request.method != "GET":
            raise ValueError("Salt-okunur tarayıcı yalnızca GET isteklerine izin verir.")
        await validate_public_url(route.request.url)
    except (ValueError, OSError):
        await route.abort("blockedbyclient")
        return
    await route.continue_()


def require_page() -> Page:
    if page is None or page.is_closed():
        raise RuntimeError("Yerel tarayıcı hazır değil.")
    return page


async def page_result() -> dict[str, str]:
    current_page = require_page()
    return {
        "title": (await current_page.title())[:300],
        "url": current_page.url,
        "text": (await current_page.locator("body").inner_text(timeout=5_000))[:MAX_PAGE_TEXT],
    }


@asynccontextmanager
async def browser_lifespan(_server: FastMCP):
    global browser, context, page
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=False)
        context = await browser.new_context(accept_downloads=False, java_script_enabled=False, service_workers="block")
        await context.route("**/*", guard_browser_request)
        page = await context.new_page()
        yield {}
        await browser.close()
        browser = None
        context = None
        page = None


mcp = FastMCP(
    "si-MİTÇİ",
    host=HOST,
    port=PORT,
    streamable_http_path="/mcp",
    lifespan=browser_lifespan,
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)


@mcp.tool()
async def search_web(query: str) -> str:
    """Search the public web and return result titles, URLs, and snippets."""
    if not query.strip() or len(query) > 300:
        raise ValueError("Arama sorgusu boş olamaz veya 300 karakter sınırını aşamaz.")
    async with page_lock:
        current_page = require_page()
        search_url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        await current_page.goto(search_url, wait_until="domcontentloaded", timeout=25_000)
        cards = current_page.locator(".result")
        results: list[dict[str, str]] = []
        for index in range(min(await cards.count(), 8)):
            card = cards.nth(index)
            link = card.locator("a.result__a").first
            href = await link.get_attribute("href")
            title = (await link.inner_text()).strip()
            snippet_locator = card.locator(".result__snippet").first
            snippet = (await snippet_locator.inner_text()).strip() if await snippet_locator.count() else ""
            if not href or not title:
                continue
            parsed_href = urlsplit(href)
            if parsed_href.hostname and parsed_href.hostname.endswith("duckduckgo.com"):
                destination = parse_qs(parsed_href.query).get("uddg", [None])[0]
            else:
                destination = href
            if not destination:
                continue
            try:
                await validate_public_url(destination)
            except (ValueError, OSError):
                continue
            results.append({
                "title": title[:300],
                "url": destination,
                "snippet": snippet[:1_000],
            })
        return json.dumps({"query": query, "results": results}, ensure_ascii=False)


@mcp.tool()
async def open_page(url: str) -> str:
    """Open a public HTTPS page in the visible local browser and read its text."""
    await validate_public_url(url)
    async with page_lock:
        current_page = require_page()
        await current_page.goto(url, wait_until="domcontentloaded", timeout=25_000)
        await validate_public_url(current_page.url)
        return json.dumps(await page_result(), ensure_ascii=False)


@mcp.tool()
async def read_page() -> str:
    """Read the visible page's title, URL, and text without interacting with controls."""
    async with page_lock:
        return json.dumps(await page_result(), ensure_ascii=False)


@mcp.tool()
async def screenshot() -> str:
    """Save a screenshot of the current public page to the TreOS data folder."""
    async with page_lock:
        current_page = require_page()
        path = DATA_DIR / "simitci-last-view.png"
        path.parent.mkdir(parents=True, exist_ok=True)
        await current_page.screenshot(path=str(path), full_page=False)
        return json.dumps({"screenshot": str(path)}, ensure_ascii=False)


class OriginGuard:
    def __init__(self, app: Any, allowed_origin: str):
        self.app = app
        self.allowed_origin = allowed_origin

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        origin = headers.get(b"origin", b"").decode("latin-1")
        host = headers.get(b"host", b"").decode("latin-1").lower()
        if origin != self.allowed_origin or host not in {
            f"localhost:{PORT}",
            f"127.0.0.1:{PORT}",
        }:
            await self._respond(send, 403, [(b"content-type", b"text/plain")], b"Origin not allowed")
            return

        if scope["method"] == "OPTIONS":
            response_headers = [
                (b"access-control-allow-origin", self.allowed_origin.encode("latin-1")),
                (b"access-control-allow-methods", b"GET, POST, DELETE, OPTIONS"),
                (b"access-control-allow-headers", b"accept, content-type, mcp-protocol-version, mcp-session-id, last-event-id"),
                (b"access-control-allow-private-network", b"true"),
                (b"access-control-max-age", b"600"),
                (b"vary", b"Origin"),
            ]
            await self._respond(send, 204, response_headers, b"")
            return

        async def send_with_cors(message: dict[str, Any]) -> None:
            if message["type"] == "http.response.start":
                headers_out = list(message.get("headers", []))
                headers_out.extend([
                    (b"access-control-allow-origin", self.allowed_origin.encode("latin-1")),
                    (b"access-control-expose-headers", b"Mcp-Session-Id, MCP-Protocol-Version"),
                    (b"access-control-allow-private-network", b"true"),
                    (b"vary", b"Origin"),
                ])
                message = {**message, "headers": headers_out}
            await send(message)

        await self.app(scope, receive, send_with_cors)

    @staticmethod
    async def _respond(send: Any, status: int, headers: list[tuple[bytes, bytes]], body: bytes) -> None:
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})


def main() -> None:
    global DATA_DIR
    parser = argparse.ArgumentParser(description="si-MİTÇİ yerel salt-okunur web araştırma MCP sunucusu")
    parser.add_argument("--allowed-origin", required=True, help="TreOS web uygulamasının tam origin adresi")
    parser.add_argument("--data-dir", type=Path, default=default_data_dir())
    arguments = parser.parse_args()
    DATA_DIR = arguments.data_dir.expanduser()
    try:
        allowed_origin = validate_origin(arguments.allowed_origin)
    except ValueError as error:
        parser.error(str(error))

    certificate = DATA_DIR / "treos-localhost.crt"
    private_key = DATA_DIR / "treos-localhost.key"
    if not certificate.is_file() or not private_key.is_file():
        parser.error(
            f"TreOS localhost TLS sertifikası bulunamadı: {DATA_DIR}. "
            "Önce TreOS STeLA kurulumunu çalıştırın."
        )

    print(f"si-MİTÇİ MCP hazır: https://localhost:{PORT}/mcp", flush=True)
    print("Görünür tarayıcı salt-okunur araştırma için açılır; form gönderimi ve satın alma araçları yoktur.", flush=True)
    uvicorn.run(
        OriginGuard(mcp.streamable_http_app(), allowed_origin),
        host=HOST,
        port=PORT,
        ssl_certfile=str(certificate),
        ssl_keyfile=str(private_key),
        log_level="info",
        access_log=False,
    )


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nsi-MİTÇİ durduruldu.", flush=True)
    except Exception as error:
        print(f"si-MİTÇİ başlatılamadı: {error}", file=sys.stderr, flush=True)
        raise
