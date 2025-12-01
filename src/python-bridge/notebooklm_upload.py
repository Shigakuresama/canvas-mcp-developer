#!/usr/bin/env python3
"""
NotebookLM Source Upload Automation
Uses Playwright to automate adding sources to NotebookLM notebooks
"""

import json
import sys
import os
import time
from pathlib import Path
from typing import List, Optional

try:
    from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "Playwright not installed. Run: pip install playwright && playwright install chromium"
    }))
    sys.exit(1)


STATE_PATH = Path(__file__).parent / "state.json"
NOTEBOOKLM_URL = "https://notebooklm.google.com/"


def get_notebooks(page) -> List[dict]:
    """Get list of existing notebooks"""
    notebooks = []

    try:
        # Wait for notebook list to load
        page.wait_for_selector('[data-test-id="notebook-card"]', timeout=10000)

        # Get all notebook cards
        cards = page.query_selector_all('[data-test-id="notebook-card"]')

        for card in cards:
            title_el = card.query_selector('[data-test-id="notebook-title"]')
            title = title_el.inner_text() if title_el else "Untitled"
            notebooks.append({
                "title": title,
                "element": card
            })
    except PlaywrightTimeout:
        # No notebooks found or page structure different
        pass

    return notebooks


def create_notebook(page, name: str) -> bool:
    """Create a new notebook"""
    try:
        # Click create new notebook button
        create_btn = page.query_selector('button:has-text("Create new")')
        if not create_btn:
            create_btn = page.query_selector('[data-test-id="create-notebook-button"]')

        if create_btn:
            create_btn.click()
            time.sleep(2)

            # Enter notebook name if prompted
            name_input = page.query_selector('input[placeholder*="name"]')
            if name_input:
                name_input.fill(name)
                name_input.press('Enter')
                time.sleep(1)

            return True
    except Exception as e:
        print(f"Error creating notebook: {e}", file=sys.stderr)

    return False


def add_website_source(page, url: str) -> dict:
    """Add a website URL as a source"""
    try:
        # Click add source button
        add_btn = page.query_selector('button:has-text("Add source")')
        if not add_btn:
            add_btn = page.query_selector('[data-test-id="add-source-button"]')

        if not add_btn:
            return {"success": False, "error": "Could not find Add Source button"}

        add_btn.click()
        time.sleep(1)

        # Select website option
        website_option = page.query_selector('button:has-text("Website")')
        if not website_option:
            website_option = page.query_selector('[data-test-id="source-type-website"]')

        if not website_option:
            return {"success": False, "error": "Could not find Website option"}

        website_option.click()
        time.sleep(0.5)

        # Enter URL
        url_input = page.query_selector('input[type="url"], input[placeholder*="URL"]')
        if not url_input:
            url_input = page.query_selector('[data-test-id="website-url-input"]')

        if not url_input:
            return {"success": False, "error": "Could not find URL input"}

        url_input.fill(url)
        url_input.press('Enter')

        # Wait for source to be added
        time.sleep(3)

        return {"success": True, "url": url}

    except Exception as e:
        return {"success": False, "error": str(e)}


def add_file_source(page, file_path: str) -> dict:
    """Add a file as a source (PDF, TXT, etc.)"""
    try:
        if not os.path.exists(file_path):
            return {"success": False, "error": f"File not found: {file_path}"}

        # Click add source button
        add_btn = page.query_selector('button:has-text("Add source")')
        if not add_btn:
            add_btn = page.query_selector('[data-test-id="add-source-button"]')

        if not add_btn:
            return {"success": False, "error": "Could not find Add Source button"}

        add_btn.click()
        time.sleep(1)

        # Select file upload option
        file_option = page.query_selector('button:has-text("Upload")')
        if not file_option:
            file_option = page.query_selector('[data-test-id="source-type-upload"]')

        if file_option:
            file_option.click()
            time.sleep(0.5)

        # Handle file input
        file_input = page.query_selector('input[type="file"]')
        if file_input:
            file_input.set_input_files(file_path)
            time.sleep(5)  # Wait for upload
            return {"success": True, "file": file_path}
        else:
            return {"success": False, "error": "Could not find file input"}

    except Exception as e:
        return {"success": False, "error": str(e)}


