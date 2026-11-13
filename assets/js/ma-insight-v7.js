/*
 * [11/11 v7 디자이너] 챗봇형 시안(main-v7-chat) 알림 팝오버 — 사진은 원래 높이(187)로 두고 남는 높이에 판단 근거를 넣는다.
 * [11/13 디자이너 2차] 덩어리를 위에서부터 결과 → 원인 → 조치 로 묶는다(예전엔 기준 줄 · 추이 · 원인 · 권고가 따로 떠 경계가 흐렸다).
 *   ① 결과: 사진 아래 카드 하나 — 지금 값(크게, 단계색) + "기준 0.80 · +0.06 초과" 칩 + 추이 그래프(기준 위 구역 음영 · 면 채움 · 시각)
 *           예전 기준 줄(.ma-reason)은 이 카드로 흡수(숨김). 그래프 기준 = 지금 값 − 기준 줄의 초과량(같은 숫자에서 나와 어긋나지 않는다)
 *   ② 원인: 순위 · 이름 · 가능성 막대(시안 값) + "먼저 볼 것" 한 줄(1순위와 이어진다)
 *   ③ 조치: 권고 · 체크 · 메모 묶음(.ma-delta) 위에 구분선 + "조치" 머리 — 판단에서 행동으로 넘어가는 경계
 *   Delta 가 오른쪽 아래로 접혀 있는 시안이라 "왜 생겼나"를 팝오버가 든다. 대화창은 "왜 그렇게 보는지" 설명을 맡는다(같은 말 두 번 안 함).
 *   값: 알림 데이터(alert-data-v7.js monitor.hist · trend · cause · causeP · fixFirst)가 있으면 그것, 없으면 감지 종류별 시안 값(임시).
 *   화면이 낮으면 그래프가 먼저 줄고, 그다음 결과 · 원인 칸이 안에서 스크롤된다(조치 체크 · 단추는 늘 보인다).
 */
