/*
 * v3 Delta 꼴 — 위젯형 / 가로형 (10/21 디자이너, 가로형 Figma DS 1335:21707 Delta-horizon).
 *
 *   ?form=bar     가로형(526 · 머리 줄 위 + 유리 카드, 펼치면 296 으로 아래로 자란다)
 *   ?form=widget  위젯형(220 정사각 · 펼치면 지도 높이 가득)
 *
 * 고른 꼴은 기억한다(localStorage) — 화면 사이를 오가도 같은 꼴로 비교한다.
 * 요소는 하나다. 꼴은 body.d3-bar 로만 갈리고 모양은 v3.css 가 맡는다.
 * delta-resize.js 보다 먼저 읽혀야 한다 — 펼친 너비(처음 · 최소)를 여기서 바꿔 준다.
 */
(function () {
  "use strict";

  if (!document.body.classList.contains("ver-3")) { return; }

  var KEY = "aprism.v3.deltaForm";
  var asked = new URLSearchParams(location.search).get("form");
  var form = null;

  if (asked === "bar" || asked === "widget") {
    form = asked;
    try { localStorage.setItem(KEY, form); } catch (e) { /* 저장 못 해도 이번 화면은 그 꼴 */ }
  } else {
    try { form = localStorage.getItem(KEY); } catch (e) { form = null; }
  }
  if (form !== "bar") { return; }

  document.body.classList.add("d3-bar");
  var win = document.querySelector("[data-delta3]");
  if (win) {
    win.setAttribute("data-d3-start", "526");   // Figma 펼침 526 × 296
    win.setAttribute("data-d3-min", "420");
  }
})();
