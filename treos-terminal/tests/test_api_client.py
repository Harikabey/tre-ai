import unittest
from unittest.mock import Mock, patch

from api_client import GROQ_URL, OPENROUTER_URL, send_request


class SendRequestTests(unittest.TestCase):
    @patch("api_client.get_model", return_value="openai/gpt-4o-mini")
    @patch("api_client.requests.post")
    def test_sends_json_mode_and_openrouter_headers(self, post, _get_model) -> None:
        response = Mock()
        response.json.return_value = {"choices": []}
        post.return_value = response

        result = send_request("secret", "openrouter", [{"role": "user", "content": "hi"}])

        self.assertEqual(result, {"choices": []})
        args, kwargs = post.call_args
        self.assertEqual(args[0], OPENROUTER_URL)
        self.assertEqual(kwargs["json"]["model"], "openai/gpt-4o-mini")
        self.assertEqual(kwargs["json"]["response_format"], {"type": "json_object"})
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer secret")
        self.assertEqual(kwargs["headers"]["HTTP-Referer"], "https://treos.app")
        self.assertEqual(kwargs["headers"]["X-Title"], "TreOS Terminal")

    @patch("api_client.get_model", return_value="qwen/qwen3.6-27b")
    @patch("api_client.requests.post")
    def test_wraps_timeouts_without_disclosing_request_headers(
        self, post, _get_model
    ) -> None:
        import requests

        post.side_effect = requests.Timeout("timeout")
        with self.assertRaisesRegex(RuntimeError, "zaman aşımına"):
            send_request("secret", "groq", [])

    @patch("api_client.get_model", return_value="qwen/qwen3.6-27b")
    @patch("api_client.requests.post")
    def test_sends_groq_model(self, post, _get_model) -> None:
        response = Mock()
        response.json.return_value = {"choices": []}
        post.return_value = response

        send_request("secret", "groq", [{"role": "user", "content": "hi"}])

        args, kwargs = post.call_args
        self.assertEqual(args[0], GROQ_URL)
        self.assertEqual(kwargs["json"]["model"], "qwen/qwen3.6-27b")


if __name__ == "__main__":
    unittest.main()
