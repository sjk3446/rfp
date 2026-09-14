"""Reqly Windows local security helper (standard library only).

The browser never receives a stored API key. Windows DPAPI encrypts the key for
the currently signed-in Windows account, and this helper makes AI requests.
"""

from __future__ import annotations

import base64
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import re
import secrets
import sys
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = 8766
DATA_DIR = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Reqly"
KEY_FILE = DATA_DIR / "api-key.dpapi"
CONFIG_FILE = DATA_DIR / "settings.json"
PAIR_CODE = f"{secrets.randbelow(1_000_000):06d}"
SESSION_TOKEN = secrets.token_urlsafe(32)
PAIRED_ORIGIN = ""
FAILED_PAIR_ATTEMPTS: list[float] = []
MAX_BODY = 2 * 1024 * 1024
ALLOWED_MODELS = {"gpt-5-mini", "gpt-5"}


class DATA_BLOB(ctypes.Structure):
    _fields_ = [("cbData", wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]


crypt32 = ctypes.WinDLL("Crypt32.dll", use_last_error=True) if os.name == "nt" else None
kernel32 = ctypes.WinDLL("Kernel32.dll", use_last_error=True) if os.name == "nt" else None
if crypt32:
    crypt32.CryptProtectData.argtypes = [
        ctypes.POINTER(DATA_BLOB), wintypes.LPCWSTR, ctypes.POINTER(DATA_BLOB),
        ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DATA_BLOB),
    ]
    crypt32.CryptProtectData.restype = wintypes.BOOL
    crypt32.CryptUnprotectData.argtypes = [
        ctypes.POINTER(DATA_BLOB), ctypes.POINTER(wintypes.LPWSTR), ctypes.POINTER(DATA_BLOB),
        ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(DATA_BLOB),
    ]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [wintypes.HLOCAL]
    kernel32.LocalFree.restype = wintypes.HLOCAL


def _blob(data: bytes) -> tuple[DATA_BLOB, object]:
    buffer = ctypes.create_string_buffer(data)
    return DATA_BLOB(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_char))), buffer


def protect(data: bytes) -> bytes:
    if not crypt32:
        raise RuntimeError("이 도우미는 Windows에서만 사용할 수 있습니다.")
    source, keepalive = _blob(data)
    result = DATA_BLOB()
    if not crypt32.CryptProtectData(
        ctypes.byref(source), "Reqly API key", None, None, None, 0, ctypes.byref(result)
    ):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(result.pbData, result.cbData)
    finally:
        kernel32.LocalFree(ctypes.cast(result.pbData, wintypes.HLOCAL))


def unprotect(data: bytes) -> bytes:
    if not crypt32:
        raise RuntimeError("이 도우미는 Windows에서만 사용할 수 있습니다.")
    source, keepalive = _blob(data)
    result = DATA_BLOB()
    if not crypt32.CryptUnprotectData(
        ctypes.byref(source), None, None, None, None, 0, ctypes.byref(result)
    ):
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(result.pbData, result.cbData)
    finally:
        kernel32.LocalFree(ctypes.cast(result.pbData, wintypes.HLOCAL))


def save_key(api_key: str, model: str) -> None:
    if not api_key or len(api_key) < 20:
        raise ValueError("API 키 형식이 올바르지 않습니다.")
    if model not in ALLOWED_MODELS:
        raise ValueError("허용되지 않은 AI 모델입니다.")
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    KEY_FILE.write_bytes(base64.b64encode(protect(api_key.encode("utf-8"))))
    CONFIG_FILE.write_text(json.dumps({"model": model or "gpt-5-mini"}), encoding="utf-8")


def load_key() -> str:
    if not KEY_FILE.exists():
        raise RuntimeError("저장된 API 키가 없습니다. 웹 화면의 ‘AI 연결’에서 먼저 저장하세요.")
    return unprotect(base64.b64decode(KEY_FILE.read_bytes())).decode("utf-8")


def load_model() -> str:
    try:
        model = json.loads(CONFIG_FILE.read_text(encoding="utf-8")).get("model", "gpt-5-mini")
        return model if model in ALLOWED_MODELS else "gpt-5-mini"
    except (OSError, ValueError):
        return "gpt-5-mini"


