"""
Lightweight PreToolUse guard for Grimborne Hunters.
Fast (<50ms) pass-through for all normal commands; only audits `git commit`
to prevent accidentally committing .blend/temp files inside assets/ or broken imports.
"""
import json
import os
import re
import subprocess
import sys


def allow():
    print(json.dumps({"decision": "allow"}))
    sys.exit(0)


def deny(reason):
    print(json.dumps({"decision": "deny", "reason": reason}, ensure_ascii=False))
    sys.exit(0)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        allow()

    cmd = str(payload.get("toolCall", {}).get("args", {}).get("CommandLine", ""))
    if not re.search(r"\bgit\b.*\bcommit\b", cmd, re.IGNORECASE):
        allow()

    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    try:
        staged = subprocess.check_output(
            ["git", "-C", repo_root, "diff", "--cached", "--name-only"],
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=5,
        ).splitlines()
    except Exception:
        allow()

    forbidden = []
    for path in staged:
        low = path.lower().replace("\\", "/")
        if low.endswith((".blend", ".blend1", ".bak", ".tmp")):
            forbidden.append(path)
        elif low.startswith("assets/") and low.endswith(".py"):
            forbidden.append(path)

    if forbidden:
        deny(
            "Grimborne Pre-Commit Guard заблокировал коммит: в staging попали запрещённые "
            f"рабочие файлы ({', '.join(forbidden[:5])}). Убери их из git staging."
        )

    allow()


if __name__ == "__main__":
    main()
