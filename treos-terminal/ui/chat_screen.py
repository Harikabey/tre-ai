"""TreOS Terminal sohbet ekranı."""

from __future__ import annotations

import asyncio

from textual.app import ComposeResult
from textual.containers import VerticalScroll
from textual.screen import Screen
from textual.widgets import Footer, Header, Input, Markdown

from actions import is_dangerous, parse_model_response, run_actions
from api_client import send_request
from config import get_api_key, get_provider, reset_api_key
from prompts import SYSTEM_PROMPT
from ui.api_key_screen import ApiKeyScreen
from ui.confirm_modal import ConfirmModal


class ChatScreen(Screen):
    """İstekleri gönderir, yanıtları gösterir ve onaylı eylemleri çalıştırır."""

    BINDINGS = [
        ("ctrl+r", "reset_key", "Anahtarı sıfırla"),
        ("ctrl+l", "clear_chat", "Ekranı temizle"),
    ]
    CSS = """
    ChatScreen { layout: vertical; }
    #chat { height: 1fr; border: round $primary; padding: 1; }
    #prompt { dock: bottom; }
    """

    def __init__(self) -> None:
        super().__init__()
        self.messages: list[dict[str, str]] = []
        self.busy = False

    def compose(self) -> ComposeResult:
        yield Header()
        yield VerticalScroll(id="chat")
        yield Input(placeholder="İsteğinizi yazın ve Enter'a basın...", id="prompt")
        yield Footer()

    def on_mount(self) -> None:
        self.query_one("#prompt", Input).focus()
        self.add_message("TreOS Terminal hazır. Çalıştırılacak her işlem önce onayınıza sunulur.")

    def add_message(self, content: str) -> None:
        self.query_one("#chat", VerticalScroll).mount(Markdown(content))

    async def on_input_submitted(self, event: Input.Submitted) -> None:
        prompt = event.value.strip()
        event.input.value = ""
        if not prompt or self.busy:
            return
        self.add_message(f"**Siz:** {prompt}")
        self.messages.append({"role": "user", "content": prompt})
        self.messages = self.messages[-10:]
        await self.ask_model()

    async def ask_model(self) -> None:
        self.busy = True
        self.query_one("#prompt", Input).disabled = True
        try:
            key = get_api_key()
            if not key:
                self.app.switch_screen(ApiKeyScreen())
                return
            response = await asyncio.to_thread(
                send_request,
                key,
                get_provider(),
                [{"role": "system", "content": SYSTEM_PROMPT}, *self.messages],
            )
            raw = response["choices"][0]["message"]["content"]
            if not isinstance(raw, str):
                raise ValueError("Model yanıtı metin değil.")
            actions = parse_model_response(raw)
            safe_actions = []
            for action in actions:
                if is_dangerous(action):
                    self.add_message(f"⚠️ Reddedildi: {action['reason']}")
                else:
                    safe_actions.append(action)
            if not safe_actions:
                if not actions:
                    self.add_message("Model bir işlem önermedi.")
                return
            self.messages.append({"role": "assistant", "content": raw})
            self.messages = self.messages[-10:]
            approved = await self.app.push_screen_wait(ConfirmModal(safe_actions))
            if not approved:
                self.add_message("İptal edildi.")
                return
            progress: list[str] = []
            await asyncio.to_thread(run_actions, safe_actions, progress.append)
            for result in progress:
                self.add_message(result)
        except (KeyError, IndexError, TypeError, ValueError, RuntimeError) as error:
            self.add_message(f"**Hata:** {error}")
        finally:
            self.busy = False
            if self.is_mounted:
                self.query_one("#prompt", Input).disabled = False
                self.query_one("#prompt", Input).focus()

    def action_clear_chat(self) -> None:
        self.query_one("#chat", VerticalScroll).remove_children()
        self.messages.clear()

    def action_reset_key(self) -> None:
        try:
            reset_api_key()
        except RuntimeError as error:
            self.add_message(f"**Hata:** {error}")
            return
        self.app.switch_screen(ApiKeyScreen())
