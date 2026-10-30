/*
 * [10/30 v6] 상단 미션 탭 — 드롭다운(미션 고르기) 대신 윈도우 파일 탐색기처럼 탭을 늘어놓는다(디자이너).
 *   [통합 순회 현황] [미션 △] [미션 ⓧ] [미션] …
 * 지금 보는 탭은 아래 면(content-surface, bg/cell)과 이어져 한 장처럼 보이고, 바닥 양옆이 바깥으로 둥글게 퍼진다.
 * 탭 이름 뒤 기호는 그 미션의 가장 높은 알림 단계(ⓧ 위험 · △ 주의) — 다른 미션에 무슨 일이 났는지 탭에서 바로 보인다.
 *
 * 탭 내용은 기존 미션 메뉴(관제 mission-scope.js 의 [data-scope-menu] · 통합 순회 building.js 의 [data-bld-menu])에서 읽는다.
 * 메뉴는 숨겨 두고 그대로 살려 둔다 — 탭을 누르면 그 메뉴 줄을 대신 누르므로 미션 바꾸기 · 들어가기 동작이 같다.
 * 메뉴가 다시 그려지면(알림 단계 · 미션이 바뀌면) 탭도 다시 그린다.
 */
(function () {
  "use strict";

  var left = document.querySelector(".status-bar-left");
  var menu = document.querySelector("[data-scope-menu], [data-bld-menu]");
  if (!left || !menu) { return; }
  var overview = left.querySelector(".sb-overview");
  var onOverview = !!(overview && overview.classList.contains("is-on"));

  var bar = document.createElement("nav");
  bar.className = "sb-tabs";
  bar.setAttribute("aria-label", "보는 범위");
  var logo = left.querySelector(".status-bar-logo");
  if (logo && logo.nextSibling) { left.insertBefore(bar, logo.nextSibling); } else { left.appendChild(bar); }

  function tab(tag, name, on) {
    var t = document.createElement(tag);
    t.className = "sb-tab" + (on ? " is-on" : "");
    if (tag === "button") { t.type = "button"; }
    if (on) { t.setAttribute("aria-current", "page"); }
    var n = document.createElement("span");
    n.className = "sb-tab-name t-label-1";
    n.textContent = name;
    t.appendChild(n);
    return t;
  }

  function build() {
    bar.textContent = "";
    // 통합 순회 현황 — 관제에서는 그 화면으로 가는 링크, 통합 순회 현황에서는 지금 탭
    var first = tab(onOverview ? "span" : "a", "통합 순회 현황", onOverview);
    if (!onOverview && overview) { first.href = overview.getAttribute("href") || "building-v6.html"; }
    bar.appendChild(first);

    Array.prototype.forEach.call(menu.querySelectorAll(".scope-item"), function (item) {
      var nm = item.querySelector(".scope-name .t-label-2");
      if (!nm) { return; }
      var on = !onOverview && item.getAttribute("aria-checked") === "true";
      var t = tab("button", nm.textContent, on);
      var run = item.querySelector(".scope-run");
      if (run) { t.setAttribute("data-run", run.getAttribute("data-run") || ""); }
      var sevEl = item.querySelector(".scope-sev");
      var sev = sevEl && sevEl.getAttribute("data-sev");
      var label = nm.textContent;
      if (sev) {
        var ic = document.createElement("span");
        ic.className = "i i-16 sb-tab-sev";
        ic.setAttribute("data-sev", sev);
        ic.style.setProperty("--i", "var(--ic-" + (sev === "critical" ? "error" : "warning") + ")");
        ic.setAttribute("aria-hidden", "true");
        t.appendChild(ic);
        label += " · " + (sev === "critical" ? "위험" : "주의") + " 알림 있음";
      }
      t.title = label;
      t.setAttribute("aria-label", label);
      t.addEventListener("click", function () { item.click(); });
      bar.appendChild(t);
    });
  }

  build();
  new MutationObserver(build).observe(menu, { childList: true });
})();
