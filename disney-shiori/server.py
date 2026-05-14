import hashlib
import http.server
import json
import os
import secrets
import socketserver
import sqlite3
from copy import deepcopy
from http import cookies
from urllib.parse import urlparse

PORT = int(os.environ.get('PORT', '8000'))
LEGACY_DATA_FILE = 'database.json'
DB_FILE = os.environ.get('DATABASE_FILE', 'dream_shiori.sqlite3')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD')
ADMIN_PASSWORD_HASH = os.environ.get('ADMIN_PASSWORD_HASH')
ADMIN_COOKIE_SECURE = os.environ.get('ADMIN_COOKIE_SECURE', '').lower() in ('1', 'true', 'yes')
ADMIN_SESSION_COOKIE = 'dream_admin_session'
USER_COOKIE = 'dream_user_id'
ADMIN_SESSION_TOKEN = secrets.token_urlsafe(32)

DEFAULT_DATA = {
    'parkHours': {'open': '09:00', 'close': '21:00'},
    'userNotes': [],
    'parks': {
        'land': {
            'masterEvents': [
                {'id': 1, 'name': 'ハーモニー・イン・カラー', 'times': ['12:45'], 'isLottery': True, 'imageUrl': '', 'duration': 45},
                {'id': 2, 'name': 'エレクトリカルパレード', 'times': ['18:15'], 'isLottery': False, 'imageUrl': '', 'duration': 45},
                {'id': 4, 'name': 'ジャンボリミッキー！', 'times': ['10:45', '12:00', '13:45', '15:00'], 'isLottery': True, 'imageUrl': '', 'duration': 15},
                {'id': 5, 'name': 'マジカルミュージックワールド', 'times': ['10:50', '12:15', '13:40', '15:45', '17:10'], 'isLottery': True, 'imageUrl': '', 'duration': 25},
                {'id': 6, 'name': 'クラブマウスビート', 'times': ['12:20', '13:45', '15:10', '17:15', '18:40'], 'isLottery': True, 'imageUrl': '', 'duration': 25},
            ],
            'dailySchedules': {},
            'plans': {},
        },
        'sea': {
            'masterEvents': [
                {'id': 3, 'name': 'リーチ・フォー・ザ・スターズ', 'times': ['17:50', '20:15'], 'isLottery': True, 'imageUrl': '', 'duration': 20},
                {'id': 7, 'name': 'ビリーヴ！〜シー・オブ・ドリームス〜', 'times': ['19:30'], 'isLottery': True, 'imageUrl': '', 'duration': 30},
            ],
            'dailySchedules': {},
            'plans': {},
        },
    },
}


def _connect():
    return sqlite3.connect(DB_FILE)


def _strip_plans(data):
    clean = deepcopy(data if data and data.get('parks') else DEFAULT_DATA)
    clean.pop('userNotes', None)
    for park_data in clean.get('parks', {}).values():
        park_data['plans'] = {}
    return clean


def _extract_plans(data):
    result = {}
    if not data or not data.get('parks'):
        return result
    for park_key, park_data in data['parks'].items():
        result[park_key] = park_data.get('plans') or {}
    return result


def _merge_user_plans(global_data, user_plans):
    data = deepcopy(global_data)
    for park_key, plans in (user_plans or {}).items():
        if park_key in data.get('parks', {}):
            data['parks'][park_key]['plans'] = plans or {}
    data['userNotes'] = get_user_notes(user_plans.get('_user_id')) if user_plans and user_plans.get('_user_id') else []
    return data


