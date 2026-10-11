#!/usr/bin/env python3
"""Check real public routes and MIME, with no private inputs or external API calls."""
import json
import sys
import time
import urllib.error
import urllib.request


def check(base, release):
    def get(path):
        with urllib.request.urlopen(base.rstrip("/") + path, timeout=20) as response:
            return response.headers.get_content_type(), response.read()
    mime, marker = get("/release.json")
    assert json.loads(marker)["release"] == release, "Wrong release at the edge"
    for route in ["/", "/tarot", "/tarot/", "/astrology/"]:
        mime, body = get(route)
        assert mime == "text/html" and b"<h1" in body, route
    for feature in ["tarot", "astrology"]:
        mime, body = get(f"/engines/{feature}/engine.wasm")
        assert mime == "application/wasm" and body[:4] == b"\0asm", feature
        mime, body = get(f"/engines/{feature}/worker.mjs")
        assert mime in ["text/javascript", "application/javascript"] and b"<!DOCTYPE" not in body
    for name in ["semantics.1", "rules.1", "reading.en.1"]:
        mime, body = get(f"/content/reading/{name}.json")
        assert mime == "application/json" and isinstance(json.loads(body), dict), name
    try:
        get("/__pxoracle_missing_asset__.js")
        raise AssertionError("Missing asset was rewritten to HTTP 200")
    except urllib.error.HTTPError as error:
        assert error.code == 404, error.code


if __name__ == "__main__":
    base, release = sys.argv[1:]
    for attempt in range(12):
        try:
            check(base, release)
            print("Public HTTPS routes, WASM/Worker MIME, content and genuine 404 passed")
            break
        except (AssertionError, OSError, ValueError):
            if attempt == 11:
                raise
            time.sleep(5)
