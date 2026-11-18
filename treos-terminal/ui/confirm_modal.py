"""Eylem listesini gösteren onay penceresi."""

from textual.app import ComposeResult
from textual.containers import Horizontal, Vertical
from textual.screen import ModalScreen
from textual.widgets import Button, Markdown

from actions import format_todo_list


class ConfirmModal(ModalScreen[bool]):
    """Eylemleri gösterir ve açık kullanıcı onayı alır."""

    BINDINGS = [
        ("y", "approve", "Onayla"),
        ("n", "reject", "Reddet"),
        ("escape", "reject", "Reddet"),
    ]
    CSS = """
    ConfirmModal { align: center middle; }
    #confirm-box { width: 80; height: auto; max-height: 85%; padding: 1 2; border: thick $warning; background: $surface; }
    #todo-list { height: auto; max-height: 1fr; overflow-y: auto; }
    #confirm-buttons { height: 3; align-horizontal: center; }
    #confirm-buttons Button { margin: 0 1; }
    """

    def __init__(self, actions: list[dict]) -> None:
        super().__init__()
        self.actions = actions

    def compose(self) -> ComposeResult:
        with Vertical(id="confirm-box"):
            yield Markdown(format_todo_list(self.actions), id="todo-list")
            with Horizontal(id="confirm-buttons"):
                yield Button("Evet (y)", variant="success", id="yes")
                yield Button("Hayır (n)", variant="error", id="no")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        self.dismiss(event.button.id == "yes")

    def action_approve(self) -> None:
        self.dismiss(True)

    def action_reject(self) -> None:
        self.dismiss(False)