def init_db():
    with _connect() as con:
        con.execute('create table if not exists app_meta (key text primary key, value text not null)')
        con.execute(
            'create table if not exists user_plans ('
            'user_id text not null, '
            'park text not null, '
            'date text not null, '
            'plans_json text not null, '
            'updated_at text not null default current_timestamp, '
            'primary key (user_id, park, date))'
        )
        con.execute(
            'create table if not exists user_state ('
            'user_id text primary key, '
            'notes_json text not null, '
            'updated_at text not null default current_timestamp)'
        )
        existing = con.execute("select value from app_meta where key = 'global_data'").fetchone()
        if existing:
            return
        data = deepcopy(DEFAULT_DATA)
        if os.path.exists(LEGACY_DATA_FILE):
            try:
                with open(LEGACY_DATA_FILE, 'r', encoding='utf-8') as f:
                    legacy = json.load(f)
                if legacy.get('parks'):
                    data = legacy
            except (OSError, json.JSONDecodeError):
                pass
        con.execute(
            "insert or replace into app_meta (key, value) values ('global_data', ?)",
            (json.dumps(_strip_plans(data), ensure_ascii=False),),
        )


def get_global_data():
    with _connect() as con:
        row = con.execute("select value from app_meta where key = 'global_data'").fetchone()
    if not row:
        return _strip_plans(DEFAULT_DATA)
    try:
        return _strip_plans(json.loads(row[0]))
    except json.JSONDecodeError:
        return _strip_plans(DEFAULT_DATA)


def save_global_data(data):
    with _connect() as con:
        con.execute(
            "insert or replace into app_meta (key, value) values ('global_data', ?)",
            (json.dumps(_strip_plans(data), ensure_ascii=False),),
        )


def get_user_plans(user_id):
    plans = {'land': {}, 'sea': {}, '_user_id': user_id}
    with _connect() as con:
        rows = con.execute(
            'select park, date, plans_json from user_plans where user_id = ?',
            (user_id,),
        ).fetchall()
    for park, date, plans_json in rows:
        if park not in plans:
            plans[park] = {}
        try:
            plans[park][date] = json.loads(plans_json)
        except json.JSONDecodeError:
            plans[park][date] = []
    return plans


def get_user_notes(user_id):
    if not user_id:
        return []
    with _connect() as con:
        row = con.execute('select notes_json from user_state where user_id = ?', (user_id,)).fetchone()
    if not row:
        return []
    try:
        notes = json.loads(row[0])
        return notes if isinstance(notes, list) else []
    except json.JSONDecodeError:
        return []


def save_user_plans(user_id, plans_by_park):
    with _connect() as con:
        for park, plans_by_date in (plans_by_park or {}).items():
            if park not in ('land', 'sea'):
                continue
            con.execute('delete from user_plans where user_id = ? and park = ?', (user_id, park))
            for date, plans in (plans_by_date or {}).items():
                con.execute(
                    'insert or replace into user_plans (user_id, park, date, plans_json, updated_at) '
                    'values (?, ?, ?, ?, current_timestamp)',
                    (user_id, park, date, json.dumps(plans or [], ensure_ascii=False)),
                )


def save_user_notes(user_id, notes):
    clean_notes = notes if isinstance(notes, list) else []
    with _connect() as con:
        con.execute(
            'insert or replace into user_state (user_id, notes_json, updated_at) values (?, ?, current_timestamp)',
            (user_id, json.dumps(clean_notes[:100], ensure_ascii=False)),
        )


def make_cookie(name, value, max_age=None, http_only=True):
    parts = [f'{name}={value}', 'Path=/', 'SameSite=Lax']
    if max_age is not None:
        parts.append(f'Max-Age={max_age}')
    if http_only:
        parts.append('HttpOnly')
    if ADMIN_COOKIE_SECURE:
        parts.append('Secure')
    return '; '.join(parts)


def verify_admin_password(password):
    if ADMIN_PASSWORD_HASH:
        try:
            algorithm, iterations, salt, expected = ADMIN_PASSWORD_HASH.split('$', 3)
            if algorithm != 'pbkdf2_sha256':
                return False
            digest = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), int(iterations)).hex()
            return secrets.compare_digest(digest, expected)
        except (ValueError, TypeError):
            return False
    return bool(ADMIN_PASSWORD and secrets.compare_digest(password, ADMIN_PASSWORD))


