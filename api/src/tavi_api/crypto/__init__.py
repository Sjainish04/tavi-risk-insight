"""Credential encryption layer.

Hackathon scope: software Fernet (AES-128 in CBC + HMAC-SHA256). Production
target: IBM Cloud Hyper Protect Crypto Services on IBM Z LinuxONE — see
HACKATHON_PLAN.md "IBM Z positioning" for the migration path.
"""

from tavi_api.crypto.fernet_fallback import (
    decrypt_secret,
    encrypt_secret,
    generate_master_key,
)

__all__ = ["encrypt_secret", "decrypt_secret", "generate_master_key"]
