"""Groq ve OpenRouter sohbet tamamlama istemcisi."""

from __future__ import annotations

import requests

from config import get_model


GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
GROQ_MODEL = "llama-3.1-8b-instant"
OPENROUTER_MODEL = "openai/gpt-4o-mini"


def send_request(
    api_key: str,
    provider: str,
    messages: list[dict],
    timeout: int = 60,
) -> dict:
    """Seçili sağlayıcıya JSON yanıtlı sohbet isteği gönderir."""
    endpoints = {"groq": GROQ_URL, "openrouter": OPENROUTER_URL}
    if provider not in endpoints:
        raise ValueError("Sağlayıcı 'groq' veya 'openrouter' olmalıdır.")

    headers = {"Authorization": f"Bearer {api_key}"}
    if provider == "openrouter":
        headers.update(
            {
                "HTTP-Referer": "https://treos.app",
                "X-Title": "TreOS Terminal",
            }
        )
    payload = {
        "model": get_model(provider),
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    try:
        response = requests.post(
            endpoints[provider], headers=headers, json=payload, timeout=timeout
        )
        response.raise_for_status()
        data = response.json()
    except requests.Timeout as error:
        raise RuntimeError("API isteği zaman aşımına uğradı.") from error
    except requests.HTTPError as error:
        response = error.response
        detail = response.text if response is not None else str(error)
        status = response.status_code if response is not None else "bilinmiyor"
        raise RuntimeError(f"API HTTP hatası ({status}): {detail}") from error
    except requests.RequestException as error:
        raise RuntimeError(f"API isteği başarısız oldu: {error}") from error
    except (ValueError, TypeError) as error:
        raise RuntimeError(f"API geçersiz yanıt döndürdü: {error}") from error

    if not isinstance(data, dict):
        raise RuntimeError("API yanıtının biçimi geçersiz.")
    return data
