"""List all watsonx.ai projects in the account, with their compute associations.

The "right" project for our app is one in au-syd that has a watsonx.ai Runtime
attached. The script highlights that.

Run from api/:
    uv run python scripts/list_projects.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

from dotenv import load_dotenv
import httpx

load_dotenv()


def iam_token() -> str:
    api_key = os.environ.get("WATSONX_API_KEY", "")
    try:
        out = subprocess.check_output(
            ["ibmcloud", "iam", "oauth-tokens", "--output", "json"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        return json.loads(out)["iam_token"]
    except Exception:
        pass
    res = httpx.post(
        "https://iam.cloud.ibm.com/identity/token",
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": api_key,
        },
        timeout=15,
    )
    res.raise_for_status()
    return f"Bearer {res.json()['access_token']}"


def main() -> int:
    token = iam_token()

    # Try both global and regional endpoints
    endpoints = [
        ("global v2", "https://api.dataplatform.cloud.ibm.com/v2/projects"),
        ("au-syd v2", "https://api.au-syd.dataplatform.cloud.ibm.com/v2/projects"),
        ("au-syd dai v2", "https://au-syd.dai.cloud.ibm.com/v2/projects"),
    ]
    projects: list = []
    for name, url in endpoints:
        try:
            res = httpx.get(url, headers={"Authorization": token}, params={"limit": 100}, timeout=20)
            print(f"  {name}: HTTP {res.status_code}", end="")
            if res.status_code == 200:
                got = res.json().get("resources", [])
                print(f" → {len(got)} project(s)")
                projects.extend(got)
                if got:
                    break
            else:
                print(f" → {res.text[:80]}")
        except Exception as e:
            print(f"  {name}: {type(e).__name__} {str(e)[:80]}")
    print()

    if not projects:
        print("No projects found.")
        print()
        print("Create a watsonx.ai project at:")
        print("  https://au-syd.dai.cloud.ibm.com/projects/?context=cpdaas")
        print("Then click '+ New service' in its Manage > Services & integrations page,")
        print("pick 'watsonx.ai Runtime' Lite plan in au-syd, and re-run this script.")
        return 1

    print(f"Found {len(projects)} project(s) in your account:\n")

    candidate: dict | None = None
    for p in projects:
        meta = p.get("metadata", {})
        ent = p.get("entity", {})
        pid = meta.get("guid", "")
        region = meta.get("region", "?")
        name = ent.get("name", "")
        compute = ent.get("compute") or []
        wml = [c for c in compute if "wml" in (c.get("type") or "").lower() or "machine_learning" in (c.get("type") or "").lower() or "watsonx" in (c.get("name") or "").lower()]
        marker = "✓" if wml and region == "au-syd" else " "
        print(f"  [{marker}] {name}")
        print(f"       id:      {pid}")
        print(f"       region:  {region}")
        print(f"       compute: {', '.join(c.get('name','?') for c in compute) or 'NONE'}")
        print()
        if marker == "✓" and candidate is None:
            candidate = p

    if candidate:
        cid = candidate["metadata"]["guid"]
        print(f"USE THIS ONE → set WATSONX_PROJECT_ID={cid} in api/.env")
    else:
        print("No project has a watsonx.ai Runtime attached in au-syd yet.")
        print()
        print("Pick one of the projects above (or create a new one), open it in the browser,")
        print("then click '+ New service' on its Services & integrations page, pick")
        print("'watsonx.ai Runtime' Lite plan in au-syd. Re-run this script after.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
