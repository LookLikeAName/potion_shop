"""
語音工具的網頁介面（只在本機執行，用標準函式庫的 http.server）。

  python tools/voice/gui.py            打開 http://127.0.0.1:8766
  python tools/voice/gui.py --port 9000 --no-browser

1. 聲音設計：寫露米婭與老師的聲音描述 → 建立並試聽 → 用幾句台詞、不同語氣試講 → 滿意的設為正式聲音
2. 批次產生：所有劇情與泡泡台詞，只重做沒產生過、或文字／語氣／聲音改過的句子

API 金鑰：優先用環境變數（config.json 的 api_key_env）；也可以在網頁上輸入，只存在記憶體裡、不寫進檔案。
"""
from __future__ import annotations

import argparse
import json
import sys
import threading
import time
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlparse

import core


class Job:
    """背景產生工作（一次只跑一個）"""

    def __init__(self):
        self.lock = threading.Lock()
        self.running = False
        self.stopping = False
        self.log = []
        self.done = 0
        self.total = 0

    def snapshot(self) -> dict:
        with self.lock:
            return {'running': self.running, 'log': self.log[-300:], 'done': self.done, 'total': self.total}

    def start(self, ids, cfg: dict, api_key: str) -> bool:
        with self.lock:
            if self.running:
                return False
            self.running, self.stopping = True, False
            self.log, self.done, self.total = [], 0, len(ids)
        threading.Thread(target=self._run, args=(ids, cfg, api_key), daemon=True).start()
        return True

    def _run(self, ids, cfg, api_key):
        def log(s):
            with self.lock:
                self.log.append(s)

        def progress(a, b):
            with self.lock:
                self.done, self.total = a, b

        try:
            core.generate(cfg, api_key, ids, log=log, progress=progress, stop=lambda: self.stopping)
        except Exception as e:  # noqa: BLE001 — 任何錯誤都顯示在網頁上
            log('錯誤：{}'.format(e))
        finally:
            with self.lock:
                self.running = False


JOB = Job()
SESSION = {'api_key': ''}


