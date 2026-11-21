"""HTTP Basic authentication with salted PBKDF2 password hashes (standard library only)."""

import base64
import binascii
import hashlib
import hmac
import os
import re
import uuid

from fastapi import Depends, Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session as DBSession

from .db import get_db
from .models import User

ITERATIONS = 200_000
USERNAME_RE = re.compile(r"^[A-Za-z0-9_.-]{3,32}$")
MIN_PASSWORD_LEN = 6

# Verified Basic-auth header -> user id. Avoids re-running PBKDF2 on every request.
# Cleared when it grows too big. No password change or user deletion exists yet, so entries stay valid.
_verified: dict[str, uuid.UUID] = {}
_VERIFIED_MAX = 1000


def validate_new_account(username: str, password: str) -> None:
    if not USERNAME_RE.match(username):
        raise HTTPException(400, "Tên đăng nhập 3-32 ký tự: chữ, số, _ . -")
    if len(password) < MIN_PASSWORD_LEN:
        raise HTTPException(400, f"Mật khẩu cần ít nhất {MIN_PASSWORD_LEN} ký tự")


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, ITERATIONS)
    return f"pbkdf2_sha256${ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iterations, salt_hex, digest_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except ValueError:
        return False


def parse_basic(authorization: str | None) -> tuple[str, str] | None:
    if not authorization or not authorization.lower().startswith("basic "):
        return None
    try:
        raw = base64.b64decode(authorization[6:].strip(), validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return None
    if ":" not in raw:
        return None
    username, password = raw.split(":", 1)
    return username, password


def current_user(
    authorization: str | None = Header(default=None),
    db: DBSession = Depends(get_db),
) -> User:
    # No WWW-Authenticate header on purpose: it would make the browser show its own login popup.
    creds_key = hashlib.sha256((authorization or "").encode("utf-8")).hexdigest()
    cached_id = _verified.get(creds_key)
    if cached_id is not None:
        user = db.get(User, cached_id)
        if user is not None:
            return user

    creds = parse_basic(authorization)
    if not creds:
        raise HTTPException(401, "Cần đăng nhập")
    username, password = creds
    user = db.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(password, user.password_hash):
        raise HTTPException(401, "Sai tên đăng nhập hoặc mật khẩu")

    if len(_verified) >= _VERIFIED_MAX:
        _verified.clear()
    _verified[creds_key] = user.id
    return user
