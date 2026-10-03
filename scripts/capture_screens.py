"""
宣傳影片用的遊戲截圖（Windows 的 Python + Edge 無頭模式，透過 DevTools 協定操作）。

  1. 先開開發伺服器（npm run dev，http://localhost:5173）
  2. python scripts/capture_screens.py            → promo/shots/

1920×1080 全解析度。後期：載入 example_save_data.txt（日文介面）；前期：新遊戲的標題、序章、教學。
另外錄幾秒連續畫面（promo/shots/<名稱>/0000.jpg…，附每格的時間 frames.txt）。
需要：pip 的 websockets（Windows Python 已經有）。
"""
import asyncio
import base64
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

import websockets

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'promo' / 'shots'
URL = 'http://localhost:5173/'
EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
PORT = 9333
SAVE_KEY = 'idle-potion-shop/save'
LANG_KEY = 'idle-potion-shop-lang'


class Cdp:
    def __init__(self, ws):
        self.ws, self.n, self.wait, self.handlers = ws, 0, {}, {}

    async def run(self):
        async for raw in self.ws:
            m = json.loads(raw)
            if 'id' in m and m['id'] in self.wait:
                self.wait.pop(m['id']).set_result(m)
            elif 'method' in m and m['method'] in self.handlers:
                await self.handlers[m['method']](m['params'])

    async def call(self, method, **params):
        self.n += 1
        fut = asyncio.get_event_loop().create_future()
        self.wait[self.n] = fut
        await self.ws.send(json.dumps({'id': self.n, 'method': method, 'params': params}))
        m = await asyncio.wait_for(fut, 60)
        if 'error' in m:
            raise RuntimeError('{}: {}'.format(method, m['error']))
        return m.get('result', {})

    async def js(self, expr):
        r = await self.call('Runtime.evaluate', expression=expr, returnByValue=True, awaitPromise=True)
        return r.get('result', {}).get('value')

    async def until(self, expr, timeout=90):
        end = time.time() + timeout
        while time.time() < end:
            if await self.js(expr):
                return True
            await asyncio.sleep(0.5)
        raise TimeoutError(expr)

    async def shot(self, name):
        r = await self.call('Page.captureScreenshot', format='png')
        (OUT / (name + '.png')).write_bytes(base64.b64decode(r['data']))
        print('  shot', name)

    async def clip(self, name, seconds):
        """連續畫面：screencast 送來的每一格存成 jpg，時間記在 frames.txt"""
        d = OUT / name
        shutil.rmtree(d, ignore_errors=True)
        d.mkdir(parents=True)
        frames = []

        async def on_frame(p):
            k = len(frames)
            (d / '{:04d}.jpg'.format(k)).write_bytes(base64.b64decode(p['data']))
            frames.append(p['metadata']['timestamp'])
            await self.ws.send(json.dumps({'id': 0, 'method': 'Page.screencastFrameAck', 'params': {'sessionId': p['sessionId']}}))

        self.handlers['Page.screencastFrame'] = on_frame
        await self.call('Page.startScreencast', format='jpeg', quality=92, maxWidth=1920, maxHeight=1080, everyNthFrame=1)
        await asyncio.sleep(seconds)
        await self.call('Page.stopScreencast')
        self.handlers.pop('Page.screencastFrame', None)
        t0 = frames[0] if frames else 0
        (d / 'frames.txt').write_text('\n'.join('{:.3f}'.format(t - t0) for t in frames))
        print('  clip', name, len(frames), 'frames')

    async def click(self, selector_js):
        """用 JS 找到元素並點一下（selector_js = 回傳元素的運算式）"""
        return await self.js('(() => { const el = ' + selector_js + '; if (!el) return false; el.click(); return true; })()')

    async def load_with_storage(self, setup_js):
        """
        換一個存檔重新進遊戲：setup_js 在遊戲的程式之前執行（直接 reload 的話，遊戲關頁面前會自動存檔，
        把剛放進去的存檔蓋掉）
        """
        if getattr(self, 'boot', None):
            await self.call('Page.removeScriptToEvaluateOnNewDocument', identifier=self.boot)
        r = await self.call('Page.addScriptToEvaluateOnNewDocument', source='try {' + setup_js + '} catch (e) {}')
        self.boot = r['identifier']
        await self.call('Page.navigate', url='about:blank')
        await asyncio.sleep(1)
        await self.call('Page.navigate', url=URL)

    async def mouse(self, x, y):
        for t in ('mousePressed', 'mouseReleased'):
            await self.call('Input.dispatchMouseEvent', type=t, x=x, y=y, button='left', clickCount=1)


