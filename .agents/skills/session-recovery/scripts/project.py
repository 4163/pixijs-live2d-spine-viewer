import json
import os
import sys
sys.dont_write_bytecode = True
import re
from urllib.parse import unquote, urlparse

FILE_URI_RE = re.compile(r"file://[^\x00-\x1f\s\"'<>]+", re.IGNORECASE)


def home():
    return os.path.expanduser("~")


def home_path(*parts):
    return os.path.join(home(), *parts)


def project_root(start=None):
    """Git root of start (cwd by default). Falls back to that directory."""
    cur = os.path.abspath(start or os.getcwd())
    origin = cur
    while True:
        if os.path.isdir(os.path.join(cur, ".git")) or os.path.isfile(os.path.join(cur, ".git")):
            return cur
        parent = os.path.dirname(cur)
        if parent == cur:
            return origin
        cur = parent


def project_label(root=None):
    return project_root(root) if root else project_root()


def norm(path):
    if path is None:
        return ""
    text = str(path).strip().strip("\"'")
    if not text:
        return ""
    if text.lower().startswith("file:"):
        parsed = urlparse(text)
        text = unquote(parsed.path or "")
        # file:///E:/foo -> /E:/foo; drop the extra slash before the drive.
        if len(text) >= 3 and text[0] == "/" and text[2] == ":":
            text = text[1:]
    else:
        text = unquote(text)
    text = text.replace("\\", "/")
    if os.name == "nt":
        text = text.lower()
    while len(text) > 1 and text.endswith("/"):
        text = text[:-1]
    return text


def in_project(stored, root=None):
    """True if stored is the project root or a directory under it."""
    root_n = norm(root or project_root())
    stored_n = norm(stored)
    if not root_n or not stored_n:
        return False
    return stored_n == root_n or stored_n.startswith(root_n + "/")


def stored_paths(value):
    if value is None:
        return
    if isinstance(value, (list, tuple)):
        for item in value:
            yield from stored_paths(item)
        return
    text = str(value).strip()
    if not text:
        return
    if text[0] in "[{":
        try:
            yield from stored_paths(json.loads(text))
            return
        except Exception:
            pass
    yield text


def any_in_project(value, root=None):
    return any(in_project(p, root) for p in stored_paths(value))


def blob_in_project(blob, root=None):
    if not blob:
        return False
    text = blob.decode("utf-8", errors="ignore") if isinstance(blob, bytes) else str(blob)
    return any(in_project(uri, root) for uri in FILE_URI_RE.findall(text))
