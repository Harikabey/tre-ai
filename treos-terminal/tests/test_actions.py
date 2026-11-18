import unittest
from unittest.mock import patch

from actions import execute_action, is_dangerous, parse_model_response, run_actions


class ParseModelResponseTests(unittest.TestCase):
    def test_rejects_non_json_and_invalid_actions(self) -> None:
        with self.assertRaisesRegex(ValueError, "geçersiz JSON"):
            parse_model_response("not json")
        with self.assertRaisesRegex(ValueError, "actions"):
            parse_model_response('{"actions": "run_command"}')

    def test_validates_each_action(self) -> None:
        actions = parse_model_response(
            '{"actions":[{"action":"chat","target":"Bilgi","reason":"Yanıt"}]}'
        )
        self.assertEqual(actions[0]["action"], "chat")
        with self.assertRaisesRegex(ValueError, "hedefi"):
            parse_model_response(
                '{"actions":[{"action":"chat","target":" ","reason":"Yanıt"}]}'
            )


class ActionSafetyTests(unittest.TestCase):
    def test_rejects_dangerous_commands_and_protected_paths(self) -> None:
        self.assertTrue(
            is_dangerous(
                {"action": "run_command", "target": "RM -rf /tmp/data"}
            )
        )
        self.assertTrue(
            is_dangerous(
                {"action": "write_file", "target": "C:\\Windows\\system.ini"}
            )
        )
        self.assertFalse(
            is_dangerous(
                {"action": "write_file", "target": "/tmp/treos-note.txt"}
            )
        )

    @patch("actions.subprocess.run")
    def test_execution_rechecks_dangerous_actions(self, run) -> None:
        succeeded, message = execute_action(
            {
                "action": "run_command",
                "target": "format C:",
                "reason": "disk",
            }
        )
        self.assertFalse(succeeded)
        self.assertIn("Reddedildi", message)
        run.assert_not_called()

    @patch("actions.execute_action", side_effect=[(False, "hata"), (True, "ok")])
    def test_stops_action_chain_after_failure(self, execute) -> None:
        progress: list[str] = []
        run_actions([{}, {}], progress.append)
        execute.assert_called_once()
        self.assertEqual(len(progress), 1)


if __name__ == "__main__":
    unittest.main()
