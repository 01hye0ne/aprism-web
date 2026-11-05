/*
 * [11/05 v6 실험] Delta 문장 속 미션 · 지점 표시 고르기 — 문형표 5 · 6절을 실제 화면에서 바꿔 본다.
 *   main-v6.html?lab=delta 일 때만 켜진다(한글판만). 본 코드(monitor.js · v3-panel.js · delta-answer-v6.js)는 그대로 두고,
 *   화면에 그려진 Delta 글에서 미션 이름 · "B4 7번 지점"을 찾아 고른 모양으로 감싼다. 고른 값은 이 브라우저에만 남는다.
 *   축 셋: 미션 모양(M) · 지점 모양(W) · 접힘 2줄 대상(X, 설비 / 현상 / 설비 + 현상)
 */
(function () {
  "use strict";
  var body = document.body;
  if (!/[?&]lab=delta\b/.test(location.search)) { return; }
  if (document.documentElement.lang === "en" || !body.classList.contains("ver-6")) { return; }

  var KEY = "aprism-lab-delta";
  var AXES = [
    { k: "m", t: "미션", opts: [["0", "글자 그대로"], ["a", "A 회색"], ["ab", "A 회색 굵게"], ["b", "B 굵게"], ["c", "C 층 칩 + 굵게"], ["t", "6-1 토큰"], ["tn", "6-2 접힘 번호만"]] },
    { k: "w", t: "지점", opts: [["0", "글자 그대로"], ["w1", "W1 경로 번호"], ["w2", "W2 핀 + 번호"], ["w3", "W3 핀 축소"], ["w4", "W4 지점 꼬리표"], ["wp", "핀 머리(단계 색)"]] },
    { k: "x", t: "접힘 2줄", opts: [["eq", "설비 이름"], ["ph", "현상"], ["eqph", "설비 + 현상"]] },
    { k: "l2", t: "2줄 기본 글색", opts: [["g", "회색 55%(시안, 영문판)"], ["w", "흰색(지금 한글판)"]] },
    { k: "mg", t: "미션 회색 밝기(지금 코드 60%)", opts: [["60", "60%"], ["70", "70%"], ["75", "75%"], ["80", "80%"], ["88", "88%"]] },
    { k: "g", t: "지점과 설비 사이", opts: [["6", "띄어쓰기(약 6px)"], ["4", "4px"], ["3", "3px"], ["2", "2px"]] },
    { k: "e", t: "설비 이름 글", opts: [["0", "그대로"], ["g", "회색"], ["b", "굵게"], ["gb", "회색 굵게"], ["w", "흰색 굵게"], ["r", "설비 그대로, 나머지 회색"], ["rw", "설비 흰색, 나머지 회색"]] }
  ];
  var pick = { m: "0", w: "w1", x: "eq", g: "6", e: "0", mg: "60", l2: "g" };
  try { var saved = JSON.parse(localStorage.getItem(KEY) || "null"); if (saved) { Object.assign(pick, saved); } } catch (e) { /* 저장 안 됨 — 기본값 */ }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(pick)); } catch (e) { /* 무시 */ } }

  var PIN = '<svg viewBox="0 0 12 16" aria-hidden="true"><path d="M6 0a6 6 0 0 0-6 6c0 4.5 6 10 6 10s6-5.5 6-10a6 6 0 0 0-6-6zm0 8.5A2.5 2.5 0 1 1 6 3.5a2.5 2.5 0 0 1 0 5z"/></svg>';

  // ---- 모양 -------------------------------------------------------------
  var css = document.createElement("style");
  css.textContent = [
    ".lab-m-a { color: color-mix(in srgb, var(--text-primary) var(--lab-mg, 60%), transparent); }",
    ".lab-m-ab { color: color-mix(in srgb, var(--text-primary) var(--lab-mg, 60%), transparent); font-weight: 800; }",
    // 2줄 기본 회색 — 10/31 디자이너 시안(영문판 i18n-en.css 와 같은 값)
    "body.lab-l2g .delta3 .ai-line-2 .dl2 { color: color-mix(in srgb, var(--text-primary) 55%, transparent); font-weight: var(--font-weight-regular); }",
    // 실제 코드의 미션 회색(v6.css .dl-m)도 같은 값으로 덮어 본다
    "body.lab-on .delta3 .ai-line-2 .dl-m { color: color-mix(in srgb, var(--text-primary) var(--lab-mg, 60%), transparent); }",
    ".lab-m-b { font-weight: 800; }",
    "body.lab-mb .delta3 .ai-line-2 .dl1 { font-weight: var(--font-weight-regular); }",
    ".lab-m-c, .lab-m-t { font-weight: 800; }",
    ".lab-chip { display: inline-flex; align-items: center; gap: 4px; padding: 0 6px; border-radius: 6px; background: rgb(44 52 67 / 85%); color: #F7F8FA; font-size: 14px; line-height: 22px; font-weight: 800; white-space: nowrap; vertical-align: 1px; }",
    ":root[data-theme='light'] .lab-chip { background: #E8EBF0; color: #16191D; }",
    ".lab-chip .no { color: rgb(247 248 250 / 55%); }",
    ":root[data-theme='light'] .lab-chip .no { color: rgb(22 25 29 / 50%); }",
    ".lab-floor { display: inline-grid; place-items: center; height: 20px; padding: 0 5px; margin-right: 4px; border-radius: 4px; background: rgb(58 66 82 / 90%); color: #C9D0DC; font-size: 13px; font-weight: 600; vertical-align: 1px; }",
    ":root[data-theme='light'] .lab-floor { background: #E8EBF0; color: #5B6470; }",
    ".lab-eq-g { color: color-mix(in srgb, var(--text-primary) 60%, transparent); }",
    ".lab-eq-b { font-weight: 800; }",
    ".lab-eq-gb { color: color-mix(in srgb, var(--text-primary) 60%, transparent); font-weight: 800; }",
    ".lab-eq-w { color: var(--text-primary); font-weight: 800; }",
    ".lab-rest-g { color: color-mix(in srgb, var(--text-primary) 60%, transparent); }",
    ".lab-eq-rw { color: var(--text-primary); }",
    ".lab-w1 { display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; width: 22px; height: 22px; padding-bottom: 0.5px; border-radius: 50%; background: rgb(10 15 24 / 45%); color: #C9D0DC; font-size: 13px; line-height: 1; font-weight: 800; font-variant-numeric: tabular-nums; vertical-align: baseline; margin: 0 1px; }",
    ".lab-w2 { display: inline-flex; align-items: center; gap: 3px; height: 22px; padding: 0 6px 0 5px; border-radius: 6px; background: rgb(44 52 67 / 85%); color: #F7F8FA; font-size: 14px; font-weight: 800; vertical-align: 1px; }",
    ".lab-w2 svg { width: 10px; height: 13px; fill: #9EA8BB; }",
    ":root[data-theme='light'] .lab-w2 { background: #E8EBF0; color: #16191D; }",
    ".lab-w3 { position: relative; display: inline-block; width: 20px; height: 28px; vertical-align: -10px; margin: 0 1px; }",
    ".lab-w3 b { position: absolute; left: 0; top: 0; width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; border: 2px solid #0A0F18; color: #0A0F18; font-size: 11px; line-height: 16px; text-align: center; font-weight: 800; }",
    ".lab-w3::after { content: ''; position: absolute; left: 9px; top: 19px; width: 2px; height: 9px; background: var(--lab-sev); }",
    ".lab-w3 b { background: var(--lab-sev); }",
    ".lab-w4 { display: inline-flex; align-items: center; height: 22px; padding: 0 6px; border-radius: 6px; border: 1px solid color-mix(in srgb, var(--text-primary) 40%, transparent); font-size: 13px; font-weight: 700; vertical-align: 1px; }",
    ".lab-wp { display: inline-grid; place-items: center; width: 20px; height: 20px; box-sizing: border-box; border-radius: 50%; border: 2px solid #0A0F18; background: var(--lab-sev); color: #0A0F18; font-size: 12px; font-weight: 800; vertical-align: -1px; }",
    // 고르기 판
    ".lab-panel { position: fixed; left: 92px; bottom: 16px; z-index: 9999; width: 300px; display: grid; gap: 10px; padding: 14px; border-radius: 10px; background: #12161E; color: #F7F8FA; box-shadow: 0 8px 24px rgb(0 0 0 / 45%); font: 14px/1.4 'SUIT Variable', SUIT, sans-serif; }",
    ".lab-panel h6 { margin: 0; font-size: 15px; font-weight: 800; display: flex; justify-content: space-between; align-items: center; }",
    ".lab-panel h6 button { all: unset; cursor: pointer; color: #9EA8BB; font-size: 14px; }",
    ".lab-panel.is-min > :not(h6) { display: none; }",
    ".lab-axis { display: grid; gap: 6px; }",
    ".lab-axis > span { color: #9EA8BB; font-size: 14px; }",
    ".lab-opts { display: flex; flex-wrap: wrap; gap: 6px; }",
    ".lab-opts button { all: unset; cursor: pointer; padding: 3px 8px; border-radius: 6px; background: #232A36; color: #C9D0DC; font-size: 14px; }",
    ".lab-opts button[aria-pressed='true'] { background: #F7F8FA; color: #0B0E13; font-weight: 700; }",
    ".lab-opts button:focus-visible, .lab-panel h6 button:focus-visible { outline: 2px solid #4DB2FF; outline-offset: 2px; }",
    ".lab-hint { color: #9EA8BB; font-size: 14px; }"
  ].join("\n");
  document.head.appendChild(css);

  // ---- 데이터 ------------------------------------------------------------
  function alerts() { return window.APRISM_DELTA_ALERTS || { all: [], order: [], missionOf: function () { return null; } }; }
  function missions() {
    return Array.prototype.map.call(document.querySelectorAll(".sb-tab[data-mission]"), function (t) {
      var no = t.querySelector(".sb-tab-no");
      return { name: t.getAttribute("data-mission"), no: no ? no.textContent.trim() : "" };
    }).filter(function (m) { return m.name; }).sort(function (a, b) { return b.name.length - a.name.length; });
  }
  function floorOfMission(name) {
    var A = alerts(), hit = (A.all || []).filter(function (a) { return A.missionOf(a) === name; })[0];
    return hit ? hit.floor : "";
  }
  var SEV = { critical: "#FF383C", warning: "#FFC800" };
  function alertAt(floor, n) {
    return (alerts().all || []).filter(function (a) { var m = /\d+/.exec(a.wp || ""); return a.floor === floor && m && +m[0] === n; })[0];
  }

  // ---- 그리기 -----------------------------------------------------------
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function missionHTML(m, floor, collapsed) {
    var name = esc(m.name);
    switch (pick.m) {
      case "a": return '<span data-lab class="lab-m-a">' + name + "</span>";
      case "ab": return '<span data-lab class="lab-m-ab">' + name + "</span>";
      case "b": return '<span data-lab class="lab-m-b">' + name + "</span>";
      case "c": return '<span data-lab>' + (floor ? '<span class="lab-floor">' + esc(floor) + "</span>" : "") + '<span class="lab-m-c">' + name + "</span></span>";
      case "t": return '<span data-lab class="lab-chip"><b class="no">' + esc(m.no) + "</b><b>" + name + "</b></span>";
      case "tn": return collapsed ? '<span data-lab class="lab-chip" title="' + name + '"><b class="no">' + esc(m.no) + "</b></span>"
        : '<span data-lab class="lab-chip"><b class="no">' + esc(m.no) + "</b><b>" + name + "</b></span>";
      default: return null;
    }
  }
  function wpHTML(n, sev) {
    var col = SEV[sev] || "#9EA8BB";
    switch (pick.w) {
      case "w1": return '<span data-lab class="lab-w1">' + n + "</span>";
      case "w2": return '<span data-lab class="lab-w2">' + PIN + n + "</span>";
      case "w3": return '<span data-lab class="lab-w3" style="--lab-sev:' + col + '"><b>' + n + "</b></span>";
      case "w4": return '<span data-lab class="lab-w4">지점 ' + n + "</span>";
      case "wp": return '<span data-lab class="lab-wp" style="--lab-sev:' + col + '">' + n + "</span>";
      default: return null;
    }
  }

  // 글 마디 하나를 고른 모양으로 바꾼다 — 바꿀 것이 없으면 그대로 둔다
  function decorateText(node, collapsed) {
    var t = node.nodeValue, ms = missions(), out = esc(t), hit = false;
    // "B4 7번 지점" · "7번 지점"
    if (pick.w !== "0") {
      out = out.replace(/(?:(B\d+) )?(\d+)번 지점/g, function (all, fl, n) {
        var a = fl ? alertAt(fl, +n) : null, h = wpHTML(+n, a && a.sev);
        if (!h) { return all; }
        hit = true;
        return (fl ? '<span data-lab class="lab-floor">' + fl + "</span>" : "") + h;
      });
    }
    if (pick.m !== "0") {
      ms.forEach(function (m) {
        var re = new RegExp("(?:(B\\d+) )?" + m.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
        out = out.replace(re, function (all, fl) {
          var h = missionHTML(m, fl || floorOfMission(m.name), collapsed);
          if (!h) { return all; }
          hit = true;
          // 층이 붙어 있던 자리(펼침 목록 "B4 정기 순회 점검")는 C · 토큰에서 층을 칩으로, 나머지는 글 그대로
          if (fl && pick.m !== "c") { return (pick.m === "t" || pick.m === "tn" ? '<span data-lab class="lab-floor">' + fl + "</span>" : fl + " ") + h; }
          return h;
        });
      });
    }
    if (!hit) { return; }
    var span = document.createElement("span");
    span.setAttribute("data-lab", "");
    span.setAttribute("data-lab-orig", t);
    span.innerHTML = out;
    node.parentNode.replaceChild(span, node);
  }
  function walk(root, collapsed) {
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeValue.trim() && !(n.parentNode.closest && n.parentNode.closest("[data-lab], .lab-panel, input, textarea, button.delta3-plus, .delta3-clue")) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    var list = [];
    while (tw.nextNode()) { list.push(tw.currentNode); }
    list.forEach(function (n) { decorateText(n, collapsed); });
  }

  // 접힘 2줄 "{설비}부터 확인하세요." — 대상을 바꾸고 지점 토큰을 앞에 둔다
  function line2() {
    var dl2 = document.querySelector(".delta3 .ai-line-2 .dl2");
    var first = (alerts().order || [])[0];
    if (!dl2 || !first || dl2.querySelector("[data-lab]")) { return; }
    var m = /^(.+?)부터 확인하세요\.$/.exec(dl2.textContent.trim());
    if (!m) { return; }
    var tgt = pick.x === "ph" ? first.phen || m[1] : pick.x === "eqph" ? (first.eq || m[1]) + " " + (first.phen || "") : m[1];
    var n = /\d+/.exec(first.wp || ""), w = n ? wpHTML(+n[0], first.sev) : null;
    // 지점과 설비 사이 — 띄어쓰기 대신 지점 표식 오른쪽 여백으로 잰다(6 = 띄어쓰기 그대로)
    if (w && pick.g !== "6") { w = w.replace('<span data-lab class="', '<span data-lab style="margin-right:' + pick.g + 'px" class="'); }
    var eqCls = pick.e !== "0" && pick.e !== "r" ? ' class="lab-eq-' + pick.e + '"' : "";
    dl2.setAttribute("data-lab-line", dl2.textContent);
    dl2.innerHTML = (w ? w + (pick.g === "6" ? " " : "") : "") + "<span data-lab><span" + eqCls + ">" + esc(tgt.trim()) + "</span>" + (pick.e === "r" || pick.e === "rw" ? "<span class=\"lab-rest-g\">부터 확인하세요.</span>" : "부터 확인하세요.") + "</span>";
  }

  // 고른 값을 바꾸면 원래 글로 되돌린 뒤 다시 입힌다
  function restore() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-lab-line]"), function (e) { e.textContent = e.getAttribute("data-lab-line"); e.removeAttribute("data-lab-line"); });
    Array.prototype.forEach.call(document.querySelectorAll("[data-lab-orig]"), function (e) { if (e.parentNode) { e.parentNode.replaceChild(document.createTextNode(e.getAttribute("data-lab-orig")), e); } });
  }
  var busy = false;
  function paint() {
    body.classList.add("lab-on");
    body.classList.toggle("lab-l2g", pick.l2 !== "w");
    body.style.setProperty("--lab-mg", (pick.mg || "60") + "%");
    if (busy) { return; }
    busy = true;
    body.classList.toggle("lab-mb", pick.m === "b");
    var line = document.querySelector(".delta3 .ai-line-2");
    if (line) { line2(); walk(line, !document.querySelector(".delta3.is-open")); }
    Array.prototype.forEach.call(document.querySelectorAll(".delta3 .dc-msg"), function (m) { walk(m, false); });
    busy = false;
  }

  // 판이 갈아 끼워질 때마다 다시 입힌다(monitor.js 가 글을 새로 쓴다)
  var win = document.querySelector("[data-delta3]") || document.querySelector(".delta3");
  if (win) {
    new MutationObserver(function () { if (!busy) { requestAnimationFrame(paint); } }).observe(win, { childList: true, subtree: true, characterData: true });
  }
  document.addEventListener("aprism:severity", function () { setTimeout(paint, 30); });

  // ---- 고르기 판 --------------------------------------------------------
  var panel = document.createElement("div");
  panel.className = "lab-panel";
  panel.innerHTML = '<h6>Delta 표시 실험 <button type="button" data-min>접기</button></h6>';
  AXES.forEach(function (ax) {
    var box = document.createElement("div");
    box.className = "lab-axis";
    box.innerHTML = "<span>" + ax.t + "</span>";
    var opts = document.createElement("div");
    opts.className = "lab-opts";
    ax.opts.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.textContent = o[1];
      b.setAttribute("aria-pressed", String(pick[ax.k] === o[0]));
      b.addEventListener("click", function () {
        pick[ax.k] = o[0];
        save();
        Array.prototype.forEach.call(opts.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        busy = true; restore(); busy = false;
        paint();
      });
      opts.appendChild(b);
    });
    box.appendChild(opts);
    panel.appendChild(box);
  });
  var hint = document.createElement("p");
  hint.className = "lab-hint";
  hint.textContent = "미션 이동 문형은 위에서 주의만 있는 미션 탭(M2)을 누르면 나와요. 펼친 Delta에서도 같은 모양이 입혀져요.";
  hint.style.margin = "0";
  panel.appendChild(hint);
  body.appendChild(panel);
  panel.querySelector("[data-min]").addEventListener("click", function (e) {
    var min = panel.classList.toggle("is-min");
    e.currentTarget.textContent = min ? "펴기" : "접기";
  });
  setTimeout(paint, 300);
})();
