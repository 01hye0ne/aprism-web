// 영문판(*-en.html) 번역 사전에 넣을 한글 문구를 뽑는다.
//
// 화면 HTML 의 글자 · 속성과, 그 화면이 읽는 JS 의 문자열(주석 뺀 것)에서 한글이 든 것만 모은다.
// 템플릿 문자열은 ${…} 를 경계로 조각낸다 — 사전은 조각 단위로도 바꾸기 때문.
// 사용:  node tools/i18n-extract.mjs > 목록.json   (사전에 아직 없는 것만: --missing)
import fs from 'node:fs';
import path from 'node:path';

import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGES = [
  'screens/splash.html', 'screens/login.html',
  'screens/mission-setup-v6.html', 'screens/mission-precheck-v6.html', 'screens/building-v6.html',
  'screens/main-v6.html', 'screens/alert-center-v6.html', 'screens/safety-v6.html', 'screens/report-v6.html',
];
const SKIP_JS = new Set(['map-model.js', 'i18n-en.js', 'i18n-en-dict.js']);
const HAN = /[가-힣]/;

const found = new Map(); // 문구 → 처음 나온 곳
const add = (s, where) => {
  // 문자열 속 HTML 조각은 글자만 — 화면에 붙는 건 태그 사이 글자다.
  if (/<\/?[a-z][^>]*>/i.test(s)) { s.split(/<[^>]*>/).forEach((t) => add(t, where)); return; }
  s = s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&middot;/g, '·');
  s = s.replace(/\s+/g, ' ').trim();
  if (!HAN.test(s)) return;
  if (!found.has(s)) found.set(s, where);
};

// JS 문자열 리터럴만 골라낸다(주석 · 정규식 건너뜀).
function jsStrings(src, where) {
  let i = 0;
  const n = src.length;
  let prevSig = '';
  const tpl = (stack) => {
    // 백틱 안: 조각을 모으고 ${ } 안은 코드로 다시 읽는다.
    let buf = '';
    while (i < n) {
      const c = src[i];
      if (c === '\\') { buf += src.slice(i, i + 2); i += 2; continue; }
      if (c === '`') { i++; add(unesc(buf), where); return; }
      if (c === '$' && src[i + 1] === '{') {
        add(unesc(buf), where); buf = '';
        i += 2; code(1);
        continue;
      }
      buf += c; i++;
    }
  };
  const unesc = (s) => s.replace(/\\n/g, ' ').replace(/\\(.)/g, '$1');
  function code(depth) {
    while (i < n) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === '"' || c === "'") {
        let j = i + 1, buf = '';
        while (j < n && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') { buf += src.slice(j, j + 2); j += 2; } else buf += src[j++]; }
        add(unesc(buf), where); i = j + 1; prevSig = 'x'; continue;
      }
      if (c === '`') { i++; tpl(); prevSig = 'x'; continue; }
      if (c === '/') {
        // 앞 글자가 값이 아니면 정규식
        if (!/[\w$)\]]/.test(prevSig)) {
          let j = i + 1, cls = false;
          while (j < n && src[j] !== '\n') {
            if (src[j] === '\\') { j += 2; continue; }
            if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false;
            else if (src[j] === '/' && !cls) break;
            j++;
          }
          i = j + 1; prevSig = 'x'; continue;
        }
      }
      if (c === '{') depth++;
      if (c === '}') { depth--; if (depth === 0) { i++; return; } }
      if (!/\s/.test(c)) prevSig = c;
      i++;
    }
  }
  code(Infinity);
}

function htmlStrings(src, where) {
  src = src.replace(/<!--[\s\S]*?-->/g, '');
  src = src.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/g, (_, body) => { jsStrings(body, where + ' <script>'); return ''; });
  src = src.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, '');
  // 속성
  for (const m of src.matchAll(/\s[\w:-]+="([^"]*)"/g)) add(m[1], where);
  // 글자 — 태그 사이 덩어리와, 인라인 태그를 걷어낸 블록 단위 둘 다
  const text = src.replace(/<[^>]+>/g, '\u0000');
  for (const t of text.split('\u0000')) add(t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&middot;/g, '·'), where);
}

const jsSeen = new Set();
for (const p of PAGES) {
  const abs = path.join(ROOT, p);
  const src = fs.readFileSync(abs, 'utf8');
  htmlStrings(src, p);
  for (const m of src.matchAll(/src="([^"?]+\.js)/g)) {
    const js = path.resolve(path.dirname(abs), m[1]);
    const base = path.basename(js);
    if (SKIP_JS.has(base) || jsSeen.has(js) || !fs.existsSync(js)) continue;
    jsSeen.add(js);
    jsStrings(fs.readFileSync(js, 'utf8'), 'assets/js/' + base);
  }
}

let out = [...found.keys()];
if (process.argv.includes('--missing')) {
  const dictPath = path.join(ROOT, 'assets/js/i18n-en-dict.js');
  const dict = {};
  if (fs.existsSync(dictPath)) {
    const g = { APRISM_EN: null };
    new Function('window', fs.readFileSync(dictPath, 'utf8'))(g);
    Object.assign(dict, g.APRISM_EN || {});
  }
  out = out.filter((s) => !(s in dict));
}
if (process.argv.includes('--where')) out = out.map((s) => [s, found.get(s)]);
process.stdout.write(JSON.stringify(out, null, 0).replace(/","/g, '",\n"') + '\n');
process.stderr.write(out.length + ' strings\n');
