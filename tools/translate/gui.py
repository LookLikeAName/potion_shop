"""
翻譯工具的網頁介面（只在本機執行，用標準函式庫的 http.server）。

  python tools/translate/gui.py            打開 http://127.0.0.1:8765
  python tools/translate/gui.py --port 9000 --no-browser

API 金鑰：優先用環境變數（config.json 的 api_key_env）；也可以在網頁上輸入，只存在記憶體裡、不寫進檔案。
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import core

TARGET_LANGS = [l for l in core.LANG_NAMES if l != core.SOURCE_LANG]


class Job:
    """背景翻譯工作（一次只跑一個）"""

    def __init__(self):
        self.lock = threading.Lock()
        self.running = False
        self.stopping = False
        self.log = []
        self.done = 0
        self.total = 0
        self.lang = ''

    def snapshot(self) -> dict:
        with self.lock:
            return {'running': self.running, 'log': self.log[-300:], 'done': self.done, 'total': self.total, 'lang': self.lang}

    def start(self, lang: str, keys, cfg: dict, api_key: str) -> bool:
        with self.lock:
            if self.running:
                return False
            self.running, self.stopping = True, False
            self.log, self.done, self.total, self.lang = [], 0, len(keys), lang
        threading.Thread(target=self._run, args=(lang, keys, cfg, api_key), daemon=True).start()
        return True

    def _run(self, lang, keys, cfg, api_key):
        def log(s):
            with self.lock:
                self.log.append(s)

        def progress(a, b):
            with self.lock:
                self.done, self.total = a, b

        try:
            core.translate(lang, keys, cfg, api_key, log=log, progress=progress, stop=lambda: self.stopping)
        except Exception as e:  # noqa: BLE001 — 任何錯誤都顯示在網頁上
            log('錯誤：{}'.format(e))
        finally:
            with self.lock:
                self.running = False


JOB = Job()
SESSION = {'api_key': ''}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, code: int, body: bytes, ctype: str) -> None:
        self.send_response(code)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data, code: int = 200) -> None:
        self._send(code, json.dumps(data, ensure_ascii=False).encode('utf-8'), 'application/json; charset=utf-8')

    def _body(self) -> dict:
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n).decode('utf-8') or '{}') if n else {}

    def do_GET(self):
        url = urlparse(self.path)
        q = {k: v[0] for k, v in parse_qs(url.query).items()}
        if url.path == '/':
            self._send(200, (core.HERE / 'gui.html').read_bytes(), 'text/html; charset=utf-8')
        elif url.path == '/api/meta':
            cfg = core.load_config()
            self._json({
                'langs': [{'id': l, 'name': core.LANG_NAMES[l]} for l in TARGET_LANGS],
                'config': cfg,
                'hasKey': bool(SESSION['api_key'] or core.api_key_from_env(cfg)),
                'keySource': 'env' if core.api_key_from_env(cfg) else ('session' if SESSION['api_key'] else ''),
            })
        elif url.path == '/api/rows':
            self._json(core.rows(q.get('lang', 'ja')))
        elif url.path == '/api/job':
            self._json(JOB.snapshot())
        elif url.path == '/api/preview':
            # 看某一段實際送出的提示詞（調整術語表、風格說明時用）
            lang, key = q.get('lang', 'ja'), q.get('key', '')
            src = core.Catalog(core.SOURCE_LANG).entries()
            if key not in src:
                self._json({'error': 'no such key'}, 404)
                return
            self._json(core.build_messages(lang, [(key, src[key])]))
        else:
            self._json({'error': 'not found'}, 404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._body()
        except ValueError:
            self._json({'error': 'bad json'}, 400)
            return
        if path == '/api/config':
            cfg = core.load_config()
            for k, v in (body.get('config') or {}).items():
                if k in core.DEFAULT_CONFIG:
                    cfg[k] = type(core.DEFAULT_CONFIG[k])(v)
            core.save_config(cfg)
            if 'apiKey' in body:
                SESSION['api_key'] = (body.get('apiKey') or '').strip()
            self._json({'ok': True})
        elif path == '/api/translate':
            lang = body['lang']
            cfg = core.load_config()
            api_key = SESSION['api_key'] or core.api_key_from_env(cfg)
            if not api_key:
                self._json({'error': '沒有 API 金鑰：請設定環境變數 {} 或在上方輸入'.format(cfg['api_key_env'])}, 400)
                return
            keys = body.get('keys') or core.pending_keys(lang)
            if not keys:
                self._json({'error': '沒有需要翻譯的文字'}, 400)
                return
            if not JOB.start(lang, keys, cfg, api_key):
                self._json({'error': '已經有翻譯在進行中'}, 409)
                return
            self._json({'ok': True, 'count': len(keys)})
        elif path == '/api/stop':
            JOB.stopping = True
            self._json({'ok': True})
        elif path == '/api/set':
            try:
                issues = core.set_translation(body['lang'], body['key'], body['value'], locked=body.get('locked'))
            except KeyError:
                self._json({'error': 'no such key'}, 404)
                return
            self._json({'ok': True, 'issues': issues})
        elif path == '/api/source':
            try:
                errors = core.set_source(body['key'], body['value'])
            except KeyError:
                self._json({'error': 'no such key'}, 404)
                return
            if errors:
                self._json({'error': '；'.join(errors)}, 400)
                return
            self._json({'ok': True})
        elif path == '/api/lock':
            core.set_locked(body['lang'], body['key'], bool(body['locked']))
            self._json({'ok': True})
        else:
            self._json({'error': 'not found'}, 404)


def main() -> None:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8765)
    p.add_argument('--no-browser', action='store_true')
    args = p.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    url = 'http://127.0.0.1:{}'.format(args.port)
    print('翻譯工具：{}（Ctrl+C 結束）'.format(url))
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
