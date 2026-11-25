"""
Grimborne Hunters — One-Command Release & Cache-Buster Automation
Automates:
  1) Atomic version bump (?v=YYYYMMDDzNNN) across HTML, JS, README, launchers
  2) Static check (tools/check_assets.py)
  3) Live Headless Edge QA (tools/qa_smoke.py)
  4) Optional git add / commit / push + prints clickable GitHub Pages URL

Usage:
    D:\\RGBMoCap\\runtime\\python.exe tools\\release.py --bump auto
    D:\\RGBMoCap\\runtime\\python.exe tools\\release.py --bump 20261125z106 --commit "z106: ..." --push
"""
import argparse
import datetime
import os
import re
import subprocess
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PY = sys.executable
LIVE_BASE_URL = "https://feesy1.github.io/grimborne-hunters/"
VER_RE = re.compile(r"(20\d{6})z(\d+)")


def detect_current_version():
    idx = os.path.join(REPO_ROOT, "index.html")
    with open(idx, "r", encoding="utf-8", errors="ignore") as f:
        m = re.search(r"style\.css\?v=(20\d{6}z\d+)", f.read())
    if not m:
        raise RuntimeError("Cannot detect current version from index.html")
    return m.group(1)


def compute_next_version(cur_ver, arg_bump):
    if arg_bump and arg_bump.lower() != "auto":
        if arg_bump.startswith("z"):
            today = datetime.datetime.now().strftime("%Y%m%d")
            return f"{today}{arg_bump}"
        return arg_bump
    m = VER_RE.fullmatch(cur_ver)
    if not m:
        raise RuntimeError(f"Unexpected current version format: {cur_ver}")
    today = datetime.datetime.now().strftime("%Y%m%d")
    next_num = int(m.group(2)) + 1
    return f"{today}z{next_num}"


ALLOWED_STATIC_VERSIONS = {"20261117z25"}
ANY_QUERY_VER_RE = re.compile(r"(\?v=)(20\d{6}z\d+)")
CONST_VER_RE = re.compile(r"""(SECTOR01_ASSET_VER\s*=\s*['"])(20\d{6}z\d+)(['"])""")


def bump_version(old_ver, new_ver):
    targets = []
    for name in ("index.html", "README.md", "ИГРАТЬ_НА_ТЕЛЕФОНЕ.md", "Запустить_игру.cmd", "Запустить_на_Mac.command"):
        p = os.path.join(REPO_ROOT, name)
        if os.path.isfile(p):
            targets.append(p)
    for dp, _, fn in os.walk(os.path.join(REPO_ROOT, "js")):
        for f in sorted(fn):
            if f.endswith(".js"):
                targets.append(os.path.join(dp, f))

    changed = 0
    for fp in targets:
        with open(fp, "r", encoding="utf-8", errors="replace") as fh:
            txt = fh.read()
        new_txt = ANY_QUERY_VER_RE.sub(
            lambda m: m.group(0) if m.group(2) in ALLOWED_STATIC_VERSIONS else f"{m.group(1)}{new_ver}",
            txt,
        )
        new_txt = CONST_VER_RE.sub(lambda m: f"{m.group(1)}{new_ver}{m.group(3)}", new_txt)
        if old_ver != new_ver and old_ver in new_txt:
            new_txt = new_txt.replace(old_ver, new_ver)
        if new_txt != txt:
            with open(fp, "w", encoding="utf-8", newline="") as fh:
                fh.write(new_txt)
            changed += 1
    print(f"Normalized & bumped version -> {new_ver} across {changed} files.")
    return changed


def run_step(cmd, label):
    print(f"\n--- {label} ---")
    res = subprocess.run(cmd, cwd=REPO_ROOT)
    if res.returncode != 0:
        print(f"[FAILED] {label} (exit {res.returncode})")
        sys.exit(res.returncode)


def main():
    parser = argparse.ArgumentParser(description="Grimborne Hunters Release Helper")
    parser.add_argument("--bump", default="", help="New version tag (e.g. 20261125z106, z106, or 'auto')")
    parser.add_argument("--skip-qa", action="store_true", help="Skip Headless Edge QA smoke test (not recommended)")
    parser.add_argument("--shots", default="", help="Optional screenshot output folder for qa_smoke.py")
    parser.add_argument("--commit", default="", help="Git commit message (stages all changes)")
    parser.add_argument("--push", action="store_true", help="Push origin main after commit")
    args = parser.parse_args()

    cur_ver = detect_current_version()
    active_ver = cur_ver
    if args.bump:
        active_ver = compute_next_version(cur_ver, args.bump)
        bump_version(cur_ver, active_ver)

    run_step([PY, os.path.join("tools", "check_assets.py")], "Static Asset, Import & Version Check")

    if not args.skip_qa:
        qa_cmd = [PY, os.path.join("tools", "qa_smoke.py")]
        if args.shots:
            qa_cmd.extend(["--shots", args.shots])
        run_step(qa_cmd, "Live Headless Edge QA Smoke Suite")

    if args.commit:
        run_step(["git", "add", "-A"], "Git Stage")
        run_step(["git", "status", "-s"], "Git Status")
        run_step(["git", "commit", "-m", args.commit], "Git Commit")
        if args.push:
            run_step(["git", "push", "origin", "main"], "Git Push origin main")

    print("\n============================================================")
    print(f"RELEASE READY: {active_ver}")
    print(f"LIVE URL     : {LIVE_BASE_URL}?v={active_ver}")
    print("============================================================")


if __name__ == "__main__":
    main()
