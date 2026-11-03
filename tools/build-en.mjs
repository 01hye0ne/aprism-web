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
const LINK = new RegExp(`((?:href|data-goto|data-monitor-href|data-modal-confirm|action)="(?:\\./)?)(${PAGES.join('|')})\\.html(?=[?#"])`, 'g');

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

for (const name of PAGES) {
  const src = fs.readFileSync(path.join(ROOT, 'screens', name + '.html'), 'utf8');
  let out = src.replace(/<html lang="ko"/, '<html lang="en"');
  out = out.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1${HEAD}`);
  if (!out.includes('i18n-en.js')) throw new Error(name + ': <meta charset> 를 못 찾음');
  out = out.replace(LINK, '$1$2-en.html');
  fs.writeFileSync(path.join(ROOT, 'screens', name + '-en.html'), out);
  console.log('screens/' + name + '-en.html');
}
