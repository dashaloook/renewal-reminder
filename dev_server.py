"""Local dev server: serves the static app and runs api/send_reminder.py.

Usage:  python3 dev_server.py [port]      (default 5173)

Reads secrets from .env.local (git-ignored) so they never need to be in code.
On Vercel this file isn't used: Vercel serves the static files and runs api/ itself.
"""

import importlib.util
import os
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))


def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


spec = importlib.util.spec_from_file_location("send_reminder", os.path.join(ROOT, "api", "send_reminder.py"))
api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)

ENV = {**os.environ, **load_env(os.path.join(ROOT, ".env.local"))}
PRIVATE = {".env", ".env.local", "dev_server.py"}


class Dev(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def _api(self):
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(min(length, api.MAX_BODY + 1)) if length else b""
        status, out = api.process(self.command, self.headers, raw, self.client_address[0], env=ENV)
        body = b"" if status == 204 else __import__("json").dumps(out).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _route(self, fallback):
        path = self.path.split("?")[0]
        if path.rstrip("/") == "/api/send_reminder":
            return self._api()
        if os.path.basename(path) in PRIVATE or path.startswith("/.") or "/." in path:
            self.send_error(404)
            return
        return fallback()

    def do_GET(self):
        self._route(super().do_GET)

    def do_POST(self):
        self._route(lambda: self.send_error(404))

    def do_OPTIONS(self):
        self._route(lambda: self.send_error(404))

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    configured = bool(ENV.get("BREVO_API_KEY") and ENV.get("BREVO_SENDER")) or bool(ENV.get("GMAIL_USER") and ENV.get("GMAIL_APP_PASSWORD"))
    print(f"Renewal Reminder on http://localhost:{port}  (email {'configured' if configured else 'NOT configured: copy .env.example to .env.local'})")
    ThreadingHTTPServer(("127.0.0.1", port), Dev).serve_forever()
