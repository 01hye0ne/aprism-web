/*
 * 움직임 시뮬레이션 — 상태 8개 · 재생 · 진행 슬라이더(route-rules 시안과 같은 조작).
 * map.js 의 window.APRISM_RR 로 로봇 자리와 상태를 바꾼다. 재생하면 지점마다 서서 측정하고,
 * 끝에 닿으면 미션 완료로 넘어간다.
 *
 * 화면 곳곳이 같은 박자로 따라온다(decorate).
 *   지도 로봇 둘레   측정 눈금 6칸 — 0.5초에 한 칸(측정 중)
 *   우측 지금 카드   측정 중 원형 진행도 · 이동 중 도착 예상 · 일시정지 경과 · 긴급정지 띠 · 통신 끊김
 *   우측 진행 막대   지나온 칸 수 · % · 지금 지점 이름
 */
(function () {
  "use strict";
  var MODES = [["run", "이동 중"], ["inspect", "지점 측정 중"], ["alert", "위험 감지"], ["pause", "일시정지"],
    ["estop", "긴급정지"], ["return", "자동복귀"], ["lost", "통신 끊김"], ["done", "미션 완료"]];
  var box = document.createElement("section");
  box.className = "rsim";
  box.setAttribute("aria-label", "움직임 시뮬레이션");
  box.innerHTML = '<div class="rsim-chips" role="group" aria-label="상태">' +
    MODES.map(function (m) { return '<button type="button" data-m="' + m[0] + '" aria-pressed="' + (m[0] === "run") + '">' + m[1] + "</button>"; }).join("") +
    '</div><div class="rsim-bar"><button type="button" class="rsim-play">재생</button>' +
    '<input type="range" min="0" max="1000" value="0" aria-label="미션 진행도"><span class="rsim-pct">0%</span><span class="rsim-lanes" hidden></span><span class="rsim-lanes rsim-x" role="group" aria-label="지점 수"><span>지점</span><button type="button" data-wpn="20" aria-pressed="true">20개</button><button type="button" data-wpn="60" aria-pressed="false">60개</button></span></div>' +
    '<p class="rsim-wait">지도 모델을 불러오는 중</p>';
  document.body.appendChild(box);

  (function () {   // [10/30] 접기 — 접으면 오른쪽 아래 구석에 작은 화살표만 남는다. 접힘 여부는 기억한다
    var fold = document.createElement("button");
    fold.type = "button";
    fold.className = "rsim-fold";
    fold.innerHTML = '<svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    box.appendChild(fold);
    function setFold(on) {
      box.classList.toggle("is-folded", on);
      fold.setAttribute("aria-expanded", String(!on));
      fold.setAttribute("aria-label", on ? "움직임 시뮬레이션 펼치기" : "움직임 시뮬레이션 접기");
      try { localStorage.setItem("rsim-folded", on ? "1" : "0"); } catch (e) { }
    }
    var saved = false; try { saved = localStorage.getItem("rsim-folded") === "1"; } catch (e) { }
    setFold(saved);
    fold.addEventListener("click", function () { setFold(!box.classList.contains("is-folded")); });
  })();

  var api = null, range = box.querySelector("input"), pct = box.querySelector(".rsim-pct"), play = box.querySelector(".rsim-play");
  var mode = "run", playing = false, dwell = null, last = 0, modeAt = performance.now(), touched = false;
  var SPEED_SEC = 70;   // 한 바퀴 시간

  function press(m) {
    if (m !== mode) { modeAt = performance.now(); }
    mode = m;
    touched = true;
    Array.prototype.forEach.call(box.querySelectorAll("[data-m]"), function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-m") === m)); });
  }
  function show() {
    if (!api) { return; }
    var t = api.total() || 1, f = Math.max(0, Math.min(1, api.get() / t));
    range.value = Math.round(f * 1000);
    pct.textContent = Math.round(f * 100) + "%";
  }
  function stop() { playing = false; dwell = null; play.textContent = "재생"; }
  function setMode(m) {
    press(m);
    api.mode(m);
    if (m === "done") { api.set(api.total()); }
    if (m === "inspect") {   // 가장 가까운 앞 지점에 세운다
      var s = api.get(), next = api.stops().filter(function (x) { return x >= s - 1e-6; })[0];
      if (next !== undefined) { api.set(next); }
    }
    show();
  }
  function resume() { stop(); setMode("run"); api.set(api.get() + api.total() * 0.0005); show(); }

  (function () {   // [10/22 실험] 지점 수 — 고르면 다시 연다
    var cur = "20"; try { cur = localStorage.getItem("rr-wp-total") === "60" ? "60" : "20"; } catch (e) { }
    Array.prototype.forEach.call(box.querySelectorAll("[data-wpn]"), function (x) { x.setAttribute("aria-pressed", String(x.getAttribute("data-wpn") === cur)); });
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-wpn]"); if (!b || b.getAttribute("data-wpn") === cur) { return; }
      try { localStorage.setItem("rr-wp-total", b.getAttribute("data-wpn")); } catch (er) { }
      location.reload();
    });
  })();
  box.addEventListener("click", function (e) {   // [10/22 실험] 앞길 선, 번호 표현
    var b = e.target.closest("[data-ahead], [data-pv], [data-past], [data-flow], [data-thin]"); if (!b || !api) { return; }
    var k = b.hasAttribute("data-ahead") ? "data-ahead" : b.hasAttribute("data-pv") ? "data-pv" : b.hasAttribute("data-flow") ? "data-flow" : b.hasAttribute("data-thin") ? "data-thin" : "data-past";
    if (k === "data-thin" && api.thin) { api.thin(b.getAttribute(k)); }
    if (k === "data-flow" && api.flow) { api.flow(b.getAttribute(k)); }
    if (k === "data-past" && api.pastNo) { api.pastNo(b.getAttribute(k)); }
    if (k === "data-ahead" && api.ahead) { api.ahead(b.getAttribute(k)); }
    if (k === "data-pv" && api.pins) { api.pins(b.getAttribute(k)); }
    Array.prototype.forEach.call(box.querySelectorAll("[" + k + "]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
  });
  box.querySelector(".rsim-lanes").addEventListener("click", function (e) {
    var b = e.target.closest("[data-lanes]"); if (!b || !api || !api.lanes) { return; }
    api.lanes(b.getAttribute("data-lanes"));
    Array.prototype.forEach.call(box.querySelectorAll("[data-lanes]"), function (x) { x.setAttribute("aria-pressed", String(x === b)); });
  });
  box.querySelector(".rsim-chips").addEventListener("click", function (e) {
    var b = e.target.closest("[data-m]");
    if (!b || !api) { return; }
    stop();
    setMode(b.getAttribute("data-m"));
  });
  range.addEventListener("input", function () {
    if (!api) { return; }
    stop();
    if (mode === "done" || mode === "inspect") { press("run"); api.mode("run"); }
    touched = true;
    api.set(range.value / 1000 * api.total());
    show();
  });
  play.addEventListener("click", function () {
    if (!api) { return; }
    if (playing) { stop(); return; }
    if (mode === "done" || api.get() >= api.total() - 1e-6) { press("run"); api.mode("run"); api.set(0); }
    else if (mode !== "run" && mode !== "return") { press("run"); api.mode("run"); }
    playing = true; last = 0; play.textContent = "멈춤";
  });

  /* ---------- 지도 — 측정 눈금 6칸(로봇 둘레) ---------- */
  var NS = "http://www.w3.org/2000/svg";
  function ringOf() {
    var bot = document.querySelector(".map-bot");
    if (!bot) { return null; }
    var r = bot.querySelector(".rr-ring");
    if (r) { return r; }
    r = document.createElementNS(NS, "svg");
    r.setAttribute("class", "rr-ring");
    r.setAttribute("viewBox", "-30 -30 60 60");
    r.setAttribute("aria-hidden", "true");
    for (var k = 0; k < 6; k += 1) {
      var a0 = -Math.PI / 2 + k * Math.PI / 3 + .12, a1 = a0 + Math.PI / 3 - .24, R = 24;
      var p = document.createElementNS(NS, "path");
      p.setAttribute("d", "M" + (Math.cos(a0) * R).toFixed(2) + " " + (Math.sin(a0) * R).toFixed(2) + " A" + R + " " + R + " 0 0 1 " + (Math.cos(a1) * R).toFixed(2) + " " + (Math.sin(a1) * R).toFixed(2));
      r.appendChild(p);
    }
    bot.appendChild(r);
    return r;
  }

  /* ---------- 지도 — 일시정지 고리 + 재개 버튼(시안 C안) ---------- */
  var PR = 23, PCIRC = 2 * Math.PI * PR;
  function pauseOf() {
    var bot = document.querySelector(".map-bot");
    if (!bot) { return null; }
    var g = bot.querySelector(".rr-pause");
    if (g) { return g; }
    g = document.createElement("div");
    g.className = "rr-pause";
    g.innerHTML = '<svg viewBox="-30 -30 60 60" aria-hidden="true"><circle r="' + PR + '" class="trk"></circle>' +
      '<circle r="' + PR + '" class="val" stroke-dasharray="' + PCIRC.toFixed(2) + '" stroke-dashoffset="' + PCIRC.toFixed(2) + '" transform="rotate(-90)"></circle></svg>' +
      '<button type="button" class="rr-pause-go" aria-label="재개"><svg viewBox="-6 -6 12 12" aria-hidden="true"><path d="M-2.5 -4 L4 0 L-2.5 4 Z"></path></svg></button>';
    g.querySelector("button").addEventListener("click", function (e) { e.stopPropagation(); resume(); });
    bot.appendChild(g);
    return g;
  }

  /* ---------- 우측 지금 카드 — 상태 줄 ---------- */
  var CIRC = 69.12;
  function noteHtml(m) {
    if (m === "inspect") {
      return '<div class="rr-note is-measure"><svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true"><circle cx="14" cy="14" r="11" class="trk"></circle>' +
        '<circle cx="14" cy="14" r="11" class="val" stroke-dasharray="' + CIRC + '" stroke-dashoffset="' + CIRC + '" transform="rotate(-90 14 14)"></circle></svg>' +
        '<span>측정 중</span><span class="num" data-rr="pct">0%</span></div>';
    }
    if (m === "run" || m === "alert") { return '<div class="rr-note"><span>이동 중</span><span class="num" data-rr="eta"></span></div>'; }
    if (m === "pause") {
      return '<div class="rr-note"><span>일시정지 <b class="num" data-rr="held">1:24</b></span><span>자동복귀까지 <b class="num" data-rr="auto">8:36</b></span></div>' +
        '<div class="rr-note"><span></span><button type="button" class="rr-resume">▶ 재개</button></div>';
    }
    if (m === "estop") { return '<div class="rr-band"><b>긴급정지, 모터 전원 차단</b><span>현장 복구 필요, 이 지점 인근</span></div>'; }
    if (m === "lost") { return '<div class="rr-note"><span>위치 확인 중</span><span class="num">마지막 통신 2분 전</span></div>'; }
    return "";
  }
  var noteCard = null, noteMode = null;
  function placeNote(m) {
    var card = document.querySelector("[data-timeline] .timeline-item.is-running .step-card");
    if (card !== noteCard || m !== noteMode) {
      Array.prototype.forEach.call(document.querySelectorAll("[data-timeline] .rr-notes"), function (n) { n.remove(); });
      noteCard = card; noteMode = m;
      var html = noteHtml(m);
      if (card && html) {
        var wrap = document.createElement("div");
        wrap.className = "rr-notes";
        wrap.innerHTML = html;
        card.appendChild(wrap);
        var rb = wrap.querySelector(".rr-resume");
        if (rb) { rb.addEventListener("click", function (e) { e.stopPropagation(); resume(); }); }
      }
    }
    return noteCard;
  }

  /* ---------- 우측 진행 막대 ---------- */
  var lastProg = "";
  function syncProgress() {
    var rail = document.querySelector("[data-timeline]");
    if (!rail) { return; }
    var items = rail.querySelectorAll(".timeline-item[data-waypoint]"), done = rail.querySelectorAll(".timeline-item[data-waypoint].is-done").length;
    var run = rail.querySelector(".timeline-item[data-waypoint].is-running .step-title");
    var key = done + "/" + items.length + "|" + (run ? run.textContent : "");
    if (key === lastProg) { return; }
    lastProg = key;
    var p = items.length ? done / items.length * 100 : 0;
    var track = document.querySelector("[data-progress-track]");
    if (track) { track.style.setProperty("--progress", p + "%"); }
    var pe = document.querySelector("[data-progress-percent]"); if (pe) { pe.textContent = Math.round(p) + "%"; }
    var ce = document.querySelector("[data-progress-count]"); if (ce) { ce.textContent = done + "/" + items.length; }
    var te = document.querySelector("[data-progress-title]"); if (te && run) { te.textContent = run.textContent + " 판독"; }
  }

  /* ---------- 자동복귀 — 남은 카드를 "건너뜀 n곳" 한 장으로, 끝에 충전 스테이션 복귀 카드 ---------- */
  var groupKey = null;
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) { n.className = cls; } if (html != null) { n.innerHTML = html; } return n; }
  function group(m) {
    var rail = document.querySelector("[data-timeline]");
    if (!rail) { return; }
    if (m !== "return") {
      if (groupKey !== null) {
        Array.prototype.forEach.call(rail.querySelectorAll(".rr-extra"), function (n) { n.remove(); });
        Array.prototype.forEach.call(rail.querySelectorAll(".rr-hide"), function (n) { n.classList.remove("rr-hide"); });
        groupKey = null;
      }
      return;
    }
    var pend = Array.prototype.slice.call(rail.querySelectorAll(".timeline-item[data-waypoint].is-pending"));
    var key = pend.map(function (n) { return n.getAttribute("data-waypoint"); }).join(",");
    if (key === groupKey) { return; }
    groupKey = key;
    Array.prototype.forEach.call(rail.querySelectorAll(".rr-extra"), function (n) { n.remove(); });
    Array.prototype.forEach.call(rail.querySelectorAll(".rr-hide"), function (n) { n.classList.remove("rr-hide"); });
    pend.forEach(function (n) { n.classList.add("rr-hide"); });
    var done = rail.querySelectorAll(".timeline-item.is-done"), after = done.length ? done[done.length - 1] : null;
    var nodes = [];
    if (pend.length) {
      var skip = el("article", "timeline-item is-pending rr-extra rr-skip",
        '<span class="rail-capsule"><span class="rail-stub"></span><span class="rail-mark"><span class="rail-dot"></span></span><span class="rail-line"></span></span>' +
        '<div class="step-wrap"><div class="step-card"><div class="step-head"><div class="step-title-row"><span class="t-label-1 step-title">건너뜀 ' + pend.length + '곳</span></div></div>' +
        '<p class="t-caption step-desc num">' + pend[0].getAttribute("data-waypoint") + (pend.length > 1 ? " ~ " + pend[pend.length - 1].getAttribute("data-waypoint") : "") + '</p></div></div>');
      nodes.push(skip);
    }
    var home = el("article", "timeline-item is-running rr-extra rr-home",
      '<span class="rail-capsule"><span class="rail-stub"></span><span class="rail-mark"><span class="rail-dot"></span></span></span>' +
      '<div class="step-wrap"><div class="step-card"><div class="step-head"><div class="step-title-row"><span class="t-label-1 step-title">충전 스테이션으로 복귀</span></div></div>' +
      '<div class="rr-homebar"></div><div class="rr-note"><span>자동복귀 중</span><span class="num" data-rr="home-eta"></span></div></div></div>');
    nodes.push(home);
    nodes.forEach(function (n) {
      if (after && after.parentNode) { after.parentNode.insertBefore(n, after.nextSibling); after = n; }
      else { rail.insertBefore(n, rail.firstChild); after = n; }
    });
    try { home.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { /* 오래된 브라우저 */ }
  }

  /* ---------- 로봇 카드 상태 · 버튼 · 진행 막대 글 ---------- */
  var BADGE = { run: ["수행중", "badge-info"], alert: ["수행중", "badge-info"], inspect: ["측정 중", "badge-info"], pause: ["일시정지", "badge-idle"],
    estop: ["긴급정지", "badge-danger"], "return": ["자동복귀", "badge-info"], lost: ["끊김", "badge-danger"], done: ["완료", "badge-normal"] };
  var LEFTTXT = { pause: "일시정지 중, 남은 시간 멈춤", estop: "긴급정지로 멈춤", "return": "미션 중단, 충전 스테이션으로 복귀 중", lost: "통신이 돌아오면 다시 계산", done: "미션 완료" };
  var badgeMode = null;
  function robotCard(m) {
    if (m === badgeMode) { return; }
    badgeMode = m;
    var badge = document.querySelector('.robot-strip .robot-card[aria-pressed="true"] .robot-lists .badge');
    if (badge) {
      if (!badge.hasAttribute("data-rr-orig")) { badge.setAttribute("data-rr-orig", badge.className); }
      var b = BADGE[m] || BADGE.run;
      badge.className = "badge " + b[1] + " t-caption";
      badge.innerHTML = '<span class="badge-dot"></span>' + b[0];
    }
    var left = document.querySelector("[data-progress-left]");
    if (left) {
      if (!left.hasAttribute("data-rr-orig")) { left.setAttribute("data-rr-orig", left.textContent); }
      left.textContent = LEFTTXT[m] || left.getAttribute("data-rr-orig");
    }
    var rec = document.querySelector("[data-recall-button]"), es = document.querySelector('.rc-actions [data-modal-open="estop"]');
    if (rec) { rec.classList.toggle("rr-on", m === "return"); }
    if (es) { es.classList.toggle("rr-on", m === "estop"); }
  }

  /* 위험 감지 — 방금 지난 카드에도 요약 줄(카드 테두리는 더하지 않는다, 점은 빨강) */
  function alertLine(m) {
    var rail = document.querySelector("[data-timeline]");
    if (!rail) { return; }
    var item = m === "alert" ? rail.querySelector("[data-rr-alert]") : null;
    Array.prototype.forEach.call(rail.querySelectorAll(".rr-alert-line"), function (n) { if (!item || !item.contains(n)) { n.remove(); } });
    if (item && !item.querySelector(".rr-alert-line")) {
      var card = item.querySelector(".step-card");
      if (card) { card.appendChild(el("p", "rr-alert-line", "<span>가스, 열화상 2종 기준 초과</span><span class=\"num\">10:09</span>")); }
    }
  }

  /* 마지막 지점을 지나면 이미 충전 스테이션으로 가는 길이다 — 자동복귀가 의미가 없어 버튼을 끈다 */
  var endKey = "";
  function endGuard() {
    var st = api.stops(), last = st.length ? st[st.length - 1] : api.total();
    var home = (mode === "run" || mode === "alert") && api.get() > last + api.total() * 0.003;
    var off = home || mode === "done" || mode === "return";
    var key = off + "|" + home + "|" + mode;
    if (key === endKey) { return; }
    endKey = key;
    var rec = document.querySelector("[data-recall-button]"), chip = box.querySelector('[data-m="return"]');
    if (rec) {
      rec.disabled = off && mode !== "return";
      rec.title = home ? "마지막 지점을 지나 충전 스테이션으로 가는 중이에요" : mode === "done" ? "미션이 끝났어요" : "";
    }
    if (chip) { chip.disabled = home || mode === "done"; chip.title = chip.disabled ? "마지막 지점 뒤에서는 자동복귀가 의미 없어요" : ""; }
    var left = document.querySelector("[data-progress-left]");
    if (left && home) { left.textContent = "점검 끝, 충전 스테이션으로 이동 중"; }
    else { badgeMode = null; }   // 다시 앞쪽으로 오면 robotCard 가 원래 글로 되돌린다
  }

  /* [10/22] 시안의 상태별 패널 — 긴급정지(버튼 글 · 아래 칸 흐리게), 통신 끊김(띠 · 목록 얼림 · Signal 끊김), 미션 완료(요약 띠) */
  var bitsMode = null;
  function stateBits(m) {
    var rail = document.querySelector("[data-timeline]");
    if (!rail) { return; }
    var card = document.querySelector('.robot-strip .robot-card[aria-pressed="true"]') || document.querySelector(".robot-strip .robot-card");
    // Signal
    var sig = card && card.querySelectorAll(".robot-row .t-caption");
    var sigTxt = null; if (sig) { Array.prototype.forEach.call(sig, function (n) { if (/^(Strong|Good|Weak|끊김)$/.test(n.textContent.trim())) { sigTxt = n; } }); }
    if (sigTxt) {
      if (!sigTxt.hasAttribute("data-rr-orig")) { sigTxt.setAttribute("data-rr-orig", sigTxt.textContent); }
      sigTxt.textContent = m === "lost" ? "끊김" : sigTxt.getAttribute("data-rr-orig");
      sigTxt.classList.toggle("rr-sig-lost", m === "lost");
    }
    // E-STOP 버튼 글
    var es = document.querySelector('.rc-actions [data-modal-open="estop"]');
    /* 버튼이 좁아 글은 그대로 두고, 작동 중 테두리(rr-on)로만 보인다 */
    rail.classList.toggle("rr-estop", m === "estop");
    rail.classList.toggle("rr-frozen", m === "lost");
    // 목록 위 띠
    var host = rail.parentNode, ban = host && host.querySelector(".rr-banner");
    var want = m === "lost" || m === "done";
    if (!want) { if (ban) { ban.remove(); } bitsMode = m; return; }
    if (ban && bitsMode === m) { return; }
    bitsMode = m;
    if (!ban) { ban = el("div", "rr-banner"); host.insertBefore(ban, rail); }
    if (m === "lost") {
      ban.className = "rr-banner is-lost";
      ban.innerHTML = "<b>통신 끊김</b><span>마지막 통신 11:16:42, 2분 전. 아래 목록은 그 시점 기준이다.</span>";
    } else {
      var all = rail.querySelectorAll(".timeline-item[data-waypoint]").length, bad = rail.querySelectorAll(".timeline-item[data-wp-alert]").length;
      ban.className = "rr-banner is-done";
      ban.innerHTML = "<b>미션 완료 14:15</b><span>" + all + "곳 중 이상 " + bad + "곳</span>";
    }
  }

  /* [10/22] 스팟 머리 큐브 — 정육면체를 진행 방향으로 돌려 위 앞쪽에서 본 그림. 앞면은 오목, 넓은 판 눈 두 개 */
  var spotKey = "";
  function spotHead(m, now) {
    var bot = document.querySelector(".map-bot");
    if (!bot) { return; }
    var svg = bot.querySelector(".rr-spot");
    if (!svg) { svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "rr-spot"); svg.setAttribute("viewBox", "-30 -30 60 60"); svg.setAttribute("aria-hidden", "true"); bot.appendChild(svg); }
    var angTxt = bot.style.getPropertyValue("--bot-ang") || getComputedStyle(bot).getPropertyValue("--bot-ang") || "90deg";
    var hDeg = parseFloat(angTxt) || 90, st = bot.getAttribute("data-rr") || m;
    var look = st === "inspect" ? Math.sin(now / 650) * 0.9 : 0;
    var key = Math.round(hDeg) + "|" + st + "|" + look.toFixed(2);
    if (key === spotKey) { return; }
    spotKey = key;
    var P = Math.PI, t = 35 * P / 180, h = hDeg * P / 180, S = 9, ZB = -1;   // [10/22] 다시 정육면체(뒤끝 -1)
    var yaw = h + 0.25 * Math.cos(h);   // 옆을 볼 때 얼굴이 조금 보이게만 살짝 튼다
    var f = [Math.cos(yaw), 0, Math.sin(yaw)], l = [Math.sin(yaw), 0, -Math.cos(yaw)];
    function W(x, y, z) { return [x * l[0] + z * f[0], y, x * l[2] + z * f[2]]; }
    function prj(p) { return [p[0] * S, 2 + (-p[1] * Math.cos(t) + p[2] * Math.sin(t)) * S]; }
    var view = [0, Math.sin(t), Math.cos(t)];
    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function fmt(q2) { return q2[0].toFixed(1) + "," + q2[1].toFixed(1); }
    var FACES = [
      { n: [0, 0, 1], k: .82, c: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]] },
      { n: [0, 0, -1], k: .7, c: [[1, -1, ZB], [-1, -1, ZB], [-1, 1, ZB], [1, 1, ZB]] },
      { n: [1, 0, 0], k: .9, c: [[1, -1, 1], [1, -1, ZB], [1, 1, ZB], [1, 1, 1]] },
      { n: [-1, 0, 0], k: .9, c: [[-1, -1, ZB], [-1, -1, 1], [-1, 1, 1], [-1, 1, ZB]] },
      { n: [0, 1, 0], k: 1, c: [[-1, 1, 1], [1, 1, 1], [1, 1, ZB], [-1, 1, ZB]] }
    ];
    var lost = st === "lost", shut = st === "pause" || st === "estop" || lost;
    var fill = "#89B9ED", eye = "#F2FAFF";   // 시안 K 와 같은 색: 몸 길색, 눈 밝은 라이트
    if (st === "pause") { fill = "#9EA8BB"; }
    if (st === "estop") { fill = "#FF383C"; }
    if (st === "return") { fill = "#E4E8EF"; eye = "#070A10"; }
    if (lost) { eye = "#9EA8BB"; }
    var ring = "color-mix(in srgb, " + fill + " 55%, #FFFFFF)";
    function shade(k) { return "color-mix(in srgb, " + fill + " " + Math.round(k * 100) + "%, #0A0F18)"; }
    var vis = FACES.filter(function (fc) { return dot(W(fc.n[0], fc.n[1], fc.n[2]), view) > 0.001; });
    var ptsOf = function (fc) { return fc.c.map(function (c) { return fmt(prj(W(c[0], c[1], c[2]))); }).join(" "); };
    var html = "";
    // 밝은 테두리 — 면들을 테두리색으로 굵게 한 번 깔고, 그 위에 면을 얇게(모서리가 둥글게)
    if (!lost) { vis.forEach(function (fc) { html += '<polygon points="' + ptsOf(fc) + '" fill="' + ring + '" stroke="' + ring + '" stroke-width="5" stroke-linejoin="round"/>'; }); }
    vis.forEach(function (fc) {
      html += '<polygon points="' + ptsOf(fc) + '" ' + (lost ? 'fill="#0A0F18" fill-opacity=".6" stroke="#9EA8BB" stroke-dasharray="3 2.2" stroke-width="1.6"' : 'fill="' + shade(fc.k) + '" stroke="' + shade(fc.k) + '" stroke-width="2.2"') + ' stroke-linejoin="round"/>';
    });
    var facing = dot(f, view);
    if (facing > 0.06) {
      var op = Math.min(1, (facing - 0.06) * 6), sx = Math.sin(look) * 0.12;
      var zc = function () { return 1.01; };   // [10/22] 앞면은 평평하게(오목 되돌림)
      var quad = function (x0, x1, y0, y1) { return [W(x0, y0, zc(x0)), W(x1, y0, zc(x1)), W(x1, y1, zc(x1)), W(x0, y1, zc(x0))].map(function (p) { return fmt(prj(p)); }).join(" "); };
      [-1, 1].forEach(function (k) {
        var cxk = k * 0.52 + sx, hw = 0.2;
        var pts = shut ? quad(cxk - hw, cxk + hw, -0.82, -0.68) : quad(cxk - hw, cxk + hw, -0.72, 0.06);
        html += '<polygon points="' + pts + '" fill="' + eye + '" stroke="' + eye + '" stroke-width=".5" stroke-linejoin="round" opacity="' + op.toFixed(2) + '"/>';
      });
    }
    // 테두리 그림자로 지도와 떼어 놓는다
    svg.innerHTML = html;
  }

  /* [10/22] 시안 K 스팟 머리 — 머리는 화면을 보고 돌지 않고, 눈이 바라보는 쪽 면으로 옮겨 간다 */
  var HEXR = (function () {
    var R = 11, rr = 3.2, v = [], d = "", KW = 1;   // [10/22] 가로로 긴 머리 — 캡슐 비율(약 1.7 : 1)
    for (var i = 0; i < 6; i += 1) { var a = -Math.PI / 2 + i * Math.PI / 3; v.push([Math.cos(a) * R * KW, Math.sin(a) * R]); }
    for (var j = 0; j < 6; j += 1) {
      var p0 = v[(j + 5) % 6], p1 = v[j], p2 = v[(j + 1) % 6];
      var l1 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), l2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      var a1 = [p1[0] + (p0[0] - p1[0]) / l1 * rr, p1[1] + (p0[1] - p1[1]) / l1 * rr], b1 = [p1[0] + (p2[0] - p1[0]) / l2 * rr, p1[1] + (p2[1] - p1[1]) / l2 * rr];
      d += (j ? " L" : "M") + a1[0].toFixed(2) + " " + a1[1].toFixed(2) + " Q" + p1[0].toFixed(2) + " " + p1[1].toFixed(2) + " " + b1[0].toFixed(2) + " " + b1[1].toFixed(2);
    }
    return d + " Z";
  })();
  var kKey = "";
  function kHead(m, now) {
    var bot = document.querySelector(".map-bot");
    if (!bot) { return; }
    var svg = bot.querySelector(".rr-khead");
    if (!svg) { svg = document.createElementNS(NS, "svg"); svg.setAttribute("class", "rr-khead"); svg.setAttribute("viewBox", "-14 -14 28 28"); svg.setAttribute("aria-hidden", "true"); bot.appendChild(svg); }
    var st = bot.getAttribute("data-rr") || m;
    var ang = (parseFloat(bot.style.getPropertyValue("--bot-ang")) || 90) * Math.PI / 180;
    var off = st === "inspect" ? Math.sin(now / 650) * 0.7 : 0;
    var key = Math.round(ang * 57.3) + "|" + st + "|" + off.toFixed(2);
    if (key === kKey) { return; }
    kKey = key;
    var lost = st === "lost";
    var kc = lost ? "#0A0F18" : st === "estop" ? "#FF383C" : st === "pause" ? "#9EA8BB" : st === "return" ? "#E4E8EF" : "var(--bot-route, #89B9ED)";
    var ring = lost ? "#9EA8BB" : "color-mix(in srgb, " + kc + " 55%, #FFFFFF)";
    var ecol = st === "return" ? "#070A10" : "#F2FAFF";
    var html = '<path d="' + HEXR + '" fill="' + kc + '" stroke="' + ring + '" stroke-width="' + (lost ? 2 : 1.5) + '" stroke-dasharray="' + (lost ? "3 2.2" : "none") + '" stroke-linejoin="round"' + (lost ? ' opacity=".7"' : "") + "/>";
    var a = ang + off, c = Math.cos(a), sn = Math.sin(a);
    var shut = st === "pause" || st === "estop", back = sn < -0.55;
    if (!(back && !shut && !lost)) {
      if (lost || (shut && back)) { c = 0; sn = 1; }
      var cx = c * 5.4, cy = 1.4 + sn * 1.8, gap = 3.4 - Math.abs(c) * 1.4, tilt = c * 1.1;   // 시안 K 값 그대로
      if (lost || shut) { gap = Math.max(gap, 2.9); }
      [-1, 1].forEach(function (k) {
        var ex = cx + k * gap, ey = cy - k * tilt;
        if (lost || shut) {
          var sl = -c * 0.55, hl = 1.25, ly = ey + 2.4;
          html += '<path d="M' + (ex - hl).toFixed(2) + " " + (ly - sl * hl).toFixed(2) + " L" + (ex + hl).toFixed(2) + " " + (ly + sl * hl).toFixed(2) + '" fill="none" stroke="' + (lost ? "#9EA8BB" : ecol) + '" stroke-width="2.1" stroke-linecap="round"/>';
        } else {
          html += '<rect x="' + (ex - 1.05).toFixed(2) + '" y="' + (ey - 3.7).toFixed(2) + '" width="2.1" height="7.4" rx="1.05" fill="' + ecol + '" fill-opacity="' + (sn < -0.2 ? .6 : 1) + '"/>';
        }
      });
    }
    svg.innerHTML = html;
  }

  function mmss(sec) { sec = Math.max(0, Math.floor(sec)); return Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0"); }
  function decorate(t) {
    if (!api || !touched) { return; }
    var e = t - modeAt;
    // 지도 측정 눈금
    var ring = ringOf();
    if (ring) {
      ring.style.display = mode === "inspect" ? "block" : "none";
      if (mode === "inspect") {
        var n = Math.min(6, Math.floor((e % 4500) / 500));
        Array.prototype.forEach.call(ring.children, function (p, k) { p.setAttribute("class", k < n ? "on" : ""); });
      }
    }
    var pz = pauseOf();
    if (pz) {
      pz.style.display = mode === "pause" ? "block" : "none";
      if (mode === "pause") { pz.querySelector(".val").setAttribute("stroke-dashoffset", (PCIRC * (1 - Math.min(.999, (84 + e / 1000) / 600))).toFixed(2)); }
    }
    endGuard();
    stateBits(mode);
    kHead(mode, t);   // [10/22] 로봇 = 시안 K 스팟 머리 그대로(모양, 라운딩, 눈 움직임)
    var railEl = document.querySelector("[data-timeline]");
    if (railEl) { railEl.classList.toggle("rr-flow", mode === "run" || mode === "alert" || mode === "return"); }   // 측정 · 멈춤에선 레일 흐름도 멈춘다(시안)
    group(mode);
    robotCard(mode);
    alertLine(mode);
    if (mode === "return") {
      var he = document.querySelector('[data-rr="home-eta"]');
      if (he) { var sec = Math.max(1, Math.round(api.get() / (api.total() / SPEED_SEC))); he.textContent = "도착 약 " + (sec >= 60 ? Math.floor(sec / 60) + "분 " : "") + (sec % 60) + "초"; }
    }
    // 우측 카드 상태 줄
    var card = mode === "return" ? null : placeNote(mode);
    if (mode === "return") { placeNote(""); }
    if (card) {
      if (mode === "inspect") {
        var fr = Math.min(1, (e % 4500) / 3000), v = card.querySelector(".rr-note .val"), pe = card.querySelector('[data-rr="pct"]');
        if (v) { v.setAttribute("stroke-dashoffset", (CIRC * (1 - fr)).toFixed(2)); }
        if (pe) { pe.textContent = Math.round(fr * 100) + "%"; }
      } else if (mode === "run" || mode === "alert") {
        var s = api.get(), next = api.stops().filter(function (x) { return x > s + 1e-6; })[0], eta = card.querySelector('[data-rr="eta"]');
        if (eta) { eta.textContent = next === undefined ? "" : "도착 약 " + Math.max(1, Math.round((next - s) / (api.total() / SPEED_SEC))) + "초"; }
      } else if (mode === "pause") {
        var held = 84 + e / 1000, he = card.querySelector('[data-rr="held"]'), au = card.querySelector('[data-rr="auto"]');
        if (he) { he.textContent = mmss(held); }
        if (au) { au.textContent = mmss(600 - held); }
      }
    }
    syncProgress();
  }

  function loop(t) {
    window.requestAnimationFrame(loop);
    decorate(t);
    if (!api || !playing) { last = t; return; }
    var dt = last ? Math.min(0.1, (t - last) / 1000) : 0;
    last = t;
    if (dwell) {
      if (t >= dwell.until) { press("run"); api.mode("run"); api.set(dwell.at + api.total() * 0.0005); dwell = null; }
      show();
      return;
    }
    var total = api.total(), speed = total / SPEED_SEC, s0 = api.get(), back = mode === "return";
    var s1 = s0 + (back ? -1 : 1) * speed * dt;
    if (!back) {
      var hit = api.stops().filter(function (x) { return x > s0 + 1e-6 && x <= s1; })[0];
      if (hit !== undefined) { api.set(hit); press("inspect"); api.mode("inspect"); dwell = { at: hit, until: t + 3600 }; show(); return; }
      if (s1 >= total) { api.set(total); setMode("done"); stop(); return; }
    } else if (s1 <= 0) { api.set(0); setMode("done"); stop(); return; }
    api.set(s1);
    show();
  }

  var tries = 0;
  (function wait() {
    var a = window.APRISM_RR;
    if (!a || !a.ready()) { setTimeout(wait, 300); return; }
    // [10/28] 지점이 다 깔리기 전(8개 미만)에 시작하면 시작 자리를 못 잡고 touched 가 꺼진 채 남아
    // 상태 칩을 누르기 전까지 로봇 머리(K)가 그려지지 않았다 — 지점이 깔릴 때까지 잠깐(최대 6초) 기다린다
    var n0 = 0; try { n0 = a.stops().length; } catch (e) { n0 = 0; }
    if (n0 < 8 && tries < 20) { tries += 1; setTimeout(wait, 300); return; }
    api = a;
    box.querySelector(".rsim-wait").hidden = true;
    box.classList.add("is-ready");
    try { var st0 = api.stops(); if (st0.length > 7) { api.mode("run"); api.set(st0[6] + (st0[7] - st0[6]) * 0.55); } } catch (e) { /* 지점이 적으면 그대로 */ }
    touched = true;   // 지점이 적어도 로봇 머리는 그린다
    show();
    window.requestAnimationFrame(loop);
  })();
})();
