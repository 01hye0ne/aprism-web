/*
 * 시안 3 · Delta 창 — 뜨는 자리와 끌어 옮기기.
 *
 * 여닫기 자체는 screen.js 가 한다([data-ai-toggle] 로 .is-open 을 붙였다 뗀다).
 * 여기서는 그 상태 변화를 보고 세 가지만 한다.
 *   1. 처음 펼치면 지도 한가운데에 놓는다 — Figma 의 창 자리(Two Column 가운데)다.
 *   2. 머리를 잡아 옮긴다. 사람이 한 번 옮기면 그 자리를 기억한다(다시 펼쳐도 거기다).
 *   3. 접으면 왼쪽 위 모서리로 돌아간다 — 인라인 자리를 지우면 CSS 가 맡는다.
 *
 * 그리고 프리즘 쪽 디테일 둘이 더 있다.
 *   4. 빛은 왼쪽 위 Delta 자리 한 곳에서 온다. 창이 어디에 있든 그쪽에서 받도록
 *      바깥 · 안쪽 빛의 방향과 세기를 계산해 CSS 변수로 넣는다(--d3-*).
 *   5. 접힘 <-> 펼침은 한 동작으로 잇는다. 모서리의 카드가 그대로 넓어져 창이 된다 —
 *      자리와 크기를 재서 되돌린 뒤 제자리로 풀어 준다(FLIP).
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
    light();
  }

  function opened() {
    place(moved ? clamp(moved.left, moved.top) : middle());
  }

  function closed() {
    win.style.left = "";
    win.style.top = "";
  }

  /* ---------- 빛의 방향과 세기 ---------- *
   * 광원은 접힌 Delta 의 표식 자리(무대 왼쪽 위에서 22, 22)다.
   * u = 광원에서 창 한가운데로 가는 단위 벡터. 짜임은 Figma 카드와 같다.
   *   바깥 빛   -u 쪽(광원 쪽)으로 샌다
   *   강한 띠   빛이 빠져나가는 +u 변에 앉는다(inset 은 반대쪽에 띠를 만든다)
   *   옅은 띠   빛이 들어오는 -u 변
   */
  function light() {
    if (!isOpen()) { return; }
    var box = win.getBoundingClientRect();
    var base = stage.getBoundingClientRect();
    var dx = (box.left - base.left) + box.width / 2 - 22;
    var dy = (box.top - base.top) + box.height / 2 - 22;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / dist;
    var uy = dy / dist;
    var far = Math.sqrt(base.width * base.width + base.height * base.height) || 1;
    // 멀어질수록 옅어지되 절반 아래로는 안 내려간다 — 단계 색을 못 읽으면 안 된다.
    var power = Math.max(0.55, 1 - 0.45 * (dist / far));

    win.style.setProperty("--d3-ox", (-ux * 10).toFixed(1) + "px");
    win.style.setProperty("--d3-oy", (-uy * 10).toFixed(1) + "px");
    win.style.setProperty("--d3-ix", (-ux * 7).toFixed(1) + "px");
    win.style.setProperty("--d3-iy", (-uy * 7).toFixed(1) + "px");
    win.style.setProperty("--d3-ex", (ux * 4).toFixed(1) + "px");
    win.style.setProperty("--d3-ey", (uy * 4).toFixed(1) + "px");
    win.style.setProperty("--d3-power", power.toFixed(3));
  }

  /* ---------- 접힘 <-> 펼침을 한 동작으로 ---------- *
   * 누르기 직전의 자리를 재 두었다가(was), 새 자리에서 그 크기로 되돌린 뒤 풀어 준다.
   * 내용은 늘어나 보이지 않게 잠깐 흐렸다 돌아온다.
   */
  var was = null;

  function morph() {
    if (!was || !win.animate) { was = null; return; }
    var to = win.getBoundingClientRect();
    if (!to.width || !was.width) { was = null; return; }
    var sx = was.width / to.width;
    var sy = was.height / to.height;
    var dx = was.left - to.left;
    var dy = was.top - to.top;
    was = null;
    win.animate([
      { transform: "translate(" + dx + "px," + dy + "px) scale(" + sx + "," + sy + ")" },
      { transform: "none" }
    ], { duration: 280, easing: "cubic-bezier(.2,.9,.25,1)" });
    win.style.transformOrigin = "top left";
    var card = win.querySelector(".delta3-card");
    if (card) { card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260, easing: "ease-out" }); }
  }

  /* 여닫는 버튼은 screen.js 가 듣는다 — 그보다 먼저(캡처) 지금 자리를 재 둔다. */
  document.addEventListener("click", function (event) {
    if (!event.target.closest("[data-ai-toggle], [data-delta3-close]")) { return; }
    was = win.getBoundingClientRect();
  }, true);

  /* screen.js 가 .is-open 을 붙였다 뗄 때마다 따라간다.
     class 는 끌기 표시(.is-dragging) 로도 바뀌므로 여닫힘이 실제로 달라졌을 때만 움직인다. */
  var shown = isOpen();

  new MutationObserver(function () {
    if (isOpen() === shown) { return; }
    shown = !shown;
    if (shown) { opened(); } else { closed(); }
    light();
    morph();
  }).observe(win, { attributes: true, attributeFilter: ["class"] });

  if (isOpen()) { opened(); light(); }

  /* ---------- 끌어 옮기기 ---------- */
  var grab = null;

  head.addEventListener("pointerdown", function (event) {
    if (!isOpen() || event.target.closest("button")) { return; }
    grab = { x: event.clientX, y: event.clientY, left: win.offsetLeft, top: win.offsetTop };
    win.classList.add("is-dragging");
    head.setPointerCapture(event.pointerId);
  });

  head.addEventListener("pointermove", function (event) {
    if (!grab) { return; }
    moved = clamp(grab.left + event.clientX - grab.x, grab.top + event.clientY - grab.y);
    place(moved);
  });

  function drop() { grab = null; win.classList.remove("is-dragging"); }

  head.addEventListener("pointerup", drop);
  head.addEventListener("pointercancel", drop);

  /* 창을 접고 펴는 길은 하나다 — 닫기도 [+] 와 같은 토글을 누른다. */
  if (close && toggle) {
    close.addEventListener("click", function () { toggle.click(); });
  }

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && isOpen() && toggle) { toggle.click(); }
  });

  /*
   * Delta 표식(세 상태 도트) — 단계가 바뀌면 점 셋이 1 - 2 - 3 순으로 다시 팝인한다.
   * 점 자체의 애니메이션은 단계마다 이름이 달라 브라우저가 알아서 다시 돌리는데,
   * 팝인은 이름이 그대로라 안 돈다. 클래스를 뗐다 붙이고 그 사이에 리플로를 한 번 일으킨다.
   */
  var dots = document.querySelector("[data-delta-dots]");

  if (dots) {
    new MutationObserver(function () {
      dots.classList.remove("is-enter");
      void dots.offsetWidth;
      dots.classList.add("is-enter");
    }).observe(document.body, { attributes: true, attributeFilter: ["data-level"] });
  }

  /* 창이 잘려 보이지 않게 — 무대가 줄면 안쪽으로 당긴다. */
  window.addEventListener("resize", function () {
    if (!isOpen()) { return; }
    var at = clamp(win.offsetLeft, win.offsetTop);
    if (moved) { moved = at; }
    place(at);
  });
})();
