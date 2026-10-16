/*
 * 미션 범위 — 통합 관제 메인 v2.2 (2026-10-06 클라이언트 회의 이후)
 *
 * 화면 전체가 미션 하나를 본다. 상태바의 미션 고르기가 그 기준이다.
 *   왼쪽 최신 알림   그 미션의 알림만 (monitor.js 가 aprism:scope 를 듣는다)
 *   오른쪽 로봇 패널  그 미션의 로봇만 — 화살표도 그 안에서만 넘긴다
 *   지도             미션 이름의 층(지하 N층 → BN)으로 넘어간다
 * 미션 밖 로봇은 [로봇 현황] 이 맡는다. 거기서 다른 미션 로봇을 고르면 그 미션으로 넘어간다.
 *
 * Delta · 테두리 색은 미션과 상관없이 전체 알림을 본다(인덱스 "확인이 필요한 것").
 * 다른 미션에 주의 · 위험이 있으면 미션 메뉴의 그 미션 옆에 점이 찍힌다.
 *
 * body[data-mission-scope] 가 있는 판에서만 돈다. 미션 이름은 screen.js 의 로봇 데이터에서 온다.
 */
(function () {
  "use strict";

  var body = document.body;
  if (!body.hasAttribute("data-mission-scope")) { return; }

  var MISSIONS = window.APRISM_ROBOT_MISSIONS || [];
  var menuBox = document.querySelector("[data-scope-menu-box]");
  var trigger = document.querySelector("[data-scope-trigger]");
  var nameSlot = document.querySelector("[data-scope-name]");
  var menu = document.querySelector("[data-scope-menu]");
  var countSlot = document.querySelector("[data-scope-count]");
  var runSlot = document.querySelector("[data-scope-running]");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".robot-strip .robot-card[data-robot]"));
  if (!trigger || !menu || !cards.length) { return; }

  var current = MISSIONS[0] || null;
  // 전체 층 현황(building-v2-2.html)에서 층 · 미션을 골라 들어오면 ?mission= 이 붙어 온다.
  var asked = /[?&]mission=([^&#]+)/.exec(location.search);
  if (asked) {
    try {
      var want = decodeURIComponent(asked[1].replace(/\+/g, " "));
      if (MISSIONS.indexOf(want) >= 0) { current = want; }
    } catch (e) { /* 깨진 주소면 첫 미션 */ }
  }

  // 전체 건물로 나가는 링크 — 테마 같은 보기 설정은 들고 간다.
  var keep = (location.search.match(/[?&](theme|palette|delta|glow)=[\w-]+/g) || [])
    .map(function (q) { return q.slice(1); }).join("&");
  if (keep) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-building-link]"), function (a) {
      a.setAttribute("href", a.getAttribute("href").split("?")[0] + "?" + keep);
    });
  }
  var levels = window.APRISM_ALERT_LEVELS || {};   // 미션 → 가장 높은 알림 단계(monitor.js)

  function missionOf(card) { return MISSIONS[Number(card.getAttribute("data-robot"))] || null; }

  // 로봇 순서대로, 겹치지 않게. 미션이 없는 로봇은 메뉴에 넣지 않는다(로봇 현황이 맡는다).
  function names() {
    var list = [];
    MISSIONS.forEach(function (m) { if (m && list.indexOf(m) < 0) { list.push(m); } });
    return list;
  }

  function floorOf(m) {
    var hit = /지하\s*(\d+)\s*층/.exec(m || "");
    return hit ? "B" + hit[1] : null;
  }

  function closeMenu() {
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  }

  function buildMenu() {
    menu.textContent = "";
    names().forEach(function (m) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "menu-item scope-item";
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", m === current ? "true" : "false");

      var dot = document.createElement("span");
      dot.className = "scope-dot";
      if (levels[m]) {
        dot.setAttribute("data-sev", levels[m]);
        dot.title = levels[m] === "critical" ? "위험 알림 있음" : "주의 알림 있음";
      }
      var text = document.createElement("span");
      text.className = "t-label-2";
      text.textContent = m;

      item.appendChild(dot);
      item.appendChild(text);
      item.addEventListener("click", function () {
        closeMenu();
        apply(m, false);
      });
      menu.appendChild(item);
    });
  }

  /*
   * keepRobot — [로봇 현황] 에서 다른 미션 로봇을 고른 경우. 그 로봇이 곧 선택되므로 첫 장으로 옮기지 않는다.
   */
  function apply(m, keepRobot) {
    current = m;
    nameSlot.textContent = m || "배정된 미션 없음";

    var shown = cards.filter(function (card) {
      var on = missionOf(card) === m;
      card.hidden = !on;
      return on;
    });

    if (countSlot) { countSlot.textContent = shown.length + "대 배정"; }
    if (runSlot) {
      runSlot.textContent = shown.filter(function (c) { return c.querySelector(".badge-info"); }).length + "대 수행중";
    }

    if (!keepRobot) {
      var pressed = cards.filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })[0];
      if (!pressed || pressed.hidden) {
        var first = shown.filter(function (c) { return !c.hasAttribute("data-robot-offline"); })[0];
        if (first) { first.click(); }
      }
    }

    var floor = floorOf(m);
    if (floor) { window.APRISM_FLOOR_WANT = floor; }   // 지도가 아직 안 섰으면 map.js 가 이 층으로 연다
    var floorBtn = floor && document.querySelector("[data-map-floor='" + floor + "']");
    if (floorBtn && floorBtn.getAttribute("aria-pressed") !== "true") { floorBtn.click(); }

    buildMenu();
    document.dispatchEvent(new CustomEvent("aprism:scope", { detail: { mission: m } }));
  }

  trigger.addEventListener("click", function (event) {
    event.stopPropagation();
    var open = trigger.getAttribute("aria-expanded") === "true";
    trigger.setAttribute("aria-expanded", open ? "false" : "true");
    menu.hidden = open;
  });

  document.addEventListener("click", function (event) {
    if (!menuBox.contains(event.target)) { closeMenu(); }
  });

  menuBox.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { closeMenu(); trigger.focus(); }
  });

  // [로봇 현황] 의 [선택] 은 숨은 띠 카드를 누른다 — 누르기 전에 그 로봇의 미션으로 넘어간다.
  document.addEventListener("click", function (event) {
    var card = event.target.closest && event.target.closest(".robot-strip .robot-card[data-robot]");
    if (card && card.hidden) { apply(missionOf(card), true); }
  }, true);

  document.addEventListener("aprism:alert-levels", function (event) {
    levels = event.detail || {};
    buildMenu();
  });

  apply(current, false);
})();
