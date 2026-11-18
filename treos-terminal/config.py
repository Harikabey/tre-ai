"""TreOS Terminal yapılandırmasını yöneten yardımcılar."""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


CONFIG_DIR = Path.home() / ".treos"
CONFIG_FILE = CONFIG_DIR / "config.json"


def _read_config() -> dict[str, Any]:
    if not CONFIG_FILE.exists():
        return {}
    try:
        data = json.loads(CONFIG_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise RuntimeError(f"Yapılandırma dosyası okunamadı: {error}") from error
    if not isinstance(data, dict):
        raise RuntimeError("Yapılandırma dosyasının biçimi geçersiz.")
    return data


def _write_config(data: dict[str, Any]) -> None:
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    try:
        os.chmod(CONFIG_FILE, 0o600)
    except OSError:
        if os.name != "nt":
            raise


def get_api_key() -> str | None:
    """Kaydedilmiş API anahtarını döndürür."""
    key = _read_config().get("api_key")
    return key if isinstance(key, str) and key else None


def save_api_key(key: str) -> None:
    """API anahtarını yerel yapılandırmaya kaydeder."""
    if not key.strip():
        raise ValueError("API anahtarı boş olamaz.")
    data = _read_config()
    data["api_key"] = key.strip()
    data.setdefault("provider", "groq")
    _write_config(data)


def reset_api_key() -> None:
    """Kaydedilmiş API anahtarını ve yapılandırma dosyasını siler."""
    try:
        CONFIG_FILE.unlink(missing_ok=True)
    except OSError as error:
        raise RuntimeError(f"API anahtarı sıfırlanamadı: {error}") from error


def get_provider() -> str:
    """Yapılandırılmış sağlayıcıyı döndürür."""
    provider = _read_config().get("provider", "groq")
    if provider not in {"groq", "openrouter"}:
        raise RuntimeError("Sağlayıcı 'groq' veya 'openrouter' olmalıdır.")
    return provider


def set_provider(provider: str) -> None:
    """API sağlayıcısını kaydeder."""
    if provider not in {"groq", "openrouter"}:
        raise ValueError("Sağlayıcı 'groq' veya 'openrouter' olmalıdır.")
    data = _read_config()
    data["provider"] = provider
    _write_config(data)


def get_model(provider: str) -> str:
    """Sağlayıcı için yapılandırılmış modeli döndürür."""
    defaults = {
        "groq": "qwen/qwen3.6-27b",
        "openrouter": "openai/gpt-4o-mini",
    }
    if provider not in defaults:
        raise ValueError("Bilinmeyen API sağlayıcısı.")
    model = _read_config().get("model")
    return model.strip() if isinstance(model, str) and model.strip() else defaults[provider]
