/*
 * [11/11 v7 디자이너] 챗봇형 시안(main-v7-chat) 알림 팝오버 — 사진은 원래 높이(187)로 두고 남는 높이에 판단 근거를 넣는다.
 *   ① 측정 추이: 최근 측정값 꺾은선 + 기준 점선(기준 = 지금 값 − 팝오버 "기준 초과 +x" 의 x — 같은 숫자에서 나와 어긋나지 않는다)
 *   ② 추정 원인: 후보 2~3개(가능성 순) + 먼저 볼 것 한 줄
 *   Delta 가 오른쪽 아래로 접혀 있는 시안이라 "왜 생겼나"를 팝오버가 든다. 대화창은 "왜 그렇게 보는지" 설명을 맡는다(같은 말 두 번 안 함).
 *   값: 알림 데이터(alert-data-v7.js monitor.hist · trend · cause · fixFirst)가 있으면 그것, 없으면 감지 종류별 시안 값(임시).
 *   자리: 기준 줄(.ma-reason) 바로 아래 · 권고 줄 위. 화면이 낮으면 이 칸이 먼저 줄어 안에서 스크롤된다(조치 체크 · 단추는 늘 보인다).
 */
(function () {
  "use strict";
  if (!document.body.classList.contains("d3-chat")) { return; }
  var box = document.querySelector("[data-map-alert]");
  var S7 = window.APRISM_ALERTS7;
  if (!box || !S7) { return; }

  var CAUSE = {
    "계기인식": [["감압 밸브 설정 이상", "하류 밸브 닫힘", "주변 온도 상승"], "감압 밸브 설정부터 보는 게 가장 빨라요."],
    "누출감지": [["배관 이음부 실링 열화", "밸브 패킹 마모", "결로를 누출로 오인"], "이음부 실링 상태부터 보세요."],
    "이상음향": [["베어링 마모", "축 정렬 불량", "고정 볼트 풀림"], "베어링 소음부터 귀로 확인해 보세요."],
    "온도감지": [["냉각 불량", "과부하 운전", "주변 열원 영향"], "냉각수 흐름부터 확인해 보세요."],
    "부분방전": [["절연물 열화", "케이블 접속부 오염", "습기 유입"], "접속부 오염 여부부터 보세요."],
    "안전감지": [["고소 작업 중 미착용", "고리 체결 누락", "카메라 각도로 고리 미검출"], "작업자에게 무전으로 착용부터 확인하세요."]
  };

  var wrap = document.createElement("div");
  wrap.className = "ma-ins";
  wrap.innerHTML =
    '<section class="ma-ins-sec is-trend"><h4 class="ma-ins-h"><span>측정 추이</span><span class="ma-ins-sub"></span></h4><div class="ma-ins-chart"></div></section>' +
    '<section class="ma-ins-sec is-cause"><h4 class="ma-ins-h"><span>추정 원인</span><span class="ma-ins-sub">가능성 순</span></h4><ol class="ma-ins-list"></ol><p class="ma-ins-first"></p></section>';

  function num(s) { var m = /-?\d+(?:\.\d+)?/.exec(String(s || "")); return m ? parseFloat(m[0]) : NaN; }
  function unit(s) { return String(s || "").replace(/^[^\d-]*-?\d+(?:\.\d+)?\s*/, "").trim(); }
  function dec(s) { var m = /\.(\d+)/.exec(String(s || "")); return m ? m[1].length : 0; }

  function find() {
    var wp = box.getAttribute("data-wp") || "";
    var title = (box.querySelector("[data-ma-title]") || {}).textContent || "";
    title = title.replace(/\s+/g, " ").trim();
    return S7.list.filter(function (a) { return a.wp === wp && title.indexOf(a.value) >= 0 && title.indexOf(a.label) >= 0; })[0] ||
      S7.list.filter(function (a) { return title.indexOf(a.label + " " + a.value) >= 0; })[0] || null;
  }

  function chart(vals, std, d, u, sev, H) {
    var W = 260, px = 10, top = 12, bot = 16;
    H = Math.max(64, Math.min(180, H || 64));
    var lo = Math.min.apply(null, vals.concat([std])), hi = Math.max.apply(null, vals.concat([std]));
    var pad = (hi - lo) * 0.25 || 1; lo -= pad; hi += pad;
    var X = function (i) { return px + (W - 2 * px) * (vals.length === 1 ? 0.5 : i / (vals.length - 1)); };
    var Y = function (v) { return top + (H - top - bot) * (1 - (v - lo) / (hi - lo)); };
    var pts = vals.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" ");
    var g = '<svg viewBox="0 0 ' + W + " " + H + '" class="ma-ins-svg" role="img" aria-label="최근 측정 ' + vals.join(", ") + " " + u + ", 기준 " + std.toFixed(d) + '">';
    g += '<line class="ma-ins-std" x1="0" x2="' + W + '" y1="' + Y(std).toFixed(1) + '" y2="' + Y(std).toFixed(1) + '"/>';
    g += '<text class="ma-ins-stdt" x="' + (W - 2) + '" y="' + (Y(std) - 3).toFixed(1) + '" text-anchor="end">기준 ' + std.toFixed(d) + '</text>';
    g += '<polyline class="ma-ins-line" points="' + pts + '"/>';
    vals.forEach(function (v, i) {
      var over = v > std, last = i === vals.length - 1;
      g += '<circle class="ma-ins-pt' + (over ? " is-over is-" + sev : "") + (last ? " is-last" : "") + '" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) + '" r="' + (last ? 3.5 : 2.5) + '"/>';
      g += '<text class="ma-ins-v' + (over ? " is-over is-" + sev : "") + '" x="' + X(i).toFixed(1) + '" y="' + (H - 3) + '" text-anchor="' + (i === 0 ? "start" : last ? "end" : "middle") + '">' + v.toFixed(d) + "</text>";
    });
    return g + "</svg>";
  }

  var lastKey = "", cur = null;
  // 그래프 높이 = 칸에 남은 높이(그래프 칸이 남는 높이를 받는다, 64 ~ 180) — 칸 폭(260 기준)에 비례해 viewBox 높이를 정한다
  function draw() {
    if (!cur) { return; }
    var host = wrap.querySelector(".ma-ins-chart");
    host.innerHTML = "";
    var w = host.clientWidth || 260, h = host.clientHeight || 64;
    host.innerHTML = chart(cur[0], cur[1], cur[2], cur[3], cur[4], h * 260 / w);
  }
  if (window.ResizeObserver) { var rsz = 0; new ResizeObserver(function () { var k = wrap.clientHeight; if (k !== rsz) { rsz = k; draw(); } }).observe(wrap); }
  function render() {
    if (box.hidden || !box.classList.contains("ma-v3")) { return; }
    var a = find(), key = a ? a.id : "";
    var reason = box.querySelector(".ma-reason");
    if (!wrap.isConnected || wrap.previousElementSibling !== reason) {
      if (reason && reason.parentNode) { reason.parentNode.insertBefore(wrap, reason.nextSibling); }
    }
    if (key === lastKey) { return; }
    lastKey = key;
    wrap.hidden = !a;
    if (!a) { return; }
    var m = a.monitor || {}, sev = a.sev === "critical" ? "critical" : "warning";
    // ① 측정 추이
    var trend = wrap.querySelector(".is-trend"), v = num(a.value), u = unit(a.value), d = dec(a.value);
    var ex = num(reason ? reason.textContent : ""), std = isNaN(ex) ? (m.std ? num(m.std) : v * 0.92) : v - Math.abs(ex);
    var showTrend = !isNaN(v) && a.detect !== "안전감지";
    trend.hidden = !showTrend;
    if (showTrend) {
      var vals = (m.hist && m.hist.length >= 2) ? m.hist.map(num) : null;
      if (!vals) { var dd = Math.max(Math.abs(v - std), Math.abs(std) * 0.03); vals = [std - dd * 0.9, std - dd * 0.4, std + dd * 0.3, v]; }
      vals = vals.map(function (x) { return +x.toFixed(d); });
      var rising = vals.every(function (x, i) { return i === 0 || x >= vals[i - 1]; });
      wrap.querySelector(".is-trend .ma-ins-sub").textContent = m.trend || ("최근 " + vals.length + "회 " + (rising ? "계속 오름" : "오르내림"));
      cur = [vals, std, d, u, sev];
      draw();
    }
    // ② 추정 원인
    var c = (m.cause && m.cause.length) ? [m.cause, m.fixFirst || ""] : (CAUSE[a.detect] || CAUSE["계기인식"]);
    var ol = wrap.querySelector(".ma-ins-list"); ol.textContent = "";
    c[0].slice(0, 3).forEach(function (t) { var li = document.createElement("li"); li.textContent = t; ol.appendChild(li); });
    var first = wrap.querySelector(".ma-ins-first"); first.textContent = c[1]; first.hidden = !c[1];
  }
  new MutationObserver(function () { setTimeout(render, 0); }).observe(box, { attributes: true, attributeFilter: ["hidden", "data-wp"], subtree: true, childList: true, characterData: true });
  render();
})();
