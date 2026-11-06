/*
 * 최신 알림 정렬 바꾸기 — [⇅ 오래된 순] 을 누르면 [⇅ 최신 순] (관제 monitor.js · 전체 미션 building.js 공통)
 *
 * [11/05 논의] 예전엔 거르기 줄 오른쪽에 "오래된 순 · 위험 우선" 이 고를 수 없는 글로만 있었다.
 * 위험이 먼저인 규칙은 그대로 두고, 같은 단계 안의 시간 순서만 바꾼다. 단추 하나 — 지금 순서를 말하고, 누르면 반대로.
 * 고른 값은 화면끼리 같이 기억한다(localStorage).
 *
 * 쓰는 법: APRISM_AH_SORT.mount(다시 그리기) — .ah-order 자리를 단추로 바꾼다.
 *          APRISM_AH_SORT.time(a, b) — 같은 단계 안 시간 비교(오래된 순이면 오름차순).
 */
(function () {
  "use strict";
  var KEY = "aprism-ah-sort";
  var LABEL = { old: "오래된 순", new: "최신 순" };
  var HINT = "위험 알림이 먼저, 같은 단계 안에서 시간 순서. 누르면 순서를 바꾼다";
  var mode = "old";
  try { if (localStorage.getItem(KEY) === "new") { mode = "new"; } } catch (e) { /* 저장이 막혀도 기본값 */ }

  function time(a, b) {
    var d = a.time < b.time ? -1 : a.time > b.time ? 1 : 0;
    return mode === "new" ? -d : d;
  }

  function mount(onChange) {
    var slot = document.querySelector(".ah-order");
    if (!slot || slot.hasAttribute("data-ah-sort")) { return; }
    var b = document.createElement("button");
    b.type = "button";
    b.className = "ah-order ah-sort-btn t-caption";
    b.setAttribute("data-ah-sort", "");
    b.setAttribute("aria-label", "정렬 바꾸기");
    b.title = HINT;
    var ic = document.createElement("span");
    ic.className = "i i-16";
    ic.setAttribute("aria-hidden", "true");
    ic.style.setProperty("--i", "var(--ic-sort)");
    var label = document.createElement("span");
    b.appendChild(ic);
    b.appendChild(label);
    function sync() { label.textContent = LABEL[mode]; b.setAttribute("data-mode", mode); }
    b.addEventListener("click", function () {
      mode = mode === "old" ? "new" : "old";
      try { localStorage.setItem(KEY, mode); } catch (e) { /* 그대로 */ }
      sync();
      if (onChange) { onChange(mode); }
    });
    sync();
    slot.replaceWith(b);
  }

  window.APRISM_AH_SORT = { mount: mount, time: time, get: function () { return mode; } };
})();

/*
 * [11/06 v6] 알림 목록 띄운 막대 — 브라우저 막대(12)가 넘칠 때만 생겨 줄 너비가 화면마다 달랐다(전체 미션 312 · 미션 관제 324).
 * 막대는 v6.css 에서 숨기고, 상자(.ah-box) 안 오른쪽에 4 막대를 띄운다. 끌어서 넘길 수 있다.
 */
(function () {
  "use strict";
  if (!document.body || !document.body.classList.contains("ver-6")) { return; }
  function attach(list) {
    var box = list.parentElement;
    if (!box || list.hasAttribute("data-ah-thumb")) { return; }
    list.setAttribute("data-ah-thumb", "");
    var t = document.createElement("span");
    t.className = "ah-thumb";
    t.setAttribute("aria-hidden", "true");
    t.hidden = true;
    box.appendChild(t);
    var th = 0;
    function update() {
      var h = list.clientHeight, sh = list.scrollHeight;
      if (sh <= h + 1 || !h) { t.hidden = true; return; }
      t.hidden = false;
      th = Math.max(24, Math.round(h * h / sh));
      t.style.height = th + "px";
      t.style.top = Math.round(list.offsetTop + (h - th) * list.scrollTop / (sh - h)) + "px";
    }
    list.addEventListener("scroll", update, { passive: true });
    if (window.ResizeObserver) { new ResizeObserver(update).observe(list); }
    new MutationObserver(update).observe(list, { childList: true, subtree: true });
    t.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      var y0 = e.clientY, s0 = list.scrollTop;
      t.classList.add("is-drag");
      t.setPointerCapture(e.pointerId);
      function move(ev) {
        var h = list.clientHeight, sh = list.scrollHeight;
        list.scrollTop = s0 + (ev.clientY - y0) * (sh - h) / Math.max(1, h - th);
      }
      function up() {
        t.classList.remove("is-drag");
        t.removeEventListener("pointermove", move);
        t.removeEventListener("pointerup", up);
        t.removeEventListener("pointercancel", up);
      }
      t.addEventListener("pointermove", move);
      t.addEventListener("pointerup", up);
      t.addEventListener("pointercancel", up);
    });
    update();
  }
  function init() { Array.prototype.forEach.call(document.querySelectorAll(".ah-box > .ah-list"), attach); }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", init); } else { init(); }
})();
