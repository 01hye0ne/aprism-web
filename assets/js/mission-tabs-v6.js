/*
 * [10/30 v6] 상단 미션 탭 — 드롭다운(미션 고르기) 대신 윈도우 파일 탐색기처럼 탭을 늘어놓는다(디자이너).
 *   [전체 미션] [미션 △] [미션 ⓧ] [미션] …
 * 지금 보는 탭은 아래 면(content-surface, bg/cell)과 이어져 한 장처럼 보이고, 바닥 양옆이 바깥으로 둥글게 퍼진다.
 * 탭 이름 뒤 기호는 그 미션의 가장 높은 알림 단계(ⓧ 위험 · △ 주의) — 다른 미션에 무슨 일이 났는지 탭에서 바로 보인다.
 *
 * 탭 내용은 기존 미션 메뉴(관제 mission-scope.js 의 [data-scope-menu] · 통합 순회 building.js 의 [data-bld-menu])에서 읽는다.
 * 메뉴는 숨겨 두고 그대로 살려 둔다 — 탭을 누르면 그 메뉴 줄을 대신 누르므로 미션 바꾸기 · 들어가기 동작이 같다.
 * 메뉴가 다시 그려지면(알림 단계 · 미션이 바뀌면) 탭도 다시 그린다.
 * [10/30] 안전진단(safety.js)도 — 상단 경로([data-sf-crumb])를 그릴 때마다 통째로 새로 깔므로, 메뉴 · 통합 순회 단추는 매번 다시 찾는다.
 *   거기서 첫 탭은 다른 화면으로 가지 않고 그 화면의 "미션 전체" 보기(단추 data-sc="all")를 누른다.
 */
