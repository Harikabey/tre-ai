"""Model eylemlerini doğrulama ve kullanıcı onayı sonrası çalıştırma."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path, PureWindowsPath
from typing import Callable


ALLOWED_ACTIONS = {"run_command", "open_app", "write_file", "chat"}
DANGEROUS_PATTERNS = [
    r"\bformat\b",
    r"\bdel\s+/[fqs]",
    r"\brm\s+-rf?\b",
    r"\bmkfs\b",
    r"\bdd\s+if=",
    r"\bshutdown\b",
    r"\breboot\b",
    r"\bdiskpart\b",
    r":\(\)\s*\{",
    r"\bchmod\s+-R\s+777\s+/",
    r"\breg\s+delete\b",
    r"\bcipher\s+/w\b",
]
PROTECTED_PATHS = ("/etc", "/boot", "/usr/bin", "c:\\windows")
ACTION_LABELS = {
    "run_command": "Komut çalıştır",
    "open_app": "Uygulama aç",
    "write_file": "Dosya yaz",
    "chat": "Mesaj",
}


def parse_model_response(raw: str) -> list[dict]:
    """Model JSON yanıtını doğrulanmış eylemlere dönüştürür."""
    try:
        data = json.loads(raw)
    except json.JSONDecodeError as error:
        raise ValueError("Model geçersiz JSON döndürdü") from error
    if not isinstance(data, dict) or not isinstance(data.get("actions"), list):
        raise ValueError("Model yanıtında 'actions' listesi bulunamadı.")

    actions = data["actions"]
    for action in actions:
        if not isinstance(action, dict):
            raise ValueError("Her eylem bir JSON nesnesi olmalıdır.")
        if action.get("action") not in ALLOWED_ACTIONS:
            raise ValueError("Eylem türü geçersiz.")
        if not isinstance(action.get("target"), str) or not action["target"].strip():
            raise ValueError("Eylem hedefi boş olmayan bir metin olmalıdır.")
        if not isinstance(action.get("reason"), str):
            raise ValueError("Eylem sebebi metin olmalıdır.")
        if "content" in action and not isinstance(action["content"], str):
            raise ValueError("Eylem içeriği metin olmalıdır.")
    return actions


def is_dangerous(action: dict) -> bool:
    """Kara listedeki komutları ve korunan sistem dizinlerini saptar."""
    target = action.get("target", "")
    if not isinstance(target, str):
        return True
    if any(re.search(pattern, target, re.IGNORECASE) for pattern in DANGEROUS_PATTERNS):
        return True
    if action.get("action") != "write_file":
        return False

    normalized = target.replace("\\", "/").lower()
    win_path = PureWindowsPath(target)
    return any(
        normalized == path or normalized.startswith(path + "/")
        for path in ("/etc", "/boot", "/usr/bin")
    ) or win_path.drive.lower() == "c:" and (
        win_path.parts[1].lower() == "\\windows"
        or any(part.lower() == "windows" for part in win_path.parts[1:2])
    )


def format_todo_list(actions: list[dict]) -> str:
    """Eylemleri onay penceresi için Markdown listesine dönüştürür."""
    lines = ["### YAPILACAKLAR"]
    for index, action in enumerate(actions, start=1):
        label = ACTION_LABELS[action["action"]]
        target = action["target"].replace("`", "\\`")
        lines.extend(
            [
                f"{index}. **{label}**: `{target}`",
                f"   _Sebep:_ {action['reason']}",
            ]
        )
    return "\n".join(lines)


def _run_command(target: str) -> tuple[bool, str]:
    try:
        result = subprocess.run(
            target,
            shell=True,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return False, f"Komut çalıştırılamadı: {error}"
    output = (result.stdout + result.stderr).strip()
    if result.returncode:
        return False, output or f"Komut {result.returncode} koduyla başarısız oldu."
    return True, output or "Komut tamamlandı."


def _open_app(target: str) -> tuple[bool, str]:
    try:
        if os.name == "nt":
            os.startfile(target)  # type: ignore[attr-defined]
        elif sys.platform == "darwin":
            subprocess.Popen(["open", target])
        else:
            subprocess.Popen([target])
    except OSError as error:
        return False, f"Uygulama açılamadı: {error}"
    return True, f"{target} açıldı."


def _write_file(action: dict) -> tuple[bool, str]:
    path = Path(action["target"]).expanduser()
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(action.get("content", ""), encoding="utf-8")
    except OSError as error:
        return False, f"Dosya yazılamadı: {error}"
    return True, f"{path} dosyasına yazıldı."


def execute_action(action: dict) -> tuple[bool, str]:
    """Tek bir eylemi son güvenlik kontrolünden sonra yürütür."""
    if is_dangerous(action):
        return False, f"Reddedildi: {action.get('reason', 'Tehlikeli eylem')}"
    kind = action["action"]
    if kind == "chat":
        return True, action["reason"]
    if kind == "run_command":
        return _run_command(action["target"])
    if kind == "open_app":
        return _open_app(action["target"])
    if kind == "write_file":
        return _write_file(action)
    return False, "Bilinmeyen eylem türü."


def run_actions(
    actions: list[dict],
    on_progress: Callable[[str], None],
) -> None:
    """Eylemleri sırayla çalıştırır ve ilk hatada durur."""
    for action in actions:
        succeeded, message = execute_action(action)
        on_progress(f"{'✓' if succeeded else '✗'} {message}")
        if not succeeded:
            break
