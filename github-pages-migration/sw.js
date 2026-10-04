// issue #1332（ブルーグリーンデプロイ導入 Task 13）: 旧URL（GitHub Pages）の
// kill switch用Service Worker。既存のvite-plugin-pwa生成SW（Workbox）が
// index.htmlをprecache済みのため、通常のページロードではナビゲーション
// リクエストがSWのfetchハンドラでインターセプトされ、古いアプリの
// index.htmlがキャッシュから返ってしまう可能性がある
// （index.html内のインラインスクリプトによるService Worker解除処理が
// 実行される前に、古いキャッシュが返ってしまうケースへの対策）。
//
// ブラウザはページロード時にSWスクリプト自体の更新確認を行うため、この
// ファイルへの差し替え（内容がバイト単位で変わる）がブラウザに検出されると、
// install時にskipWaiting()で即座に新SWへ切り替え、activate時に全キャッシュを
// 削除・SW自身をunregister・開いているタブをnavigate()でリロードする。
// リロード後はSWが存在しないため、index.htmlがネットワークから直接取得され、
// 移行ページのインラインスクリプトが確実に実行される
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map((name) => caches.delete(name)));
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
