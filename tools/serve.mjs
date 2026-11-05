// 저장소 폴더를 로컬에서 띄운다 — node tools/serve.mjs [열 화면 경로]
// 예: node tools/serve.mjs screens/safety-v6.html  →  http://localhost:5180/screens/safety-v6.html
// 캐시를 끄므로(no-store) ?v= 를 다시 찍지 않아도 고친 CSS·JS 가 바로 보인다.
// 포트는 PORT=5181 처럼 바꾸고, 브라우저를 열지 않으려면 NO_OPEN=1 로 실행한다.
import http from 'http'; import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url'; import { exec } from 'child_process';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 5180;
const START = (process.argv[2] || 'index.html').replace(/\\/g, '/').replace(/^\/+/, '');
const TYPES = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.mp4':'video/mp4', '.woff2':'font/woff2', '.glb':'model/gltf-binary' };
http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let f = path.normalize(path.join(ROOT, p));
  if (!f.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  fs.readFile(f, (e, b) => {
    if (e) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(b);
  });
}).listen(PORT, '127.0.0.1', () => {
  const url = `http://localhost:${PORT}/${START}`;
  console.log(`열림 ${url}\n(끄려면 Ctrl+C)`);
  if (!process.env.NO_OPEN) exec(process.platform === 'win32' ? `start "" "${url}"` : `${process.platform === 'darwin' ? 'open' : 'xdg-open'} "${url}"`);
});
