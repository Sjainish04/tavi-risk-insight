"""Decode the IAM token to figure out which account the API key belongs to.

Run from api/:
    uv run python scripts/check_account.py
"""

from __future__ import annotations

import base64
import json
import os
import sys

import httpx
from dotenv import load_dotenv

load_dotenv()

UOFT_ACCOUNT_ID = "1ba6ad8570a341e3aa218603f290c8c3"


def main() -> int:
    api_key = os.environ.get("WATSONX_API_KEY", "")
    if not api_key:
        print("WATSONX_API_KEY not set in api/.env")
        return 1

    res = httpx.post(
        "https://iam.cloud.ibm.com/identity/token",
        data={
            "grant_type": "urn:ibm:params:oauth:grant-type:apikey",
            "apikey": api_key,
        },
        timeout=15,
    )
    if res.status_code != 200:
        print(f"IAM token exchange failed: {res.status_code}")
        print(res.text[:300])
        return 2

    access_token = res.json()["access_token"]

    # Decode the JWT payload (base64 decode middle segment, no signature verify)
    parts = access_token.split(".")
    payload = parts[1] + "=" * (-len(parts[1]) % 4)
    claims = json.loads(base64.urlsafe_b64decode(payload))

    account_id = claims.get("account", {}).get("bss", "?")
    email = claims.get("email", "?")
    iam_id = claims.get("iam_id", "?")
    sub = claims.get("sub", "?")

    print("=" * 60)
    print("Identity behind the WATSONX_API_KEY:")
    print("=" * 60)
    print(f"  Email:      {email}")
    print(f"  IAM ID:     {iam_id}")
    print(f"  sub:        {sub}")
    print(f"  Account ID: {account_id}")
    print()
    if account_id == UOFT_ACCOUNT_ID:
        print(f"  Status: ✓ This key IS in the UofT account")
        print()
        print("  But the projects list returned 0. Possible reasons:")
        print("  (a) the project was created on a different account in the browser")
        print("  (b) the project hasn't fully provisioned yet — wait 30s and re-run list_projects.py")
        print("  (c) the project was created without 'storage' completing — try opening it in the browser to check")
    else:
        print(f"  Status: ✗ This key is NOT in UofT (UofT id = {UOFT_ACCOUNT_ID})")
        print()
        print("  Fix: create a fresh API key from inside the UofT account context.")
        print("  1. https://cloud.ibm.com — top-right account dropdown — switch to 'UofT'")
        print("  2. Click your avatar (top right) → API keys → Create →")
        print("     name it 'tavi-hackathon' → Create → copy the new key")
        print("  3. Update WATSONX_API_KEY in api/.env")
        print("  4. Re-run scripts/list_projects.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
