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

  // v5(10/29 디자이너) — 위젯형만 쓴다. 주소 · 기억한 꼴과 상관없이 위젯형이고, v4 에서 고른 꼴(기억)은 건드리지 않는다.
  if (document.body.classList.contains("ver-5")) {
    form = "widget";
  } else if (asked === "bar" || asked === "widget") {
    form = asked;
    try { localStorage.setItem(KEY, form); } catch (e) { /* 저장 못 해도 이번 화면은 그 꼴 */ }
  } else {
    try { form = localStorage.getItem(KEY); } catch (e) { form = null; }
  }
  var win = document.querySelector("[data-delta3]");
  if (form === "bar") {
    document.body.classList.add("d3-bar");
    if (win) {
      win.setAttribute("data-d3-start", "526");   // Figma 펼침 526 × 296
      win.setAttribute("data-d3-min", "420");
    }
  }

  /*
   * 펼치면 묻기 칸이 바로 선다(10/21 디자이너, Figma expand 1335:21705 · 1320:14677) — 펼친 창 맨 아래에 늘 있고 초점이 간다.
   * 묻기 칸은 화면에 따라 hidden 으로 시작해 [돋보기]로 열게 돼 있어(통합 순회 현황), 펼칠 때 직접 연다.
   * 가로형 · 위젯형 둘 다 — 처음엔 가로형에만 걸어 통합 순회 현황 위젯형은 펼쳐도 묻기 칸이 없었다(10/21 버그).
   */
  var box = document.getElementById("ai-ask");
  if (!win || !box) { return; }
  var input = box.querySelector("[data-ai-ask]");

  // 조치 버튼 · 묻기 칸은 요약 칸(.delta3-body) 안 맨 끝이 제자리다 — 미션 관제는 delta-chat.js 가 그렇게 옮기는데
  // 통합 순회 현황에는 대화가 없어 카드 바깥(조치 줄)에 남는다. 두 화면이 같은 짜임이어야 해서 여기서 옮긴다.
  var body = win.querySelector(".delta3-body");
  var acts = win.querySelector("[data-ai-actions]");
  if (body) {
    if (acts && acts.parentElement !== body) { body.appendChild(acts); }
    if (box.parentElement !== body) { body.appendChild(box); }
  }
  // 보내기는 글을 쓸 때만 — 대화(delta-chat.js)가 없는 화면은 여기서 맡는다.
  if (input && !document.querySelector('script[src*="delta-chat"]')) {
    input.addEventListener("input", function () { box.classList.toggle("has-text", input.value.trim() !== ""); });
  }

  var shown = win.classList.contains("is-open");
  if (shown) { box.hidden = false; }
  new MutationObserver(function () {
    var now = win.classList.contains("is-open");
    if (now === shown) { return; }   // 단계 · 끌기 같은 다른 class 변화는 넘긴다 — 접힘 → 펼침일 때만
    shown = now;
    if (!now) { return; }
    box.hidden = false;
    if (input) { setTimeout(function () { input.focus({ preventScroll: true }); }, 300); }   // 펼치는 움직임(280) 뒤에
  }).observe(win, { attributes: true, attributeFilter: ["class"] });
})();
