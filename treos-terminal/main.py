"""TreOS Terminal uygulaması."""

from __future__ import annotations

import argparse

from textual.app import App

from config import get_api_key, reset_api_key
from ui.api_key_screen import ApiKeyScreen
from ui.chat_screen import ChatScreen


class TreOSApp(App):
    """TreOS Terminal Textual uygulaması."""

    TITLE = "TreOS Terminal"

    def on_mount(self) -> None:
        self.push_screen(ChatScreen() if get_api_key() else ApiKeyScreen())


def main() -> None:
    """Komut satırı seçeneklerini işleyip uygulamayı başlatır."""
    parser = argparse.ArgumentParser(description="TreOS Terminal")
    parser.add_argument("--reset-key", action="store_true", help="Kaydedilmiş API anahtarını sil")
    args = parser.parse_args()
    if args.reset_key:
        reset_api_key()
        print("API anahtarı sıfırlandı.")
        return
    TreOSApp().run()


if __name__ == "__main__":
    main()
