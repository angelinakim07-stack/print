"""Secure first-admin setup command.

Usage (run once against the target deployment):
    cd backend && python create_first_admin.py

It refuses to run if an Admin already exists.
"""
import asyncio
import getpass

from db import db, now_utc
from security import hash_password


async def main():
    if await db.users.count_documents({"role": "Admin"}) > 0:
        print("An admin already exists. Aborting.")
        return
    email = input("Admin email: ").strip().lower()
    name = input("Admin name: ").strip() or "System Admin"
    password = getpass.getpass("Admin password (min 10 chars): ")
    if len(password) < 10:
        print("Password too short.")
        return
    await db.users.insert_one({
        "name": name, "email": email, "password_hash": hash_password(password),
        "role": "Admin", "permissions": {}, "active": True, "company": None,
        "phone": None, "created_at": now_utc(), "created_by": "cli",
    })
    print(f"Admin {email} created.")


if __name__ == "__main__":
    asyncio.run(main())
