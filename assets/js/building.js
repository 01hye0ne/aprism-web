// 전체 층 현황 — v2.2 (screens/building-v2-2.html)
//
// 다른 디자이너의 "다중 로봇 종합 관제" 시안(2026-10-16)에서 기능을 가져와 v2.2 부품으로 옮겼다.
//   · 지도   전주기 맵 모델(map-model.js)의 층을 떼어 위아래로 쌓는다. 쌓인 판은 윤곽선만,
//            들어간 층은 메인 지도와 같은 색으로 채워진다.
//   · 손     층에 올리면 그 층이 밝아지고 요약이 뜬다. 누르면 그 층으로 들어간 뒤
//            메인 v2.2(미션 모니터링)가 그 층 미션으로 열린다(?mission=).
//   · 왼쪽   최신 알림 — 메인과 같은 부품이고 미션을 가리지 않는다. 줄을 누르면 그 미션으로 들어간다.
//   · 오른쪽 로봇 현황(층별) · 운행 흐름 · 다음 일정.
//
// 값은 메인 v2.2 와 같은 이야기다 — 로봇 12대(screen.js · 로봇 카드), 알림 6건(monitor.js).
// 서버가 없는 퍼블리싱이라 여기 들고 있다. 숫자는 임시 값이다.
(function () {
  "use strict";

  var body = document.body;
  if (!body.classList.contains("is-building")) { return; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text != null) { node.textContent = text; }
    return node;
  }
  function icon(name, size) {
    var node = el("span", "i i-" + (size || 16));
    node.style.setProperty("--i", "var(--ic-" + name + ")");
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  /* ==================================================================
   * 데이터
   * ================================================================== */

  // 위에서 아래 차례 — 화면에 쌓이는 차례와 같다.
  var FLOORS = ["B3", "B4"];
  var FNAME = { B3: "지하 3층", B4: "지하 4층" };

  // 미션은 메인 v2.2 의 로봇 데이터(screen.js)와 같다. 층은 미션 이름에서 나온다.
  // 10/19 — 미션은 층에 속하지 않는다. 미션마다 지나는 층을 차례대로 든다(메인 v2.2 screen.js 와 같다).
  var MISSION_FLOORS = {
    "정기 순회 점검": ["B3", "B4"],
    "야간 순회 점검": ["B4"],
    "발전기실 설비 점검": ["B3"],
    "공조 설비 순회": ["B3"],
    "유틸리티 순회": ["B4"],
    "전기실 열화상 점검": ["B3"]
  };
  var MISSION_LIST = Object.keys(MISSION_FLOORS);
  // 그 층을 지나는 미션
  function missionsOn(f) { return MISSION_LIST.filter(function (m) { return MISSION_FLOORS[m].indexOf(f) >= 0; }); }

  /*
   * 로봇 — 메인 v2.2 로봇 카드와 같은 값이다(번호 · 상태 배지 · 배터리 · 신호).
   * 미션이 없는 로봇은 층의 도크에 서 있다. 도크 층은 여기서 정했다(임시).
   *   st    배지 — run 수행중 · done 완료 · idle 대기 · off 끊김
   *   now   지금 하는 일(screen.js 의 current)
   *   uv    층 바닥 위 자리(0~1). building.js 가 열린 바닥으로 옮겨 앉힌다.
   */
  var ROBOTS = [
    { n: 1,  floor: "B4", st: "run",  mission: "정기 순회 점검",     now: "N₂ 배관 압력 점검",     done: 3,  total: 20, bat: 78, sig: 4, uv: [0.42, 0.40] },
    { n: 2,  floor: "B4", st: "done", mission: "정기 순회 점검",     now: "복귀 중",               done: 20, total: 20, bat: 18, chg: false, sig: 2, uv: [0.70, 0.66], moving: true },   // B3(WP-01~12) → 계단 → B4(WP-13~20) → B4 도크로 복귀 중
    { n: 3,  floor: "B4", st: "idle", mission: null,                          now: "대기 중",               bat: 35, chg: true, sig: 3, uv: [0.90, 0.92], dock: true },
    { n: 4,  floor: "B4", st: "done", mission: "야간 순회 점검",     now: "순회 완료",             done: 20, total: 20, bat: 92, sig: 4, uv: [0.76, 0.92], dock: true },
    { n: 5,  floor: "B3", st: "run",  mission: "발전기실 설비 점검", now: "발전기 베어링 진동 측정", done: 1, total: 20, bat: 64, sig: 3, uv: [0.50, 0.30] },
    { n: 6,  floor: "B4", st: "idle", mission: null,                          now: "충전 중",               bat: 8,  chg: true, sig: 2, uv: [0.90, 0.80], dock: true },
    { n: 7,  floor: "B3", st: "done", mission: "공조 설비 순회",     now: "순회 완료",             done: 20, total: 20, bat: 96, chg: true, sig: 4, uv: [0.10, 0.92], dock: true },
    { n: 8,  floor: "B3", st: "idle", mission: null,                          now: "대기 중",               bat: 47, sig: 3, uv: [0.24, 0.92], dock: true },
    { n: 9,  floor: "B4", st: "done", mission: "유틸리티 순회",      now: "순회 완료",             done: 20, total: 20, bat: 88, sig: 4, uv: [0.76, 0.80], dock: true },
    { n: 10, floor: "B3", st: "off",  mission: null,                          now: "통신 끊김",             bat: 29, sig: 0, uv: [0.30, 0.62] },
    { n: 11, floor: "B3", st: "run",  mission: "전기실 열화상 점검", now: "배전반실 열화상 점검",  done: 3,  total: 20, bat: 71, sig: 4, uv: [0.66, 0.58] },
    { n: 12, floor: "B3", st: "idle", mission: null,                          now: "충전 중",               bat: 55, chg: true, sig: 3, uv: [0.10, 0.80], dock: true }
  ];
  var BADGE = {
    run:  { cls: "badge-info",   text: "수행중" },
    done: { cls: "badge-normal", text: "완료" },
    idle: { cls: "badge-idle",   text: "대기" },
    off:  { cls: "badge-danger", text: "끊김" }
  };
  function rname(r) { return "Robot " + (r.n < 10 ? "0" : "") + r.n; }

  /*
   * 알림 — 메인 v2.2(monitor.js)의 위험 1 · 주의 5 와 같다. robot 은 위 ROBOTS 의 번호다.
   * 그 로봇의 미션 · 층으로 묶인다. uv 는 층 위 표식 자리(임시).
   */
  var ALERTS = [
    { sev: "critical", robot: 1, floor: "B4", where: "터빈 2 / Unit 03 · WP-04 N₂ 배관 압력계", time: "10:12:40", title: "지하발전소 터빈 2 NG 1건 발견", uv: [0.38, 0.34] },
    { sev: "warning",  robot: 1, floor: "B4", where: "APRO 4F · WP-03 냉각수 배관 밸브",       time: "10:11:19", title: "누출감지 · 냉각수 배관 밸브", uv: [0.30, 0.52] },
    { sev: "warning",  robot: 2, floor: "B3", where: "Robot 02 · WP-06 수배전반",              time: "10:09:42", title: "부분방전 · 이상 점수 9.41", uv: [0.62, 0.22] },
    { sev: "warning",  robot: 2, floor: "B3", where: "Robot 02 · WP-12 냉각 펌프 P-2",         time: "10:06:05", title: "진동 상승 · 냉각 펌프 P-2", uv: [0.64, 0.46] },
    { sev: "warning",  robot: 5, floor: "B3", where: "Robot 05 · WP-02 발전기 베어링",         time: "10:03:27", title: "과열 · 발전기 베어링 68.4℃", uv: [0.56, 0.24] },
    { sev: "warning",  robot: 2, floor: "B4", where: "Robot 02 · WP-20 공기 압축기 C-1",       time: "10:01:12", title: "압력 편차 · 공기 압축기 C-1", uv: [0.50, 0.74] }
  ];
  ALERTS.forEach(function (a) {
    // 층은 알림이 난 웨이포인트의 층이다(로봇이 지금 선 층이 아니다 — 메인 v2.2 monitor.js 와 같다).
    a.mission = robotNo(a.robot).mission;
  });

  var DONE = [
    { time: "10:29:10", title: "온도감지 · WP-03 펌프 하우징", how: "추이 관찰 · 다음 순회 재측정", who: "김현대" },
    { time: "10:18:52", title: "소음 이상 · 변압기 TR-1", how: "현장 점검 요청 · 이상 없음", who: "김현대" },
    { time: "10:02:31", title: "진동감지 · WP-02 터빈1 베어링", how: "추이 관찰 · 다음 순회 재측정", who: "홍길동" },
    { time: "09:47:15", title: "온도감지 · WP-03 펌프 하우징", how: "현장 점검 요청 · 이상 없음", who: "홍길동" },
    { time: "09:30:08", title: "누유 흔적 · 유압 유닛 HU-2", how: "청소 후 재측정 · 정상", who: "김현대" }
  ];

  /*
   * 운행 흐름 — 06:00 ~ 14:00(분). 미션이 있는 로봇만 줄을 갖는다.
   * 지난 칸은 screen.js 의 웨이포인트 시각에서, 앞으로의 칸(plan)은 남은 칸 수로 어림했다.
   *   run 순회 · move 이동 · 복귀 · chg 충전
   */
  var T0 = 6 * 60, T1 = 14 * 60, NOW = 10 * 60 + 11;
  function hm(t) { var p = t.split(":"); return (+p[0]) * 60 + (+p[1]); }
  var GANTT = [
    { n: 1,  bars: [["09:12", "10:11", "run"], ["10:11", "14:00", "run", 1]] },
    { n: 2,  bars: [["08:40", "10:11", "run"], ["10:11", "10:25", "move", 1], ["10:25", "12:30", "chg", 1]] },
    { n: 4,  bars: [["07:20", "09:06", "run"], ["09:06", "09:20", "move"], ["09:20", "10:11", "chg"], ["10:11", "10:40", "chg", 1]] },
    { n: 5,  bars: [["10:02", "10:11", "run"], ["10:11", "13:40", "run", 1]] },
    { n: 7,  bars: [["06:05", "07:16", "run"], ["07:16", "07:30", "move"], ["07:30", "10:11", "chg"], ["11:30", "12:50", "run", 1]] },
    { n: 9,  bars: [["06:00", "06:41", "run"], ["06:41", "06:55", "move"], ["06:55", "08:30", "chg"]] },
    { n: 11, bars: [["09:40", "10:11", "run"], ["10:11", "12:10", "run", 1]] }
  ];

  var SCHED = [
    { time: "10:25", text: "Robot 02 · 도크 도착 후 충전", floor: "B4" },
    { time: "11:30", text: "Robot 07 · 공조 설비 순회 2회차 시작", floor: "B3" },
    { time: "12:10", text: "Robot 11 · 전기실 열화상 점검 끝", floor: "B3" }
  ];

  function robotNo(n) { return ROBOTS.filter(function (r) { return r.n === n; })[0]; }
  function robotsOn(f) { return ROBOTS.filter(function (r) { return r.floor === f; }); }
  function alertsOn(f) { return ALERTS.filter(function (a) { return a.floor === f; }); }
  function alertsOf(m) { return ALERTS.filter(function (a) { return a.mission === m; }); }
  function topSev(list) {
    if (list.some(function (a) { return a.sev === "critical"; })) { return "critical"; }
    return list.length ? "warning" : null;
  }
  function sevCount(list) {
    var c = list.filter(function (a) { return a.sev === "critical"; }).length;
    var w = list.length - c;
    var out = [];
    if (c) { out.push("위험 " + c); }
    if (w) { out.push("주의 " + w); }
    return out.join(" · ");
  }
  // 미션으로 들어갈 때 열 층 — 그 미션 로봇이 선 층(수행중 먼저), 없으면 미션의 첫 층. 메인도 같은 층으로 연다.
  function floorFor(m) {
    var mine = ROBOTS.filter(function (r) { return r.mission === m; })
      .sort(function (a, b) { return (a.st === "run" ? 0 : 1) - (b.st === "run" ? 0 : 1); });
    return mine.length ? mine[0].floor : MISSION_FLOORS[m][0];
  }
  // 층에 들어갈 때 열 미션 — 알림이 가장 높은 미션, 없으면 수행 중인 미션, 그것도 없으면 첫 미션.
  function missionFor(f) {
    var list = missionsOn(f);
    var best = null, rank = -1;
    list.forEach(function (m) {
      var s = topSev(alertsOf(m));
      var k = s === "critical" ? 3 : s === "warning" ? 2 :
        ROBOTS.some(function (r) { return r.mission === m && r.st === "run"; }) ? 1 : 0;
      if (k > rank) { rank = k; best = m; }
    });
    return best;
  }

  /* ==================================================================
   * 메인 v2.2 로 넘어가기 — 테마 · 팔레트 같은 보기 설정은 들고 간다.
   * ================================================================== */
  function mainUrl(mission) {
    var keep = (location.search.match(/[?&](theme|palette|delta|glow)=[\w-]+/g) || [])
      .map(function (s) { return s.slice(1); });
    keep.push("mission=" + encodeURIComponent(mission));
    return "main-v2-2.html?" + keep.join("&");
  }

  /* ==================================================================
   * 상태바 — 전체 건물 › 층 · 미션 고르기
   * ================================================================== */
  var menuBox = $("[data-bld-menu-box]");
  var trigger = $("[data-bld-trigger]");
  var menu = $("[data-bld-menu]");

  function closeMenu() {
    if (!trigger) { return; }
    trigger.setAttribute("aria-expanded", "false");
    menu.hidden = true;
  }

  // 미션 메뉴 — 메인 v2.2 와 같이 상태별(수행중 · 대기 · 완료)로 묶고 지나는 층 꼬리표를 단다(10/19).
  function stateOf(m) {
    var mine = ROBOTS.filter(function (r) { return r.mission === m; });
    if (mine.some(function (r) { return r.st === "run"; })) { return "run"; }
    if (mine.length && mine.every(function (r) { return r.st === "done"; })) { return "done"; }
    return "idle";
  }

  function buildMenu() {
    menu.textContent = "";
    // 표 머리 — 수행 · 미션 · 층 · 로봇(메인 v2.2 mission-scope.js 와 같다, 10/19)
    var head = el("div", "scope-head t-caption");
    head.setAttribute("aria-hidden", "true");
    ["수행", "미션", "층", "로봇"].forEach(function (t) { head.appendChild(el("span", null, t)); });
    menu.appendChild(head);
    [["run", "수행중"], ["idle", "대기"], ["done", "완료"]].forEach(function (g) {
      MISSION_LIST.filter(function (m) { return stateOf(m) === g[0]; }).forEach(function (m) {
        var item = el("button", "menu-item scope-item is-" + g[0]);
        item.type = "button";
        item.setAttribute("role", "menuitem");
        // 수행 — 수행중 파란 점 · 대기 빈 고리 · 완료 빈칸
        var run = el("span", "scope-run");
        run.setAttribute("data-run", g[0]);
        run.title = g[1];
        item.appendChild(run);
        // 알림 단계는 이름 뒤 기호(ⓧ · △)
        var name = el("span", "scope-name");
        name.appendChild(el("span", "t-label-2", m));
        var s = topSev(alertsOf(m));
        if (s) {
          var sev = icon(s === "critical" ? "error" : "warning");
          sev.classList.add("scope-sev");
          sev.setAttribute("data-sev", s);
          sev.removeAttribute("aria-hidden");
          sev.title = s === "critical" ? "위험 알림 있음" : "주의 알림 있음";
          name.appendChild(sev);
        }
        item.appendChild(name);
        var fl = el("span", "scope-floors");
        MISSION_FLOORS[m].forEach(function (f) { fl.appendChild(el("span", "floor-tag num", f)); });
        item.appendChild(fl);
        item.appendChild(el("span", "scope-robots num", ROBOTS.filter(function (r) { return r.mission === m; })
          .map(function (r) { return (r.n < 10 ? "0" : "") + r.n; }).join(" · ")));
        item.addEventListener("click", function () { closeMenu(); enter(floorFor(m), m); });
        menu.appendChild(item);
      });
    });
  }

  if (trigger) {
    buildMenu();
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
  }

  /* ==================================================================
   * 왼쪽 — 최신 알림(전체 미션) · 오늘 확인 완료. 줄 모양은 monitor.js 와 같다.
   * ================================================================== */
  var RANK = { critical: 0, warning: 1 };
  var filter = "all";

  function alertRow(a) {
    var node = el("button", "ah-item is-" + a.sev);
    node.type = "button";
    node.setAttribute("role", "listitem");
    node.setAttribute("aria-pressed", "false");

    // 무슨 일(위험도 + 알림명 + 시각)이 첫 줄, 어디서(층 · 웨이포인트)가 둘째 줄 — 메인 v2.2 와 같다(10/19).
    var title = el("span", "ah-title t-label-2");
    title.appendChild(icon(a.sev === "critical" ? "error" : "warning"));
    title.appendChild(el("span", null, a.title));
    title.appendChild(el("span", "ah-time t-caption num", a.time));

    var where = el("span", "ah-where t-caption");
    where.appendChild(el("span", "floor-tag num", a.floor));   // 층 꼬리표는 웨이포인트 이름 앞(10/19)
    var wp = /WP-\d+.*$/.exec(a.where);   // 위치는 웨이포인트만(10/19, 메인 v2.2 와 같다)
    where.appendChild(el("span", "ah-wp", wp ? wp[0] : a.where));

    // 어느 층 · 미션의 알림인지 — 미션을 고르기 전 화면이라 이 줄이 하나 더 붙는다.
    // 미션 줄은 글자 칩 대신 회색 아이콘으로 표시한다 — 칩은 값(층) 자리라서(10/19).
    var scope = el("span", "ah-scope t-caption");
    scope.appendChild(icon("way"));
    scope.appendChild(el("span", null, a.mission));

    node.appendChild(title);
    node.appendChild(where);
    node.appendChild(scope);
    node.addEventListener("mouseenter", function () { setHot(a.floor, null, true); });
    node.addEventListener("mouseleave", function () { setHot(null); });
    node.addEventListener("click", function () { enter(a.floor, a.mission); });

    // [안전진단] — 메인 v2.2 목록과 같은 자리 · 모양(monitor.js). 화면은 아직 없다.
    var row = el("div", "ah-row");
    row.setAttribute("role", "listitem");
    node.removeAttribute("role");
    var go = el("button", "btn btn-ghost is-xs ah-report");
    go.type = "button";
    go.title = "안전진단 화면 준비 중";
    go.setAttribute("aria-label", "안전진단");
    go.appendChild(icon("shield"));
    go.appendChild(el("span", "ah-report-label", "안전진단"));
    row.appendChild(node);
    row.appendChild(go);
    return row;
  }

  function doneRow(d) {
    var node = el("div", "done-item");
    node.setAttribute("role", "listitem");
    var head = el("span", "done-title");
    head.appendChild(el("span", "t-label-2", d.title));
    head.appendChild(el("span", "t-caption num", d.time));
    var how = el("span", "done-how t-caption");
    how.appendChild(icon("check"));
    how.appendChild(el("span", null, d.how));
    how.appendChild(el("span", null, d.who));
    node.appendChild(head);
    node.appendChild(how);
    return node;
  }

  function renderLeft() {
    var list = $("[data-ah-list]");
    if (!list) { return; }
    var all = ALERTS.slice().sort(function (a, b) {
      return (RANK[a.sev] - RANK[b.sev]) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
    });
    var shown = all.filter(function (a) { return filter === "all" || a.sev === filter; });
    list.textContent = "";
    shown.forEach(function (a) { list.appendChild(alertRow(a)); });

    var counts = { all: all.length, critical: 0, warning: 0 };
    all.forEach(function (a) { counts[a.sev] += 1; });
    $$("[data-ah-count]").forEach(function (n) { n.textContent = counts[n.getAttribute("data-ah-count")]; });
    // 테두리 · Delta 판 단계 = 남은 알림 중 가장 높은 단계(메인 v2.2 monitor.js 와 같은 신호, 10/19)
    var top = counts.critical ? "critical" : counts.warning ? "warning" : null;
    document.dispatchEvent(new CustomEvent("aprism:severity", { detail: { level: top, glow: top } }));
    $$("[data-ah-filter]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-ah-filter") === filter ? "true" : "false");
    });

    var done = $("[data-done-list]");
    done.textContent = "";
    DONE.forEach(function (d) { done.appendChild(doneRow(d)); });
    var dc = $("[data-done-count]");
    if (dc) { dc.textContent = DONE.length + "건"; }
  }

  $$("[data-ah-filter]").forEach(function (b) {
    b.addEventListener("click", function () { filter = b.getAttribute("data-ah-filter"); renderLeft(); });
  });
  var allBtn = $("[data-ah-all]");
  if (allBtn) { allBtn.addEventListener("click", function () { location.href = "alert-center.html"; }); }

  /* ==================================================================
   * 오른쪽 — 로봇 현황 · 운행 흐름 · 다음 일정
   * ================================================================== */
  var fleetFloor = "all";

  /*
   * 로봇 줄 — Figma "Building / 로봇 현황" 의 로봇 줄(1260:15802, 10/19 디자이너 수정).
   *   위    층 꼬리표 · 이름 / 미션 · 지금 하는 일 / 진행 막대 · 지나온 수
   *   아래  상태 · 배터리 · 신호 세 칸(bg/map-chip) — 메인 로봇 카드의 Mission · Battery · Signal 과 같은 값이다.
   */
  var SIG = { 4: "Strong", 3: "Good", 2: "Weak", 1: "Weak", 0: "끊김" };

  function chip(cls) { return el("span", "bld-chip" + (cls ? " " + cls : "")); }

  function fleetRow(r) {
    var node = el("button", "bld-robot" + (r.st === "off" ? " is-offline" : ""));
    node.type = "button";
    node.setAttribute("role", "listitem");
    node.setAttribute("data-floor", r.floor);
    node.setAttribute("aria-label", rname(r) + " · " + FNAME[r.floor] + " · " + r.now);

    var body = el("span", "bld-robot-body");
    var top = el("span", "bld-robot-top");
    top.appendChild(el("span", "bld-floor-tag num", r.floor));
    top.appendChild(el("span", "bld-robot-name", rname(r)));
    body.appendChild(top);
    body.appendChild(el("span", "bld-robot-mission t-caption", r.mission ? r.mission + " · " + r.now : r.now));

    var prog = el("span", "bld-robot-prog");
    var bar = el("span", "bld-bar");
    var fill = el("i");
    fill.style.width = (r.total ? Math.round(r.done / r.total * 100) : 0) + "%";
    bar.appendChild(fill);
    prog.appendChild(bar);
    prog.appendChild(el("span", "num bld-robot-count", r.total ? r.done + "/" + r.total : "—"));
    body.appendChild(prog);

    var foot = el("span", "bld-robot-foot");
    // 상태
    var b = BADGE[r.st];
    var st = chip("badge " + b.cls);
    st.appendChild(el("span", "badge-dot"));
    st.appendChild(el("span", "t-caption", b.text));
    foot.appendChild(st);
    // 배터리
    var bc = chip();
    var bat = el("span", "battery" + (r.bat <= 20 ? " is-critical" : r.bat <= 40 ? " is-warning" : "") + (r.chg ? " is-charging" : ""));
    var bb = el("span", "battery-body");
    var bf = el("span", "battery-fill");
    bf.style.width = r.bat + "%";
    bb.appendChild(bf);
    if (r.chg) {
      var bolt = el("span", "i battery-bolt");
      bolt.style.setProperty("--i", "var(--ic-bolt)");
      bolt.setAttribute("aria-hidden", "true");
      bb.appendChild(bolt);
    }
    bat.appendChild(bb);
    bat.appendChild(el("span", "battery-tip"));
    bat.appendChild(el("span", "t-caption num", r.bat + "%"));
    bc.appendChild(bat);
    foot.appendChild(bc);
    // 신호 — 막대는 theme.js 가 SVG 로 다시 그린다(data-level)
    var sc = chip();
    var sig = el("span", "battery" + (r.sig <= 2 ? " is-warning" : ""));
    var bars = el("span", "signal-bars");
    bars.setAttribute("data-level", String(r.sig));
    for (var i = 0; i < 4; i += 1) { bars.appendChild(el("i")); }
    sig.appendChild(bars);
    sig.appendChild(el("span", "t-caption", SIG[r.sig]));
    sc.appendChild(sig);
    foot.appendChild(sc);

    node.appendChild(body);
    node.appendChild(foot);

    node.addEventListener("mouseenter", function () { setHot(r.floor, null, true); markRobot(r, true); });
    node.addEventListener("mouseleave", function () { setHot(null); markRobot(r, false); });
    node.addEventListener("click", function () { enter(r.floor, r.mission || missionFor(r.floor)); });
    return node;
  }

  function renderRight() {
    var running = ROBOTS.filter(function (r) { return r.st === "run"; }).length;
    var cnt = $("[data-bld-count]");
    if (cnt) { cnt.textContent = ROBOTS.length + "대 연결"; }
    var run = $("[data-bld-running]");
    if (run) { run.textContent = running + "대 수행중"; }

    var ff = $("[data-bld-fleet-filter]");
    ff.textContent = "";
    [["all", "전체", ROBOTS.length]].concat(FLOORS.map(function (f) { return [f, f, robotsOn(f).length]; }))
      .forEach(function (x) {
        // 고른 층은 흰 면(Button Primary · inverse), 나머지는 Secondary — Figma 10/19
        var b = el("button", "btn is-xs " + (fleetFloor === x[0] ? "btn-inverse" : "btn-secondary"));
        b.type = "button";
        b.setAttribute("aria-pressed", fleetFloor === x[0] ? "true" : "false");
        b.appendChild(document.createTextNode(x[1] + " "));
        b.appendChild(el("span", "num", String(x[2])));
        b.addEventListener("click", function () { fleetFloor = x[0]; renderRight(); });
        ff.appendChild(b);
      });

    var list = $("[data-bld-fleet]");
    list.textContent = "";
    // 수행중 → 끊김 → 완료 → 대기. 관제사가 먼저 볼 것이 위다.
    var ORDER = { run: 0, off: 1, done: 2, idle: 3 };
    ROBOTS.filter(function (r) { return fleetFloor === "all" || r.floor === fleetFloor; })
      .slice().sort(function (a, b) { return (ORDER[a.st] - ORDER[b.st]) || (a.n - b.n); })
      .forEach(function (r) { list.appendChild(fleetRow(r)); });

    // 운행 흐름
    var g = $("[data-bld-gantt]");
    g.textContent = "";
    var span = T1 - T0;
    var ticks = el("div", "bld-g-row is-ticks");
    ticks.appendChild(el("span"));
    var tt = el("span", "bld-g-ticks t-caption num");
    for (var t = T0; t <= T1; t += 120) {
      var s = el("span", null, (t / 60 < 10 ? "0" : "") + t / 60);
      s.style.left = ((t - T0) / span * 100) + "%";
      tt.appendChild(s);
    }
    ticks.appendChild(tt);
    g.appendChild(ticks);
    var rows = el("div", "bld-g-body");
    GANTT.forEach(function (row) {
      var r = robotNo(row.n);
      var line = el("button", "bld-g-row");
      line.type = "button";
      line.setAttribute("aria-label", rname(r) + " 운행 흐름 · " + FNAME[r.floor]);
      line.appendChild(el("span", "bld-g-name t-caption num", (r.n < 10 ? "0" : "") + r.n));
      var track = el("span", "bld-g-track");
      row.bars.forEach(function (bar) {
        var a = Math.max(T0, hm(bar[0])), z = Math.min(T1, hm(bar[1]));
        if (z <= a) { return; }
        var seg = el("i", "is-" + bar[2] + (bar[3] ? " is-plan" : ""));
        seg.style.left = ((a - T0) / span * 100) + "%";
        seg.style.width = ((z - a) / span * 100) + "%";
        track.appendChild(seg);
      });
      line.appendChild(track);
      line.addEventListener("mouseenter", function () { setHot(r.floor, null, true); markRobot(r, true); });
      line.addEventListener("mouseleave", function () { setHot(null); markRobot(r, false); });
      line.addEventListener("click", function () { enter(r.floor, r.mission); });
      rows.appendChild(line);
    });
    var now = el("span", "bld-g-now");
    now.style.setProperty("--x", ((NOW - T0) / span));
    now.appendChild(el("b", "t-caption num", "10:11"));
    rows.appendChild(now);
    g.appendChild(rows);

    var sc = $("[data-bld-sched]");
    sc.textContent = "";
    SCHED.forEach(function (s) {
      var li = el("li", "bld-sched-item");
      li.appendChild(el("span", "t-caption num bld-sched-time", s.time));
      li.appendChild(el("span", "t-label-2", s.text));
      sc.appendChild(li);
    });
  }

  /* ==================================================================
   * 지도 칸 — 층 버튼 · 건물 요약
   * ================================================================== */
  var floorsBox = $("[data-bld-floors]");
  FLOORS.forEach(function (f) {
    var b = el("button", "map-floor", f);
    b.type = "button";
    b.setAttribute("data-bld-floor", f);
    b.setAttribute("aria-pressed", "false");
    b.setAttribute("aria-label", FNAME[f] + "으로 들어가기");
    var s = topSev(alertsOn(f));
    if (s) { var dot = el("span", "bld-floor-dot"); dot.setAttribute("data-sev", s); b.appendChild(dot); }
    floorsBox.appendChild(b);
  });
  $$("[data-bld-floor]").forEach(function (b) {
    var f = b.getAttribute("data-bld-floor");
    b.classList.toggle("is-on", f === "all");
    b.addEventListener("click", function () { if (f !== "all") { enter(f, missionFor(f)); } });
    if (f !== "all") {
      b.addEventListener("mouseenter", function () { setHot(f, null, true); });
      b.addEventListener("mouseleave", function () { setHot(null); });
    }
  });

  function renderSum() {
    var rows = $("[data-bld-sum-rows]");
    $("[data-bld-sum-floors]").textContent = FLOORS.length;
    rows.textContent = "";
    var running = ROBOTS.filter(function (r) { return r.st === "run"; }).length;
    var r0 = el("div");
    r0.appendChild(el("dt", "t-caption", "로봇"));
    r0.appendChild(el("dd", "t-label-2", ROBOTS.length + "대 · " + running + "대 수행중"));
    rows.appendChild(r0);
    FLOORS.forEach(function (f) {
      var list = alertsOn(f);
      var d = el("div");
      d.appendChild(el("dt", "t-caption num", f));
      var dd = el("dd", "t-label-2 bld-sev");
      var s = topSev(list);
      if (s) { dd.setAttribute("data-sev", s); }
      dd.appendChild(el("span", "bld-sev-dot"));
      dd.appendChild(document.createTextNode(list.length ? sevCount(list) : "알림 없음"));
      d.appendChild(dd);
      rows.appendChild(d);
    });
  }

  renderLeft();
  renderRight();
  renderSum();

  /* ==================================================================
   * 3D — 층을 쌓는다
   * ================================================================== */
  var view = $(".map-view");
  var canvas = $("[data-bld-scene]");
  var hit = $("[data-bld-hit]");
  var panel = $(".map-panel");
  var labels = $("[data-bld-labels]");
  var tip = $("[data-bld-tip]");
  var loading = $("[data-bld-loading]");
  var hint = $("[data-bld-hint]");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var THREE, renderer, scene, camera;
  var ready = false;
  var F = {};            // 층마다 { holder, mats, lines, size, y, op, solid, hot, meshes, base }
  var mode = "all";      // all · one
  var cur = null;
  var hot = null;
  var busy = false;
  var tween = null;
  var cam = { target: null, zoom: 1, user: 1 };
  var unit = 1;          // 화면 1px 의 월드 길이(zoom 1)
  var GAP = 0.78;        // 층 사이 틈 — 층 높이의 배수가 아니라 긴 변(100)에 대한 비율이다

  function isLight() { return document.documentElement.getAttribute("data-theme") === "light"; }

  /*
   * 색 — 메인 지도(map.js)의 다크 · 라이트 팔레트와 같다. 쌓인 판(전체 보기)은 면을 바탕에 묻고
   * 외곽선만 남긴다. 층에 들어가면 면이 제 색으로 차오른다(solid 0 → 1).
   */
  var PAL = {
    dark: {
      ghost: 0x0e131c, ghostLift: 0, edge: 0x7b8fb4, edgeSolid: 0x7b8fb4, hotEdge: 0xd1d5de, hotFace: 0x1a2232,
      face: { floor: 0x18202e, wall: 0x3a475f, equipment: 0x41506a, stairs: 0x34405a, other: 0x36435a },
      lift: { floor: 0, wall: 0.55, equipment: 0.4, stairs: 0.45, other: 0.4 }
    },
    light: {
      ghost: 0xf4f5f7, ghostLift: 0.7, edge: 0x5d6773, edgeSolid: 0x5d6773, hotEdge: 0x2b2f36, hotFace: 0xe4e7ec,
      face: { floor: 0xeceef1, wall: 0xb4bcc9, equipment: 0x9aa5b6, stairs: 0xc3cad5, other: 0xb0b8c6 },
      lift: { floor: 0, wall: 0.08, equipment: 0.06, stairs: 0.07, other: 0.06 }
    }
  };
  var KINDS = ["floor", "wall", "equipment", "stairs", "other"];

  function kindOf(node) {
    var n = node;
    while (n) {
      var s = String(n.name || "").toLowerCase().replace(/^[0-9]+[_\-\s]*/, "").split(/[\s\-–_]/)[0];
      if (KINDS.indexOf(s) >= 0) { return s; }
      n = n.parent;
    }
    return "other";
  }
  function floorIdOf(name) {
    var m = String(name || "").match(/지하[\s_]*([0-9]+)[\s_]*층/);
    return m ? "B" + m[1] : "";
  }

  function b64ToBuffer(b64) {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) { out[i] = bin.charCodeAt(i); }
    return out.buffer;
  }

  function start(mods) {
    THREE = mods[0];
    var GLTFLoader = mods[1].GLTFLoader;
    var merge = mods[2].mergeGeometries;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -4000, 4000);
    scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x0b0e16, 1.5));
    var sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(60, 120, 30);
    scene.add(sun);
    cam.target = new THREE.Vector3();

    new GLTFLoader().parse(b64ToBuffer(window.APRISM_MAP_GLB), "", function (gltf) {
      build(gltf.scene, merge);
    }, function (err) {
      loading.textContent = "3D 맵 파일을 불러오지 못했어요";
      if (window.console) { console.error(err); }
    });
  }

  function build(root, merge) {
    root.updateMatrixWorld(true);
    var tops = root.children.filter(function (c) { return floorIdOf(c.name); });

    // 두 층은 원본에서 계단이 맞물리게 놓여 있다 — 가로 자리는 둘이 함께 쓰는 가운데로 옮긴다.
    var all = new THREE.Box3().setFromObject(root);
    var center = all.getCenter(new THREE.Vector3());
    var b4 = tops.filter(function (c) { return floorIdOf(c.name) === "B4"; })[0] || tops[0];
    var b4size = new THREE.Box3().setFromObject(b4).getSize(new THREE.Vector3());
    var S = 100 / Math.max(b4size.x, b4size.z);

    tops.forEach(function (top) {
      var f = floorIdOf(top.name);
      if (FLOORS.indexOf(f) < 0) { return; }
      var box = new THREE.Box3().setFromObject(top);
      var place = new THREE.Matrix4().makeScale(S, S, S)
        .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));

      var parts = {}, edges = {};
      KINDS.forEach(function (k) { parts[k] = []; edges[k] = []; });
      top.traverse(function (node) {
        if (!node.isMesh || !node.geometry) { return; }
        var g = node.geometry.index ? node.geometry.toNonIndexed() : node.geometry.clone();
        Object.keys(g.attributes).forEach(function (a) { if (a !== "position" && a !== "normal") { g.deleteAttribute(a); } });
        if (!g.attributes.normal) { g.computeVertexNormals(); }
        g.applyMatrix4(node.matrixWorld);
        g.applyMatrix4(place);
        var k = kindOf(node);
        parts[k].push(g);
        edges[k].push(new THREE.EdgesGeometry(g, 28));
      });

      var holder = new THREE.Group();
      var mats = {}, lines = [], meshes = [];
      KINDS.forEach(function (k) {
        if (!parts[k].length) { return; }
        var geo = parts[k].length > 1 ? merge(parts[k], false) : parts[k][0];
        var mat = new THREE.MeshLambertMaterial({
          color: 0x000000, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
        });
        var mesh = new THREE.Mesh(geo, mat);
        mesh.userData.floor = f;
        mesh.userData.kind = k;
        holder.add(mesh);
        meshes.push(mesh);
        mats[k] = mat;

        var eg = edges[k].length > 1 ? merge(edges[k], false) : edges[k][0];
        var lm = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
        var ls = new THREE.LineSegments(eg, lm);
        ls.raycast = function () {};
        ls.userData.kind = k;
        holder.add(ls);
        lines.push(ls);
      });

      var size = new THREE.Box3().setFromObject(holder).getSize(new THREE.Vector3());
      var bounds = new THREE.Box3().setFromObject(holder);
      scene.add(holder);
      F[f] = { holder: holder, mats: mats, lines: lines, meshes: meshes, size: size, bounds: bounds,
               y: 0, op: 1, solid: 0, hot: 0 };
    });

    // 로봇 · 알림 자리를 열린 바닥으로 옮긴다(벽 · 설비 안에 박히지 않게).
    seat();
    layout(true);
    ready = true;
    loading.remove();
    buildLabels();
    resize();
    requestAnimationFrame(frame);
  }

  // 층 바닥 위 (u, v) — u 는 짧은 변, v 는 긴 변.
  function surf(f, uv, lift) {
    var s = F[f], b = s.bounds;
    var longZ = s.size.z >= s.size.x;
    var x0 = b.min.x, x1 = b.max.x, z0 = b.min.z, z1 = b.max.z;
    var x = longZ ? x0 + uv[0] * (x1 - x0) : x0 + uv[1] * (x1 - x0);
    var z = longZ ? z0 + uv[1] * (z1 - z0) : z0 + uv[0] * (z1 - z0);
    return new THREE.Vector3(x, s.y + (lift || 0), z);
  }

  // 위에서 내려 쏴서 처음 맞는 것이 바닥이면 그 자리, 아니면 둘레를 넓혀 가며 찾는다.
  function seat() {
    var ray = new THREE.Raycaster();
    var down = new THREE.Vector3(0, -1, 0);
    function openAt(f, uv) {
      var p = surf(f, uv, 500);
      ray.set(p, down);
      var hitList = ray.intersectObjects(F[f].meshes, false);
      return hitList.length && hitList[0].object.userData.kind === "floor";
    }
    function fix(f, uv) {
      if (openAt(f, uv)) { return uv; }
      for (var r = 0.02; r < 0.3; r += 0.02) {
        for (var a = 0; a < Math.PI * 2; a += Math.PI / 8) {
          var t = [uv[0] + Math.cos(a) * r, uv[1] + Math.sin(a) * r];
          if (t[0] < 0.02 || t[0] > 0.98 || t[1] < 0.02 || t[1] > 0.98) { continue; }
          if (openAt(f, t)) { return t; }
        }
      }
      return uv;
    }
    ROBOTS.forEach(function (r) { if (F[r.floor]) { r.uv = fix(r.floor, r.uv); } });
    ALERTS.forEach(function (a) { if (F[a.floor]) { a.uv = fix(a.floor, a.uv); } });
  }

  /* ---------- 배치 · 전환 ---------- */
  function stackY(f) {
    var i = FLOORS.indexOf(f);
    var h = F.B4 ? F.B4.size.y : 10;
    return (FLOORS.length - 1 - i) * (h + GAP * 100);
  }

  function layout(instant) {
    var targets = {};
    if (mode === "all") {
      FLOORS.forEach(function (f) { targets[f] = { y: stackY(f), op: 1, solid: 0 }; });
      var top = stackY(FLOORS[0]) + F[FLOORS[0]].size.y;
      animate(targets, new THREE.Vector3(0, top / 2, 0), 1, instant);
    } else {
      FLOORS.forEach(function (f) {
        var on = f === cur;
        var above = FLOORS.indexOf(f) < FLOORS.indexOf(cur);
        targets[f] = { y: on ? stackY(cur) : stackY(cur) + (above ? 80 : -80), op: on ? 1 : 0, solid: on ? 1 : 0 };
      });
      animate(targets, new THREE.Vector3(0, stackY(cur) + F[cur].size.y * 0.3, 0), 1.5, instant);
    }
  }

  function animate(targets, t, z, instant) {
    var from = {};
    FLOORS.forEach(function (f) { from[f] = { y: F[f].y, op: F[f].op, solid: F[f].solid }; });
    tween = {
      t0: performance.now(), dur: (instant || reduce) ? 0 : 700, from: from, to: targets,
      ct0: cam.target.clone(), ct1: t, cz0: cam.zoom, cz1: z
    };
  }

  function ease(t) { return 1 - Math.pow(1 - t, 3); }

  var DIR = null;
  var tmpA = null, tmpB = null;

  function step(now) {
    var pal = PAL[isLight() ? "light" : "dark"];
    if (tween) {
      var k = tween.dur ? Math.min(1, (now - tween.t0) / tween.dur) : 1;
      var e = ease(k);
      FLOORS.forEach(function (f) {
        var a = tween.from[f], b = tween.to[f], s = F[f];
        s.y = a.y + (b.y - a.y) * e;
        s.op = a.op + (b.op - a.op) * e;
        s.solid = a.solid + (b.solid - a.solid) * e;
      });
      cam.target.lerpVectors(tween.ct0, tween.ct1, e);
      cam.zoom = tween.cz0 + (tween.cz1 - tween.cz0) * e;
      if (k >= 1) { tween = null; }
    }
    var ghost = tmpA.setHex(pal.ghost);
    FLOORS.forEach(function (f) {
      var s = F[f];
      s.hot += (((hot === f && mode === "all") ? 1 : 0) - s.hot) * 0.2;
      s.holder.position.y = s.y;
      s.holder.visible = s.op > 0.01;
      var dim = (hot && mode === "all" && hot !== f) ? 0.4 : 1;
      KINDS.forEach(function (key) {
        var m = s.mats[key];
        if (!m) { return; }
        m.color.copy(ghost).lerp(tmpB.setHex(pal.hotFace), s.hot * (1 - s.solid))
          .lerp(tmpB.setHex(pal.face[key]), s.solid);
        m.emissive = m.emissive || new THREE.Color();
        // 쌓인 판은 면을 바탕에 묻는다 — 라이트는 반구광이 옆면을 회색으로 눌러 판이 무거워져서 스스로 밝힌다.
        m.emissive.setHex(pal.face[key]).multiplyScalar(pal.lift[key] * s.solid)
          .add(tmpB.setHex(pal.ghost).multiplyScalar(pal.ghostLift * (1 - s.solid)));
        m.opacity = s.op;
        m.transparent = s.op < 0.999;
        m.depthWrite = s.op > 0.5;
      });
      s.lines.forEach(function (ls) {
        var base = ls.userData.kind === "floor" ? 0.35 : 0.8;
        ls.material.color.setHex(pal.edge).lerp(tmpB.setHex(pal.hotEdge), s.hot);
        ls.material.opacity = (base - (base - 0.4) * s.solid) * s.op * dim;
      });
    });
    camera.zoom = cam.zoom * cam.user;
    camera.position.copy(cam.target).addScaledVector(DIR, 1500);
    camera.lookAt(cam.target);
    camera.updateProjectionMatrix();
  }

  function frame(now) {
    step(now || performance.now());
    renderer.render(scene, camera);
    placeLabels();
    requestAnimationFrame(frame);
  }

  /*
   * 창은 두 칸(지도 + 우측 패널) 전체를 덮는다. 건물은 지도 칸 가운데에 와야 한다 —
   * 투영 창을 비대칭으로 잘라 지도 칸 가운데를 카메라 중심으로 둔다.
   */
  function resize() {
    if (!renderer) { return; }
    var vw = view.clientWidth, vh = view.clientHeight;
    renderer.setSize(vw, vh, false);
    if (!ready) { return; }
    var vr = view.getBoundingClientRect(), pr = panel.getBoundingClientRect();
    var cx = pr.left - vr.left + pr.width / 2;
    var cy = pr.top - vr.top + pr.height / 2;

    // 쌓인 건물 전체가 지도 칸에 들어오는 배율
    camera.position.set(0, 0, 0).addScaledVector(DIR, 1500);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    var inv = camera.matrixWorldInverse;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    FLOORS.forEach(function (f) {
      var b = F[f].bounds, y0 = stackY(f);
      [b.min.x, b.max.x].forEach(function (x) {
        [y0, y0 + F[f].size.y].forEach(function (y) {
          [b.min.z, b.max.z].forEach(function (z) {
            var p = new THREE.Vector3(x, y, z).applyMatrix4(inv);
            minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
            minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
          });
        });
      });
    });
    // 왼쪽 위는 Delta 가, 오른쪽은 도구 레일이 쓴다 — 여백을 둔다.
    var room = { w: pr.width - 200, h: pr.height - 120 };
    unit = Math.max((maxX - minX) / room.w, (maxY - minY) / room.h);
    camera.left = -cx * unit;
    camera.right = (vw - cx) * unit;
    camera.top = cy * unit;
    camera.bottom = -(vh - cy) * unit;
    camera.updateProjectionMatrix();
  }

  /* ---------- 지도 위 표식 ---------- */
  var L = {};
  function buildLabels() {
    labels.textContent = "";
    FLOORS.forEach(function (f) {
      var list = alertsOn(f);
      var tag = el("button", "bld-ftag");
      tag.type = "button";
      tag.setAttribute("data-floor", f);
      tag.setAttribute("aria-label", FNAME[f] + "으로 들어가기");
      tag.appendChild(el("span", "bld-ftag-line"));
      var txt = el("span", "bld-ftag-txt");
      var name = el("span", "bld-ftag-name");
      name.appendChild(el("b", "num", f));
      name.appendChild(el("span", "t-label-2", FNAME[f]));
      txt.appendChild(name);
      var sub = el("span", "t-caption bld-ftag-sub");
      sub.appendChild(document.createTextNode("로봇 " + robotsOn(f).length + "대"));
      if (list.length) {
        var sev = el("span", "bld-sev");
        sev.setAttribute("data-sev", topSev(list));
        sev.appendChild(el("span", "bld-sev-dot"));
        sev.appendChild(document.createTextNode(sevCount(list)));
        sub.appendChild(sev);
      }
      txt.appendChild(sub);
      tag.appendChild(txt);
      tag.addEventListener("mouseenter", function () { setHot(f, null, true); });
      tag.addEventListener("mouseleave", function () { setHot(null); });
      tag.addEventListener("click", function () { enter(f, missionFor(f)); });
      labels.appendChild(tag);
      L["tag" + f] = tag;
    });

    ALERTS.forEach(function (a, i) {
      var m = el("span", "bld-alert is-" + a.sev);
      m.setAttribute("aria-hidden", "true");
      m.appendChild(icon(a.sev === "critical" ? "error" : "warning"));
      labels.appendChild(m);
      a.node = m;
    });

    ROBOTS.forEach(function (r) {
      var b = el("span", "bld-bot is-" + r.st);
      b.setAttribute("aria-hidden", "true");
      b.appendChild(el("i"));
      b.appendChild(el("span", "bld-bot-name num", (r.n < 10 ? "0" : "") + r.n));
      labels.appendChild(b);
      r.node = b;
    });
  }

  function markRobot(r, on) { if (r.node) { r.node.classList.toggle("is-marked", on); } }

  var proj = null;
  function toScreen(p) {
    proj.copy(p).project(camera);
    return [(proj.x + 1) / 2 * view.clientWidth, (1 - proj.y) / 2 * view.clientHeight];
  }
  function snap(v) { var d = window.devicePixelRatio || 1; return Math.round(v * d) / d; }
  function put(node, p, op) {
    var xy = toScreen(p);
    node.style.transform = "translate(" + snap(xy[0]) + "px," + snap(xy[1]) + "px)";
    node.style.opacity = op;
    node.style.pointerEvents = op > 0.5 ? "" : "none";
  }

  function placeLabels() {
    if (!ready) { return; }
    // 표식 층은 지도 칸 안에 있다 — 창(.map-view) 기준 좌표에서 칸의 자리만큼 뺀다.
    var vr = view.getBoundingClientRect(), hr = hit.getBoundingClientRect();
    labels.style.left = (vr.left - hr.left) + "px";
    labels.style.top = (vr.top - hr.top) + "px";
    FLOORS.forEach(function (f) {
      var s = F[f], b = s.bounds;
      var corner = new THREE.Vector3(b.max.x, s.y + s.size.y * 0.5, b.min.z);
      put(L["tag" + f], corner, mode === "all" ? s.op : 0);
      L["tag" + f].classList.toggle("is-hot", hot === f);
    });
    ALERTS.forEach(function (a) {
      put(a.node, surf(a.floor, a.uv, F[a.floor].size.y + 1), F[a.floor].op);
    });
    ROBOTS.forEach(function (r) {
      if (r.moving && !reduce) { r.uv[1] = Math.min(0.86, r.uv[1] + 0.00003); }
      put(r.node, surf(r.floor, r.uv, F[r.floor].size.y * 0.15 + 1), F[r.floor].op);
    });
  }

  /* ---------- 손 ---------- */
  var ray = null, ndc = null;
  function pickFloor(event) {
    if (!ready) { return null; }
    var vr = view.getBoundingClientRect();
    ndc.set((event.clientX - vr.left) / vr.width * 2 - 1, -((event.clientY - vr.top) / vr.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    var objs = [];
    FLOORS.forEach(function (f) { if (F[f].op > 0.5) { objs = objs.concat(F[f].meshes); } });
    var h = ray.intersectObjects(objs, false)[0];
    return h ? h.object.userData.floor : null;
  }

  function showTip(f, event) {
    var list = alertsOn(f), bots = robotsOn(f);
    var run = bots.filter(function (r) { return r.st === "run"; }).length;
    tip.textContent = "";
    var head = el("p", "bld-tip-head");
    head.appendChild(el("b", "num", f));
    head.appendChild(el("span", "t-label-1", FNAME[f]));
    tip.appendChild(head);
    var rows = el("dl", "bld-tip-rows");
    function row(k, v, sev) {
      var d = el("div");
      d.appendChild(el("dt", "t-caption", k));
      var dd = el("dd", "t-label-2" + (sev !== undefined ? " bld-sev" : ""));
      if (sev) { dd.setAttribute("data-sev", sev); }
      if (sev !== undefined) { dd.appendChild(el("span", "bld-sev-dot")); }
      dd.appendChild(document.createTextNode(v));
      d.appendChild(dd);
      rows.appendChild(d);
    }
    row("로봇", bots.length + "대 · " + run + "대 수행중");
    row("미션", missionsOn(f).length + "건 지남");
    row("알림", list.length ? sevCount(list) : "없음", topSev(list));
    tip.appendChild(rows);
    var go = el("p", "t-caption bld-tip-go");
    go.appendChild(el("span", null, "누르면 들어가요"));
    go.appendChild(el("b", "t-label-2", missionFor(f)));
    tip.appendChild(go);
    tip.hidden = false;
    var hr = hit.getBoundingClientRect();
    var x = event.clientX - hr.left + 16, y = event.clientY - hr.top + 16;
    x = Math.min(x, hr.width - tip.offsetWidth - 8);
    y = Math.min(y, hr.height - tip.offsetHeight - 8);
    tip.style.transform = "translate(" + Math.round(x) + "px," + Math.round(y) + "px)";
  }

  // fromList — 목록 · 버튼에서 얹은 손. 지도 위 요약은 띄우지 않고 층만 밝힌다.
  function setHot(f, event, fromList) {
    if (mode !== "all" || busy) { return; }
    hot = f;
    hit.classList.toggle("is-pick", !!f && !fromList);
    $$("[data-bld-floor]").forEach(function (b) { b.classList.toggle("is-hover", b.getAttribute("data-bld-floor") === f); });
    if (f && event) { showTip(f, event); } else { tip.hidden = true; }
  }

  var drag = null;
  hit.addEventListener("pointermove", function (event) {
    if (mode !== "all" || busy || drag) { return; }
    var over = event.target.closest && event.target.closest(".bld-ftag, .map-tools, .bld-sum, .delta3");
    if (over) { if (!over.classList.contains("bld-ftag")) { setHot(null); } return; }
    setHot(pickFloor(event), event);
  });
  hit.addEventListener("pointerleave", function () { setHot(null); });
  hit.addEventListener("click", function (event) {
    if (mode !== "all" || (event.target.closest && event.target.closest("button"))) { return; }
    var f = pickFloor(event);
    if (f) { enter(f, missionFor(f)); }
  });

  // 확대 · 축소 — 휠과 버튼. 판 가운데를 기준으로 한다.
  function zoomBy(k) {
    cam.user = Math.max(0.6, Math.min(3, cam.user * k));
  }
  hit.addEventListener("wheel", function (event) {
    if (mode !== "all") { return; }
    event.preventDefault();
    zoomBy(Math.pow(1.0015, -event.deltaY));
  }, { passive: false });
  $$("[data-bld-zoom]").forEach(function (b) {
    b.addEventListener("click", function () { zoomBy(b.getAttribute("data-bld-zoom") === "in" ? 1.25 : 0.8); });
  });
  var home = $("[data-bld-home]");
  if (home) { home.addEventListener("click", function () { cam.user = 1; }); }

  /*
   * 들어가기 — 다른 층은 위아래로 비켜 사라지고, 고른 층이 제 색으로 차며 다가온다.
   * 다 오면 메인 v2.2 가 그 미션으로 열린다. 상태바도 그 사이 "전체 건물 › 지하 N층" 으로 바뀐다.
   */
  function enter(f, mission) {
    if (busy) { return; }
    closeMenu();
    if (!ready) { location.href = mainUrl(mission); return; }
    setHot(null);
    busy = true;
    mode = "one";
    cur = f;
    cam.user = 1;
    layout(false);
    tip.hidden = true;
    body.classList.add("is-entering");
    // 넘어가는 동안 상태바를 메인 v2.2 모양(전체 건물 › [미션 칩])으로 바꿔 둔다 — 10/19 디자이너.
    // 예전엔 이름 줄에 미션을 붙이고 칩은 "통합 순회 현황" 그대로라 두 미션이 함께 보였다.
    if (trigger) { trigger.querySelector(".t-title-2").textContent = mission; }
    $$("[data-bld-floor]").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-bld-floor") === f); });
    setTimeout(function () { location.href = mainUrl(mission); }, reduce ? 0 : 760);
  }

  // 뒤로 가기로 돌아왔을 때(bfcache) 쌓인 판으로 되돌린다.
  window.addEventListener("pageshow", function (event) {
    if (!event.persisted || !ready) { return; }
    busy = false;
    mode = "all";
    cur = null;
    body.classList.remove("is-entering");
    if (trigger) { trigger.querySelector(".t-title-2").textContent = "통합 순회 현황"; }
    $$("[data-bld-floor]").forEach(function (b) { b.classList.toggle("is-on", b.getAttribute("data-bld-floor") === "all"); });
    layout(true);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") { setHot(null); }
  });

  // Delta 의 첫 버튼 — 위험 알림이 난 미션으로 들어간다.
  var goCrit = $("[data-bld-go-critical]");
  if (goCrit) {
    goCrit.addEventListener("click", function () {
      var a = ALERTS.filter(function (x) { return x.sev === "critical"; })[0];
      if (a) { enter(a.floor, a.mission); }
    });
  }

  if (typeof ResizeObserver !== "undefined") { new ResizeObserver(function () { resize(); }).observe(view); }
  window.addEventListener("resize", resize);

  if (!window.APRISM_MAP_GLB || !canvas) {
    if (loading) { loading.textContent = "3D 맵을 표시할 수 없어요"; }
    return;
  }
  Promise.all([
    import("three"),
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/utils/BufferGeometryUtils.js")
  ]).then(function (mods) {
    var T = mods[0];
    DIR = new T.Vector3(1, 0.95, 1).normalize();
    tmpA = new T.Color(); tmpB = new T.Color();
    proj = new T.Vector3();
    ray = new T.Raycaster(); ndc = new T.Vector2();
    start(mods);
  }).catch(function (err) {
    if (loading) { loading.textContent = "이 브라우저에서는 3D 맵을 표시할 수 없어요"; }
    if (window.console) { console.error(err); }
  });
})();
