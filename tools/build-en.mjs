// 영문판 화면(*-en.html)을 한글판에서 다시 만든다.
//
// 한글판(splash · login · v6 일곱 장)을 그대로 복사하고 — 비밀번호 변경 강제(password-expired)는 뺀다 —
//   · <html lang="en">
//   · <head> 맨 앞에 번역 사전(i18n-en-dict.js) · 번역기(i18n-en.js)
//   · 영문판이 있는 화면으로 가는 주소를 *-en.html 로
// 만 바꾼다. 글자 번역은 화면을 열 때 i18n-en.js 가 한다.
//
// 한글판을 고친 뒤:  node tools/build-en.mjs  →  python tools/stamp-assets.py
// 사전에 빠진 문구 찾기:  node tools/i18n-extract.mjs --missing
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PAGES = ['splash', 'login', 'mission-setup-v6', 'mission-precheck-v6', 'building-v6', 'main-v6', 'alert-center-v6', 'safety-v6', 'report-v6'];
const LINK = new RegExp(`((?:href|data-goto|data-monitor-href|data-modal-confirm|action)="(?:\\./)?)(${[...PAGES, 'control-v6'].join('|')})\\.html(?=[?#"])`, 'g');

const HEAD = `
  <!-- 영문판 — tools/build-en.mjs 가 한글판에서 만든 파일이다. 여기를 고치지 말고 한글판을 고친 뒤 다시 만든다. -->
  <style>html:not(.i18n-ready) body { visibility: hidden; }</style>
  <link rel="stylesheet" href="../assets/css/i18n-en.css" />
  <script src="../assets/js/i18n-en-dict.js"></script>
  <script src="../assets/js/i18n-en.js"></script>`;

// 사전 — tools/i18n/*.tsv(한글<TAB>영문)를 하나로 묶는다. ⎵ 는 띄움.
const dict = {};
for (const f of fs.readdirSync(path.join(ROOT, 'tools/i18n')).filter((f) => f.endsWith('.tsv')).sort()) {
  fs.readFileSync(path.join(ROOT, 'tools/i18n', f), 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (!line.trim() || line.startsWith('# ')) return;
    const tab = line.indexOf('\t');
    if (tab < 0) { console.warn(`${f}:${i + 1} 탭 없음 — 건너뜀`); return; }
    const ko = line.slice(0, tab).trim();
    const en = line.slice(tab + 1).replace(/⎵/g, ' ');
    if (ko in dict && dict[ko] !== en) console.warn(`${f}:${i + 1} 겹침 "${ko}" — 뒤의 것을 씀`);
    dict[ko] = en;
  });
}
fs.writeFileSync(path.join(ROOT, 'assets/js/i18n-en-dict.js'),
  '/* 영문판 번역 사전 — tools/build-en.mjs 가 tools/i18n/*.tsv 에서 만든다. 여기를 고치지 말고 tsv 를 고친다. */\n' +
  'window.APRISM_EN = ' + JSON.stringify(dict, null, 0).replace(/","/g, '",\n"') + ';\n');
console.log('assets/js/i18n-en-dict.js — ' + Object.keys(dict).length + ' 문구');

// [11/06] 영문판 *-v6-en.html 은 v7 한글판(*-v7.html)에서 만든다(디자이너 — v6 한글은 멈추고, 영문은 v7 을 계속 따른다).
//   파일 이름 · 화면 사이 주소는 v6-en 그대로. v7 주소 잇개(v7.js)는 빼고, 제목 판 표기는 파일 이름과 같게 v6.
for (const name of PAGES) {
  const v7 = name.replace(/-v6$/, '-v7');
  const from = v7 !== name && fs.existsSync(path.join(ROOT, 'screens', v7 + '.html')) ? v7 : name;
  let src = fs.readFileSync(path.join(ROOT, 'screens', from + '.html'), 'utf8');
  if (from !== name) {
    src = src.replace(/\r?\n\s*<!-- v7\(11\/06~\)[^\n]*-->\r?\n\s*<script src="\.\.\/assets\/js\/v7\.js[^"]*"><\/script>/, '');
    if (src.includes('assets/js/v7.js')) throw new Error(from + ': v7.js 를 못 뺌');
    // [11/10] v7 알림 데이터 한 곳(alert-data-v7.js)도 뺀다 — 영문판은 v7 기능이 필요 없다(디자이너). 없으면 각 JS 가 예전 데이터를 쓴다
    src = src.replace(/\r?\n\s*<!-- \[11\/10\] 알림 데이터 한 곳[^\n]*-->\r?\n\s*<script src="\.\.\/assets\/js\/alert-data-v7\.js[^"]*"><\/script>/, '');
    if (src.includes('assets/js/alert-data-v7.js')) throw new Error(from + ': alert-data-v7.js 를 못 뺌');
    src = src.replace('<title>v7 ·', '<title>v6 ·');
  }
  let out = src.replace(/<html lang="ko"/, '<html lang="en"');
  out = out.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1${HEAD}`);
  if (!out.includes('i18n-en.js')) throw new Error(name + ': <meta charset> 를 못 찾음');
  out = out.replace(LINK, '$1$2-en.html');
  fs.writeFileSync(path.join(ROOT, 'screens', name + '-en.html'), out);
  console.log('screens/' + name + '-en.html' + (from !== name ? '  ← ' + from + '.html' : ''));
}
