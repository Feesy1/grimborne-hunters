"""
Grimborne Hunters — Static Asset, ES Module Import & Cache-Buster Validator
Usage:
    D:\\RGBMoCap\\runtime\\python.exe tools\\check_assets.py
"""
import json
import os
import re
import struct
import sys
from collections import Counter

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
JS_DIR = os.path.join(REPO_ROOT, "js")
ASSETS_DIR = os.path.join(REPO_ROOT, "assets")

IMPORT_RE = re.compile(r"""(?:import|export)\s+[^'"]*?from\s+['"]([^'"]+)['"]""")
VER_RE = re.compile(r"\?v=(20\d{6}z\d+)")
CONST_VER_RE = re.compile(r"""SECTOR01_ASSET_VER\s*=\s*['"](20\d{6}z\d+)['"]""")

# Static icon cache version in index.html that does not need per-release bumping
ALLOWED_STATIC_VERSIONS = {"20261117z25"}


def check_js_imports():
    errors = []
    js_count = 0
    for dp, _, fn in os.walk(JS_DIR):
        for f in sorted(fn):
            if not f.endswith(".js"):
                continue
            js_count += 1
            fp = os.path.join(dp, f)
            rel = os.path.relpath(fp, REPO_ROOT).replace("\\", "/")
            with open(fp, "r", encoding="utf-8", errors="replace") as fh:
                txt = fh.read()
            for raw_target in IMPORT_RE.findall(txt):
                target = raw_target.split("?")[0]
                if target.startswith("."):
                    resolved = os.path.normpath(os.path.join(dp, target))
                    if not os.path.isfile(resolved):
                        errors.append(f"Broken import in {rel}: '{raw_target}' -> missing {resolved}")
    return js_count, errors


def check_cache_versions():
    errors = []
    ver_counts = Counter()
    file_vers = {}
    targets = []
    for name in ("index.html", "README.md", "ИГРАТЬ_НА_ТЕЛЕФОНЕ.md", "Запустить_игру.cmd", "Запустить_на_Mac.command"):
        p = os.path.join(REPO_ROOT, name)
        if os.path.isfile(p):
            targets.append(p)
    for dp, _, fn in os.walk(JS_DIR):
        for f in sorted(fn):
            if f.endswith(".js"):
                targets.append(os.path.join(dp, f))

    for fp in targets:
        rel = os.path.relpath(fp, REPO_ROOT).replace("\\", "/")
        with open(fp, "r", encoding="utf-8", errors="replace") as fh:
            txt = fh.read()
        found = [v for v in VER_RE.findall(txt) + CONST_VER_RE.findall(txt) if v not in ALLOWED_STATIC_VERSIONS]
        if found:
            file_vers[rel] = sorted(set(found))
            for v in found:
                ver_counts[v] += 1

    if not ver_counts:
        return None, ["No ?v=YYYYMMDDzNNN cache-buster versions found in repo!"]

    primary_ver, _ = ver_counts.most_common(1)[0]
    for rel, vers in file_vers.items():
        stale = [v for v in vers if v != primary_ver]
        if stale:
            errors.append(f"Version mismatch in {rel}: found {stale}, expected '{primary_ver}'")
    return primary_ver, errors


def check_assets():
    errors = []
    warnings = []
    glb_stats = []
    total_bytes = 0

    for dp, _, fn in os.walk(ASSETS_DIR):
        for f in sorted(fn):
            fp = os.path.join(dp, f)
            rel = os.path.relpath(fp, REPO_ROOT).replace("\\", "/")
            sz = os.path.getsize(fp)
            total_bytes += sz
            low = f.lower()

            if low.endswith((".blend", ".blend1", ".bak", ".tmp", ".py")):
                errors.append(f"Forbidden source/temp file inside assets/: {rel} ({sz/1024/1024:.2f} MB)")
                continue

            if low.endswith(".glb"):
                try:
                    with open(fp, "rb") as fh:
                        magic, ver, length = struct.unpack("<4sII", fh.read(12))
                        if magic != b"glTF" or ver != 2:
                            errors.append(f"Invalid glTF v2 header: {rel}")
                            continue
                        clen, ctype = struct.unpack("<I4s", fh.read(8))
                        g = json.loads(fh.read(clen).decode("utf-8"))
                    exts = g.get("extensionsUsed", [])
                    has_draco = "KHR_draco_mesh_compression" in exts
                    nodes = len(g.get("nodes", []))
                    meshes = len(g.get("meshes", []))
                    glb_stats.append((rel, sz, meshes, nodes, has_draco))
                    if rel.startswith("assets/env/") and sz > 2.5 * 1024 * 1024:
                        warnings.append(f"Large env GLB (>2.5 MB): {rel} ({sz/1024/1024:.2f} MB)")
                    elif sz > 6.0 * 1024 * 1024 and not has_draco:
                        warnings.append(f"Uncompressed heavy GLB (>6 MB, no Draco): {rel} ({sz/1024/1024:.2f} MB)")
                except Exception as exc:
                    errors.append(f"Failed to parse GLB {rel}: {exc}")

    return total_bytes, glb_stats, warnings, errors


def main():
    print("=== GRIMBORNE HUNTERS: CHECK ASSETS & CODE INTEGRITY ===")
    js_count, imp_errs = check_js_imports()
    primary_ver, ver_errs = check_cache_versions()
    total_bytes, glb_stats, warnings, asset_errs = check_assets()

    draco_cnt = sum(1 for _, _, _, _, d in glb_stats if d)
    print(f"JS modules checked : {js_count}")
    print(f"Active version tag : {primary_ver}")
    print(f"Assets total size  : {total_bytes / 1024 / 1024:.2f} MB | GLBs: {len(glb_stats)} ({draco_cnt} Draco-compressed)")

    if warnings:
        print("\nWARNINGS (non-blocking P2 optimization targets):")
        for w in warnings:
            print(f"  [WARN] {w}")

    all_errs = imp_errs + ver_errs + asset_errs
    if all_errs:
        print(f"\nERRORS ({len(all_errs)}):")
        for e in all_errs:
            print(f"  [FAIL] {e}")
        sys.exit(1)

    print("\nALL ASSET, IMPORT & VERSION CHECKS PASSED!")
    sys.exit(0)


if __name__ == "__main__":
    main()
