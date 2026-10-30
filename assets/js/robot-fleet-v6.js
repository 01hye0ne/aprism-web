/*
 * [10/30 v6] 우측 패널 "로봇 선택" — Figma UI_00 Mission-in progress-2 (1533:19576).
 *
 * 왜(디자이너): 왼쪽 위 미션 고르기로는 다른 미션에 어떤 알림이 났는지 알기 어렵다.
 * 그래서 전체 미션의 로봇을 한 줄에 두고, 이상을 찾은 로봇은 칸 오른쪽 위에 아이콘을 단다.
 *   위험 = 빨강 ⓧ(error) · 주의 = 노랑 △(warning) — 미션 고르기 메뉴(mission-scope.js)의 기호와 같다.
 * 머리 줄 — N대 연결(줄에 선 로봇 중 연결된 수) · 위험 N · 주의 N(그 단계 알림이 있는 로봇 수, 0 이면 숨김).
 *
 * 칸을 누르면 아래 로봇 카드(.robot-strip .robot-card[data-robot])를 대신 누른다 —
 * 다른 미션 로봇이면 mission-scope.js 가 그 미션으로 먼저 넘긴다([로봇 현황] 의 [선택]과 같은 길).
 * 그림은 robot-2d.js 가 카드에 그린 2D 로봇을 복제한다(칸에서는 움직이지 않는다).
 * 알림은 monitor.js 의 APRISM_DELTA_ALERTS.all(미션 상관없이 전체) — 알림이 바뀔 때마다 다시 칠한다.
 */
(function () {
  "use strict";

  var box = document.querySelector("[data-robot-fleet]");
  if (!box) { return; }
  var MISSIONS = window.APRISM_ROBOT_MISSIONS || [];
  var conn = document.querySelector("[data-fleet-conn]");
  var crit = document.querySelector("[data-fleet-crit]");
  var warn = document.querySelector("[data-fleet-warn]");

  function cardOf(i) { return document.querySelector(".robot-strip .robot-card[data-robot='" + i + "']"); }
  function nameOf(i) { var c = cardOf(i), id = c && c.querySelector(".robot-id"); return id ? id.textContent.trim() : "Robot " + ("0" + (i + 1)).slice(-2); }

  // 미션이 있는 로봇만, 로봇 번호 차례로
  var ids = [];
  MISSIONS.forEach(function (m, i) { if (m && cardOf(i)) { ids.push(i); } });

  var tiles = ids.map(function (i) {
    var card = cardOf(i);
    var b = document.createElement("button");
    b.type = "button";
    b.className = "rf-tile";
    b.setAttribute("data-fleet-robot", String(i));
    b.setAttribute("aria-pressed", "false");
    if (card.hasAttribute("data-robot-offline")) { b.classList.add("is-offline"); b.setAttribute("aria-disabled", "true"); }

    var art = document.createElement("span");
    art.className = "rf-art";
    art.setAttribute("aria-hidden", "true");
    var g = card.querySelector(".robot-thumb .robot-2d") || card.querySelector(".robot-thumb svg");
    if (g) { art.appendChild(g.cloneNode(true)); }
    b.appendChild(art);

    var sev = document.createElement("span");
    sev.className = "i i-14 rf-sev";
    sev.setAttribute("aria-hidden", "true");
    sev.hidden = true;
    b.appendChild(sev);

    var label = document.createElement("span");
    label.className = "rf-name";
    label.textContent = nameOf(i);
    b.appendChild(label);

    b.addEventListener("click", function () {
      if (b.classList.contains("is-offline")) { return; }
      var c = cardOf(i);
      if (c) { c.click(); }
      window.setTimeout(sync, 0);
    });
    box.appendChild(b);
    return b;
  });

  // 로봇마다 가장 높은 알림 단계
  function levels() {
    var all = (window.APRISM_DELTA_ALERTS && window.APRISM_DELTA_ALERTS.all) || [];
    var lv = {};
    all.forEach(function (a) {
      if (a.robot == null) { return; }
      if (a.sev === "critical") { lv[a.robot] = "critical"; }
      else if (a.sev === "warning" && lv[a.robot] !== "critical") { lv[a.robot] = "warning"; }
    });
    return lv;
  }

  function sync() {
    var lv = levels(), nc = 0, nw = 0, on = 0;
    tiles.forEach(function (b) {
      var i = Number(b.getAttribute("data-fleet-robot")), card = cardOf(i), s = lv[i] || null;
      b.setAttribute("aria-pressed", card && card.getAttribute("aria-pressed") === "true" ? "true" : "false");
      if (!b.classList.contains("is-offline")) { on += 1; }
      if (s === "critical") { nc += 1; } else if (s === "warning") { nw += 1; }
      var ic = b.querySelector(".rf-sev");
      ic.hidden = !s;
      if (s) {
        ic.setAttribute("data-sev", s);
        ic.style.setProperty("--i", "var(--ic-" + (s === "critical" ? "error" : "warning") + ")");
      }
      var m = MISSIONS[i] || "";
      b.title = nameOf(i) + " · " + m + (s ? " · " + (s === "critical" ? "위험" : "주의") + " 알림 있음" : "");
      b.setAttribute("aria-label", b.title);
    });
    if (conn) { conn.textContent = on + "대 연결"; }
    if (crit) { crit.hidden = !nc; crit.lastElementChild.textContent = "위험 " + nc; }
    if (warn) { warn.hidden = !nw; warn.lastElementChild.textContent = "주의 " + nw; }
  }

  sync();
  ["aprism:alert-levels", "aprism:severity", "aprism:scope"].forEach(function (ev) {
    document.addEventListener(ev, function () { window.setTimeout(sync, 0); });
  });
  // 아래 카드 · [로봇 현황] 으로 로봇을 바꿔도 고른 칸을 따라간다
  document.addEventListener("click", function (event) {
    if (event.target.closest && event.target.closest(".robot-card, .rc-arrow")) { window.setTimeout(sync, 0); }
  });
})();
