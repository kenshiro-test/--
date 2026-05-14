import getpass
import hashlib
import secrets

password = getpass.getpass('Admin password: ')
confirm = getpass.getpass('Confirm password: ')

if password != confirm:
    raise SystemExit('Passwords do not match.')

if len(password) < 14:
    raise SystemExit('Use at least 14 characters for the admin password.')

iterations = 260000
salt = secrets.token_urlsafe(16)
digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), iterations).hex()

print(f'ADMIN_PASSWORD_HASH=pbkdf2_sha256${iterations}${salt}${digest}')
