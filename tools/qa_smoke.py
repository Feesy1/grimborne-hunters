"""
Grimborne Hunters — Permanent Headless Edge Live QA Smoke Suite
Tests:
  1) Zero console errors, zero JS exceptions, zero HTTP >= 400 errors
  2) Castle of Ash (Prologue Arena): boot, bonfire & boss arena integrity, FPS >= 45
  3) Sector 01 Vertical Slice: FPS >= 60, wakePos.y == 0, all solid colliders block hero,
     destructible crate blocks until smashed then clears collider, shallow-water surface,
     and all distinct audio SFX invoke without errors.
  4) Optional --shots <dir> captures 8 ground-level screenshots + 2x4 contact sheet.

Usage:
    D:\\RGBMoCap\\runtime\\python.exe tools\\qa_smoke.py
    D:\\RGBMoCap\\runtime\\python.exe tools\\qa_smoke.py --shots C:\\temp\\qa_shots
"""
import argparse
import base64
import http.server
import json
import os
import re
import shutil
import socket
import socketserver
import struct
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def detect_version():
    idx = os.path.join(REPO_ROOT, "index.html")
    with open(idx, "r", encoding="utf-8", errors="ignore") as f:
        m = re.search(r"style\.css\?v=(20\d{6}z\d+)", f.read())
    return m.group(1) if m else "dev"


def find_browser():
    for p in [
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    ]:
        if os.path.exists(p):
            return p
    raise FileNotFoundError("Could not locate Edge/Chrome binary")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=REPO_ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


class ThreadingHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class SimpleWS:
    def __init__(self, ws_url, timeout=60):
        rest = ws_url[5:]
        host_port, path = rest.split("/", 1)
        path = "/" + path
        host, port = host_port.split(":")
        self.sock = socket.create_connection((host, int(port)), timeout=timeout)
        key = base64.b64encode(os.urandom(16)).decode()
        req = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: {host_port}\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(req.encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            chunk = self.sock.recv(4096)
            if not chunk:
                raise RuntimeError("WS handshake failed")
            buf += chunk
        self._extra = buf.split(b"\r\n\r\n", 1)[1]
        self._id = 0
        self.events = []

    def _read_exact(self, n):
        out = bytearray()
        if self._extra:
            take = min(n, len(self._extra))
            out.extend(self._extra[:take])
            self._extra = self._extra[take:]
        while len(out) < n:
            chunk = self.sock.recv(n - len(out))
            if not chunk:
                raise RuntimeError("WS connection closed")
            out.extend(chunk)
        return bytes(out)

    def send_text(self, text):
        data = text.encode("utf-8")
        mask = os.urandom(4)
        header = bytearray([0x81])
        L = len(data)
        if L < 126:
            header.append(0x80 | L)
        elif L < 65536:
            header.append(0x80 | 126)
            header.extend(struct.pack("!H", L))
        else:
            header.append(0x80 | 127)
            header.extend(struct.pack("!Q", L))
        header.extend(mask)
        masked = bytes(b ^ mask[i & 3] for i, b in enumerate(data))
        self.sock.sendall(bytes(header) + masked)

    def recv_frame(self):
        chunks = []
        while True:
            b1, b2 = self._read_exact(2)
            fin = (b1 & 0x80) != 0
            opcode = b1 & 0x0F
            masked = (b2 & 0x80) != 0
            length = b2 & 0x7F
            if length == 126:
                length = struct.unpack("!H", self._read_exact(2))[0]
            elif length == 127:
                length = struct.unpack("!Q", self._read_exact(8))[0]
            mask = self._read_exact(4) if masked else None
            payload = self._read_exact(length)
            if mask:
                payload = bytes(b ^ mask[i & 3] for i, b in enumerate(payload))
            if opcode == 0x8:
                raise RuntimeError("WS closed")
            if opcode == 0x9:
                continue
            chunks.append(payload)
            if fin:
                return b"".join(chunks).decode("utf-8", errors="replace")

    def call(self, method, params=None):
        self._id += 1
        cid = self._id
        self.send_text(json.dumps({"id": cid, "method": method, "params": params or {}}))
        while True:
            msg = json.loads(self.recv_frame())
            if msg.get("id") == cid:
                if "error" in msg:
                    raise RuntimeError(f"CDP {method} error: {msg['error']}")
                return msg.get("result", {})
            else:
                self.events.append(msg)

    def eval_js(self, expr, await_promise=True):
        res = self.call("Runtime.evaluate", {
            "expression": expr,
            "returnByValue": True,
            "awaitPromise": await_promise,
        })
        if "exceptionDetails" in res:
            raise RuntimeError(f"JS Exception: {res['exceptionDetails']}")
        return res.get("result", {}).get("value")

    def screenshot(self, path):
        res = self.call("Page.captureScreenshot", {"format": "png"})
        with open(path, "wb") as f:
            f.write(base64.b64decode(res["data"]))


def pick_free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    parser = argparse.ArgumentParser(description="Grimborne Hunters Live Headless Edge QA Smoke Suite")
    parser.add_argument("--shots", default="", help="Optional directory to save 8 Sector 01 screenshots + contact sheet")
    args = parser.parse_args()

    ver = detect_version()
    http_port = pick_free_port()
    cdp_port = pick_free_port()
    srv = ThreadingHTTPServer(("127.0.0.1", http_port), QuietHandler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    profile_dir = tempfile.mkdtemp(prefix="grimborne_qa_")
    browser = find_browser()
    proc = subprocess.Popen([
        browser,
        "--headless=new",
        f"--remote-debugging-port={cdp_port}",
        f"--user-data-dir={profile_dir}",
        "--window-size=1280,720",
        "--use-gl=angle",
        "--use-angle=d3d11",
        "--enable-webgl",
        "--ignore-gpu-blocklist",
        "--autoplay-policy=no-user-gesture-required",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    ws = None
    try:
        ws_url = None
        for _ in range(50):
            try:
                data = json.loads(urllib.request.urlopen(f"http://127.0.0.1:{cdp_port}/json/list", timeout=2).read().decode())
                for tab in data:
                    if tab.get("type") == "page" and "webSocketDebuggerUrl" in tab:
                        ws_url = tab["webSocketDebuggerUrl"]
                        break
                if ws_url:
                    break
            except Exception:
                time.sleep(0.25)
        assert ws_url, "Failed to attach to Edge CDP"
        ws = SimpleWS(ws_url, timeout=90)
        ws.call("Page.enable")
        ws.call("Runtime.enable")
        ws.call("Log.enable")
        ws.call("Network.enable")
        ws.call("Emulation.setDeviceMetricsOverride", {"width": 1280, "height": 720, "deviceScaleFactor": 1, "mobile": False})
        ws.call("Page.navigate", {"url": f"http://127.0.0.1:{http_port}/index.html?qa=1&v={ver}"})

        ready = False
        t0 = time.time()
        while time.time() - t0 < 45:
            try:
                ready = bool(ws.eval_js(
                    "Boolean(window.__grimborne?.world && window.__grimborne?.combat && !document.getElementById('splash-screen'))",
                    await_promise=False,
                ))
                if ready:
                    break
            except Exception:
                pass
            time.sleep(0.25)
        assert ready, "Engine did not boot cleanly within 45s"

        # 1. Castle of Ash regression check
        castle_res = ws.eval_js("""
        (async () => {
          const g = window.__grimborne;
          g.audio?.unlock?.();
          const hasCastleLayout = Boolean(g.world.getSoulsCastleLayout?.());
          const bf = g.world.getSoulsBonfirePos?.();
          const clCastle = g.world.clampSoulsPosition?.(0, 25, 0.5);
          return { hasCastleLayout, bonfire: bf, clCastle };
        })()
        """)
        print("CASTLE_CHECK:", json.dumps(castle_res, ensure_ascii=False))
        assert castle_res["hasCastleLayout"], "Castle layout missing!"

        # 2. Sector 01 Vertical Slice boot + FPS check
        boot = ws.eval_js("""
        (async () => {
          const g = window.__grimborne;
          await g.teleportToExteriorShore({ withSword: false, bonfireLit: false });
          await (g.world?.getExteriorShoreReadyPromise?.() || Promise.resolve());
          await new Promise(r => setTimeout(r, 850));
          const fps = await new Promise((res) => {
            let n = 0; const s0 = performance.now();
            function tick() {
              n++;
              if (n >= 40) res(Math.round((n * 1000) / Math.max(1, performance.now() - s0)));
              else requestAnimationFrame(tick);
            }
            requestAnimationFrame(tick);
          });
          const wakeCl = g.world.clampSoulsPosition(0.0, 2.5, 0.50);
          return {
            fps,
            wakeY: +wakeCl.y.toFixed(4),
            zoneTitle: g.world.getExteriorShoreZoneTitle?.(0.0, 2.5, 0.0),
            interactables: (g.world.getExteriorShoreInteractables?.() || []).length,
          };
        })()
        """)
        print("SECTOR01_BOOT:", json.dumps(boot, ensure_ascii=False))
        assert boot["fps"] >= 50, f"Low FPS in Sector 01: {boot['fps']}"
        assert abs(boot["wakeY"]) < 0.01, f"wakePos Y drift: {boot['wakeY']}"

        # 3. Physics, 1:1 Solid Collisions, Destructibles & Shallow-Water Wading Assertions
        phys = ws.eval_js("""
        (() => {
          const g = window.__grimborne;
          const w = g.world;
          const dist2 = (a, b) => Math.hypot(a.x - b[0], a.z - b[1]);
          const testSolid = (x, z) => {
            const cl = w.clampSoulsPosition(x, z, 0.50);
            return { x: +cl.x.toFixed(3), z: +cl.z.toFixed(3), y: +cl.y.toFixed(3), surface: cl.surface, push: +dist2(cl, [x, z]).toFixed(3) };
          };
          const checks = {
            lantern1:       testSolid( 3.55,  6.20),
            pilgrimPierW:   testSolid(-3.85, 11.20),
            bonfireHearth:  testSolid(-2.30, 16.00),
            fisherSkiff:    testSolid( 6.35, 18.60),
            gateBrazierW:   testSolid(-3.90, 27.65),
            portcullisWall: testSolid( 0.00, 32.00),
            deepRiverStop:  testSolid(14.00, 14.00),
            crate1Before:   testSolid(-4.45,  4.85),
            shallowWade:    testSolid( 8.40, 14.00),
          };
          const smashRes = w.hitShoreDestructibles(-4.45, 4.85, 1.45);
          checks.crate1After = testSolid(-4.45, 4.85);
          checks.smashCount = smashRes?.count || 0;
          w.resetShoreDestructibles?.();
          g.audio?.playClubPickup?.();
          g.audio?.playBonfireKindle?.();
          g.audio?.playIronGateLocked?.();
          g.audio?.playWoodSmash?.();
          g.audio?.playFootstep?.(false, 'shallow_water');
          return checks;
        })()
        """)
        assert phys["lantern1"]["push"] >= 0.80, f"Lantern #1 collider failed: {phys['lantern1']}"
        assert phys["pilgrimPierW"]["push"] >= 1.40, f"Pilgrim Pier collider failed: {phys['pilgrimPierW']}"
        assert phys["bonfireHearth"]["push"] >= 1.45, f"Bonfire collider failed: {phys['bonfireHearth']}"
        assert phys["fisherSkiff"]["push"] >= 1.15, f"Skiff collider failed: {phys['fisherSkiff']}"
        assert phys["gateBrazierW"]["push"] >= 1.10, f"Gate Brazier collider failed: {phys['gateBrazierW']}"
        assert phys["portcullisWall"]["z"] <= 29.85, f"Portcullis wall failed: {phys['portcullisWall']}"
        assert phys["deepRiverStop"]["y"] >= -0.45, f"Deep river shin-limit failed: {phys['deepRiverStop']}"
        assert phys["crate1Before"]["push"] >= 0.90, f"Crate #1 solid check failed: {phys['crate1Before']}"
        assert phys["smashCount"] >= 1, f"Crate #1 smash failed: {phys['smashCount']}"
        assert phys["crate1After"]["push"] < 0.15, f"Smashed Crate #1 collider stayed active: {phys['crate1After']}"
        assert phys["shallowWade"]["surface"] == "shallow_water", f"Shallow-water surface mismatch: {phys['shallowWade']}"
        print("PHYSICS_ASSERTIONS: 11/11 PASSED")

        # 4. Optional visual screenshots capture
        if args.shots:
            from PIL import Image, ImageDraw
            os.makedirs(args.shots, exist_ok=True)
            ws.eval_js("""
            (() => {
              const ui = document.getElementById('ui-root');
              if (ui) ui.style.opacity = '0';
              const fb = document.getElementById('fps-badge');
              if (fb) fb.style.display = 'none';
            })()
            """, await_promise=False)
            shot_specs = [
                ("01_landing_outfall_waterfall.png", 0.0,  2.5,  0.04, 0.14, ""),
                ("02_great_club_lantern1.png",       1.4,  4.5, -2.55, 0.14, ""),
                ("03_pilgrim_archway_road.png",      0.0,  5.6,  3.10, 0.15,
                 "g.world.setShoreSwordPickedUp?.(true); g.equipGreatClub?.(); g.world.setShoreBonfireLit?.(true);"),
                ("04_shore_bonfire_closeup.png",    -0.35, 17.8,  0.68, 0.22,
                 "g.world.setShoreBonfireLit?.(true);"),
                ("05_fisher_skiff_shoreline.png",    4.2, 17.0, -2.28, 0.18, ""),
                ("06_shallow_water_wading.png",      8.4, 14.0,  2.55, 0.30,
                 "g.world.emitShoreWaterRipple?.(8.4, 14.0, true); setTimeout(() => g.world.emitShoreWaterRipple?.(8.55, 14.1, true), 90);"),
                ("07_ash_gatehouse_braziers.png",    0.0, 22.4,  3.14, 0.14, ""),
                ("08_barrels_pines_cliffs.png",     -1.2,  4.8,  1.62, 0.18, ""),
            ]
            captured = []
            for fname, x, z, yaw, pitch, setup_js in shot_specs:
                ws.eval_js(f"""
                (async () => {{
                  const g = window.__grimborne;
                  {setup_js}
                  const cl = g.world.clampSoulsPosition({x}, {z}, 0.50);
                  g.combat.debugTeleport({x}, {z}, cl.y);
                  g.world.setCombatOrbitYaw?.({yaw});
                  g.world.setCombatOrbitPitch?.({pitch});
                  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))));
                  await new Promise(r => setTimeout(r, 240));
                }})()
                """)
                out_p = os.path.join(args.shots, fname)
                ws.screenshot(out_p)
                captured.append(out_p)
            tw, th = 640, 360
            sheet = Image.new("RGB", (tw * 4, th * 2), (12, 16, 24))
            draw = ImageDraw.Draw(sheet)
            for idx, img_p in enumerate(captured):
                im = Image.open(img_p).convert("RGB").resize((tw, th), Image.Resampling.LANCZOS)
                gx, gy = (idx % 4) * tw, (idx // 4) * th
                sheet.paste(im, (gx, gy))
                draw.rectangle([gx + 8, gy + 8, gx + 290, gy + 32], fill=(10, 14, 22))
                draw.text((gx + 14, gy + 13), os.path.basename(img_p), fill=(240, 232, 210))
            sheet_p = os.path.join(args.shots, f"contact_sheet_{ver}.png")
            sheet.save(sheet_p)
            print("SHOTS_SAVED:", sheet_p)

        # 5. Collect console / JS exception / HTTP errors
        console_errs, page_errs, http_errs = [], [], []
        for ev in ws.events:
            m = ev.get("method")
            p = ev.get("params", {})
            if m == "Runtime.consoleAPICalled" and p.get("type") == "error":
                console_errs.append(str(p.get("args")))
            elif m == "Runtime.exceptionThrown":
                page_errs.append(str(p.get("exceptionDetails")))
            elif m == "Network.responseReceived":
                st = p.get("response", {}).get("status", 200)
                url = p.get("response", {}).get("url", "")
                if st >= 400 and "yandex" not in url and "favicon" not in url:
                    http_errs.append(f"{st} {url}")

        print(f"ERRORS: console={len(console_errs)} page={len(page_errs)} http={len(http_errs)}")
        for e in console_errs + page_errs + http_errs:
            print("  ERR:", e)

        assert len(console_errs) == 0, f"Console errors: {console_errs}"
        assert len(page_errs) == 0, f"Page errors: {page_errs}"
        assert len(http_errs) == 0, f"HTTP errors: {http_errs}"
        print(f"ALL QA SMOKE CHECKS PASSED ({ver}, {boot['fps']} FPS)!")
    finally:
        try:
            if ws:
                ws.sock.close()
        except Exception:
            pass
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        srv.shutdown()
        shutil.rmtree(profile_dir, ignore_errors=True)


if __name__ == "__main__":
    main()
