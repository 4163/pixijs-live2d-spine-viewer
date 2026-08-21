import sqlite3
import sys
sys.dont_write_bytecode = True
import os
import json
from datetime import datetime

from project import any_in_project, blob_in_project, home_path, project_label

AGY_CLI_DIR = home_path(".gemini", "antigravity-cli")
AGY_IDE_DIR = home_path(".gemini", "antigravity-ide")


def get_cli_summaries():
    db_path = os.path.join(AGY_CLI_DIR, "conversation_summaries.db")
    if not os.path.isfile(db_path):
        return []

    db = sqlite3.connect(db_path)
    rows = db.execute("""
        SELECT conversation_id, title, last_modified_time, agent_name, workspace_uris, step_count
        FROM conversation_summaries
        ORDER BY last_modified_time DESC
    """).fetchall()
    db.close()

    results = []
    for r in rows:
        c_id, title, last_mod, agent, uris, steps = r
        if not any_in_project(uris):
            continue
        results.append({
            "id": c_id,
            "title": title,
            "date": last_mod.split(".")[0] if last_mod else "N/A",
            "agent": agent,
            "steps": steps,
            "source": "CLI",
        })
    return results


def ide_db_in_project(db_path):
    try:
        db = sqlite3.connect(db_path)
        row = db.execute("SELECT data FROM trajectory_metadata_blob WHERE id = 'main'").fetchone()
        db.close()
        if not row:
            return False
        return blob_in_project(row[0])
    except Exception:
        return False


def get_ide_summaries():
    results = []
    conv_dir = os.path.join(AGY_IDE_DIR, "conversations")
    if not os.path.isdir(conv_dir):
        return results

    for db_name in os.listdir(conv_dir):
        if not db_name.endswith(".db"):
            continue
        db_path = os.path.join(conv_dir, db_name)
        if not ide_db_in_project(db_path):
            continue
        c_id = db_name[:-3]
        mtime = datetime.fromtimestamp(os.path.getmtime(db_path)).strftime("%Y-%m-%d %H:%M:%S")
        results.append({
            "id": c_id,
            "title": "Unknown (IDE Session)",
            "date": mtime,
            "agent": "Antigravity IDE",
            "steps": "N/A",
            "source": "IDE",
        })

    results.sort(key=lambda x: x["date"], reverse=True)
    return results


def cmd_list():
    cli_sessions = get_cli_summaries()
    ide_sessions = get_ide_summaries()
    label = project_label()

    print(f"=== Antigravity Sessions (CLI: {label}) ===")
    if not cli_sessions:
        print("No sessions found.")
    for s in cli_sessions:
        print(f"ID: {s['id']} [CLI]")
        print(f"Title: {s['title']}")
        print(f"Date: {s['date']} | Agent: {s['agent']} | Steps: {s['steps']}")
        print("-" * 40)

    print(f"\n=== Antigravity Sessions (IDE: {label}) ===")
    if not ide_sessions:
        print("No sessions found.")
    for s in ide_sessions[:10]:
        print(f"ID: {s['id']} [IDE]")
        print(f"Date: {s['date']} | Agent: {s['agent']}")
        print("-" * 40)
    if len(ide_sessions) > 10:
        print(f"... and {len(ide_sessions) - 10} more IDE sessions.")


def get_transcript_path(session_id):
    p = os.path.join(AGY_CLI_DIR, "brain", session_id, ".system_generated", "logs", "transcript.jsonl")
    if os.path.isfile(p):
        return p
    p = os.path.join(AGY_IDE_DIR, "brain", session_id, ".system_generated", "logs", "transcript.jsonl")
    if os.path.isfile(p):
        return p
    return None


def cmd_read(session_id):
    t_path = get_transcript_path(session_id)
    if not t_path:
        print(f"Error: Transcript for session {session_id} not found.")
        sys.exit(1)

    print(f"=== Session: {session_id} ===")
    with open(t_path, "r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            e = json.loads(line)
            source = e.get("source", "UNKNOWN")
            t_type = e.get("type", "UNKNOWN")
            content = e.get("content", "")

            if source == "MODEL" and t_type == "PLANNER_RESPONSE":
                print(f"\n[MODEL]")
                print(content)
                for tc in e.get("tool_calls", []):
                    tc_name = tc.get("function", {}).get("name", "unknown_tool")
                    print(f"  > Tool: {tc_name}")
            elif source == "USER_EXPLICIT" and t_type == "USER_INPUT":
                print(f"\n[USER]")
                print(content)


def project_cli_ids():
    return {s["id"] for s in get_cli_summaries()}


def project_ide_ids():
    return {s["id"] for s in get_ide_summaries()}


def cmd_search(keyword):
    print(f"=== Searching Antigravity CLI Transcripts for '{keyword}' ===")
    cli_brain = os.path.join(AGY_CLI_DIR, "brain")
    _search_brain_dir(cli_brain, keyword, project_cli_ids())

    print(f"\n=== Searching Antigravity IDE Transcripts for '{keyword}' ===")
    ide_brain = os.path.join(AGY_IDE_DIR, "brain")
    _search_brain_dir(ide_brain, keyword, project_ide_ids())


def _search_brain_dir(brain_dir, keyword, allowed_ids):
    if not os.path.isdir(brain_dir):
        return

    found = 0
    keyword_lower = keyword.lower()
    for c_id in os.listdir(brain_dir):
        if allowed_ids is not None and c_id not in allowed_ids:
            continue
        t_path = os.path.join(brain_dir, c_id, ".system_generated", "logs", "transcript.jsonl")
        if not os.path.isfile(t_path):
            continue

        with open(t_path, "r", encoding="utf-8") as f:
            for line in f:
                if keyword_lower in line.lower():
                    print(f"Found in session ID: {c_id}")
                    found += 1
                    break
    if found == 0:
        print("No matches.")


def main():
    if len(sys.argv) < 2:
        print("Usage: python antigravity.py <list|read <id>|search <keyword>>")
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
