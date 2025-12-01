#!/usr/bin/env python3
"""
NotebookLM Authentication Helper
Saves browser session state for reuse in automation
"""

import json
import sys
import os
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "Playwright not installed. Run: pip install playwright && playwright install chromium"
    }))
    sys.exit(1)


def get_state_path():
    """Get path to state.json file"""
    return Path(__file__).parent / "state.json"


def check_auth_status():
    """Check if authentication state exists and is valid"""
    state_path = get_state_path()

    if not state_path.exists():
        return {
            "authenticated": False,
            "message": "No authentication state found. Run authentication first."
        }

    try:
        with open(state_path, 'r') as f:
            state = json.load(f)

        # Check if we have cookies for Google
        cookies = state.get('cookies', [])
        google_cookies = [c for c in cookies if 'google' in c.get('domain', '')]

        if google_cookies:
            return {
                "authenticated": True,
                "message": "Authentication state found.",
                "cookie_count": len(google_cookies)
            }
        else:
            return {
                "authenticated": False,
                "message": "No Google cookies found in state. Re-authenticate."
            }
    except Exception as e:
        return {
            "authenticated": False,
            "message": f"Error reading state: {str(e)}"
        }


def authenticate_interactive():
    """Launch browser for manual Google login, then save state"""
    state_path = get_state_path()

    with sync_playwright() as p:
        # Launch visible browser for user to log in
        browser = p.chromium.launch(headless=False)
        context = browser.new_context()
        page = context.new_page()

        # Navigate to NotebookLM
        page.goto('https://notebooklm.google.com/')

        print("=" * 60)
        print("MANUAL LOGIN REQUIRED")
        print("=" * 60)
        print("1. Log in to your Google account in the browser window")
        print("2. Make sure you can see the NotebookLM interface")
        print("3. Press ENTER here when done...")
        print("=" * 60)

        input()

        # Save the storage state
        context.storage_state(path=str(state_path))

        browser.close()

    return {
        "success": True,
        "message": f"Authentication state saved to {state_path}",
        "state_path": str(state_path)
    }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: notebooklm_auth.py <check|authenticate>"}))
        sys.exit(1)

    action = sys.argv[1]

    if action == "check":
        result = check_auth_status()
    elif action == "authenticate":
        result = authenticate_interactive()
    else:
        result = {"error": f"Unknown action: {action}"}

    print(json.dumps(result))


if __name__ == "__main__":
    main()
