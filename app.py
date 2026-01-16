import os
import re
import time
import requests
from flask import Flask, jsonify, request, render_template, Response

app = Flask(__name__)

# ----------------------------
# Simple in-memory cache
# ----------------------------
CACHE_TTL_SECONDS = 300  # 5 minutes
_cache = {}  # key -> {"ts": float, "data": any}

def cache_get(key: str):
    v = _cache.get(key)
    if not v:
        return None
    if time.time() - v["ts"] > CACHE_TTL_SECONDS:
        _cache.pop(key, None)
        return None
    return v["data"]

def cache_set(key: str, data):
    _cache[key] = {"ts": time.time(), "data": data}

# ----------------------------
# Helpers
# ----------------------------
def normalize_user_input_to_username(user_input: str) -> str:
    """
    Accepts:
      - 'melies'
      - 'https://vimeo.com/melies'
      - 'vimeo.com/melies'
    Returns:
      - 'melies'
    """
    s = (user_input or "").strip()
    if not s:
        return ""

    m = re.search(r"vimeo\.com/([^/?#]+)", s, re.IGNORECASE)
    if m:
        return m.group(1).strip()

    return s

def vimeo_simple_api_url(username: str) -> str:
    return f"https://vimeo.com/api/v2/{username}/videos.json"

# ----------------------------
# Routes
# ----------------------------
@app.get("/")
def home():
    return render_template("index.html")

@app.get("/widget.js")
def widget_js():
    js_path = os.path.join(app.root_path, "static", "widget.js")
    with open(js_path, "r", encoding="utf-8") as f:
        js = f.read()
    return Response(js, mimetype="application/javascript")

@app.get("/styles.css")
def styles_css():
    css_path = os.path.join(app.root_path, "static", "styles.css")
    with open(css_path, "r", encoding="utf-8") as f:
        css = f.read()
    return Response(css, mimetype="text/css")

@app.get("/api/vimeo")
def api_vimeo():
    """
    GET /api/vimeo?user=USERNAME_OR_PROFILE_URL&limit=6
    Uses: https://vimeo.com/api/v2/<username>/videos.json
    """
    user_input = (request.args.get("user") or "").strip()
    limit_raw = request.args.get("limit") or "6"

    try:
        limit = int(limit_raw)
    except ValueError:
        limit = 6

    limit = max(1, min(16, limit))

    username = normalize_user_input_to_username(user_input)
    if not username:
        return jsonify({"error": "Missing ?user=USERNAME (or Vimeo profile URL)"}), 400

    api_url = vimeo_simple_api_url(username)
    cache_key = f"{username}:{limit}"

    cached = cache_get(cache_key)
    if cached:
        return jsonify(cached)

    try:
        headers = {"User-Agent": "Mozilla/5.0 (VimeoLatestWidget/1.0)"}
        r = requests.get(api_url, headers=headers, timeout=12)
        r.raise_for_status()

        data = r.json()
        if not isinstance(data, list) or len(data) == 0:
            return jsonify({
                "error": "No videos found (or profile may be private/unavailable).",
                "hint": "Make sure the videos are public and the username is correct.",
                "api": api_url
            }), 400

        items = []
        for v in data[:limit]:
            items.append({
                "id": str(v.get("id", "")),
                "title": (v.get("title", "") or "").strip(),
                "url": v.get("url", ""),
                "thumbnail": v.get("thumbnail_large") or v.get("thumbnail_medium") or v.get("thumbnail_small") or "",
                "published": v.get("upload_date", ""),
                "duration": v.get("duration", None),
                "user_name": v.get("user_name", "") or "",
                "user_url": v.get("user_url", "") or "",
                "user_portrait": v.get("user_portrait_huge") or v.get("user_portrait_large") or v.get("user_portrait_medium") or ""
            })

        payload = {
            "user": username,
            "api": api_url,
            "count": len(items),
            "items": items
        }

        cache_set(cache_key, payload)
        return jsonify(payload)

    except requests.HTTPError as e:
        return jsonify({
            "error": f"Vimeo returned an error ({r.status_code}).",
            "details": str(e),
            "api": api_url
        }), 400
    except Exception as e:
        return jsonify({"error": str(e), "api": api_url}), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
