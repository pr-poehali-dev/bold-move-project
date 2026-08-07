#!/usr/bin/env python3
"""
Лёгкий HTTP-мост до api.telegram.org — работает только на стандартной
библиотеке Python (никаких pip install). Запускается на VPS-сервере, у
которого есть прямой доступ к Telegram (в отличие от облачных функций проекта).

Принимает POST /relay с телом {"path": "bot<TOKEN>/getMe", "data": "<json или null>"},
пересылает запрос на https://api.telegram.org/<path> и возвращает ответ Telegram как есть.

Защищено секретным токеном в заголовке X-Proxy-Token — без него запрос отклоняется.

Запуск: python3 tg_proxy.py
Порт и токен задаются переменными окружения TG_PROXY_PORT (по умолчанию 8765)
и TG_PROXY_TOKEN (обязателен).
"""
import os
import json
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("TG_PROXY_PORT", "8765"))
TOKEN = os.environ.get("TG_PROXY_TOKEN", "")

if not TOKEN:
    raise SystemExit("Задайте переменную окружения TG_PROXY_TOKEN перед запуском")


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[tg-proxy] {self.address_string()} - {fmt % args}")

    def _send_json(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/health":
            self._send_json(200, {"ok": True})
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/relay":
            self._send_json(404, {"error": "not found"})
            return

        if self.headers.get("X-Proxy-Token") != TOKEN:
            self._send_json(401, {"error": "unauthorized"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(length) or b"{}")
            path = body.get("path")
            data = body.get("data")
            if not path:
                self._send_json(400, {"error": "path required"})
                return

            url = f"https://api.telegram.org/{path}"
            req_data = data.encode() if data else None
            req = urllib.request.Request(
                url, data=req_data,
                headers={"Content-Type": "application/json"},
                method="POST" if req_data else "GET",
            )
            with urllib.request.urlopen(req, timeout=15) as r:
                resp_body = r.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp_body)))
            self.end_headers()
            self.wfile.write(resp_body)
        except Exception as e:
            self._send_json(502, {"error": f"{type(e).__name__}: {e}"})


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"[tg-proxy] listening on 0.0.0.0:{PORT}")
    server.serve_forever()
