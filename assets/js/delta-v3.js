/*
 * 시안 3 · Delta 창 — 뜨는 자리와 끌어 옮기기.
 *
 * 여닫기 자체는 screen.js 가 한다([data-ai-toggle] 로 .is-open 을 붙였다 뗀다).
 * 여기서는 그 상태 변화를 보고 세 가지만 한다.
 *   1. 처음 펼치면 지도 한가운데에 놓는다 — Figma 의 창 자리(Two Column 가운데)다.
 *   2. 머리를 잡아 옮긴다. 사람이 한 번 옮기면 그 자리를 기억한다(다시 펼쳐도 거기다).
 *   3. 접으면 왼쪽 위 모서리로 돌아간다 — 인라인 자리를 지우면 CSS 가 맡는다.
 *
 * 창은 .two-col 안에 있고 그 상자가 잘라 낸다. 밖으로 끌고 나갈 수 없게 가둔다.
 */
(function () {
  "use strict";

  var win = document.querySelector("[data-delta3]");
  if (!win) { return; }

  var stage = win.parentElement;                       /* .two-col */
  var head = win.querySelector("[data-delta3-drag]");
  var close = win.querySelector("[data-delta3-close]");
  var toggle = document.querySelector("[data-ai-toggle]");
  var map = document.querySelector(".map-panel");

  var moved = null;   /* 사람이 옮긴 자리. 옮기기 전에는 null 이다. */

  function isOpen() { return win.classList.contains("is-open"); }

  function clamp(left, top) {
    var sw = stage.clientWidth;
    var sh = stage.clientHeight;
    var w = win.offsetWidth;
    var h = win.offsetHeight;
    return {
      left: Math.max(8, Math.min(sw - w - 8, left)),
      top: Math.max(8, Math.min(sh - h - 8, top))
    };
  }

  /* 지도 칸 한가운데. 지도를 못 찾으면 무대 한가운데로 둔다. */
  function middle() {
    var box = (map || stage).getBoundingClientRect();
    var base = stage.getBoundingClientRect();
    return clamp(
      box.left - base.left + (box.width - win.offsetWidth) / 2,
      box.top - base.top + (box.height - win.offsetHeight) / 2
    );
  }

  function place(at) {
    win.style.left = at.left + "px";
    win.style.top = at.top + "px";
  }

  function opened() {
    place(moved ? clamp(moved.left, moved.top) : middle());
  }

  function closed() {
    win.style.left = "";
    win.style.top = "";
  }

  /* screen.js 가 .is-open 을 붙였다 뗄 때마다 따라간다. */
  new MutationObserver(function () {
    if (isOpen()) { opened(); } else { closed(); }
  }).observe(win, { attributes: true, attributeFilter: ["class"] });

  if (isOpen()) { opened(); }

  /* ---------- 끌어 옮기기 ---------- */
  var grab = null;

  head.addEventListener("pointerdown", function (event) {
    if (!isOpen() || event.target.closest("button")) { return; }
    grab = { x: event.clientX, y: event.clientY, left: win.offsetLeft, top: win.offsetTop };
    head.setPointerCapture(event.pointerId);
  });

  head.addEventListener("pointermove", function (event) {
    if (!grab) { return; }
    moved = clamp(grab.left + event.clientX - grab.x, grab.top + event.clientY - grab.y);
    place(moved);
  });

  head.addEventListener("pointerup", function () { grab = null; });
  head.addEventListener("pointercancel", function () { grab = null; });

  /* 창을 접고 펴는 길은 하나다 — 닫기도 [+] 와 같은 토글을 누른다. */
  if (close && toggle) {
    close.addEventListener("click", function () { toggle.click(); });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen() && toggle) { toggle.click(); }
  });

  /* 창이 잘려 보이지 않게 — 무대가 줄면 안쪽으로 당긴다. */
  window.addEventListener("resize", function () {
    if (!isOpen()) { return; }
    var at = clamp(win.offsetLeft, win.offsetTop);
    if (moved) { moved = at; }
    place(at);
  });
})();
