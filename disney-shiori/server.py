import hashlib
import base64
import html
import http.server
import json
import os
import re
import secrets
import socketserver
import sqlite3
from copy import deepcopy
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
from http import cookies
from urllib.parse import urlparse
from urllib import request
from urllib.error import HTTPError, URLError

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
    'importHistory': [],
    'parks': {
        'land': {
            'masterEvents': [
                {'id': 1, 'name': 'ハーモニー・イン・カラー', 'times': ['12:45'], 'isLottery': True, 'imageUrl': '', 'duration': 45, 'description': '', 'officialUrl': '', 'area': '', 'features': ''},
                {'id': 2, 'name': 'エレクトリカルパレード', 'times': ['18:15'], 'isLottery': False, 'imageUrl': '', 'duration': 45, 'description': '', 'officialUrl': '', 'area': '', 'features': ''},
                {'id': 4, 'name': 'ジャンボリミッキー！', 'times': ['10:45', '12:00', '13:45', '15:00'], 'isLottery': True, 'imageUrl': '', 'duration': 15, 'description': '', 'officialUrl': '', 'area': '', 'features': ''},
                {'id': 5, 'name': 'マジカルミュージックワールド', 'times': ['10:50', '12:15', '13:40', '15:45', '17:10'], 'isLottery': True, 'imageUrl': '', 'duration': 25, 'description': '', 'officialUrl': '', 'area': '', 'features': ''},
                {'id': 6, 'name': 'クラブマウスビート', 'times': ['12:20', '13:45', '15:10', '17:15', '18:40'], 'isLottery': True, 'imageUrl': '', 'duration': 25, 'description': '', 'officialUrl': '', 'area': '', 'features': ''},
            ],
            'dailySchedules': {},
            'plans': {},
        },
        'sea': {
            'masterEvents': [
                {'id': 3, 'name': 'リーチ・フォー・ザ・スターズ', 'times': ['17:50', '20:15'], 'isLottery': True, 'imageUrl': '', 'duration': 20, 'description': '', 'officialUrl': '', 'area': '', 'features': ''},
                {'id': 7, 'name': 'ビリーヴ！〜シー・オブ・ドリームス〜', 'times': ['19:30'], 'isLottery': True, 'imageUrl': '', 'duration': 30, 'description': '', 'officialUrl': '', 'area': '', 'features': ''},
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


def _now_iso():
    return datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')


def _ensure_history(data):
    if not isinstance(data.get('importHistory'), list):
        data['importHistory'] = []
    return data['importHistory']


def _extract_meta(content, property_name):
    pattern = re.compile(
        r'<meta[^>]+(?:property|name)=["\']' + re.escape(property_name) + r'["\'][^>]+content=["\']([^"\']*)["\']',
        re.IGNORECASE,
    )
    match = pattern.search(content)
    return html.unescape(match.group(1)).strip() if match else ''


def _fetch_official_fields(url):
    last_error = None
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
                      '(KHTML, like Gecko) Chrome/125.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Connection': 'close',
    }
    for attempt in range(2):
        try:
            req = request.Request(url, headers=headers)
            with request.urlopen(req, timeout=12) as res:
                raw = res.read(700000)
            content = raw.decode('utf-8', errors='ignore')
            description = _extract_meta(content, 'description') or _extract_meta(content, 'og:description')
            title = _extract_meta(content, 'og:title')
            return {'description': description, 'title': title, 'attempts': attempt + 1}
        except HTTPError as exc:
            last_error = f'HTTP {exc.code}'
            if exc.code in (403, 404):
                break
        except URLError as exc:
            last_error = getattr(exc, 'reason', exc)
        except TimeoutError:
            last_error = '通信タイムアウト'
        except Exception as exc:
            last_error = exc
    raise RuntimeError(str(last_error or '取得できませんでした'))


def run_official_import():
    data = get_global_data()
    history = _ensure_history(data)
    updated = []
    unchanged = []
    failed = []
    targets = []
    for park_key, park_data in data.get('parks', {}).items():
        for show in park_data.get('masterEvents', []):
            official_url = show.get('officialUrl') or ''
            if not official_url:
                continue
            targets.append((park_key, show, official_url))

    def fetch_target(target):
        park_key, show, official_url = target
        fields = _fetch_official_fields(official_url)
        return park_key, show, official_url, fields

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = {executor.submit(fetch_target, target): target for target in targets}
        for future in as_completed(futures):
            park_key, show, official_url = futures[future]
            try:
                _, _, _, fields = future.result()
                changed = []
                if fields.get('description') and fields['description'] != show.get('description'):
                    show['description'] = fields['description']
                    changed.append('説明文')
                item = {
                    'park': park_key,
                    'show': show.get('name', ''),
                    'url': official_url,
                    'fields': changed or ['確認のみ'],
                    'attempts': fields.get('attempts', 1),
                }
                if changed:
                    updated.append(item)
                else:
                    unchanged.append(item)
            except Exception as exc:
                failed.append({
                    'park': park_key,
                    'show': show.get('name', ''),
                    'url': official_url,
                    'error': str(exc)[:180],
                })
    record = {
        'id': secrets.token_urlsafe(8),
        'ranAt': _now_iso(),
        'source': '管理者画面の公式サイト取り込み',
        'imported': updated + unchanged,
        'updated': updated,
        'unchanged': unchanged,
        'failed': failed,
        'summary': f'{len(updated)}件更新 / {len(unchanged)}件更新なし / {len(failed)}件失敗',
    }
    history.insert(0, record)
    del history[30:]
    save_global_data(data)
    return record


def save_uploaded_show_image(body):
    data_url = body.get('dataUrl') or ''
    name = body.get('name') or 'show-image'
    match = re.match(r'^data:image/(png|jpeg|jpg|webp);base64,(.+)$', data_url)
    if not match:
        raise ValueError('Invalid image data.')
    ext = 'jpg' if match.group(1) in ('jpeg', 'jpg') else match.group(1)
    raw = base64.b64decode(match.group(2), validate=True)
    if len(raw) > 6 * 1024 * 1024:
        raise ValueError('Image is too large.')
    safe = re.sub(r'[^a-zA-Z0-9_-]+', '-', name).strip('-').lower()[:40] or 'show-image'
    os.makedirs(os.path.join('assets', 'show-images'), exist_ok=True)
    filename = f'admin-{safe}-{secrets.token_urlsafe(6)}.{ext}'
    path = os.path.join('assets', 'show-images', filename)
    with open(path, 'wb') as f:
        f.write(raw)
    return '/' + path.replace(os.sep, '/')


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
        elif parsed_path == '/api/admin/import-history':
            if not self._is_admin_authenticated():
                self._send_json(401, {'ok': False, 'message': 'Admin login required.'})
                return
            data = get_global_data()
            self._send_json(200, {'ok': True, 'history': data.get('importHistory') or []})
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
        elif parsed_path == '/api/admin/upload-image':
            if not self._is_admin_authenticated():
                self._send_json(401, {'ok': False, 'message': 'Admin login required.'})
                return
            body = self._read_json_body()
            if body is None:
                self._send_json(400, {'ok': False, 'message': 'Invalid JSON.'})
                return
            try:
                image_url = save_uploaded_show_image(body)
            except ValueError as exc:
                self._send_json(400, {'ok': False, 'message': str(exc)})
                return
            self._send_json(200, {'ok': True, 'imageUrl': image_url})
        elif parsed_path == '/api/admin/import-official':
            if not self._is_admin_authenticated():
                self._send_json(401, {'ok': False, 'message': 'Admin login required.'})
                return
            try:
                record = run_official_import()
            except Exception as exc:
                self._send_json(500, {'ok': False, 'message': str(exc)})
                return
            self._send_json(200, {'ok': True, 'record': record})
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
