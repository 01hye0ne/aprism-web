/*
 * Delta 창 너비 조절 (v2.2 · 2026-10-13 디자이너) — 펼친 창 · 대화 중 모두.
 *
 *   · 창의 왼쪽 · 오른쪽 변을 잡아 끈다. 오른쪽 변은 왼쪽 변을, 왼쪽 변은 오른쪽 변을 그 자리에 둔다.
 *   · 처음엔 395(Figma 펼친 창). 320(오른쪽 패널 너비) 아래로는 줄지 않고, 720 또는 무대 폭(-16) 위로는 늘지 않는다.
 *   · 정한 너비는 기억한다 — 접었다 다시 펼쳐도 그 너비다. 변을 두 번 누르거나 Home 을 누르면 395 로 돌아간다.
 *   · 너비는 --d3-w 변수로만 넣는다. 접힌 판(260)은 건드리지 않는다.
 *   · 손잡이는 role="separator" — Tab 으로 가서 ← → 로 16씩 바꾼다.
 *
 * 창을 놓는 일(가운데 · 끌기 · 무대 안 가두기)은 delta-v3.js 그대로다. v2.1 과 같이 쓰므로 거기는 고치지 않는다.
 */
(function () {
  "use strict";

  if (!document.body.classList.contains("v2-2")) { return; }

  var win = document.querySelector("[data-delta3]");
  if (!win) { return; }
  var stage = win.parentElement;

  var MIN = 320;      // 오른쪽 패널(col-3) 너비와 같다(10/13 디자이너)
  var START = 395;    // 처음 펼친 너비 — Figma 펼친 창
  var MAX = 720;
  var STEP = 16;
  var width = START;

  function isOpen() { return win.classList.contains("is-open"); }
  function most() { return Math.max(MIN, Math.min(MAX, stage.clientWidth - 16)); }

  function set(w, side) {
    w = Math.round(Math.max(MIN, Math.min(most(), w)));
    var left = win.offsetLeft;
    var right = left + win.offsetWidth;
    width = w;
    win.style.setProperty("--d3-w", w + "px");
    // 왼쪽 변을 끌 때는 오른쪽 변을 그 자리에 둔다. 어느 쪽이든 무대 밖으로는 나가지 않는다.
    var nextLeft = side === "left" ? right - w : left;
    nextLeft = Math.max(8, Math.min(stage.clientWidth - w - 8, nextLeft));
    win.style.left = nextLeft + "px";
    grips.forEach(function (g) { g.setAttribute("aria-valuenow", String(w)); });
  }

  var grips = ["left", "right"].map(function (side) {
    var g = document.createElement("div");
    g.className = "d3-grip is-" + side;
    g.tabIndex = 0;
    g.setAttribute("role", "separator");
    g.setAttribute("aria-orientation", "vertical");
    g.setAttribute("aria-label", "Delta 창 너비");
    g.setAttribute("aria-valuemin", String(MIN));
    g.setAttribute("aria-valuemax", String(MAX));
    g.setAttribute("aria-valuenow", String(START));
    g.title = "끌어서 너비 조절 · 두 번 눌러 처음 너비로";
    win.appendChild(g);

    var grab = null;
    g.addEventListener("pointerdown", function (event) {
      if (!isOpen() || event.button !== 0) { return; }
      event.preventDefault();
      event.stopPropagation();
      grab = { x: event.clientX, w: win.offsetWidth };
      // 끄는 동안은 흐림을 끈다(delta-v3 의 끌기와 같다).
      win.classList.add("is-dragging", "is-resizing");
      try { g.setPointerCapture(event.pointerId); } catch (e) { /* 합성 이벤트 */ }
    });
    g.addEventListener("pointermove", function (event) {
      if (!grab) { return; }
      var dx = event.clientX - grab.x;
      set(grab.w + (side === "left" ? -dx : dx), side);
    });
    function drop() {
      if (!grab) { return; }
      grab = null;
      win.classList.remove("is-dragging", "is-resizing");
      window.dispatchEvent(new Event("resize"));   // 빛 방향 · 무대 가두기를 delta-v3 가 다시 잡는다
    }
    g.addEventListener("pointerup", drop);
    g.addEventListener("pointercancel", drop);
    g.addEventListener("dblclick", function () { set(START, side); window.dispatchEvent(new Event("resize")); });
    g.addEventListener("keydown", function (event) {
      var d = event.key === "ArrowRight" ? STEP : event.key === "ArrowLeft" ? -STEP : 0;
      if (event.key === "Home") { set(START, side); event.preventDefault(); return; }
      if (!d) { return; }
      event.preventDefault();
      set(win.offsetWidth + (side === "left" ? -d : d), side);
    });
    return g;
  });

  // 기억한 너비 — 다시 펼칠 때 무대가 좁아졌으면 들어가는 만큼만.
  new MutationObserver(function () {
    if (isOpen() && width > most()) { win.style.setProperty("--d3-w", most() + "px"); }
  }).observe(win, { attributes: true, attributeFilter: ["class"] });
})();
