/*
 * 영문판(*-en.html) — 화면에 그려지는 한글을 사전(i18n-en-dict.js)으로 바꾼다.
 *
 * 한글판 화면과 JS 는 그대로 두고, 영문판 HTML 만 <head> 맨 앞에서 이 파일을 읽는다.
 * 글자 노드 · 보이는 속성(title · aria-label · placeholder · alt)을 처음에 한 번, 그 뒤엔
 * MutationObserver 로 JS 가 새로 쓴 것까지 따라가며 바꾼다.
 *
 * 바꾸는 차례 — ① 문구 통째(APRISM_EN) ② 규칙(APRISM_EN_RX: 숫자가 끼는 문구)
 *              ③ 남은 한글은 사전 조각을 긴 것부터 끼워 바꾼다.
 * 그래도 남은 한글은 콘솔(?i18n=debug)과 window.APRISM_EN_MISS 에 모인다 — 사전에 더하면 된다.
 *
 * 주소도 영문판끼리 잇는다: href · data-goto 등이 영문판이 있는 화면(EN_PAGES)을 가리키면 *-en.html 로.
 * JS 가 직접 넘기는 곳은 (window.aprismHref || String)(주소) 로 감싸 두었다.
 */
(function () {
  "use strict";
  var D = window.APRISM_EN || {};
  var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var DOW = { "일": "Sun", "월": "Mon", "화": "Tue", "수": "Wed", "목": "Thu", "금": "Fri", "토": "Sat" };
  // 숫자가 끼는 문구 — 사전 통째 맞추기가 안 될 때 차례로 건다.
  var RX = [
    // 문장째 — JS 가 숫자를 끼워 만드는 것
    [/^(\d+\.) (.+)$/, function (m, n, rest) { return n + " " + core(rest); }],   // 목차처럼 번호가 붙은 문구는 번호를 떼고 맞춘다
    // Delta 접힌 위젯 — 두 줄이 줄마다 따로 온다(v3-panel.js lines()). main 문장 꼴 그대로 줄 단위로 채운다(한글 남던 것)
    // 숫자와 낱말 사이는 줄바꿈 안 함( ) — "9 / WARNINGS" 로 갈라지지 않게
    [/^위험 (\d+)건, 주의 (\d+)건이 있어요\.$/, function (m, c, w) { return c + " critical, " + w + " warnings."; }],
    [/^위험 (\d+)건이 있어요\.$/, function (m, c) { return c + " critical."; }],
    [/^주의 (\d+)건이 있어요\.$/, function (m, w) { return w + " warnings."; }],   // [11/06] 주의만 있을 때 1줄(monitor.js)
    // [11/06 v6] 펼친 Delta 답변 흐름(delta-answer-v6.js · delta-chat.js) — 상태 답(U1) · 못 알아들음(U4) · 단추 · 입력 칸
    [/^지금 상태$/, "Status"],
    // [11/06] 추천 조치 답(delta-answer-v6.js actions) — 요청은 팝오버에서
    [/^위 이유로 다음 조치를 추천해요\.$/, "For these reasons, I recommend:"],
    [/^바로 조치 요청할 수 있도록 화면을 열어드릴게요!$/, "Opening the alert so you can request them right away."],
    // [11/06] 로봇 답 · 알림 없을 때 못 알아들음(delta-answer-v6.js robot · fallback)
    [/^(Robot \d+)(?:은|는) 지금 (.+?)(?:이에요|예요)\.$/, function (m, r, x) { var t = core(x).replace(/^\s+/, ""); return r + " is " + t.charAt(0).toLowerCase() + t.slice(1) + " now."; }],
    [/^지금은 확인할 알림이 없어요\. 아래에서 고르세요\.$/, "No open alerts. Pick one below."],
    [/^로봇 지금 뭐 해\?$/, "What is the robot doing?"],
    [/^남은 시간$/, "Remaining"],
    [/^진행$/, "Progress"],
    [/^(\d+\/\d+) 지점$/, "$1 points"],
    [/^지금 상황$/, "Overview"],
    [/^이걸 물으신 건가요\?$/, "Did you mean one of these?"],
    [/^이 있어요\. 아래에서 고르세요\.$/, " open. Pick one below."],
    [/^(.+?)(?:은|는) 지금 (위험|주의)이에요\.$/, function (m, x, sev) { return core(x) + " is " + (sev === "위험" ? "critical" : "at warning") + " now."; }],
    [/^원인 보기$/, "Cause"],
    [/^Delta에게 질문$/, "Ask Delta"],
    [/^진행 중$/, "In progress"],
    [/^이것부터 확인하세요\. 열린 (\d+)건 중 첫 번째예요\.$/, "Check this first. It's #1 of $1 open alerts."],
    [/^열린 (\d+)건 중 (\d+)번째예요\.$/, "It's #$2 of $1 open alerts."],
    [/^(\d+)번 지점$/, "Point $1"],
    // [11/05 v6] 미션 이동 답 단추 · 3번째 줄(하는 일) — monitor.js · v3-panel.js
    [/^미션 이동하기$/, "Go to mission"],
    [/^위험 (\d+)건 원인 분석 중\.\.\.$/, "Analyzing $1 critical alerts..."],
    [/^주의 (\d+)건 추세 비교 중\.\.\.$/, "Comparing trends of $1 warnings..."],
    [/^알림 (\d+)건 살펴보는 중\.\.\.$/, "Reviewing $1 alerts..."],
    [/^답변 정리 중\.\.\.$/, "Writing an answer..."],
    [/^(.+?)(?:부터|이|가)? ?확인하세요\.$/, function (m, x) { return "Check " + core(x) + " first."; }],
    [/^이 미션 위험 (\d+), 다른 미션 위험 (\d+)$/, "$1 critical here, $2 in other missions"],
    [/^이 미션 위험 (\d+)$/, "$1 critical here"],
    [/^(주의|위험) 알림 (\d+)건 누적$/, function (m, sev, n) { return n + (sev === "위험" ? " critical" : " warnings") + " in total"; }],
    // 안전진단 — 감지 종류 안내 문장(계기는 사전 조각으로 두면 다른 낱말을 깨서 여기서만 옮긴다)
    [/^(.+?)는? ((?:누출|온도|계기|이상음향|부분방전)[^만]*)만 판정$/, function (m, mis, list) {
      var N = { "계기": "Gauge reading" };
      return core(mis) + " judges only " + list.split(", ").map(function (x) { return N[x] || core(x); }).join(", ").toLowerCase();
    }],
    [/^위험 (\d+)건 포함 (\d+)건 누적$/, "$2 total, incl. $1 critical"],
    [/^위험 (\d+)건부터 조치$/, "Act on the $1 critical first"],
    [/^주의 (\d+)건 묶어서 확인$/, "Review $1 warnings together"],
    [/^위험 (\d+)건, 주의 (\d+)건이 있어요\. 위험 미션부터 확인하세요\.$/, "$1 critical, $2 warnings. Check the critical missions first."],
    [/^(\d+)대 배정$/, "$1 assigned"],
    [/^(\d+)대 연결$/, "$1 connected"],
    [/^(\d+)대 수행중$/, "$1 running"],
    [/^도착 약 ?(\d+)\s*초$/, "Arrives in ~$1 s"],
    [/^약 (\d+)\s*초 남음$/, "~$1 s left"],   // [11/06 v7] 우측 지금 카드 · 팝오버 남은 시간
    [/^로봇이 오는 중(?: · (.+))?$/, function (m, rest) { return "Robot on the way" + (rest ? " · " + rest.replace(/^도착 약 ?(\d+)\s*초$/, "arrives in ~$1 s").replace(/^약 (\d+)\s*초 남음$/, "~$1 s left") : ""); }],   // [11/06] 웨이포인트 팝오버 지금 지점 — 도착 글은 이미 영어일 수 있다
    [/^(\d{1,2})월 월 보고서( 생성)?$/, function (m, mo, g) { return (g ? "Generate " : "") + MONTH[mo - 1] + " monthly report"; }],
    [/^총 (\d+)쪽$/, "$1 pages total"],
    [/^(\d+) \/ (\d+) ?쪽$/, "$1 / $2"],
    [/^(.+?) ?(?:으로|로)? 들어가기$/, "Enter $1"],
    [/^(.+) 끝$/, "$1 · done"],
    [/(\d+)번째/g, "#$1"],
    [/^위험 (\d+)건, 주의 (\d+)건이 있어요\. (.+?)(?:부터|이|가)? ?확인하세요\.$/, "$1 critical, $2 warnings. Check $3 first."],
    [/^위험 (\d+)건, 주의 (\d+)건이에요\. 이 순서로 보세요\.$/, "$1 critical, $2 warnings. Go in this order."],
    [/^(\d+)\. 주의 (\d+)건\(이 미션 (\d+), 다른 미션 (\d+)\)$/, "$1. Warnings $2 (this mission $3, other missions $4)"],
    [/^지금 미션에서 (\d+)건, 다른 미션에서 (\d+)건의 확인해야 할 주의 단계 알림이 있어요\.$/, "Warnings to check: $1 in this mission, $2 in other missions."],
    [/^지금 미션에서 (\d+)건의 확인해야 할 주의 단계 알림이 있어요\.$/, "Warnings to check: $1 in this mission."],
    [/^위험 (\d+)건부터 보여 드릴까요\?$/, "Start with the $1 critical?"],
    [/^알림 (\d+)건부터 보여 드릴까요\?$/, "Start with the $1 alerts?"],
    [/^어서오세요 (.+?) ?님$/, "Welcome, $1"],
    [/^(\d.*) 소요$/, function (m, t) { return "Took " + core(t); }],
    [/^지점 (\d+)곳$/, "$1 waypoints"],
    [/^로봇 (\d+)대$/, "$1 robots"],
    [/^(\d+)건 지남$/, "$1 on this floor"],
    [/^(\d+)대 · (\d+)대 수행중$/, "$1 total, $2 running"],
    [/^주의 (\d+)건 묶어 보기$/, "View $1 warnings together"],
    [/^가장 급한 것은 (.+?)(?:이에요|예요)\.$/, "Most urgent: $1."],
    [/^(.+) — 검출 장면$/, "$1 — detection frame"],
    [/(\d{1,2})월 (\d{1,2})일 \(([일월화수목금토])\)/g, function (m, mo, d, w) { return DOW[w] + ", " + MON[mo - 1] + " " + d; }],
    [/(\d{1,2})월 (\d{1,2})일/g, function (m, mo, d) { return MON[mo - 1] + " " + d; }],
    [/(\d{4})년 (\d{1,2})월/g, function (m, y, mo) { return MONTH[mo - 1] + " " + y; }],
    [/(\d{4})년/g, "$1"],
    [/(\d{1,2})월(?![가-힣])/g, function (m, mo) { return MON[mo - 1] || m; }],
    [/\(([일월화수목금토])\)/g, function (m, w) { return "(" + DOW[w] + ")"; }],
    [/지하 ?(\d+) ?층/g, "B$1F"],
    [/(\d+)층/g, "$1F"],
    [/(\d+)시간 ?(\d+)분/g, "$1 h $2 min"],
    [/(\d+)분 ?(\d+)초/g, "$1 min $2 s"],
    [/(\d+)분 전/g, "$1 min ago"],
    [/(\d+)분 경과/g, "$1 min ago"],
    [/(\d+)시간/g, "$1 h"],
    [/(\d+)분/g, "$1 min"],
    [/(\d+)초/g, "$1 s"],
    [/(\d+)건/g, "$1"],
    [/(\d+)개/g, "$1"],
    [/(\d+)대/g, "$1"],
    [/(\d+)곳/g, "$1 spots"],
    [/(\d+)명/g, "$1 people"],
    [/(\d+)회/g, "$1×"],
    [/(\d+)쪽/g, "$1 pp"],
    [/(\d+)일/g, "$1 days"],
    [/약 ?(?=[\d~])/g, "~"],
    // 영문 · 숫자 뒤 조사(Robot 01 이, WP-04 로 …)는 떼어 낸다
    [/([\w)\]%℃.·]) ?(으로|에서|에게|이|가|을|를|은|는|에|로|의|와|과|도)(?=[\s,.!?]|$)/g, "$1"]
  ].concat(window.APRISM_EN_RX || []);
  var HAN = /[가-힣]/;
  var DEBUG = /[?&]i18n=debug/.test(location.search);
  var EN_PAGES = /(^|\/)(splash|login|mission-setup-v6|mission-precheck-v6|building-v6|main-v6|control-v6|alert-center-v6|safety-v6|report-v6)\.html(?=$|[?#])/;
  var ATTRS = ["title", "aria-label", "placeholder", "alt", "aria-valuetext", "aria-roledescription", "aria-description"];
  var URL_ATTRS = ["href", "data-goto", "data-monitor-href", "data-modal-confirm", "action"];

  document.documentElement.lang = "en";

  function href(u) {
    if (typeof u !== "string") { return u; }
    return u.replace(EN_PAGES, function (m, pre, name) { return pre + name + "-en.html"; });
  }
  window.aprismHref = href;

  // 조각 사전 — 긴 것부터
  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  var keys = Object.keys(D).filter(function (k) { return HAN.test(k) && k.length > 1 && !/^=/.test(k); }).sort(function (a, b) { return b.length - a.length; });
  // 한글 낱말 한가운데(실시간 의 "시간")는 건드리지 않는다 — 앞 글자가 한글이면 조각으로 보지 않는다.
  var FR = keys.length ? new RegExp("(?<![가-힣])(?:" + keys.map(esc).join("|") + ")", "g") : null;

  var cache = new Map();
  var miss = window.APRISM_EN_MISS = new Set();

  function core(s) {
    var k = s.replace(/\s+/g, " ").trim();
    if (Object.prototype.hasOwnProperty.call(D, k)) { return D[k]; }
    var out = k;
    for (var i = 0; i < RX.length; i++) {
      out = out.replace(RX[i][0], RX[i][1]);
      if (Object.prototype.hasOwnProperty.call(D, out)) { return D[out]; }
    }
    if (HAN.test(out) && FR) { out = out.replace(FR, function (m) { return D[m]; }); }
    if (HAN.test(out)) {
      if (!miss.has(k)) { miss.add(k); if (DEBUG) { console.warn("[i18n] 사전에 없음:", k); } }
    }
    return out.replace(/ {2,}/g, " ").replace(/ ([,.:;)!?])/g, "$1");
  }
  function tr(s) {
    if (!s || !HAN.test(s)) { return s; }
    var hit = cache.get(s);
    if (hit !== undefined) { return hit; }
    // 앞뒤 공백은 그대로 둔다(인라인 글자 사이 띄움).
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    // 줄바꿈이 든 문구(Delta 두 줄)는 줄마다 따로 옮긴다 — core() 가 공백을 하나로 합쳐 두 줄이 한 문단이 되는 것을 막는다.
    var out = m[1] + (m[2].indexOf("\n") >= 0 ? m[2].split("\n").map(core).join("\n") : core(m[2])) + m[3];
    out = nodot(out);
    cache.set(s, out);
    return out;
  }
  window.APRISM_TR = tr;
  // 영문 화면은 가운뎃점(·)을 쓰지 않는다 — 쉼표로 바꾼다.
  function nodot(s) { return s && s.indexOf("·") >= 0 ? s.replace(/\s*·\s*/g, ", ") : s; }

  function skip(el) {
    return el && (el.nodeName === "SCRIPT" || el.nodeName === "STYLE" || el.isContentEditable);
  }
  function doText(n) {
    if (skip(n.parentNode)) { return; }
    var v = n.nodeValue;
    // [11/05] 자리마다 영어가 다른 문구 — 부모의 data-en 을 쓴다(상단 첫 탭 전체 미션 → All, 다른 곳은 All missions 그대로)
    var p = n.parentNode;
    if (p && p.nodeType === 1 && p.hasAttribute("data-en") && HAN.test(v)) { var e = p.getAttribute("data-en"); if (e !== v) { n.nodeValue = e; } return; }
    // 한글 없는 글도 가운뎃점은 쉼표로(JS 가 영어 조각 사이에 · 를 끼우는 곳)
    var t = nodot(HAN.test(v) ? tr(v) : v);
    if (t !== v) { n.nodeValue = t; }
  }
  function doAttrs(el) {
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      // 바뀔 때만 쓴다 — 같은 값을 다시 써도 변화 기록이 생겨 끝없이 돈다(사전에 없는 문구).
      if (v && HAN.test(v)) { var t = tr(v); if (t !== v) { el.setAttribute(ATTRS[i], t); } }
    }
    for (var j = 0; j < URL_ATTRS.length; j++) {
      var u = el.getAttribute(URL_ATTRS[j]);
      if (u && u.indexOf(".html") > 0) { var h = href(u); if (h !== u) { el.setAttribute(URL_ATTRS[j], h); } }
    }
    // 검출 장면 그림은 라벨이 그림에 박혀 있다 — 영어 라벨 판(img/alert-en · img/safety-en, 같은 파일 이름)으로.
    if (el.nodeName === "IMG") {
      var src = el.getAttribute("src");
      if (src && src.indexOf("/img/alert/") >= 0) { el.setAttribute("src", src.replace("/img/alert/", "/img/alert-en/")); }
      else if (src && /\/img\/safety\/(safety_crit\.jpg|(m1_)?pd_(crit|warn|ok)\.png)/.test(src)) { el.setAttribute("src", src.replace("/img/safety/", "/img/safety-en/")); }   // 부분방전 그래프 축 글자(Phase · Amplitude)
    }
    if ((el.nodeName === "INPUT" || el.nodeName === "TEXTAREA") && el.type !== "password" && HAN.test(el.value)) {
      // 미리 채워 둔 값(읽기 전용 미션 이름 등)만 — 사람이 친 값은 건드리지 않는다.
      if (el.value === el.defaultValue || el.readOnly) { el.value = tr(el.value); el.defaultValue = el.value; }
    }
  }
  function walk(root) {
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) { return; }
    if (root.nodeType === 1) { if (skip(root)) { return; } doAttrs(root); }
    var w = document.createTreeWalker(root, 5 /* ELEMENT | TEXT */, null);
    var n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 3) { doText(n); } else if (!skip(n)) { doAttrs(n); }
    }
  }

  var mo = new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var r = list[i];
      if (r.type === "characterData") { doText(r.target); }
      else if (r.type === "attributes") { doAttrs(r.target); }
      else { for (var j = 0; j < r.addedNodes.length; j++) { walk(r.addedNodes[j]); } }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat(URL_ATTRS, ["src"]) });

  // 캔버스 글자(로봇 모습 등)도
  var C2 = window.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
  if (C2) {
    ["fillText", "strokeText", "measureText"].forEach(function (fn) {
      var orig = C2[fn];
      C2[fn] = function (text) { var a = Array.prototype.slice.call(arguments); a[0] = tr(String(text)); return orig.apply(this, a); };
    });
  }
  ["alert", "confirm", "prompt"].forEach(function (fn) {
    var orig = window[fn];
    if (orig) { window[fn] = function (msg) { var a = Array.prototype.slice.call(arguments); a[0] = tr(String(msg)); return orig.apply(window, a); }; }
  });

  // 줄임표로 잘린 글(i18n-en.css)은 마우스를 올리면 전체를 보여 준다.
  document.addEventListener("mouseover", function (e) {
    var el = e.target;
    if (el.nodeType === 1 && !el.hasAttribute("title") && el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).textOverflow === "ellipsis") {
      el.setAttribute("title", el.textContent.trim());
    }
  }, true);

  // 다 읽힌 뒤 한 번 더 훑고 화면을 연다(처음 몇 프레임에 한글이 비치지 않게).
  function ready() {
    walk(document.documentElement);
    document.documentElement.classList.add("i18n-ready");
    if (DEBUG && miss.size) { console.warn("[i18n] 사전에 없는 문구 " + miss.size + "개 — APRISM_EN_MISS"); }
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", ready); } else { ready(); }
})();