(function () {
  "use strict";
  if (!document.body.classList.contains("d3-chat")) { return; }
  var box = document.querySelector("[data-map-alert]");
  var S7 = window.APRISM_ALERTS7;
  if (!box || !S7) { return; }

  // 감지 종류별 시안 값 — [원인 후보 3, 가능성(%) 3, 먼저 볼 것]
  var CAUSE = {
    "계기인식": [["감압 밸브 설정 이상", "하류 밸브 닫힘", "주변 온도 상승"], [62, 24, 14], "감압 밸브 설정부터 보는 게 가장 빨라요."],
    "누출감지": [["배관 이음부 실링 열화", "밸브 패킹 마모", "결로를 누출로 오인"], [55, 30, 15], "이음부 실링 상태부터 보세요."],
    "이상음향": [["베어링 마모", "축 정렬 불량", "고정 볼트 풀림"], [58, 27, 15], "베어링 소음부터 귀로 확인해 보세요."],
    "온도감지": [["냉각 불량", "과부하 운전", "주변 열원 영향"], [50, 32, 18], "냉각수 흐름부터 확인해 보세요."],
    "부분방전": [["절연물 열화", "케이블 접속부 오염", "습기 유입"], [48, 34, 18], "접속부 오염 여부부터 보세요."],
    "안전감지": [["고소 작업 중 미착용", "고리 체결 누락", "카메라 각도로 고리 미검출"], [70, 20, 10], "작업자에게 무전으로 착용부터 확인하세요."]
  };

  var wrap = document.createElement("div");
  wrap.className = "ma-ins";
  wrap.innerHTML =
    '<section class="ma-grp is-result"><h4 class="ma-grp-h"><span>결과</span><span class="ma-grp-sub" data-ins-trend></span></h4>' +
      '<div class="ma-ins-card">' +
        '<div class="ma-res-top"><span class="ma-res-v" data-ins-v></span><span class="ma-res-chip" data-ins-chip></span></div>' +
        '<div class="ma-ins-chart"></div>' +
      '</div></section>' +
    '<section class="ma-grp is-cause"><h4 class="ma-grp-h"><span>원인</span><span class="ma-grp-sub">추정 · 가능성 순</span></h4>' +
      '<div class="ma-ins-card"><ol class="ma-cause"></ol><p class="ma-first"><b>먼저 볼 것</b><span data-ins-first></span></p></div></section>';
  var actH = document.createElement("h4");
  actH.className = "ma-grp-h is-act";
  actH.innerHTML = "<span>조치</span>";

  function num(s) { var m = /-?\d+(?:\.\d+)?/.exec(String(s || "")); return m ? parseFloat(m[0]) : NaN; }
  function unit(s) { return String(s || "").replace(/^[^\d-]*-?\d+(?:\.\d+)?\s*/, "").trim(); }
  function dec(s) { var m = /\.(\d+)/.exec(String(s || "")); return m ? m[1].length : 0; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function find() {
    var wp = box.getAttribute("data-wp") || "";
    var title = (box.querySelector("[data-ma-title]") || {}).textContent || "";
    title = title.replace(/\s+/g, " ").trim();
    return S7.list.filter(function (a) { return a.wp === wp && title.indexOf(a.value) >= 0 && title.indexOf(a.label) >= 0; })[0] ||
      S7.list.filter(function (a) { return title.indexOf(a.label + " " + a.value) >= 0; })[0] || null;
  }

  // 측정 시각 — 마지막 = 감지 시각(사진 꼬리표), 앞은 20분 간격(시안)
  function times(n) {
    var t = ((box.querySelector(".ma-st-time") || {}).textContent || "").trim();
    var m = /(\d{1,2}):(\d{2})/.exec(t), base = m ? (+m[1]) * 60 + (+m[2]) : 10 * 60 + 12, out = [];
    for (var i = n - 1; i >= 0; i--) { var x = (base - i * 20 + 1440) % 1440; out.push(String(Math.floor(x / 60)).padStart(2, "0") + ":" + String(x % 60).padStart(2, "0")); }
    return out;
  }

  function chart(vals, std, d, u, sev, H, tl) {
    var W = 260, pl = 4, pr = 4, top = 18, bot = 18;
    H = Math.max(72, Math.min(200, H || 72));
    var lo = Math.min.apply(null, vals.concat([std])), hi = Math.max.apply(null, vals.concat([std]));
    var pad = (hi - lo) * 0.28 || 1; lo -= pad; hi += pad * 0.6;
    var X = function (i) { return pl + 6 + (W - pl - pr - 12) * (vals.length === 1 ? 0.5 : i / (vals.length - 1)); };
    var Y = function (v) { return top + (H - top - bot) * (1 - (v - lo) / (hi - lo)); };
    var ys = Y(std).toFixed(1), yb = (H - bot).toFixed(1);
    var pts = vals.map(function (v, i) { return X(i).toFixed(1) + "," + Y(v).toFixed(1); });
    var g = '<svg viewBox="0 0 ' + W + " " + H + '" class="ma-ins-svg" role="img" aria-label="최근 측정 ' + vals.join(", ") + " " + esc(u) + ", 기준 " + std.toFixed(d) + '">';
    g += '<defs><linearGradient id="maInsFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="ma-ins-f0"/><stop offset="1" class="ma-ins-f1"/></linearGradient></defs>';
    // 기준을 넘는 구역 — 단계색을 아주 옅게
    g += '<rect class="ma-ins-zone is-' + sev + '" x="0" y="0" width="' + W + '" height="' + ys + '"/>';
    // 가로 눈금(기준 아래 두 줄)
    [0.5, 1].forEach(function (k) { var y = (+ys + (+yb - +ys) * k).toFixed(1); g += '<line class="ma-ins-grid" x1="0" x2="' + W + '" y1="' + y + '" y2="' + y + '"/>'; });
    g += '<polygon class="ma-ins-area" points="' + X(0).toFixed(1) + "," + yb + " " + pts.join(" ") + " " + X(vals.length - 1).toFixed(1) + "," + yb + '"/>';
    g += '<line class="ma-ins-std is-' + sev + '" x1="0" x2="' + W + '" y1="' + ys + '" y2="' + ys + '"/>';
    g += '<text class="ma-ins-stdt is-' + sev + '" x="2" y="' + (+ys - 4).toFixed(1) + '">기준 ' + std.toFixed(d) + "</text>";
    g += '<polyline class="ma-ins-line" points="' + pts.join(" ") + '"/>';
    vals.forEach(function (v, i) {
      var over = v > std, last = i === vals.length - 1, x = X(i).toFixed(1), y = Y(v).toFixed(1);
      g += '<circle class="ma-ins-pt' + (over ? " is-over is-" + sev : "") + (last ? " is-last" : "") + '" cx="' + x + '" cy="' + y + '" r="' + (last ? 4 : 2.5) + '"/>';
      if (last) { g += '<text class="ma-ins-lastv is-' + sev + '" x="' + x + '" y="' + (+y - 8).toFixed(1) + '" text-anchor="end">' + v.toFixed(d) + "</text>"; }
      g += '<text class="ma-ins-t' + (last ? " is-last" : "") + '" x="' + x + '" y="' + (H - 4) + '" text-anchor="' + (i === 0 ? "start" : last ? "end" : "middle") + '">' + tl[i] + "</text>";
    });
    return g + "</svg>";
  }

  var lastKey = "", cur = null;
  // 그래프 높이 = 결과 카드에 남은 높이(72 ~ 200) — 칸 폭(260 기준)에 비례해 viewBox 높이를 정한다
  function draw() {
    if (!cur) { return; }
    var host = wrap.querySelector(".ma-ins-chart");
    host.innerHTML = "";
    var w = host.clientWidth || 260, h = host.clientHeight || 72;
    host.innerHTML = chart(cur[0], cur[1], cur[2], cur[3], cur[4], h * 260 / w, cur[5]);
  }
  if (window.ResizeObserver) { var rsz = 0; new ResizeObserver(function () { var k = wrap.clientHeight; if (k !== rsz) { rsz = k; draw(); } }).observe(wrap); }

  function render() {
    if (box.hidden || !box.classList.contains("ma-v3")) { return; }
    var a = find(), key = a ? a.id : "";
    var reason = box.querySelector(".ma-reason"), act = box.querySelector(".ma-delta");
    if (!wrap.isConnected || wrap.previousElementSibling !== reason) {
      if (reason && reason.parentNode) { reason.parentNode.insertBefore(wrap, reason.nextSibling); }
    }
    if (act && act.previousElementSibling !== actH) { act.parentNode.insertBefore(actH, act); }
    if (key === lastKey) { return; }
    lastKey = key;
    wrap.hidden = !a;
    box.classList.toggle("has-ins", !!a);
    if (!a) { return; }
    var m = a.monitor || {}, sev = a.sev === "critical" ? "critical" : "warning";
    wrap.setAttribute("data-sev", sev);

    // ① 결과
    var v = num(a.value), u = unit(a.value), d = dec(a.value);
    var ex = num(reason ? reason.textContent : ""), std = isNaN(ex) ? (m.std ? num(m.std) : v * 0.92) : v - Math.abs(ex);
    var hasNum = !isNaN(v);
    wrap.querySelector("[data-ins-v]").innerHTML = hasNum ? esc(v.toFixed(d)) + (u ? " <small>" + esc(u) + "</small>" : "") : esc(a.value || a.label);
    var chip = wrap.querySelector("[data-ins-chip]");
    if (hasNum && !isNaN(std) && a.detect !== "안전감지") { chip.textContent = "기준 " + std.toFixed(d) + " · " + (v >= std ? "+" : "") + (v - std).toFixed(d) + " 초과"; chip.hidden = false; }
    else { chip.textContent = reason ? reason.textContent.trim() : ""; chip.hidden = !chip.textContent; }
    var showTrend = hasNum && a.detect !== "안전감지";
    var res = wrap.querySelector(".is-result");
    res.classList.toggle("no-chart", !showTrend);
    box.classList.toggle("ins-nochart", !showTrend);   // 그래프가 없으면(안전감지) 사진이 결과의 근거 — 남는 높이를 사진이 갖는다(v7.css)
    var trendTxt = wrap.querySelector("[data-ins-trend]");
    trendTxt.textContent = "";
    if (showTrend) {
      var vals = (m.hist && m.hist.length >= 2) ? m.hist.map(num) : null;
      if (!vals) { var dd = Math.max(Math.abs(v - std), Math.abs(std) * 0.03); vals = [std - dd * 1.1, std - dd * 0.7, std - dd * 0.3, std + dd * 0.2, v]; }
      vals = vals.map(function (x) { return +x.toFixed(d); });
      var rising = vals.every(function (x, i) { return i === 0 || x >= vals[i - 1]; });
      trendTxt.textContent = m.trend || ("최근 " + vals.length + "회 " + (rising ? "계속 오름" : "오르내림"));
      cur = [vals, std, d, u, sev, times(vals.length)];
      draw();
    } else { cur = null; wrap.querySelector(".ma-ins-chart").innerHTML = ""; }

    // ② 원인
    var base = CAUSE[a.detect] || CAUSE["계기인식"];
    var names = (m.cause && m.cause.length) ? m.cause : base[0];
    var ps = (m.causeP && m.causeP.length) ? m.causeP : base[1];
    var first = (m.cause && m.cause.length) ? (m.fixFirst || "") : base[2];
    var ol = wrap.querySelector(".ma-cause"); ol.textContent = "";
    names.slice(0, 3).forEach(function (t, i) {
      var p = ps[i] || 0, li = document.createElement("li");
      li.className = i === 0 ? "is-top" : "";
      li.innerHTML = '<span class="ma-cause-n">' + (i + 1) + '</span><span class="ma-cause-t">' + esc(t) + '</span><span class="ma-cause-p num">' + p + '%</span>' +
        '<span class="ma-cause-bar" aria-hidden="true"><i style="width:' + p + '%"></i></span>';
      ol.appendChild(li);
    });
    var fp = wrap.querySelector(".ma-first"); wrap.querySelector("[data-ins-first]").textContent = first; fp.hidden = !first;
  }
  new MutationObserver(function () { setTimeout(render, 0); }).observe(box, { attributes: true, attributeFilter: ["hidden", "data-wp"], subtree: true, childList: true, characterData: true });
  render();
})();
