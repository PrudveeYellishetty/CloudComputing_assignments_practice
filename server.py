from __future__ import annotations

import json
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
DATA_FILE = STATIC_DIR / "data" / "qbank.json"


class QuizHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIC_DIR), **kwargs)

    def do_GET(self):
        if self.path in {"/", "/index.html"}:
            self.path = "/index.html"
            return super().do_GET()
        if self.path == "/api/questions":
            self._send_json(self._load_questions())
            return
        return super().do_GET()

    def do_POST(self):
        if self.path == "/api/record-asked":
            self._handle_record_asked()
            return
        self.send_error(404, "Not Found")

    def _handle_record_asked(self):
        content_length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(content_length) or b"{}")
        ids = set(payload.get("ids", []))
        if not ids:
            self._send_json({"ok": True, "updated": 0})
            return

        questions = self._load_questions()
        updated = 0
        for question in questions:
            if question.get("id") in ids:
                question["asked_count"] = int(question.get("asked_count", 0)) + 1
                updated += 1

        self._write_questions(questions)
        self._send_json({"ok": True, "updated": updated})

    def _load_questions(self):
        with DATA_FILE.open("r", encoding="utf-8") as handle:
            return json.load(handle)

    def _write_questions(self, questions):
        with DATA_FILE.open("w", encoding="utf-8") as handle:
            json.dump(questions, handle, indent=2)
            handle.write("\n")

    def _send_json(self, payload, status=200):
        data = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def main():
    port = int(os.environ.get("PORT") or "10000")
    host = os.environ.get("HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, port), QuizHandler)
    print(f"Serving on http://{host}:{port}")
    print(f"Data file: {DATA_FILE}")
    server.serve_forever()


if __name__ == "__main__":
    main()
