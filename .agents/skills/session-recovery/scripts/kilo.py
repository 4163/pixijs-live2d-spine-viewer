import sqlite3
import sys
sys.dont_write_bytecode = True
import os
import json
from datetime import datetime

from project import home_path, in_project, project_label

DB_PATH = home_path(".local", "share", "kilo", "kilo.db")


def get_db():
    if not os.path.isfile(DB_PATH):
        print(f"Error: Kilo DB not found at {DB_PATH}")
        sys.exit(1)
    return sqlite3.connect(DB_PATH)


def format_ts(ts):
    if not ts:
        return "N/A"
    try:
        return datetime.fromtimestamp(ts / 1000).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return datetime.fromtimestamp(ts).strftime("%Y-%m-%d %H:%M")


def cmd_list():
    db = get_db()
    rows = db.execute("""
        SELECT id, slug, title, time_updated, model, tokens_input, tokens_output, tokens_reasoning, directory
        FROM session
        ORDER BY time_updated DESC
    """).fetchall()
    rows = [r for r in rows if in_project(r[8])]

    print(f"=== Kilo Sessions ({project_label()}) ===")
    if not rows:
        print("No sessions found.")
        db.close()
        return

    for r in rows:
        s_id, slug, title, updated, model, t_in, t_out, t_reason, _directory = r
        tokens = (t_in or 0) + (t_out or 0) + (t_reason or 0)
        print(f"ID: {s_id}")
        print(f"Title: {title or slug}")
        print(f"Date: {format_ts(updated)} | Model: {model or 'N/A'} | Tokens: {tokens}")
        print("-" * 40)
    db.close()


def cmd_read(session_id):
    db = get_db()
    sess = db.execute("SELECT title, slug FROM session WHERE id = ?", (session_id,)).fetchone()
    if not sess:
        print(f"Error: Session {session_id} not found.")
        db.close()
        sys.exit(1)

    print(f"=== Session: {sess[0] or sess[1]} ({session_id}) ===")

    msgs = db.execute("""
        SELECT m.time_created, m.data, p.data
        FROM message m
        LEFT JOIN part p ON p.message_id = m.id
        WHERE m.session_id = ?
        ORDER BY m.time_created ASC
    """, (session_id,)).fetchall()

    for m in msgs:
        time_created, m_data, p_data = m
        m_json = json.loads(m_data) if m_data else {}
        p_json = json.loads(p_data) if p_data else {}

        role = m_json.get("role", "unknown").upper()
        text = p_json.get("text", "")
        if not text and p_json.get("tool_calls"):
            text = f"[Tool calls: {len(p_json.get('tool_calls'))}]"

        print(f"\n[{role}] {format_ts(time_created)}")
        print(text)

    db.close()


def cmd_search(keyword):
    db = get_db()
    query = f"%{keyword}%"

    title_rows = db.execute("""
        SELECT id, slug, title, time_updated, directory
        FROM session
        WHERE title LIKE ? OR slug LIKE ?
        ORDER BY time_updated DESC
    """, (query, query)).fetchall()
    title_rows = [r for r in title_rows if in_project(r[4])]

    print(f"=== Sessions matching '{keyword}' in title ===")
    for r in title_rows:
        print(f"ID: {r[0]} | Date: {format_ts(r[3])} | Title: {r[2] or r[1]}")

    msg_rows = db.execute("""
        SELECT DISTINCT s.id, s.title, s.slug, m.time_created, s.directory
        FROM session s
        JOIN message m ON m.session_id = s.id
        JOIN part p ON p.message_id = m.id
        WHERE p.data LIKE ?
        ORDER BY m.time_created DESC
    """, (query,)).fetchall()
    msg_rows = [r for r in msg_rows if in_project(r[4])]

    print(f"\n=== Sessions matching '{keyword}' in message content ===")
    for r in msg_rows:
        print(f"ID: {r[0]} | Date: {format_ts(r[3])} | Title: {r[1] or r[2]}")

    db.close()


def main():
    if len(sys.argv) < 2:
        print("Usage: python kilo.py <list|read <id>|search <keyword>>")
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
