"""Software encryption using `cryptography.fernet`.

Used to encrypt the watsonx API key at rest in the deployed environment.
Production migration target is IBM Cloud HPCS on IBM Z LinuxONE (FIPS 140-2
Level 4) — the call surface stays the same, so the swap is a single import.

CLI:
    uv run tavi-encrypt WATSONX_API_KEY
        prints the FERNET_MASTER_KEY (set as env var) and the encrypted blob
        (set as WATSONX_API_KEY_ENCRYPTED).
"""

from __future__ import annotations

import os
import sys

from cryptography.fernet import Fernet
from loguru import logger

ENV_MASTER_KEY = "FERNET_MASTER_KEY"


def generate_master_key() -> bytes:
    """Generate a new Fernet master key (URL-safe base64-encoded 32 bytes)."""
    return Fernet.generate_key()


def encrypt_secret(plaintext: str, master_key: bytes | None = None) -> str:
    """Encrypt a secret. Returns base64 ciphertext suitable for env-var storage."""
    if master_key is None:
        env = os.environ.get(ENV_MASTER_KEY)
        if not env:
            raise RuntimeError(
                f"{ENV_MASTER_KEY} not set; generate one via `tavi-encrypt --new-key`."
            )
        master_key = env.encode()
    f = Fernet(master_key)
    return f.encrypt(plaintext.encode()).decode()


def decrypt_secret(ciphertext: str, master_key: bytes | None = None) -> str:
    """Decrypt a secret previously encrypted with `encrypt_secret`."""
    if master_key is None:
        env = os.environ.get(ENV_MASTER_KEY)
        if not env:
            raise RuntimeError(f"{ENV_MASTER_KEY} not set; cannot decrypt.")
        master_key = env.encode()
    f = Fernet(master_key)
    return f.decrypt(ciphertext.encode()).decode()


def unwrap_at_startup(encrypted_blob: str | None, plaintext_fallback: str | None) -> str:
    """Resolve the watsonx API key at app startup.

    Order: encrypted blob → plaintext env var → empty string.
    Logs a warning if plaintext is used (development only).
    """
    if encrypted_blob:
        try:
            return decrypt_secret(encrypted_blob)
        except Exception as exc:  # noqa: BLE001
            logger.error(f"failed to decrypt WATSONX_API_KEY_ENCRYPTED: {exc}")
    if plaintext_fallback:
        logger.warning(
            "using plaintext WATSONX_API_KEY (development mode). "
            "Set WATSONX_API_KEY_ENCRYPTED + FERNET_MASTER_KEY in production."
        )
        return plaintext_fallback
    return ""


def main() -> None:
    """`tavi-encrypt` CLI entrypoint."""
    args = sys.argv[1:]
    if not args or args[0] in ("-h", "--help"):
        print("Usage:")
        print("  tavi-encrypt --new-key             # generate a new master key")
        print("  tavi-encrypt <env-var-name>        # encrypt the value of env var")
        print("  tavi-encrypt --plaintext <secret>  # encrypt a literal string")
        sys.exit(0)

    if args[0] == "--new-key":
        print(generate_master_key().decode())
        return

    if args[0] == "--plaintext" and len(args) >= 2:
        secret = args[1]
    else:
        env_name = args[0]
        secret = os.environ.get(env_name, "")
        if not secret:
            print(f"env var {env_name} is empty or unset", file=sys.stderr)
            sys.exit(1)

    if not os.environ.get(ENV_MASTER_KEY):
        print(f"{ENV_MASTER_KEY} not set; run with --new-key first", file=sys.stderr)
        sys.exit(1)

    print(encrypt_secret(secret))


if __name__ == "__main__":
    main()
