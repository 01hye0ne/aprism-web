/*
 * [11/10 v7 · UT 개선 시각화 1a] 우측 지점 목록 — 지나온 지점을 한 줄로 접는다.
 *
 *   v6 사용성 테스트: 지점 목록은 가장 많이 누른 영역(자유 탐색 225회 · 15명)이라 없애지 않는다.
 *   대신 지나온 칸이 쌓여 "진행 중인 업무가 아래에 있어 스크롤해야 보인다"(P16) · "진행 중인 미션이 눈에 덜 띈다"(P06 · P01).
 *
 *   접는 것   지나온 칸(is-done) — 알림이 걸렸던 칸도 함께 접고, 요약 줄에 위험 · 주의 건수로 남긴다.
 *             알림 자체는 최신 알림 · 지도 번호 핀이 계속 보인다.
 *   남기는 것 지금 칸 바로 앞 칸(v7 "앞 카드가 맨 위, 그 아래 지금 카드" 규칙 · 레일 이음),
 *             사람이 짚어 둔 칸(is-selected — 지도에서 고르면 목록에 보여야 한다).
 *   요약 줄   목록 맨 위 "지나온 지점 n곳 · 1–6 · 위험 1 · 주의 3 ⌄" — 누르면 펼치고 다시 누르면 접는다(이 화면에서만, 새로 고치면 접힘).
 *
 *   지금 칸이 없으면(복귀 · 통신 끊김 · 완료) 접지 않는다 — 완료는 목록 전체가 접힌다(map-v6.js rr-wp-closed).
 *   미션 설정 · 사전 점검(.sian)은 점검 순서라 그대로 다 보인다.
 *   목록 굴림(map-v6.js rrRailTo · screen.js railToRunning)은 접힌 요약 줄 높이만큼 덜 내려 요약 줄이 맨 위에 보이게 한다.
 */
