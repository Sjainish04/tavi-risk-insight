"""Print the resource group + region of the watsonx.ai project.

This tells us whether the project is in the same resource group as the
WML runtimes (which is the most common cause of the "associate" failure).

Run from api/:
    uv run python scripts/check_project_rg.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys

from dotenv import load_dotenv
import httpx

load_dotenv()


def get_iam_token() -> str:
    """Get an IAM token by exchanging the watsonx API key with IBM Cloud IAM."""
    api_key = os.environ.get("WATSONX_API_KEY", "")
    if not api_key:
        print("WATSONX_API_KEY not set", file=sys.stderr)
        sys.exit(1)

    # Try ibmcloud CLI first (faster if logged in)
    try:
        out = subprocess.check_output(
            ["ibmcloud", "iam", "oauth-tokens", "--output", "json"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
        token = json.loads(out).get("iam_token", "")
        if token:
            return token
    except Exception:
        pass

    # Fall back to direct IAM exchange
    res = httpx.post(
        "https://iam.cloud.ibm.com/identity/token",
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": api_key,
        },
        timeout=15.0,
    )
    res.raise_for_status()
    return f"Bearer {res.json()['access_token']}"


def main() -> int:
    project_id = os.environ.get("WATSONX_PROJECT_ID", "")
    if not project_id:
        print("WATSONX_PROJECT_ID not set", file=sys.stderr)
        return 1

    token = get_iam_token()
    res = httpx.get(
        f"https://api.dataplatform.cloud.ibm.com/v2/projects/{project_id}",
        headers={"Authorization": token},
        timeout=15.0,
    )
    if res.status_code != 200:
        print(f"FAILED: {res.status_code}\n{res.text[:500]}")
        return 2

    data = res.json()
    entity = data.get("entity", {})
    print(f"Name:               {entity.get('name')}")
    print(f"Region (storage):   {entity.get('storage', {}).get('properties', {}).get('bucket_region')}")
    print(f"Region (project):   {data.get('metadata', {}).get('region')}")
    print(f"Resource group ID:  {entity.get('settings', {}).get('access_restrictions', {}).get('resource_group_id') or 'not set on project'}")
    print()
    print(f"Compute resources associated to project:")
    compute = entity.get("compute") or []
    if not compute:
        print("  NONE — this is the bug. Click '+ Associate service' / '+ New service' in the project.")
    for c in compute:
        print(f"  - {c.get('name')} ({c.get('type')}) → guid {c.get('guid')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
