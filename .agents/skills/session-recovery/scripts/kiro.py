import sys
sys.dont_write_bytecode = True
import os
import json

from project import any_in_project, home_path, project_label

KIRO_SESSIONS_DIR = home_path(".kiro", "sessions")


def get_kiro_sessions(restrict_to_project=True):
    results = []
    if not os.path.isdir(KIRO_SESSIONS_DIR):
        return results

    for wh in os.listdir(KIRO_SESSIONS_DIR):
        wp = os.path.join(KIRO_SESSIONS_DIR, wh)
        if not os.path.isdir(wp):
            continue

        for s_id in os.listdir(wp):
            sp = os.path.join(wp, s_id)
            if not os.path.isdir(sp):
                continue

            sess_file = os.path.join(sp, "session.json")
            if not os.path.isfile(sess_file):
                continue
            try:
                with open(sess_file, "r", encoding="utf-8") as f:
                    sess = json.load(f)

                paths = sess.get("workspacePaths", [])
                if restrict_to_project:
                    if paths and not any_in_project(paths):
                        continue

                date_str = sess.get("lastModifiedAt", sess.get("createdAt", "N/A"))
                results.append({
                    "id": s_id,
                    "title": sess.get("title", "Untitled"),
                    "date": date_str,
                    "model": sess.get("modelId", "N/A"),
                    "dir": sp,
                })
            except Exception:
                pass

    results.sort(key=lambda x: x["date"], reverse=True)
    return results


def format_date(iso_str):
    if iso_str == "N/A":
        return iso_str
    try:
        clean = iso_str.split(".")[0]
        return clean.replace("T", " ").replace("Z", "")
    except Exception:
        return iso_str


def cmd_list():
    sessions = get_kiro_sessions()
    print(f"=== Kiro Sessions ({project_label()}) ===")
    if not sessions:
        print("No sessions found.")
        return

    for s in sessions:
        print(f"ID: {s['id']}")
        print(f"Title: {s['title']}")
        print(f"Date: {format_date(s['date'])} | Model: {s['model']} | Tokens: N/A")
        print("-" * 40)


def cmd_read(session_id):
    sessions = get_kiro_sessions(restrict_to_project=False)
    target_dir = None
    for s in sessions:
        if s["id"] == session_id:
            target_dir = s["dir"]
            break

    if not target_dir:
        print(f"Error: Session {session_id} not found.")
        sys.exit(1)

    msgs_file = os.path.join(target_dir, "messages.jsonl")
    if not os.path.isfile(msgs_file):
        print(f"Error: messages.jsonl not found in {target_dir}")
        sys.exit(1)

    print(f"=== Session: {session_id} ===")
    with open(msgs_file, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            try:
                e = json.loads(line)
                payload = e.get("payload", {})
                if not isinstance(payload, dict):
                    continue

                role = payload.get("role", payload.get("type", "unknown")).upper()
                content = payload.get("content", "")

                if isinstance(content, list):
                    text_parts = []
                    for part in content:
                        if isinstance(part, dict) and part.get("type") == "text":
                            text_parts.append(part.get("text", ""))
                    content = "".join(text_parts)

                if content:
                    print(f"\n[{role}]")
                    print(content)
            except Exception:
                pass


def cmd_search(keyword):
    print(f"=== Searching Kiro Sessions for '{keyword}' ===")
    sessions = get_kiro_sessions()
    keyword_lower = keyword.lower()
    found = 0

    for s in sessions:
        msgs_file = os.path.join(s["dir"], "messages.jsonl")
        if not os.path.isfile(msgs_file):
            continue

        with open(msgs_file, "r", encoding="utf-8") as f:
            for line in f:
                if keyword_lower in line.lower():
                    print(f"Found in session ID: {s['id']} (Title: {s['title']})")
                    found += 1
                    break

    if found == 0:
        print("No matches.")


def main():
    if len(sys.argv) < 2:
        print("Usage: python kiro.py <list|read <id>|search <keyword>>")
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
