/*
 * 미션 범위 — 통합 관제 메인 v2.2 (2026-10-06 클라이언트 회의 이후)
 *
 * 화면 전체가 미션 하나를 본다. 상태바의 미션 고르기가 그 기준이다.
 *   왼쪽 최신 알림   그 미션의 알림만 (monitor.js 가 aprism:scope 를 듣는다)
 *   오른쪽 로봇 패널  그 미션의 로봇만 — 화살표도 그 안에서만 넘긴다
 *   지도             고른 로봇이 선 층으로 연다. 층 판은 미션이 지나는 층만 켠다(10/19 — 미션은 여러 층을 지난다).
 *                    미션 모니터링이라 고른 로봇이 층을 옮기면 지도도 따라간다(map.js 층 이동)
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
      // 예전 주소(지하 N층 …)로 와도 받는다 — 10/19 부터 미션 이름에 층이 없다.
      var want = decodeURIComponent(asked[1].replace(/\+/g, " ")).replace(/^지하\s*\d+층\s+/, "");
      if (MISSIONS.indexOf(want) >= 0) { current = want; }
    } catch (e) { /* 깨진 주소면 첫 미션 */ }
  }

  // v3 — 통합 순회 현황에서 층을 펼쳐 본 뒤 들어오면 ?floor= 도 붙어 온다. 그 미션이 지나는 층이면 그 층으로 처음 연다(10/21).
  var askedFloor = (/[?&]floor=(B\d+)/.exec(location.search) || [])[1] || null;

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

  /*
   * 층 — 10/19 디자이너. 미션은 층에 속하지 않고 여러 층을 지난다(screen.js APRISM_MISSION_FLOORS).
   * 지도는 고른 로봇이 선 층으로 열고, 층 판은 그 미션이 지나는 층만 켠다.
   */
  var MFLOORS = window.APRISM_MISSION_FLOORS || {};
  var RFLOORS = window.APRISM_ROBOT_FLOORS || [];
  function floorsOf(m) { return MFLOORS[m] || []; }
  function robotFloor(card) { return card ? RFLOORS[Number(card.getAttribute("data-robot"))] || null : null; }

  // 미션 상태 — 로봇 카드 배지에서 읽는다. 하나라도 수행중이면 수행중, 다 완료면 완료, 나머지는 대기.
  var GROUPS = [["run", "수행중"], ["idle", "대기"], ["done", "완료"]];
  function stateOf(m) {
    var mine = cards.filter(function (c) { return missionOf(c) === m; });
    if (mine.some(function (c) { return c.querySelector(".robot-lists .badge-info"); })) { return "run"; }
    if (mine.length && mine.every(function (c) { return c.querySelector(".robot-lists .badge-normal"); })) { return "done"; }
    return "idle";
  }

  function closeMenu() {
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  }

  // 미션에 배정된 로봇 번호 — "01 · 02"
  function robotsOf(m) {
    return cards.filter(function (c) { return missionOf(c) === m; }).map(function (c) {
      var n = Number(c.getAttribute("data-robot")) + 1;
      return (n < 10 ? "0" : "") + n;
    }).join(" · ");
  }

  /*
   * 표 머리 — 수행 · 미션 · 층 · 로봇(10/19 디자이너). 상태 묶음 머리(수행중 · 대기 · 완료)는 없애고 "수행" 열이 맡는다.
   *   수행중 파란 점(상태 파랑) · 대기 빈 고리 · 완료 빈칸. 줄 순서는 수행중 → 대기 → 완료 그대로다.
   * 알림 단계는 점이 아니라 미션 이름 뒤 기호(ⓧ 위험 · △ 주의)로 — 수행 점과 색 점이 둘이면 뜻이 겹친다.
   */
  function menuHead() {
    var head = document.createElement("div");
    head.className = "scope-head t-caption";
    head.setAttribute("aria-hidden", "true");
    ["수행", "미션", "층", "로봇"].forEach(function (t) {
      var c = document.createElement("span");
      c.textContent = t;
      head.appendChild(c);
    });
    return head;
  }

  function span(cls, text) {
    var n = document.createElement("span");
    if (cls) { n.className = cls; }
    if (text != null) { n.textContent = text; }
    return n;
  }

  function buildMenu() {
    menu.textContent = "";
    menu.appendChild(menuHead());
    GROUPS.forEach(function (g) {
      names().filter(function (m) { return stateOf(m) === g[0]; }).forEach(function (m) {
        var item = document.createElement("button");
        item.type = "button";
        item.className = "menu-item scope-item is-" + g[0];
        item.setAttribute("role", "menuitemradio");
        item.setAttribute("aria-checked", m === current ? "true" : "false");

        var run = span("scope-run");
        run.setAttribute("data-run", g[0]);
        run.title = g[1];
        item.appendChild(run);

        var name = span("scope-name");
        name.appendChild(span("t-label-2", m));
        if (levels[m]) {
          var sev = span("i i-16 scope-sev");
          sev.setAttribute("data-sev", levels[m]);
          sev.style.setProperty("--i", "var(--ic-" + (levels[m] === "critical" ? "error" : "warning") + ")");
          sev.title = levels[m] === "critical" ? "위험 알림 있음" : "주의 알림 있음";
          name.appendChild(sev);
        }
        item.appendChild(name);

        // 지나는 층 — 차례대로(B3 → B4)
        var fl = span("scope-floors");
        floorsOf(m).forEach(function (f) { fl.appendChild(span("floor-tag num", f)); });
        item.appendChild(fl);
        item.appendChild(span("scope-robots num", robotsOf(m)));
        item.setAttribute("aria-label", m + " · " + g[1] + " · " + floorsOf(m).join(" → ") + " · Robot " + robotsOf(m) +
          (levels[m] ? " · " + (levels[m] === "critical" ? "위험" : "주의") + " 알림" : ""));

        item.addEventListener("click", function () {
          closeMenu();
          apply(m, false);
        });
        menu.appendChild(item);
      });
    });
  }

  // 층 판 — 미션이 지나지 않는 층은 끈다. 고른 로봇이 선 층에는 로봇 표시를 붙인다.
  function markFloors(m, here) {
    var on = floorsOf(m);
    Array.prototype.forEach.call(document.querySelectorAll("[data-map-floor]"), function (btn) {
      var id = btn.getAttribute("data-map-floor");
      // v3 — 층은 미션과 상관없이 옮겨 볼 수 있다(10/21 디자이너). 미션이 지나지 않는 층도 끄지 않는다.
      var out = !document.body.classList.contains("ver-3") && on.length > 0 && on.indexOf(id) < 0;
      btn.disabled = out;
      btn.classList.toggle("is-out", out);
      btn.title = out ? "이 미션이 지나지 않는 층" : "";
      btn.classList.toggle("has-robot", id === here);
    });
  }

  function pressedCard() {
    return cards.filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })[0] || null;
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
    // 좌우 버튼은 넘길 로봇이 2대 이상일 때만(10/20 디자이너 — 지금은 미션 하나에 한 대, 다기종이면 여럿이 붙을 수 있다).
    Array.prototype.forEach.call(document.querySelectorAll(".rc-nav"), function (nav) { nav.hidden = shown.length < 2; });
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

    // 지도는 고른 로봇이 선 층으로 연다. 로봇 층을 모르면 미션의 첫 층.
    var card = pressedCard();
    var here = card && !card.hidden ? robotFloor(card) : null;
    var floor = here || floorsOf(m)[0] || null;
    if (askedFloor && floorsOf(m).indexOf(askedFloor) >= 0) { floor = askedFloor; }
    askedFloor = null;   // 처음 한 번만 — 뒤에 미션을 바꾸면 로봇 층을 따른다
    markFloors(m, here);
    if (floor) { window.APRISM_FLOOR_WANT = floor; }   // 지도가 아직 안 섰으면 map.js 가 이 층으로 연다
    var floorBtn = floor && document.querySelector("[data-map-floor='" + floor + "']");
    if (floorBtn && floorBtn.getAttribute("aria-pressed") !== "true") { floorBtn.click(); }

    buildMenu();
    // 왼쪽 메뉴 [안전진단]도 지금 미션으로 연다(10/30) — 그냥 열면 안전진단 첫 미션으로 풀린다. 미션이 없으면 미션 전체.
    Array.prototype.forEach.call(document.querySelectorAll(".gnb-item[href^='./safety-v5.html']"), function (a) {
      a.href = m ? "./safety-v5.html?mission=" + encodeURIComponent(m) : "./safety-v5.html#all";
    });
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

  // 로봇을 바꿔 고르면 로봇 표시를 옮긴다. 지도가 로봇을 따라 층을 옮기면(map.js aprism:robot-floor) 그 층으로.
  document.addEventListener("click", function (event) {
    var card = event.target.closest && event.target.closest(".robot-strip .robot-card[data-robot]");
    if (card) { window.setTimeout(function () { markFloors(current, robotFloor(pressedCard())); }, 0); }
  });
  document.addEventListener("aprism:robot-floor", function (event) {
    var f = event.detail && event.detail.floor;
    if (f) { markFloors(current, f); }
  });

  document.addEventListener("aprism:alert-levels", function (event) {
    levels = event.detail || {};
    buildMenu();
  });

  apply(current, false);
})();
