"""API anahtarı ve sağlayıcı seçme ekranı."""

from textual.app import ComposeResult
from textual.containers import Center, Vertical
from textual.screen import Screen
from textual.widgets import Button, Input, Select, Static

from config import save_api_key, set_provider


class ApiKeyScreen(Screen):
    """API anahtarını ve sağlayıcıyı kullanıcıdan alır."""

    CSS = """
    ApiKeyScreen { align: center middle; }
    #key-form { width: 70; height: auto; padding: 1 2; border: round $primary; }
    #key-form Input, #key-form Select, #key-form Button { margin-top: 1; }
    """

    def compose(self) -> ComposeResult:
        with Center():
            with Vertical(id="key-form"):
                yield Static("TreOS Terminal — API bağlantısı")
                yield Static("Anahtarınız bu bilgisayarda yerel olarak saklanır.")
                yield Select(
                    [("Groq", "groq"), ("OpenRouter", "openrouter")],
                    value="groq",
                    id="provider",
                    prompt="Sağlayıcı seçin",
                )
                yield Input(
                    placeholder="API anahtarınızı girin (Groq veya OpenRouter)",
                    password=True,
                    id="api-key",
                )
                yield Button("Kaydet ve devam et", variant="primary", id="save")
                yield Static("", id="key-error")

    def on_mount(self) -> None:
        self.query_one("#api-key", Input).focus()

    def on_input_submitted(self, event: Input.Submitted) -> None:
        if event.input.id == "api-key":
            self.save_key()

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "save":
            self.save_key()

    def save_key(self) -> None:
        key = self.query_one("#api-key", Input).value.strip()
        if not key:
            self.query_one("#key-error", Static).update("API anahtarı boş olamaz.")
            return
        provider = self.query_one("#provider", Select).value
        try:
            save_api_key(key)
            set_provider(str(provider))
        except (OSError, RuntimeError, ValueError) as error:
            self.query_one("#key-error", Static).update(f"Hata: {error}")
            return
        from ui.chat_screen import ChatScreen

        self.app.switch_screen(ChatScreen())
