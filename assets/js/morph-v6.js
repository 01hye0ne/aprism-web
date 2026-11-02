/*
 * [11/02 v6] 관제 팝오버 [진단 상세] → 안전진단 상세 모핑(View Transitions, 페이지 사이).
 * 짝이 되는 세 덩어리에 같은 이름을 붙인다(v6.css) — 머리(dx-head) · 사진(dx-shot) · DELTA 조치 판(dx-act).
 * 브라우저가 페이지가 바뀌는 사이 자리 · 크기를 이어 움직인다. 크롬 · 엣지 126+ · http(s) 에서만(file:// · 다른 브라우저는 그냥 넘어간다).
 * 다른 길(GNB · 탭 · 뒤로)로 오가면 전환을 건너뛴다 — [진단 상세] 를 눌렀을 때만 모핑.
 */
(function () {
  "use strict";
  var KEY = "aprism-morph";
  var go = false;
  document.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("[data-ma-more]")) { go = true; } }, true);
  window.addEventListener("pageswap", function (e) {
    if (!e.viewTransition) { return; }
    if (!go) { e.viewTransition.skipTransition(); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch (err) { /* 저장 막힘 */ }
  });
  window.addEventListener("pagereveal", function (e) {
    var ok = false;
    try { ok = sessionStorage.getItem(KEY) === "1"; sessionStorage.removeItem(KEY); } catch (err) { /* 저장 막힘 */ }
    if (e.viewTransition && !ok) { e.viewTransition.skipTransition(); }
  });
})();
