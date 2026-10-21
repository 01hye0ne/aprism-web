// v3 — 왼쪽 관제 패널(2026-10-21 디자이너, v2.2 피드백 2번).
// "오늘 확인 완료" 를 접는다. 머리 줄 어디를 눌러도 되고, 접힌 자리는 위 최신 알림이 가져간다.
// 접힘은 보는 사람 브라우저에만 기억한다(새로 고쳐도 그대로) — 막힌 곳에서는 펼친 채로 시작한다.
(function () {
  var sec = document.querySelector("[data-done-sec]");
  var head = document.querySelector("[data-done-head]");
  var btn = document.querySelector("[data-done-fold]");
  if (!sec || !head || !btn) { return; }
  var KEY = "aprism.v3.doneFolded";

  function set(folded) {
    sec.classList.toggle("is-folded", folded);
    btn.setAttribute("aria-expanded", folded ? "false" : "true");
    btn.setAttribute("aria-label", folded ? "오늘 확인 완료 펼치기" : "오늘 확인 완료 접기");
    try { window.localStorage.setItem(KEY, folded ? "1" : "0"); } catch (e) { /* 저장이 막힌 곳 — 이번만 */ }
  }

  var start = false;
  try { start = window.localStorage.getItem(KEY) === "1"; } catch (e) { /* 펼친 채로 */ }
  // 처음 그릴 때는 움직이지 않는다 — 새로 고칠 때마다 접히는 모션이 보이면 거슬린다.
  sec.classList.add("no-motion");
  set(start);
  requestAnimationFrame(function () { requestAnimationFrame(function () { sec.classList.remove("no-motion"); }); });

  head.addEventListener("click", function () { set(!sec.classList.contains("is-folded")); });
})();


// Delta 위젯 근거 줄(10/21 디자이너) — "Thinking..." 대신 Delta 가 지금 하는 일을 행동으로 적는다("~ 분석 중...").
// 단계 · 건수가 바뀌거나 답을 기다릴 때(is-thinking) 따라 바꾼다. 건수는 Delta 판단(전체 미션)과 같은 값이다.
(function () {
  var win = document.querySelector("[data-delta3]");
  var out = win && win.querySelector(".delta3-clue-txt");
  if (!out) { return; }
  var body = document.body;

  function count(kind) {
    var c = window.APRISM_DELTA_COUNT;
    if (c) { return kind === "critical" ? c.crit : kind === "warning" ? c.warn : c.total; }
    // 전체 층 현황처럼 판단 값이 없는 화면은 최신 알림 거르기 단추의 건수를 쓴다.
    var el = document.querySelector('[data-ah-count="' + (kind === "total" ? "all" : kind) + '"]');
    return el ? parseInt(el.textContent, 10) || 0 : 0;
  }

  function say() {
    if (win.classList.contains("is-thinking")) { return "답변 정리 중..."; }
    var level = body.getAttribute("data-level");
    var total = count("total");
    if (level === "critical") { return "위험 " + count("critical") + "건 원인 분석 중..."; }
    if (level === "warning") { return "주의 " + count("warning") + "건 추세 비교 중..."; }
    if (total) { return "알림 " + total + "건 살펴보는 중..."; }
    return "순회 경로 지켜보는 중...";
  }

  // 통합 순회 현황에서 층을 펼쳐 보면 그 층이 범위다(building.js 의 APRISM_DELTA_SCOPE).
  function update() {
    var scope = window.APRISM_DELTA_SCOPE;
    var t = say();
    if (scope && !win.classList.contains("is-thinking")) { t = scope + " " + t; }
    if (out.textContent !== t) { out.textContent = t; }
  }
  update();
  new MutationObserver(update).observe(body, { attributes: true, attributeFilter: ["data-level"] });
  new MutationObserver(update).observe(win, { attributes: true, attributeFilter: ["class"] });
  document.addEventListener("aprism:severity", function () { setTimeout(update, 0); });
})();

// 지도 층 판 — 층마다 알림 건수(10/21). monitor.js · building.js 가 aprism:floor-counts 로 알린다.
(function () {
  var btns = Array.prototype.slice.call(document.querySelectorAll("[data-map-floor], .map-floor.is-all, [data-bld-floor]"));
  if (!btns.length) { return; }
  function key(b) {
    return b.getAttribute("data-map-floor") || b.getAttribute("data-bld-floor") || "all";
  }
  function paint(c) {
    if (!c) { return; }
    btns.forEach(function (b) {
      var n = c[key(b)] || 0;
      var tag = b.querySelector(".floor-count");
      if (!tag) { tag = document.createElement("span"); tag.className = "floor-count"; b.appendChild(tag); }
      tag.textContent = n;
      tag.hidden = !n;
      b.setAttribute("aria-label", b.getAttribute("data-floor-name") + (n ? " · 알림 " + n + "건" : ""));
    });
  }
  // 원래 이름(aria-label 이 있으면 그것, 없으면 글자)을 둔다 — 건수를 덧붙일 때 바탕이다.
  btns.forEach(function (b) { b.setAttribute("data-floor-name", b.getAttribute("aria-label") || b.firstChild.textContent.trim()); });
  paint(window.APRISM_FLOOR_COUNTS);
  document.addEventListener("aprism:floor-counts", function (e) { paint(e.detail); });
})();