def upload_sources(notebook_name: str, sources: List[dict], headless: bool = True) -> dict:
    """
    Upload multiple sources to a NotebookLM notebook

    sources: List of dicts with 'type' (website/file) and 'value' (url/path)
    """
    if not STATE_PATH.exists():
        return {
            "success": False,
            "error": "Not authenticated. Run authentication first."
        }

    results = {
        "success": True,
        "notebook": notebook_name,
        "uploaded": [],
        "failed": []
    }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(storage_state=str(STATE_PATH))
        page = context.new_page()

        try:
            # Navigate to NotebookLM
            page.goto(NOTEBOOKLM_URL)
            page.wait_for_load_state('networkidle')
            time.sleep(2)

            # Find or create notebook
            notebooks = get_notebooks(page)
            target_notebook = None

            for nb in notebooks:
                if nb['title'].lower() == notebook_name.lower():
                    target_notebook = nb
                    break

            if target_notebook:
                # Click on existing notebook
                target_notebook['element'].click()
                time.sleep(2)
            else:
                # Create new notebook
                if not create_notebook(page, notebook_name):
                    results["success"] = False
                    results["error"] = "Could not create notebook"
                    return results

            # Add each source
            for source in sources:
                source_type = source.get('type', 'website')
                value = source.get('value', '')

                if source_type == 'website':
                    result = add_website_source(page, value)
                elif source_type == 'file':
                    result = add_file_source(page, value)
                else:
                    result = {"success": False, "error": f"Unknown source type: {source_type}"}

                if result.get('success'):
                    results['uploaded'].append(value)
                else:
                    results['failed'].append({
                        "value": value,
                        "error": result.get('error', 'Unknown error')
                    })

                # Small delay between sources
                time.sleep(1)

        except Exception as e:
            results["success"] = False
            results["error"] = str(e)

        finally:
            # Save updated state
            context.storage_state(path=str(STATE_PATH))
            browser.close()

    return results


def list_notebooks(headless: bool = True) -> dict:
    """List all notebooks in NotebookLM"""
    if not STATE_PATH.exists():
        return {
            "success": False,
            "error": "Not authenticated. Run authentication first."
        }

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless)
        context = browser.new_context(storage_state=str(STATE_PATH))
        page = context.new_page()

        try:
            page.goto(NOTEBOOKLM_URL)
            page.wait_for_load_state('networkidle')
            time.sleep(3)

            notebooks = get_notebooks(page)
            titles = [nb['title'] for nb in notebooks]

            return {
                "success": True,
                "notebooks": titles,
                "count": len(titles)
            }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

        finally:
            browser.close()


def main():
    if len(sys.argv) < 2:
        print(json.dumps({
            "error": "Usage: notebooklm_upload.py <list|upload> [args...]"
        }))
        sys.exit(1)

    action = sys.argv[1]

    if action == "list":
        result = list_notebooks(headless=True)

    elif action == "upload":
        if len(sys.argv) < 4:
            print(json.dumps({
                "error": "Usage: notebooklm_upload.py upload <notebook_name> <sources_json>"
            }))
            sys.exit(1)

        notebook_name = sys.argv[2]
        sources_json = sys.argv[3]

        try:
            sources = json.loads(sources_json)
        except json.JSONDecodeError:
            # Try reading from file
            if os.path.exists(sources_json):
                with open(sources_json, 'r') as f:
                    sources = json.load(f)
            else:
                print(json.dumps({"error": "Invalid sources JSON"}))
                sys.exit(1)

        result = upload_sources(notebook_name, sources, headless=True)

    else:
        result = {"error": f"Unknown action: {action}"}

    print(json.dumps(result))


if __name__ == "__main__":
    main()