def api_key() -> str:
    return SESSION['api_key'] or core.api_key_from_env(core.load_config())


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

    def _err(self, msg: str, code: int = 400) -> None:
        self._json({'error': msg}, code)

    def _body(self) -> dict:
        n = int(self.headers.get('Content-Length') or 0)
        return json.loads(self.rfile.read(n).decode('utf-8') or '{}') if n else {}

    def _file(self, path, ctype: str) -> None:
        if not path.exists() or not path.is_file():
            self._err('not found', 404)
            return
        self._send(200, path.read_bytes(), ctype)

    def do_GET(self):
        url = urlparse(self.path)
        p = unquote(url.path)
        if p == '/':
            self._file(core.HERE / 'gui.html', 'text/html; charset=utf-8')
        elif p == '/api/meta':
            cfg = core.load_config()
            self._json({
                'config': cfg,
                'profiles': core.load_profiles(),
                'hasKey': bool(api_key()),
                'keySource': 'env' if core.api_key_from_env(cfg) else ('session' if SESSION['api_key'] else ''),
                'ffmpeg': bool(core.ffmpeg_path()),
                'langs': sorted(d.name for d in core.LOCALES.iterdir() if d.is_dir()),
                'testLines': {k: core.test_lines(cfg, k) for k in core.DEFAULT_PROFILES},
            })
        elif p == '/api/rows':
            self._json(core.rows(core.load_config()))
        elif p == '/api/job':
            self._json(JOB.snapshot())
        elif p == '/api/voices':
            if not api_key():
                self._err('沒有 API 金鑰')
                return
            try:
                self._json(core.list_voices(core.load_config(), api_key()))
            except core.ApiError as e:
                self._err(str(e))
        elif p.startswith('/samples/'):
            # 試聽檔（名稱只能是檔名，不能跳出資料夾）
            name = p[len('/samples/'):]
            self._file(core.SAMPLES / name.replace('/', '').replace('\\', ''), 'audio/wav')
        elif p.startswith('/voice/'):
            name = p[len('/voice/'):].replace('/', '').replace('\\', '')
            self._file(core.OUT / name, 'audio/mpeg' if name.endswith('.mp3') else 'audio/wav')
        else:
            self._err('not found', 404)

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            body = self._body()
        except ValueError:
            self._err('bad json')
            return
        cfg = core.load_config()
        if path == '/api/config':
            for k, v in (body.get('config') or {}).items():
                if k in core.DEFAULT_CONFIG:
                    d = core.DEFAULT_CONFIG[k]
                    cfg[k] = (v in (True, 'true', '1', 1)) if isinstance(d, bool) else type(d)(v)
            core.save_config(cfg)
            if 'apiKey' in body:
                SESSION['api_key'] = (body.get('apiKey') or '').strip()
            self._json({'ok': True})
            return
        if path == '/api/profile':
            # 改聲音描述、性別（還沒建立聲音，只存設定）
            profiles = core.load_profiles()
            sp = body['speaker']
            for k in ('description', 'gender', 'intro'):
                if k in body:
                    profiles[sp][k] = body[k]
            core.save_profiles(profiles)
            self._json({'ok': True})
            return
        if path == '/api/style':
            styles = core.load_styles()
            styles[body['id']] = body.get('style', '')
            core.save_styles(styles)
            self._json({'ok': True})
            return
        if path == '/api/speech':
            # 送給模型的台詞（可以加音效詞）；清空或和原始台詞一樣 = 恢復用原始台詞
            line = next((l for l in core.collect_lines(cfg) if l['id'] == body.get('id')), None)
            if not line:
                self._err('no such line', 404)
                return
            core.set_speech(line['id'], body.get('speech', ''), line['text'])
            self._json({'ok': True})
            return
        if path == '/api/select':
            # 設為正式聲音（之後的批次產生用這個）
            profiles = core.load_profiles()
            profiles[body['speaker']]['voice_id'] = body['voice_id']
            core.save_profiles(profiles)
            self._json({'ok': True})
            return
        if path == '/api/stop':
            JOB.stopping = True
            self._json({'ok': True})
            return

        key = api_key()
        if not key:
            self._err('沒有 API 金鑰：請設定環境變數 {} 或在上方輸入'.format(cfg['api_key_env']))
            return
        try:
            if path == '/api/create':
                # 建立一個候選聲音（存在雲端，拿到 voice_id）並存下試聽
                sp = body['speaker']
                profiles = core.load_profiles()
                desc = body.get('description', profiles[sp]['description'])
                gender = body.get('gender', profiles[sp]['gender'])
                intro = body.get('intro', profiles[sp].get('intro', '')).strip()
                vid, wav = core.create_voice(cfg, key, sp, gender, desc)
                sample = core.save_sample(wav, '{}-{}'.format(sp, vid)) if wav else ''
                # 建立時附的試聽是模型自己挑的句子（常常是英文）：接著用這個聲音唸一次自我介紹，聽配音語言的效果
                tries = []
                intro_error = ''
                if intro:
                    try:
                        iw = core.synthesize(cfg, key, vid, intro)
                        tries.append({'text': intro, 'style': '', 'sample': core.save_sample(iw, '{}-{}-intro'.format(sp, vid))})
                    except core.ApiError as e:
                        intro_error = str(e)[:200]
                profiles = core.load_profiles()
                profiles[sp]['description'], profiles[sp]['gender'], profiles[sp]['intro'] = desc, gender, intro
                profiles[sp]['candidates'].append({
                    'voice_id': vid, 'description': desc, 'gender': gender, 'sample': sample,
                    'created': time.strftime('%Y-%m-%d %H:%M'), 'tries': tries,
                })
                core.save_profiles(profiles)
                self._json({'ok': True, 'voice_id': vid, 'sample': sample, 'introError': intro_error})
            elif path == '/api/speak':
                # 用某個聲音試講一句（不影響正式配音）
                sp, vid = body['speaker'], body['voice_id']
                wav = core.synthesize(cfg, key, vid, body['text'], body.get('style', ''))
                sample = core.save_sample(wav, '{}-{}-try'.format(sp, vid))
                profiles = core.load_profiles()
                for c in profiles[sp]['candidates']:
                    if c['voice_id'] == vid:
                        c.setdefault('tries', []).insert(0, {'text': body['text'], 'style': body.get('style', ''), 'sample': sample})
                        del c['tries'][10:]
                core.save_profiles(profiles)
                self._json({'ok': True, 'sample': sample})
            elif path == '/api/delete':
                # 刪掉候選聲音（雲端也刪，每個專案最多 200 個）
                sp, vid = body.get('speaker'), body['voice_id']
                try:
                    core.delete_voice(cfg, key, vid)
                except core.ApiError as e:
                    if not body.get('force'):
                        raise e
                profiles = core.load_profiles()
                for k in profiles:
                    if sp and k != sp:
                        continue
                    profiles[k]['candidates'] = [c for c in profiles[k]['candidates'] if c['voice_id'] != vid]
                    if profiles[k]['voice_id'] == vid:
                        profiles[k]['voice_id'] = ''
                core.save_profiles(profiles)
                self._json({'ok': True})
            elif path == '/api/generate':
                ids = body.get('ids') or core.pending_ids(cfg)
                if not ids:
                    self._err('沒有需要產生的台詞')
                    return
                if not JOB.start(ids, cfg, key):
                    self._err('已經有工作在進行中', 409)
                    return
                self._json({'ok': True, 'count': len(ids)})
            else:
                self._err('not found', 404)
        except core.ApiError as e:
            self._err('API 錯誤：{}'.format(e))


def main() -> None:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser()
    p.add_argument('--port', type=int, default=8766)
    p.add_argument('--no-browser', action='store_true')
    args = p.parse_args()
    server = ThreadingHTTPServer(('127.0.0.1', args.port), Handler)
    url = 'http://127.0.0.1:{}'.format(args.port)
    print('語音工具：{}（Ctrl+C 結束）'.format(url))
    if not args.no_browser:
        webbrowser.open(url)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
