/* 令和8年度 日臨技中部圏支部医学検査学会（第64回） — Service Worker
   方針:
     - アプリ本体・アイコン・フロアマップは事前保存（インストール時）
     - 抄録PDF / 案内PDF は容量が大きいため、開いた分だけ自動保存（オフラインで再閲覧可）
*/
const VERSION = 'jamt64-v1';
const SHELL   = VERSION + '-shell';
const RUNTIME = VERSION + '-runtime';

const SHELL_FILES = [
  './学会アプリ.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './フロアマップ/第１会場.png',
  './フロアマップ/第２会場.png',
  './フロアマップ/第３会場.png',
  './フロアマップ/第４会場.png',
  './フロアマップ/第５会場.png',
  './フロアマップ/第６会場.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      // 1件でも失敗すると全体が失敗するため個別に追加する
      .then(c => Promise.all(SHELL_FILES.map(u => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // 外部サイト（アクセス案内等）は介入しない

  const isDoc = req.mode === 'navigate' || url.pathname.endsWith('.html');

  if (isDoc) {
    // 本体: ネットワーク優先（更新反映）→ 失敗時キャッシュ
    e.respondWith(
      fetch(req)
        .then(r => { const cp = r.clone(); caches.open(SHELL).then(c => c.put(req, cp)); return r; })
        .catch(() => caches.match(req).then(r => r || caches.match('./学会アプリ.html')))
    );
    return;
  }

  // それ以外（PDF・画像等）: キャッシュ優先 → 取得したら保存
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && r.status === 200 && r.type === 'basic') {
        const cp = r.clone();
        caches.open(RUNTIME).then(c => c.put(req, cp));
      }
      return r;
    }).catch(() => new Response('', { status: 504, statusText: 'offline' })))
  );
});
