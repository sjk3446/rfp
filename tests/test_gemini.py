"""Gemini contract and key separation tests, with no external API calls."""
import base64
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("gemini_helper", ROOT / "local-helper/local_helper.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class GeminiTests(unittest.TestCase):
    def api_result(self, result, *, expect_json=False):
        with patch.object(helper, "load_key", return_value="test-only-key") as key, patch.object(helper.urllib.request, "urlopen", return_value=io.BytesIO(json.dumps(result).encode())) as http:
            text = helper.call_gemini("instructions", "req text", "gemini-3.1-flash-lite", expect_json)
        request = http.call_args.args[0]
        key.assert_called_once_with("gemini")
        self.assertNotIn("test-only-key", request.full_url)
        self.assertNotIn("test-only-key", request.data.decode())
        self.assertEqual(request.get_header("X-goog-api-key"), "test-only-key")
        return text, json.loads(request.data)

    def test_request_and_text_parts_use_the_official_contract(self):
        result = {"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": "hidden thinking", "thought": True}, {"text": "쉬운 해설"}, {"text": "완료 확인"}]}}]}
        text, body = self.api_result(result)
        self.assertEqual(text, "쉬운 해설\n완료 확인")
        self.assertEqual(body["systemInstruction"]["parts"][0]["text"], "instructions")
        self.assertEqual(body["contents"][0]["parts"][0]["text"], "req text")
        self.assertEqual(body["generationConfig"]["thinkingConfig"]["thinkingLevel"], "low")
        self.assertEqual(body["generationConfig"]["maxOutputTokens"], 6000)
        self.assertFalse(body["store"])

    def test_glossary_requests_json_output(self):
        _, body = self.api_result({"candidates": [{"finishReason": "STOP", "content": {"parts": [{"text": '{"results":[]}'}]}}]}, expect_json=True)
        self.assertEqual(body["generationConfig"]["responseMimeType"], "application/json")

    def test_truncated_blocked_and_empty_responses_are_not_success(self):
        for response in (
            {"candidates": [{"finishReason": "MAX_TOKENS", "content": {"parts": [{"text": "partial"}]}}]},
            {"candidates": [{"finishReason": "SAFETY", "content": {"parts": [{"text": "partial"}]}}]},
            {"candidates": [{"finishReason": "STOP", "content": {"parts": []}}]},
            {"promptFeedback": {"blockReason": "SAFETY"}},
        ):
            with self.subTest(response=response), self.assertRaises(RuntimeError):
                self.api_result(response)

    def test_quota_failure_never_calls_gpt(self):
        error = urllib.error.HTTPError("https://generativelanguage.googleapis.com/", 429, "quota", {}, io.BytesIO(b"{}"))
        with patch.object(helper, "load_settings", return_value={"provider":"gemini","model":"gemini-3.8-flash"}), patch.object(helper, "load_key", return_value="test-only-key"), patch.object(helper.urllib.request, "urlopen", side_effect=error) as http, patch.object(helper,"call_openai") as gpt:
            with self.assertRaisesRegex(RuntimeError, "요청 한도"):
                helper.call_ai("instructions", "input")
            http.assert_called_once()
            gpt.assert_not_called()

    def test_existing_gpt_is_still_routed_to_gpt(self):
        with patch.object(helper,"load_settings",return_value={"provider":"openai","model":"gpt-5-mini"}), patch.object(helper,"call_openai",return_value="GPT text") as gpt, patch.object(helper,"call_gemini") as gemini:
            self.assertEqual(helper.call_ai("instructions","input"),"GPT text")
            gpt.assert_called_once_with("instructions","input","gpt-5-mini")
            gemini.assert_not_called()

    def test_errors_do_not_echo_api_keys(self):
        for code in (400,401,403,404,500):
            error = urllib.error.HTTPError("https://generativelanguage.googleapis.com/",code,"error",{},io.BytesIO(b'test-only-key'))
            with self.subTest(code=code), patch.object(helper,"load_key",return_value="test-only-key"), patch.object(helper.urllib.request,"urlopen",side_effect=error):
                with self.assertRaises(RuntimeError) as raised:
                    helper.call_gemini("instructions","input","gemini-3.8-flash")
                self.assertNotIn("test-only-key",str(raised.exception))


class KeySeparationTests(unittest.TestCase):
    def setUp(self):
        (ROOT / "tmp").mkdir(exist_ok=True)
        self.folder = tempfile.TemporaryDirectory(prefix="reqly-keys-test-", dir=ROOT / "tmp")
        data = Path(self.folder.name)
        self.gpt = data / "api-key.dpapi"
        self.gemini = data / "gemini-api-key.dpapi"
        self.config = data / "settings.json"
        self.patches = [patch.object(helper,"DATA_DIR",data),patch.object(helper,"KEY_FILE",self.gpt),patch.object(helper,"CONFIG_FILE",self.config),patch.object(helper,"KEY_FILES",{"openai":self.gpt,"gemini":self.gemini}),patch.object(helper,"protect",side_effect=lambda value:b"encrypted:"+value)]
        for item in self.patches: item.start()

    def tearDown(self):
        for item in reversed(self.patches): item.stop()
        self.folder.cleanup()

    def test_legacy_gpt_key_and_settings_survive_gemini_save(self):
        self.gpt.write_bytes(b"legacy-encrypted-gpt")
        self.config.write_text(json.dumps({"model":"gpt-5"}))
        self.assertEqual(helper.load_settings()["provider"],"openai")
        helper.save_key("test-gemini-key-1234567890","gemini-3.1-flash-lite","gemini")
        self.assertEqual(self.gpt.read_bytes(),b"legacy-encrypted-gpt")
        self.assertTrue(base64.b64decode(self.gemini.read_bytes()).startswith(b"encrypted:"))
        self.assertNotIn("test-gemini-key",self.config.read_text())
        self.assertEqual(helper.load_settings()["provider"],"gemini")
        helper.save_key("","gpt-5","openai")
        self.assertEqual(helper.load_settings()["model"],"gpt-5")
        self.assertTrue(self.gemini.exists())

    def test_cross_provider_model_or_missing_key_cannot_be_applied(self):
        with self.assertRaises(ValueError): helper.save_key("test-key-1234567890123456","gpt-5","gemini")
        with self.assertRaises(ValueError): helper.save_key("","gemini-3.8-flash","gemini")
        self.assertFalse(self.config.exists())

    def test_key_status_contains_no_key_material(self):
        helper.save_key("test-gemini-key-1234567890","gemini-3.8-flash","gemini")
        status=helper.helper_status(True)
        self.assertTrue(status["savedKeys"]["gemini"])
        self.assertFalse(status["savedKeys"]["openai"])
        self.assertEqual(status["provider"],"gemini")
        self.assertNotIn("test-gemini-key",json.dumps(status))


if __name__ == "__main__":
    unittest.main()