(function () {
  "use strict";
  var body = document.body;
  if (!body.classList.contains("ver-7") || body.classList.contains("sian")) { return; }
  var rail = document.querySelector(".right-panel [data-timeline]");
  if (!rail) { return; }
  var EN = document.documentElement.lang === "en";
  var open = false, sig = "", sum = null, queued = false;

  function ranges(nums) {
    var out = [], a = null, b = null;
    nums.forEach(function (n) {
      if (a === null) { a = b = n; return; }
      if (n === b + 1) { b = n; return; }
      out.push(a === b ? String(a) : a + "–" + b); a = b = n;
    });
    if (a !== null) { out.push(a === b ? String(a) : a + "–" + b); }
    return out.join(", ");
  }

  function makeSum() {
    var s = document.createElement("button");
    s.type = "button";
    s.className = "rail-past-sum";
    s.innerHTML =
      '<span class="rps-ic" aria-hidden="true"><span class="i i-16" style="--i:var(--ic-check-circle)"></span></span>' +
      '<span class="rps-card">' +
        '<span class="rps-title t-label-1"></span>' +
        '<span class="rps-nos t-caption num"></span>' +
        '<span class="rps-alerts t-caption"></span>' +
        '<span class="rps-fold i i-16" aria-hidden="true" style="--i:var(--ic-chevron-down)"></span>' +
      "</span>";
    // 누르면 목록을 맨 위로 — 펼친 칸은 앞 칸 위에 생겨, 그대로 두면 화면 밖에서 펼쳐져 아무 일도 없어 보인다
    s.addEventListener("click", function () { open = !open; sig = ""; apply(); requestAnimationFrame(function () { rail.scrollTop = 0; }); });
    return s;
  }

  function apply() {
    queued = false;
    var items = Array.prototype.slice.call(rail.querySelectorAll(".timeline-item[data-waypoint]"));
    var at = -1;
    items.forEach(function (it, i) { if (at < 0 && it.classList.contains("is-running")) { at = i; } });
    var fold = [];
    if (at > 0) {
      for (var i = 0; i < at - 1; i++) {
        var it = items[i];
        if (it.classList.contains("is-done") && !it.classList.contains("is-selected")) { fold.push(it); }
      }
    }
    var next = (open ? "o" : "c") + "|" + fold.map(function (it) { return it.getAttribute("data-waypoint") + (it.getAttribute("data-wp-alert") || ""); }).join(",");
    if (next === sig && (!fold.length || (sum && sum.parentNode === rail))) { return; }
    sig = next;
    items.forEach(function (it) { it.classList.toggle("rps-hidden", !open && fold.indexOf(it) >= 0); });
    if (!fold.length) { if (sum && sum.parentNode) { sum.parentNode.removeChild(sum); } return; }
    if (!sum) { sum = makeSum(); }
    if (rail.firstChild !== sum) { rail.insertBefore(sum, rail.firstChild); }
    var nos = fold.map(function (it) { var n = it.querySelector(".step-no"); return n ? parseInt(n.textContent, 10) : items.indexOf(it) + 1; }).sort(function (a, b) { return a - b; });
    var dan = fold.filter(function (it) { return it.getAttribute("data-wp-alert") === "danger"; }).length;
    var cau = fold.filter(function (it) { return it.getAttribute("data-wp-alert") === "caution"; }).length;
    sum.querySelector(".rps-title").textContent = EN ? fold.length + " passed" : "지나온 지점 " + fold.length + "곳";
    sum.querySelector(".rps-nos").textContent = ranges(nos);
    // 알림 건수는 탭 · 레일과 같은 기호(ⓧ 위험 · ▲ 주의) + 숫자 — 영문도 같은 폭이라 좁은 패널에서 번호가 밀리지 않는다. 단어는 이름(aria-label · title)에
    var al = sum.querySelector(".rps-alerts");
    al.innerHTML = "";
    var words = [];
    [["danger", dan, EN ? "Critical" : "위험", "error"], ["caution", cau, EN ? "Warning" : "주의", "warning"]].forEach(function (k) {
      if (!k[1]) { return; }
      var b = document.createElement("span");
      b.className = "rps-sev num";
      b.setAttribute("data-sev", k[0]);
      b.innerHTML = '<span class="i i-16" aria-hidden="true" style="--i:var(--ic-' + k[3] + ')"></span>' + k[1];
      al.appendChild(b);
      words.push(k[2] + " " + k[1]);
    });
    sum.classList.toggle("is-folded", !open);
    sum.setAttribute("aria-expanded", open ? "true" : "false");
    var label = sum.querySelector(".rps-title").textContent + " " + ranges(nos) + (words.length ? " · " + words.join(" · ") : "") + (open ? (EN ? " — collapse" : " 접기") : (EN ? " — expand" : " 펼치기"));
    sum.setAttribute("aria-label", label);
    sum.title = label;
    // 접으면 목록 맨 위(요약 줄 · 앞 칸 · 지금 칸)가 보이게 — 굴림 코드가 접기 전에 재 둔 자리를 바로잡는다
    if (!open) { rail.scrollTop = 0; }
  }

  function queue() { if (!queued) { queued = true; requestAnimationFrame(apply); } }
  new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i].target;
      if (sum && (t === sum || sum.contains(t))) { continue; }
      if (list[i].type === "attributes" && list[i].attributeName === "class" && t.classList && t.classList.contains("timeline-item")) {
        var o = list[i].oldValue || "";
        // 우리가 붙인 rps-hidden 만 바뀐 것은 넘긴다
        if (o.replace(/\s*rps-hidden/g, "").trim() === t.className.replace(/\s*rps-hidden/g, "").trim()) { continue; }
      }
      queue(); return;
    }
  }).observe(rail, { childList: true, subtree: true, attributes: true, attributeOldValue: true, attributeFilter: ["class", "data-wp-alert"] });
  // 다른 미션을 고르면 펼침을 되돌린다
  document.addEventListener("aprism:mission", function () { open = false; sig = ""; queue(); });
  queue();
})();
