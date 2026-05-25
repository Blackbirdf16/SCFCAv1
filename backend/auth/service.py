"""
Authentication service layer for SCFCA PoC.
Verifies password hashes and fetches user from DB.
"""
from backend.core.database import SessionLocal
from backend.core.models import User
from passlib.context import CryptContext
from types import SimpleNamespace
from backend.auth.schemas import Role

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def authenticate_user(username: str, password: str):
    try:
        db = SessionLocal()
        user = db.query(User).filter(User.username == username).first()
        db.close()
        if user and pwd_context.verify(password, user.password_hash):
            return user
        return None
    except Exception:
        # Fallback for environments without a reachable DB (development only).
        # Prefer DB-backed auth. When DB is unavailable, accept the canonical
        # demo users with known plaintext passwords to allow local smoke tests.
        demo = {
            "alice": ("alice123", Role.regular),
            "bob": ("bob123", Role.administrator),
            "eve": ("eve123", Role.administrator),
            "carol": ("carol123", Role.auditor),
            "mark": ("mark123", Role.regular),
            "john": ("john123", Role.regular),
        }
        entry = demo.get(username)
        if entry and password == entry[0]:
            # Return a lightweight object mimicking the ORM user
            return SimpleNamespace(username=username, role=entry[1])
        return None
