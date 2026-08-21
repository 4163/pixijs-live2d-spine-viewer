import sys
sys.dont_write_bytecode = True
import os
import json
import glob
from datetime import datetime

from project import home_path, in_project, project_label

CODEX_DIR = home_path(".codex")
INDEX_FILE = os.path.join(CODEX_DIR, "session_index.jsonl")


def rollout_cwd(fpath):
    try:
        with open(fpath, "r", encoding="utf-8") as f:
            for i, line in enumerate(f):
                if i > 8:
                    break
                if not line.strip():
                    continue
                e = json.loads(line)
                payload = e.get("payload") or {}
                if not isinstance(payload, dict):
                    continue
                cwd = payload.get("cwd")
                if cwd:
                    return cwd
                if e.get("type") == "session_meta":
                    return payload.get("cwd")
    except Exception:
        return None
    return None


def session_id_from_rollout(fpath):
    name = os.path.basename(fpath)
    # rollout-<timestamp>-<uuid>.jsonl
    if not (name.startswith("rollout-") and name.endswith(".jsonl")):
        return None
    core = name[len("rollout-"):-len(".jsonl")]
    parts = core.split("-")
    if len(parts) >= 5:
        return "-".join(parts[-5:])
    return core


def iter_rollouts():
    sessions_dir = os.path.join(CODEX_DIR, "sessions")
    archived_dir = os.path.join(CODEX_DIR, "archived_sessions")
    for d in [sessions_dir, archived_dir]:
        if not os.path.isdir(d):
            continue
        pattern = os.path.join(d, "**", "rollout-*.jsonl")
        for fpath in glob.glob(pattern, recursive=True):
            yield fpath


def get_index():
    by_id = {}
    if os.path.isfile(INDEX_FILE):
        with open(INDEX_FILE, "r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                e = json.loads(line)
                by_id[e.get("id")] = {
                    "id": e.get("id"),
                    "title": e.get("thread_name", "Untitled"),
                    "date": e.get("updated_at", "N/A"),
                }

    results = []
    seen = set()
    for fpath in iter_rollouts():
        cwd = rollout_cwd(fpath)
        if cwd is None or not in_project(cwd):
            continue
        s_id = session_id_from_rollout(fpath)
        if not s_id or s_id in seen:
            continue
        seen.add(s_id)
        indexed = by_id.get(s_id)
        if indexed:
            results.append(indexed)
        else:
            mtime = datetime.fromtimestamp(os.path.getmtime(fpath)).strftime("%Y-%m-%dT%H:%M:%S")
            results.append({
                "id": s_id,
                "title": os.path.basename(fpath),
                "date": mtime,
            })

    results.sort(key=lambda x: x["date"], reverse=True)
    return results


def format_date(iso_str):
    if iso_str == "N/A":
        return iso_str
    try:
        clean = iso_str.split(".")[0]
        clean = clean.replace("T", " ").replace("Z", "")
        return clean
    except Exception:
        return iso_str


def cmd_list():
    sessions = get_index()
    print(f"=== Codex Sessions ({project_label()}) ===")
    if not sessions:
        print("No sessions found.")
        return

    for s in sessions[:30]:
        print(f"ID: {s['id']}")
        print(f"Title: {s['title']}")
        print(f"Date: {format_date(s['date'])} | Tokens: N/A")
        print("-" * 40)
    if len(sessions) > 30:
        print(f"... and {len(sessions) - 30} more sessions.")


def find_rollout_file(session_id):
    sessions_dir = os.path.join(CODEX_DIR, "sessions")
    archived_dir = os.path.join(CODEX_DIR, "archived_sessions")

    for d in [sessions_dir, archived_dir]:
        if not os.path.isdir(d):
            continue
        pattern = os.path.join(d, "**", f"rollout-*-{session_id}.jsonl")
        matches = glob.glob(pattern, recursive=True)
        if matches:
            return matches[0]
    return None


def cmd_read(session_id):
    rollout = find_rollout_file(session_id)
    if not rollout:
        print(f"Error: Rollout for session {session_id} not found.")
        sys.exit(1)

    print(f"=== Session: {session_id} ===")

    with open(rollout, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            e = json.loads(line)
            t_type = e.get("type")

            if t_type == "event_msg":
                continue
            elif t_type == "response_item":
                p = e.get("payload", {})
                role = p.get("role", "unknown").upper()
                content = p.get("content", "")
                print(f"\n[{role}]")
                print(content)
            elif t_type == "turn_context":
                p = e.get("payload", {})
                user_msg = p.get("message", "")
                if user_msg:
                    print(f"\n[USER]")
                    print(user_msg)


def cmd_search(keyword):
    print(f"=== Searching Codex Sessions for '{keyword}' ===")
    keyword_lower = keyword.lower()
    found = 0

    for fpath in iter_rollouts():
        cwd = rollout_cwd(fpath)
        if cwd is None or not in_project(cwd):
            continue
        with open(fpath, "r", encoding="utf-8") as f:
            for line in f:
                if keyword_lower in line.lower():
                    print(f"Found in: {os.path.basename(fpath)}")
                    found += 1
                    break

    if found == 0:
        print("No matches.")


def main():
    if len(sys.argv) < 2:
        print("Usage: python codex.py <list|read <id>|search <keyword>>")
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "list":
        cmd_list()
    elif cmd == "read":
        if len(sys.argv) < 3:
            print("Error: session id required")
            sys.exit(1)
        cmd_read(sys.argv[2])
    elif cmd == "search":
        if len(sys.argv) < 3:
            print("Error: search keyword required")
            sys.exit(1)
        cmd_search(sys.argv[2])
    else:
        print(f"Unknown command: {cmd}")


if __name__ == "__main__":
    main()
