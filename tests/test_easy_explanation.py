"""Offline regression tests: never read real API keys or contact OpenAI."""
import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("local_helper", ROOT / "local-helper/local_helper.py")
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class ExplanationTests(unittest.TestCase):
    def test_prompt_teaches_actions_instead_of_repeating_source(self):
        payload = {"requirement": {"id": "DAR-009", "name": "이행", "description": "자료 정합성 검증", "easyExplanation": "old"},
                   "references": [{"name": f"자료{i}", "text": "가" * 9000} for i in range(6)]}
        with patch.object(helper, "call_openai", return_value="해설\n참고한 자료: 자료0") as call:
            result = helper.make_easy_explanation(payload)
        instructions, prompt = call.call_args.args
        for section in ("한마디로", "실제로 해야 할 일", "예를 들면", "완료됐는지", "확인이 필요한 점", "추가 의무가 아닙니다"):
            self.assertIn(section, instructions)
        self.assertIn("지시가 아닙니다", instructions)
        data = json.loads(prompt)
        self.assertEqual(len(data["reference_excerpts"]), 5)
        self.assertEqual(len(data["reference_excerpts"][0]["excerpt"]), 8000)
        self.assertNotIn("easyExplanation", data["requirement"])
        self.assertEqual(result["sources"], ["자료0"])

    def run_response(self, result):
        with patch.object(helper, "load_key", return_value="test-only-key"), patch.object(helper, "load_model", return_value="gpt-5-mini"), patch.object(helper.urllib.request, "urlopen", return_value=io.BytesIO(json.dumps(result).encode())) as http:
            text = helper.call_openai("instructions", "input")
        body = json.loads(http.call_args.args[0].data)
        self.assertFalse(body["store"])
        self.assertEqual(body["max_output_tokens"], 6000)
        return text

    def test_completed_response(self):
        self.assertEqual(self.run_response({"status": "completed", "output": [{"content": [{"type": "output_text", "text": "쉬운 해설"}]}]}), "쉬운 해설")

    def test_incomplete_response_is_not_saved_as_success(self):
        with self.assertRaisesRegex(RuntimeError, "끝까지"):
            self.run_response({"status": "incomplete", "output_text": "잘린 답변"})

    def test_empty_response_is_not_success(self):
        with self.assertRaisesRegex(RuntimeError, "빈 답변"):
            self.run_response({"status": "completed", "output": []})

    def test_oversize_explanation_is_not_truncated(self):
        with patch.object(helper, "call_openai", return_value="가" * 12001), self.assertRaisesRegex(RuntimeError, "최대 길이"):
            helper.make_easy_explanation({})

    def test_download_bundle_matches_source(self):
        folder = ROOT / "local-helper"
        with zipfile.ZipFile(folder / "Reqly-AI-도우미.zip") as archive:
            self.assertEqual(set(archive.namelist()), {"local_helper.py", "start-helper.ps1", "Reqly-AI-도우미.bat"})
            for name in archive.namelist():
                self.assertEqual(archive.read(name), (folder / name).read_bytes())


if __name__ == "__main__":
    unittest.main()