class JSONDataHandler(http.server.SimpleHTTPRequestHandler):
    def _send_json(self, status, payload, extra_headers=None):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        if extra_headers:
            for key, value in extra_headers.items():
                if isinstance(value, list):
                    for item in value:
                        self.send_header(key, item)
                else:
                    self.send_header(key, value)
        self.end_headers()
        self.wfile.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))

    def _cookies(self):
        jar = cookies.SimpleCookie()
        try:
            jar.load(self.headers.get('Cookie', ''))
        except cookies.CookieError:
            pass
        return jar

    def _is_admin_authenticated(self):
        morsel = self._cookies().get(ADMIN_SESSION_COOKIE)
        return bool(morsel and secrets.compare_digest(morsel.value, ADMIN_SESSION_TOKEN))

    def _user_id_and_cookie(self):
        morsel = self._cookies().get(USER_COOKIE)
        if morsel and len(morsel.value) >= 24:
            return morsel.value, None
        user_id = secrets.token_urlsafe(24)
        return user_id, make_cookie(USER_COOKIE, user_id, max_age=60 * 60 * 24 * 365 * 2)

    def _read_json_body(self):
        content_length = int(self.headers.get('Content-Length', 0))
        if content_length <= 0:
            return {}
        try:
            return json.loads(self.rfile.read(content_length).decode('utf-8'))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None

    def do_GET(self):
        parsed_path = urlparse(self.path).path
        if parsed_path == '/api/data':
            user_id, user_cookie = self._user_id_and_cookie()
            payload = _merge_user_plans(get_global_data(), get_user_plans(user_id))
            headers = {'Set-Cookie': user_cookie} if user_cookie else None
            self._send_json(200, payload, headers)
        elif parsed_path == '/api/admin/status':
            self._send_json(200, {
                'available': bool(ADMIN_PASSWORD or ADMIN_PASSWORD_HASH),
                'authenticated': self._is_admin_authenticated(),
            })
        else:
            return super().do_GET()

    def do_POST(self):
        parsed_path = urlparse(self.path).path
        if parsed_path == '/api/data':
            body = self._read_json_body()
            if body is None or not body.get('parks'):
                self._send_json(400, {'status': 'error', 'message': 'Invalid data.'})
                return

            user_id, user_cookie = self._user_id_and_cookie()
            if self._is_admin_authenticated():
                save_global_data(body)
            else:
                save_user_plans(user_id, _extract_plans(body))
                save_user_notes(user_id, body.get('userNotes') or [])

            headers = {'Set-Cookie': user_cookie} if user_cookie else None
            self._send_json(200, {'status': 'success'}, headers)
        elif parsed_path == '/api/admin/login':
            if not (ADMIN_PASSWORD or ADMIN_PASSWORD_HASH):
                self._send_json(403, {'ok': False, 'message': 'Admin mode is not configured.'})
                return
            body = self._read_json_body()
            if body is None:
                self._send_json(400, {'ok': False, 'message': 'Invalid JSON.'})
                return
            password = str(body.get('password', ''))
            if not verify_admin_password(password):
                self._send_json(401, {'ok': False, 'message': 'Invalid password.'})
                return
            self._send_json(200, {'ok': True}, {
                'Set-Cookie': make_cookie(ADMIN_SESSION_COOKIE, ADMIN_SESSION_TOKEN),
            })
        elif parsed_path == '/api/admin/logout':
            self._send_json(200, {'ok': True}, {
                'Set-Cookie': make_cookie(ADMIN_SESSION_COOKIE, '', max_age=0),
            })
        else:
            self.send_response(404)
            self.end_headers()


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


os.chdir(os.path.dirname(os.path.abspath(__file__)) or '.')
init_db()

print(f"Starting server. Please open http://localhost:{PORT}/index.html in your browser.")
if ADMIN_PASSWORD or ADMIN_PASSWORD_HASH:
    print("Admin mode is enabled. Open /index.html?admin=true to log in.")
else:
    print("Admin mode is disabled. Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH to enable it.")
with ReusableTCPServer(("", PORT), JSONDataHandler) as httpd:
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
