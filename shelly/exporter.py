#!/usr/bin/env python3
"""Shelly Cloud -> Prometheus. Stdlib only.

The VM is not in the home LAN, so values come from the Shelly Cloud
(/device/all_status, one call for all plugs). Metrics reuse the EcoFlow names
and scaling (watts=W, volt=V/10, temp=°C, rssi=dBm) so every EcoFlowMon chart
picks the Shellys up without query changes; device_sn = MAC in upper case.
"""
import hashlib, json, os, sys, time, threading, urllib.request, urllib.parse
from http.server import BaseHTTPRequestHandler, HTTPServer

EMAIL = os.environ.get("SHELLY_EMAIL", "")
PW_SHA1 = os.environ.get("SHELLY_PW_SHA1", "")  # sha1 hex of the account password
PORT = int(os.environ.get("METRICS_PORT", "9092"))
INTERVAL = int(os.environ.get("SCRAPE_INTERVAL", "60"))  # cloud limit: 1 req/s
STALE_S = 600  # cloud copy older than this = offline

state = {"token": None, "api": None, "body": ""}


def post(url, data=None, token=None):
    h = {"Authorization": "Bearer " + token} if token else {}
    req = urllib.request.Request(url, data=urllib.parse.urlencode(data or {}).encode(), headers=h)
    return json.load(urllib.request.urlopen(req, timeout=30))


def login():
    r = post("https://api.shelly.cloud/auth/login", {"email": EMAIL, "password": PW_SHA1, "var": 2})
    if not r.get("isok"):
        raise RuntimeError(f"login failed: {r.get('errors')}")
    state["token"], state["api"] = r["data"]["token"], r["data"]["user_api_url"]


def fetch():
    # ponytail: token lives ~24 h; re-login on any failure instead of tracking exp
    for attempt in (0, 1):
        try:
            if not state["token"]:
                login()
            r = post(state["api"] + "/device/all_status", token=state["token"])
            if r.get("isok"):
                return r["data"]["devices_status"]
            raise RuntimeError(r.get("errors"))
        except Exception:
            state["token"] = None
            if attempt:
                raise


def render(devices, now):
    lines = []
    for mac, d in devices.items():
        sw = d.get("switch:0")
        if not sw:
            continue
        try:
            upd = time.mktime(time.strptime(d["_updated"], "%Y-%m-%d %H:%M:%S")) - time.timezone
        except (KeyError, ValueError):
            upd = 0
        online = int(bool(d.get("cloud", {}).get("connected")) and now - upd < STALE_S)
        lab = f'device_sn="{mac.upper()}",device_name="Shelly",online="{online}",vendor="shelly"'
        vals = {
            "ecoflow_device_online": online,
            "ecoflow_2_1_watts": sw.get("apower"),
            "ecoflow_2_1_volt": sw["voltage"] / 10 if sw.get("voltage") is not None else None,
            "ecoflow_2_1_temp": (sw.get("temperature") or {}).get("tC"),
            "ecoflow_2_1_parentWifiRssi": (d.get("wifi") or {}).get("rssi"),
            "ecoflow_2_1_runTime": (d.get("sys") or {}).get("uptime"),
            "shelly_energy_total_wh": (sw.get("aenergy") or {}).get("total"),
        }
        lines += [f"{k}{{{lab}}} {v}" for k, v in vals.items() if v is not None]
    return "\n".join(sorted(lines)) + "\n"


def loop():
    while True:
        try:
            state["body"] = render(fetch(), time.time())
        except Exception as e:
            print(f"fetch failed: {e}", file=sys.stderr, flush=True)
            state["body"] = ""  # ponytail: no data rather than frozen data
        time.sleep(INTERVAL)


class H(BaseHTTPRequestHandler):
    def do_GET(self):
        b = state["body"].encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.end_headers()
        self.wfile.write(b)

    def log_message(self, *a):
        pass


def selftest():
    now = time.time()
    fresh = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(now - 30))
    old = time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime(now - 3600))
    out = render({
        "907069485f3c": {"_updated": fresh, "cloud": {"connected": True}, "wifi": {"rssi": -72}, "sys": {"uptime": 5},
                         "switch:0": {"apower": 1.1, "voltage": 237.9, "temperature": {"tC": 37.7}, "aenergy": {"total": 591.6}}},
        "90706947a36c": {"_updated": old, "cloud": {"connected": True}, "switch:0": {"apower": 0, "voltage": 236.3}},
        "nochswitch": {"_updated": fresh},
    }, now)
    assert 'ecoflow_2_1_watts{device_sn="907069485F3C",device_name="Shelly",online="1",vendor="shelly"} 1.1' in out, out
    assert 'ecoflow_2_1_volt{device_sn="907069485F3C"' in out and "} 23.79" in out, out
    assert 'ecoflow_device_online{device_sn="90706947A36C",device_name="Shelly",online="0",vendor="shelly"} 0' in out, out
    assert "NOCHSWITCH" not in out and "temp{device_sn=\"90706947A36C\"" not in out, out
    print("selftest ok")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest(); sys.exit()
    if not (EMAIL and PW_SHA1):
        sys.exit("SHELLY_EMAIL / SHELLY_PW_SHA1 missing")
    threading.Thread(target=loop, daemon=True).start()
    HTTPServer(("", PORT), H).serve_forever()