(function () {
  "use strict";

  var left = document.querySelector(".status-bar-left");
  var MENU = "[data-scope-menu], [data-bld-menu], .sf-scope";
  if (!left || !document.querySelector(MENU)) { return; }
  var menu, overview, onOverview;
  function find() {
    menu = document.querySelector(MENU);
    overview = left.querySelector(".sb-overview");
    onOverview = !!(overview && overview.classList.contains("is-on"));
  }

  var bar = document.createElement("nav");
  bar.className = "sb-tabs";
  bar.setAttribute("aria-label", "보는 범위");
  var logo = left.querySelector(".status-bar-logo");
  if (logo && logo.nextSibling) { left.insertBefore(bar, logo.nextSibling); } else { left.appendChild(bar); }

  // [11/05] 미션 번호 — 탭 이름 앞에 M1, M2 … 를 붙인다(디자이너). 탭을 끌어 순서를 바꿔도 번호는 미션을 따라간다.
  //   번호는 처음 펼친 탭 차례(수행중 → 대기 → 완료) 그대로 고정한다.
  var MNO = ["정기 순회 점검", "발전기실 설비 점검", "전기실 열화상 점검", "소방 설비 점검", "주간 설비 점검", "야간 순회 점검", "공조 설비 순회", "유틸리티 순회"];
  //   영문판은 번역기가 이름을 먼저 영어로 바꿔 두므로 사전(APRISM_EN)으로 영어 이름도 같은 번호에 잇는다
  var EN = window.APRISM_EN || {};
  var MNO_EN = MNO.map(function (k) { return EN[k]; });
  var IDLE = ["소방 설비 점검", "주간 설비 점검"];   // 데모 대기 미션(screen.js ver-6 블록과 같다)
  function mno(name) { var i = MNO.indexOf(name); return i >= 0 ? i : MNO_EN.indexOf(name); }

  function tab(tag, name, on) {
    var t = document.createElement(tag);
    t.className = "sb-tab" + (on ? " is-on" : "");
    if (tag === "button") { t.type = "button"; }
    if (on) { t.setAttribute("aria-current", "page"); }
    var n = document.createElement("span");
    n.className = "sb-tab-name t-label-1";
    n.textContent = name;
    var no = mno(name);
    if (no >= 0) {
      var m = document.createElement("span");
      m.className = "sb-tab-no t-label-1";
      m.textContent = "M" + (no + 1);
      t.appendChild(m);
    }
    t.appendChild(n);
    return t;
  }

  function build() {
    find();
    if (!menu) { return; }
    bar.textContent = "";
    // 통합 순회 현황 — 관제에서는 그 화면으로 가는 링크, 통합 순회 현황에서는 지금 탭, 안전진단에서는 "미션 전체" 단추
    var isBtn = !!(overview && overview.tagName === "BUTTON");
    // [10/30] 첫 탭 이름 = "전체 미션"(디자이너 — 관제 · 통합 순회 현황 · 안전진단 통일)
    var first = tab(isBtn ? "button" : onOverview ? "span" : "a", "전체 미션", onOverview);
    first.querySelector(".sb-tab-name").setAttribute("data-en", "All");   // [11/05] 영문판 첫 탭은 All
    if (isBtn) { var ov = overview; first.addEventListener("click", function () { if (!first.classList.contains("is-on")) { ov.click(); } }); }
    else if (!onOverview && overview) { first.href = overview.getAttribute("href") || "building-v6.html"; }
    bar.appendChild(first);

    // 끌어서 바꾼 순서(저장된 이름 차례)를 먼저, 처음 보는 미션은 메뉴 차례대로 뒤에
    var saved = loadOrder();
    var items = Array.prototype.slice.call(menu.querySelectorAll(".scope-item")).filter(function (item) { return item.querySelector(".scope-name .t-label-2"); });
    // 기본 차례는 수행중 → 대기 → 완료(관제 메뉴와 같다) — 안전진단 메뉴는 로봇 번호 차례라 여기서 맞춘다
    var RUN = { run: 0, idle: 1, done: 2 };
    var at = function (item) {
      var i = saved.indexOf(item.querySelector(".scope-name .t-label-2").textContent);
      if (i >= 0) { return i; }
      var r = item.querySelector(".scope-run"), g = r ? RUN[r.getAttribute("data-run")] : 1;
      return 1e3 + (g == null ? 1 : g) * 100 + items.indexOf(item);
    };
    items.sort(function (a, b) { return at(a) - at(b); });
    items.forEach(function (item) {
      var nm = item.querySelector(".scope-name .t-label-2");
      var on = !onOverview && item.getAttribute("aria-checked") === "true";
      var t = tab("button", nm.textContent, on);
      var run = item.querySelector(".scope-run");
      if (run) { t.setAttribute("data-run", run.getAttribute("data-run") || ""); }
      var sevEl = item.querySelector(".scope-sev");
      var sev = sevEl && sevEl.getAttribute("data-sev");
      var label = nm.textContent;
      if (mno(label) >= 0) { label = "M" + (mno(label) + 1) + " " + label; }
      if (sev) {
        var ic = document.createElement("span");
        ic.className = "i i-16 sb-tab-sev";
        ic.setAttribute("data-sev", sev);
        ic.style.setProperty("--i", "var(--ic-" + (sev === "critical" ? "error" : "warning") + ")");
        ic.setAttribute("aria-hidden", "true");
        t.appendChild(ic);
        label += " · " + (sev === "critical" ? "위험" : "주의") + " 알림 있음";
      }
      // 다른 미션에 새 위험(안전진단 시연 — 메뉴 줄의 data-new) — 탭 이름 앞 점이 깜빡이고 "새로"가 붙는다. 그 미션을 열면 사라진다
      if (item.getAttribute("data-new")) {
        t.classList.add("is-new");
        var nd = document.createElement("i"); nd.className = "sb-tab-new"; nd.setAttribute("aria-hidden", "true");
        t.insertBefore(nd, t.firstChild);
        label += " · 새 위험";
      }
      t.title = label;
      t.setAttribute("aria-label", label);
      t.setAttribute("data-mission", nm.textContent);
      t.title = label + " — 끌어서 순서 바꾸기";
      t.addEventListener("click", function () { if (justDragged) { return; } item.click(); });
      t.addEventListener("pointerdown", startDrag);
      t.addEventListener("keydown", keyMove);
      bar.appendChild(t);
    });

    // [11/05] 상단 탭 줄은 어느 화면이나 같다(디자이너) — 메뉴에 대기 미션이 없는 화면(전체 미션 · 안전진단)도 M4 · M5 를 두고, 누르면 관제 탭처럼 그 미션 설정으로
    IDLE.forEach(function (name) {
      if (bar.querySelector(".sb-tab[data-mission='" + name + "'], .sb-tab[data-mission='" + EN[name] + "']")) { return; }
      var t = tab("button", name, false);
      t.setAttribute("data-run", "idle");
      t.setAttribute("data-mission", name);
      t.title = "M" + (mno(name) + 1) + " " + name + " — 끌어서 순서 바꾸기";
      t.addEventListener("click", function () { if (justDragged) { return; } window.location.href = (window.aprismHref || String)("./mission-setup-v6.html?mission=" + encodeURIComponent(name)); });
      t.addEventListener("pointerdown", startDrag);
      t.addEventListener("keydown", keyMove);
      bar.insertBefore(t, bar.querySelector(".sb-tab[data-run='done']"));
    });
    // 끌어서 바꾼 순서가 있으면 채워 넣은 탭까지 그 차례로
    if (saved.length) {
      var pos = function (t) { var i = saved.indexOf(t.getAttribute("data-mission")); return i >= 0 ? i : 1e3; };
      missionTabs().map(function (t, i) { return [pos(t), i, t]; }).sort(function (a, b) { return a[0] - b[0] || a[1] - b[1]; }).forEach(function (e) { bar.appendChild(e[2]); });
    }

  }

  /*
   * [10/30 v6] 탭 순서 바꾸기 — 미션 탭을 잡고 옆으로 끌면 자리가 바뀐다(디자이너). [통합 순회 현황]은 맨 앞에 고정.
   * 끄는 탭은 손을 따라오고, 지나치는 탭은 반 넘게 넘어가면 비켜 선다(부드럽게 미끄러짐). 놓으면 제자리로 붙는다.
   * 순서는 이 브라우저에 기억한다(localStorage) — 관제 · 통합 순회 현황 두 화면이 같은 순서를 쓴다.
   * 키보드: 탭에 초점을 두고 Alt + ← / → 로 한 칸씩 옮긴다.
   */
  var KEY = "aprism-v6-tab-order";
  function loadOrder() { try { return JSON.parse(localStorage.getItem(KEY) || "[]") || []; } catch (e) { return []; } }
  function saveOrder() {
    var names = Array.prototype.map.call(bar.querySelectorAll(".sb-tab[data-mission]"), function (t) { return t.getAttribute("data-mission"); });
    try { localStorage.setItem(KEY, JSON.stringify(names)); } catch (e) { /* 저장 못 하면 이번 화면에서만 */ }
  }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var drag = null, justDragged = false, pending = false;

  function missionTabs() { return Array.prototype.slice.call(bar.querySelectorAll(".sb-tab[data-mission]")); }
  // 옮기기 전후 자리를 재서 비켜 서는 탭을 미끄러뜨린다(FLIP)
  function slide(moveFn, except) {
    var tabs = missionTabs().filter(function (t) { return t !== except; });
    var before = tabs.map(function (t) { return t.getBoundingClientRect().left; });
    moveFn();
    if (reduce) { return; }
    tabs.forEach(function (t, i) {
      var dx = before[i] - t.getBoundingClientRect().left;
      if (!dx) { return; }
      t.style.transition = "none";
      t.style.transform = "translateX(" + dx + "px)";
      requestAnimationFrame(function () { t.style.transition = "transform 180ms ease"; t.style.transform = ""; });
    });
  }
  function startDrag(event) {
    if (event.button !== 0) { return; }
    var t = event.currentTarget;
    drag = { t: t, x0: event.clientX, moved: false, id: event.pointerId };
    t.addEventListener("pointermove", onDrag);
    t.addEventListener("pointerup", endDrag);
    t.addEventListener("pointercancel", endDrag);
  }
  function onDrag(event) {
    if (!drag) { return; }
    var t = drag.t, dx = event.clientX - drag.x0;
    if (!drag.moved) {
      if (Math.abs(dx) < 5) { return; }
      drag.moved = true;
      try { t.setPointerCapture(drag.id); } catch (e) { /* 합성 이벤트 등 */ }
      t.classList.add("is-dragging");
      bar.classList.add("is-sorting");
      t.style.transition = "none";
    }
    // 손 자리 — 끄는 탭의 원래 자리(transform 뺀 것)에서 dx 만큼. 맨 앞 · 맨 뒤 미션 탭 밖으로는 안 나간다
    t.style.transform = "";
    var home = t.getBoundingClientRect();
    var tabs = missionTabs(), lo = tabs[0].getBoundingClientRect().left - home.left, hi = tabs[tabs.length - 1].getBoundingClientRect().right - home.right;
    var off = Math.max(lo, Math.min(hi, event.clientX - drag.x0));
    var cx = home.left + home.width / 2 + off;
    // 반 넘게 넘어간 옆 탭과 자리를 바꾼다
    var prev = t.previousElementSibling, next = t.nextElementSibling;
    if (next && next.hasAttribute("data-mission") && cx > next.getBoundingClientRect().left + next.getBoundingClientRect().width / 2) {
      slide(function () { bar.insertBefore(next, t); }, t);
    } else if (prev && prev.hasAttribute("data-mission") && cx < prev.getBoundingClientRect().left + prev.getBoundingClientRect().width / 2) {
      slide(function () { bar.insertBefore(t, prev); }, t);
    }
    // 자리를 바꿨으면 원래 자리가 옮겨졌다 — 그만큼 기준을 옮겨 탭이 손 밑에 그대로 있게
    var shift = t.getBoundingClientRect().left - home.left;
    drag.x0 += shift;
    t.style.transform = "translateX(" + (off - shift) + "px)";
  }
  function endDrag() {
    if (!drag) { return; }
    var t = drag.t, moved = drag.moved;
    t.removeEventListener("pointermove", onDrag);
    t.removeEventListener("pointerup", endDrag);
    t.removeEventListener("pointercancel", endDrag);
    drag = null;
    if (!moved) { return; }
    // 놓으면 제자리로 붙는다. 끈 뒤 바로 오는 click 은 미션을 바꾸지 않게 한 번 막는다
    t.style.transition = reduce ? "none" : "transform 160ms ease";
    t.style.transform = "";
    t.classList.remove("is-dragging");
    bar.classList.remove("is-sorting");
    justDragged = true;
    setTimeout(function () { justDragged = false; }, 0);
    saveOrder();
    if (pending) { pending = false; build(); }
  }
  function keyMove(event) {
    if (!event.altKey || (event.key !== "ArrowLeft" && event.key !== "ArrowRight")) { return; }
    event.preventDefault();
    var t = event.currentTarget, sib = event.key === "ArrowLeft" ? t.previousElementSibling : t.nextElementSibling;
    if (!sib || !sib.hasAttribute("data-mission")) { return; }
    slide(function () { if (event.key === "ArrowLeft") { bar.insertBefore(t, sib); } else { bar.insertBefore(sib, t); } });
    t.focus();
    saveOrder();
  }

  build();
  // 메뉴가 다시 그려지면(알림 단계 · 미션) 탭도 — 끄는 중이면 놓은 뒤에
  // 상태바 왼쪽 전체를 본다 — 메뉴가 통째로 바뀌는 화면(안전진단)도 있다. 탭 줄 자신이 바뀐 것은 무시한다
  new MutationObserver(function (list) {
    if (list.every(function (r) { return bar.contains(r.target); })) { return; }
    if (drag && drag.moved) { pending = true; } else { build(); }
  }).observe(left, { childList: true, subtree: true, attributes: true, attributeFilter: ["aria-checked", "class"] });
})();