def allowed_origin(origin: str) -> bool:
    return bool(
        re.fullmatch(r"https://[a-z0-9-]+\.github\.io", origin or "", re.I)
        or re.fullmatch(r"https?://(?:127\.0\.0\.1|localhost)(?::\d+)?", origin or "", re.I)
    )


def output_text(response: dict) -> str:
    if response.get("output_text"):
        return str(response["output_text"])
    parts = []
    for item in response.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text" and content.get("text"):
                parts.append(content["text"])
    return "\n".join(parts)


def call_openai(instructions: str, user_input: str) -> str:
    request_body = json.dumps(
        {
            "model": load_model(),
            "instructions": instructions,
            "input": user_input,
            # Reqly는 단발성 설명만 요청하므로 응답을 API에 보관할 필요가 없다.
            "store": False,
            # 과도하게 긴 생성으로 인한 비용을 제한하되 12,000자 편집란에는
            # 충분한 분량을 허용한다.
            "max_output_tokens": 6000,
        },
        ensure_ascii=False,
    ).encode("utf-8")
    request = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=request_body,
        headers={
            "Authorization": f"Bearer {load_key()}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            result = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        try:
            detail = json.loads(detail).get("error", {}).get("message", detail)
        except ValueError:
            pass
        raise RuntimeError(f"AI 요청 실패: {detail}") from error
    text = output_text(result).strip()
    if not text:
        raise RuntimeError("AI가 빈 답변을 반환했습니다.")
    return text


def make_easy_explanation(payload: dict) -> dict:
    requirement = payload.get("requirement") or {}
    references = payload.get("references") or []
    reference_text = "\n\n".join(
        f"[참고자료: {item.get('name', '자료')}]\n{str(item.get('text', ''))[:8000]}"
        for item in references[:5]
    )
    prompt = (
        f"요구사항 ID: {requirement.get('id', '')}\n"
        f"요구사항명: {requirement.get('name', '')}\n"
        f"분류: {requirement.get('category', '')}\n"
        f"상세 설명: {requirement.get('description', '')}\n\n"
        f"{reference_text}"
    )
    instructions = (
        "당신은 RFP 요구사항 해설자입니다. 비개발자도 이해하도록 한국어로 설명하세요. "
        "원문의 의무, 조건, 예외, 완료 판단 기준을 빠뜨리지 말고, 원문에 없는 사실은 만들지 마세요. "
        "참고자료는 요구사항과 직접 관련된 내용만 사용하고, 사용했다면 마지막 줄에 자료명을 표시하세요. "
        "12,000자 이내의 일반 텍스트로 답하세요."
    )
    text = call_openai(instructions, prompt)
    used = [item.get("name", "") for item in references if item.get("name") and item.get("name") in text]
    return {"text": text, "sources": used}


def make_glossary(payload: dict) -> dict:
    terms = [str(value).strip() for value in payload.get("terms", []) if str(value).strip()][:10]
    context = str(payload.get("context", ""))[:10000]
    instructions = (
        "RFP 전문용어 사전 역할을 하세요. IT 약자만이 아니라 일반인이 모를 수 있는 산업·업무·기술 용어를 설명하세요. "
        "문맥은 용어 뜻을 고르는 데만 사용하고 문장 전체를 요약하지 마세요. 뜻이 하나로 특정되지 않으면 가능성이 높은 순서로 최대 3개를 제시하세요. "
        "반드시 JSON만 반환하세요. 형식: {\"results\":[{\"term\":\"...\",\"candidates\":[{\"full\":\"정식명칭\",\"meaning\":\"쉬운 뜻\",\"source\":\"AI 문맥 해석\",\"sourceUrl\":\"\",\"score\":95}]}]}"
    )
    raw = call_openai(instructions, json.dumps({"terms": terms, "context": context}, ensure_ascii=False))
    raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.I)
    try:
        result = json.loads(raw)
    except ValueError as error:
        raise RuntimeError("AI 용어 설명을 JSON 형식으로 정리하지 못했습니다. 다시 시도해 주세요.") from error
    return {"results": result.get("results", [])}


