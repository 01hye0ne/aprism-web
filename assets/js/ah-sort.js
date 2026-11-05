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