def save_json():
    raw = (ROOT / 'example_save_data.txt').read_text().strip()
    data = json.loads(base64.b64decode(raw).decode('utf-8'))
    data['savedAt'] = int(time.time() * 1000)  # 不要跳離線報告
    return json.dumps(data)


async def capture(page_ws):
    async with websockets.connect(page_ws, max_size=None) as ws:
        c = Cdp(ws)
        runner = asyncio.create_task(c.run())
        await c.call('Page.enable')
        await c.call('Runtime.enable')
        await c.call('Emulation.setDeviceMetricsOverride', width=1920, height=1080, deviceScaleFactor=1, mobile=False)
        # 無頭模式的分頁可能被當成在背景：動畫停住、錄不到連續畫面。當成在前景、有焦點
        await c.call('Emulation.setFocusEmulationEnabled', enabled=True)
        await c.call('Page.bringToFront')
        # ---------- 後期（範例存檔）
        print('late game')
        # 飄字設成「少」：後期的數字很多，全部顯示會蓋滿畫面
        perf = json.dumps(json.dumps({'floats': 'few'}))
        await c.load_with_storage('if (location.origin.includes("localhost")) {{ localStorage.clear(); localStorage.setItem({}, {}); localStorage.setItem({}, "ja"); localStorage.setItem("idle-potion-shop/perf", {}); }}'
                                  .format(json.dumps(SAVE_KEY), json.dumps(save_json()), json.dumps(LANG_KEY), perf))
        await c.until("!!document.querySelector('#scene canvas') && !document.querySelector('.title-screen')")
        await asyncio.sleep(6)
        await c.shot('late_main')
        await c.clip('late_clip', 5)
        # 狂熱時刻（可以開的話）
        if await c.click("document.querySelector('.fever-btn:not(.active)')"):
            await asyncio.sleep(2.5)
            await c.shot('late_fever')
            await c.clip('late_fever_clip', 4)
        # 魔導書：溫室、大釜、露米婭
        await c.click("[...document.querySelectorAll('button')].find(b => (b.textContent + (b.title || '') + (b.getAttribute('aria-label') || '')).includes('魔導書'))")
        await asyncio.sleep(1.2)
        for tab in ('greenhouse', 'cauldron', 'lumia'):
            if await c.click("document.querySelector('.bookmark.bm-{}')".format(tab)):
                await asyncio.sleep(1.2)
                await c.shot('late_book_' + tab)

        # ---------- 前期（新遊戲）
        print('early game')
        await c.load_with_storage('if (location.origin.includes("localhost") && !sessionStorage.getItem("promo-fresh")) {{ sessionStorage.setItem("promo-fresh", "1"); localStorage.clear(); localStorage.setItem({}, "ja"); }}'
                                  .format(json.dumps(LANG_KEY)))
        await c.until("!!document.querySelector('.title-btn.primary')")
        await asyncio.sleep(3)
        await c.shot('early_title')
        await c.clip('early_title_clip', 3)
        await c.click("document.querySelector('.title-btn.primary')")
        await asyncio.sleep(2)
        await c.shot('early_story')
        # 序章往下讀幾句再關掉
        for _ in range(5):
            await c.click("[...document.querySelectorAll('.modal.story button')].pop()")
            await asyncio.sleep(0.6)
        await c.shot('early_story2')
        await c.click("document.querySelector('.modal.story .modal-close, .modal.story [aria-label]')")
        await asyncio.sleep(2)
        await c.shot('early_tutorial')
        await c.clip('early_clip', 4)
        runner.cancel()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        urllib.request.urlopen(URL, timeout=5)
    except Exception as e:  # noqa: BLE001
        sys.exit('開發伺服器沒有開（{}）：先執行 npm run dev'.format(e))
    profile = tempfile.mkdtemp(prefix='promo-edge-')
    edge = subprocess.Popen([EDGE, '--headless=new', '--remote-debugging-port={}'.format(PORT), '--user-data-dir=' + profile,
                             '--window-size=1920,1080', '--hide-scrollbars', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
                             '--enable-unsafe-swiftshader', 'about:blank'])
    try:
        for _ in range(40):
            try:
                pages = json.load(urllib.request.urlopen('http://127.0.0.1:{}/json'.format(PORT)))
                page = next(p for p in pages if p.get('type') == 'page')
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.5)
        else:
            sys.exit('Edge 的 DevTools 連不上')
        asyncio.run(capture(page['webSocketDebuggerUrl']))
    finally:
        edge.terminate()
        time.sleep(1)
        shutil.rmtree(profile, ignore_errors=True)
    print('done:', OUT)


if __name__ == '__main__':
    main()