class Handler(BaseHTTPRequestHandler):
    server_version = "ReqlyLocalHelper/1.0"

    def log_message(self, format: str, *args: object) -> None:
        sys.stdout.write("[Reqly] " + (format % args) + "\n")

    def _origin(self) -> str:
        return self.headers.get("Origin", "")

    def _cors(self) -> None:
        origin = self._origin()
        if allowed_origin(origin):
            self.send_header("Access-Control-Allow-Origin", origin)
            self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Reqly-Token")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _send(self, status: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length", "0"))
        if length > MAX_BODY:
            raise ValueError("요청 내용이 너무 큽니다.")
        return json.loads(self.rfile.read(length).decode("utf-8") or "{}")

    def _authorized(self) -> bool:
        return bool(
            PAIRED_ORIGIN
            and self._origin() == PAIRED_ORIGIN
            and secrets.compare_digest(self.headers.get("X-Reqly-Token", ""), SESSION_TOKEN)
        )

    def _require_origin(self) -> bool:
        if allowed_origin(self._origin()):
            return True
        self._send(403, {"error": "허용되지 않은 웹 주소입니다."})
        return False

    def do_OPTIONS(self) -> None:
        if not self._require_origin():
            return
        self.send_response(204)
        self._cors()
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self) -> None:
        if not self._require_origin():
            return
        if self.path == "/health":
            self._send(200, {"ok": True, "hasKey": KEY_FILE.exists(), "paired": self._authorized()})
        else:
            self._send(404, {"error": "주소를 찾을 수 없습니다."})

    def do_POST(self) -> None:
        global PAIRED_ORIGIN
        if not self._require_origin():
            return
        try:
            payload = self._body()
            if self.path == "/pair":
                cutoff = time.monotonic() - 60
                FAILED_PAIR_ATTEMPTS[:] = [value for value in FAILED_PAIR_ATTEMPTS if value >= cutoff]
                if len(FAILED_PAIR_ATTEMPTS) >= 5:
                    self._send(429, {"error": "연결 번호를 여러 번 틀렸습니다. 1분 후 다시 시도하세요."})
                    return
                if PAIRED_ORIGIN and PAIRED_ORIGIN != self._origin():
                    self._send(403, {"error": "이 도우미는 이미 다른 Reqly 웹 주소와 연결되어 있습니다. 도우미를 다시 시작하세요."})
                    return
                if not secrets.compare_digest(str(payload.get("code", "")), PAIR_CODE):
                    FAILED_PAIR_ATTEMPTS.append(time.monotonic())
                    self._send(401, {"error": "연결 번호가 맞지 않습니다."})
                    return
                PAIRED_ORIGIN = self._origin()
                FAILED_PAIR_ATTEMPTS.clear()
                self._send(200, {"ok": True, "token": SESSION_TOKEN})
                return
            if not self._authorized():
                self._send(401, {"error": "먼저 6자리 연결 번호로 도우미를 연결하세요."})
                return
            if self.path == "/key":
                save_key(str(payload.get("apiKey", "")).strip(), str(payload.get("model", "gpt-5-mini")))
                self._send(200, {"ok": True})
            elif self.path == "/v1/generate":
                task = payload.get("task")
                result = make_easy_explanation(payload) if task == "explain" else make_glossary(payload) if task == "glossary" else None
                if result is None:
                    raise ValueError("지원하지 않는 AI 작업입니다.")
                self._send(200, result)
            else:
                self._send(404, {"error": "주소를 찾을 수 없습니다."})
        except Exception as error:  # user-facing local tool
            self._send(400, {"error": str(error)})

    def do_DELETE(self) -> None:
        if not self._require_origin():
            return
        if not self._authorized():
            self._send(401, {"error": "먼저 도우미를 연결하세요."})
            return
        if self.path == "/key":
            KEY_FILE.unlink(missing_ok=True)
            CONFIG_FILE.unlink(missing_ok=True)
            self._send(200, {"ok": True})
        else:
            self._send(404, {"error": "주소를 찾을 수 없습니다."})


def main() -> None:
    print("\nReqly AI 로컬 보안 도우미")
    print("=" * 38)
    print(f"웹 화면에 입력할 6자리 연결 번호: {PAIR_CODE}")
    print("이 창을 닫으면 AI 연결도 종료됩니다.")
    print("문서 관리 기능은 이 창 없이도 사용할 수 있습니다.\n")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
