import os

import requests
from dotenv import load_dotenv
from flask import Flask, redirect, render_template, request, url_for

# Reads SUPABASE_URL and SUPABASE_KEY from a .env file on your Mac.
# On Render, they come from the service's Environment settings instead.
load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY", "")

app = Flask(__name__)


def supabase_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
    }


def get_messages():
    """Fetch the 20 newest guestbook messages from Supabase."""
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None
    response = requests.get(
        f"{SUPABASE_URL}/rest/v1/messages",
        headers=supabase_headers(),
        params={"select": "name,body,created_at", "order": "created_at.desc", "limit": 20},
        timeout=10,
    )
    response.raise_for_status()
    return response.json()


@app.route("/")
def home():
    try:
        messages = get_messages()
        error = None if messages is not None else "The guestbook isn't connected to Supabase yet."
    except requests.RequestException:
        messages, error = [], "Couldn't reach the guestbook right now."
    return render_template("index.html", messages=messages or [], error=error)


@app.route("/sign", methods=["POST"])
def sign():
    name = request.form.get("name", "").strip()[:50]
    body = request.form.get("body", "").strip()[:280]
    if name and body and SUPABASE_URL and SUPABASE_KEY:
        requests.post(
            f"{SUPABASE_URL}/rest/v1/messages",
            headers=supabase_headers(),
            json={"name": name, "body": body},
            timeout=10,
        )
    return redirect(url_for("home"))


if __name__ == "__main__":
    app.run(debug=True, port=int(os.environ.get("PORT", 5050)))
