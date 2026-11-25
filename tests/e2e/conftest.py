"""Browser tests (Playwright) — see tests/e2e/README.md.

Starts the local dev server once for the whole run and gives every test a fresh browser
(empty localStorage), so tests never depend on each other. Everything runs in the demo:
no Firebase sign-in, no email, nothing leaves the machine except loading the app's libraries.
"""
import os
import socket
import subprocess
import sys
import time
import urllib.request

import pytest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))


def _free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@pytest.fixture(scope="session")
def base_url():
    port = _free_port()
    # An empty env file location keeps local secrets (.env.local) out of the test server.
    env = {**os.environ, "RR_ENV_FILE": os.devnull}
    srv = subprocess.Popen([sys.executable, "dev_server.py", str(port)], cwd=ROOT, env=env,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    url = f"http://localhost:{port}"
    for _ in range(50):
        try:
            urllib.request.urlopen(url + "/", timeout=1)
            break
        except OSError:
            time.sleep(0.2)
    yield url
    srv.terminate()
    srv.wait(timeout=5)


@pytest.fixture
def errors(page):
    """JavaScript errors on the page; a test fails if any happen."""
    found = []
    page.on("pageerror", lambda e: found.append(str(e)))
    yield found
    assert not found, f"JavaScript errors: {found}"
