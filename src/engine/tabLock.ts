// 同一個存檔只能在一個分頁執行（企劃書 10.2）。
// 主要用 Web Locks API；另一個分頁要求接手時，先透過 BroadcastChannel 請舊分頁存檔並釋放。

const LOCK_NAME = 'idle-potion-shop/run';
const CHANNEL_NAME = 'idle-potion-shop/tabs';
const RELEASE_TIMEOUT_MS = 1500;

type Msg = { type: 'takeover' } | { type: 'released' };

export class TabLock {
  /** 被其他分頁接手時呼叫（呼叫時應立刻存檔並暫停） */
  onLost?: () => void;

  private release?: () => void;
  private bc: BroadcastChannel | null =
    typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL_NAME) : null;

  constructor() {
    this.bc?.addEventListener('message', (e: MessageEvent<Msg>) => {
      if (e.data?.type === 'takeover' && this.release) {
        this.lose();
        this.bc?.postMessage({ type: 'released' } satisfies Msg);
      }
    });
  }

  private get supported(): boolean {
    return typeof navigator !== 'undefined' && !!navigator.locks;
  }

  /** 沒有其他分頁在執行時取得鎖 */
  tryAcquire(): Promise<boolean> {
    if (!this.supported) return Promise.resolve(true);
    return new Promise((resolve) => {
      navigator.locks
        .request(LOCK_NAME, { ifAvailable: true }, (lock) => {
          if (!lock) {
            resolve(false);
            return;
          }
          resolve(true);
          return this.hold();
        })
        .catch(() => this.lose());
    });
  }

  /** 從其他分頁接手 */
  async takeover(): Promise<void> {
    await this.askRelease();
    if (!this.supported) return;
    await new Promise<void>((resolve) => {
      navigator.locks
        .request(LOCK_NAME, { steal: true }, () => {
          resolve();
          return this.hold();
        })
        .catch(() => this.lose());
    });
  }

  private hold(): Promise<void> {
    return new Promise<void>((r) => {
      this.release = r;
    });
  }

  private lose(): void {
    if (!this.release) return;
    this.release();
    this.release = undefined;
    this.onLost?.();
  }

  private askRelease(): Promise<void> {
    const bc = this.bc;
    if (!bc) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        bc.removeEventListener('message', onMsg);
        clearTimeout(timer);
        resolve();
      };
      const onMsg = (e: MessageEvent<Msg>) => {
        if (e.data?.type === 'released') done();
      };
      const timer = setTimeout(done, RELEASE_TIMEOUT_MS);
      bc.addEventListener('message', onMsg);
      bc.postMessage({ type: 'takeover' } satisfies Msg);
    });
  }
}
