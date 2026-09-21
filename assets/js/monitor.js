// 04.1 통합 관제 메인 · 모니터링 — Template ver.2 (Figma UI_00 826:8887)
// screens/dashboard-home.html (body.v2) 에서만 돈다.
//
// 셸의 동작(로봇 선택 · 타임라인 · 모달 · Drawer · AI 패널 · 지도)은 screen.js 와 map.js 가 그대로 한다.
// 여기서는 ver.2 에서 새로 생긴 것만 한다.
//
//   왼쪽 알림 히스토리 — 처리 필요 목록 · 거르기 · 고르기(→ AI 패널 문구) · 오늘 확인 완료
//   오른쪽 로봇 카드 — 한 대씩 넘겨 보기
//   알림 단계 body[data-level] — normal · warning · critical (알림 정책 UI_99 1016:1055 의 주의 · 위험)
//
// 값은 검토용으로 이 파일 안에 있다. 서버가 없는 퍼블리싱이다.
// 주소 끝에 #normal · #warning · #critical 을 붙이면 그 단계로 열린다. 없으면 Figma 와 같은 위험이다.

(function () {
  "use strict";

  var body = document.body;
  if (!body.classList.contains("v2")) { return; }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) { node.className = cls; }
    if (text != null) { node.textContent = text; }
    return node;
  }

  function icon(name) {
    var node = el("span", "i i-16");
    node.style.setProperty("--i", "var(--ic-" + name + ")");
    node.setAttribute("aria-hidden", "true");
    return node;
  }

  function clock(date) {
    var d = date || new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(function (n) { return (n < 10 ? "0" : "") + n; }).join(":");
  }

  // ==================================================================
  // 알림 데이터 — 최근 24시간.
  // 위험도는 알림 정책을 따른다 — 통신 불안정 · 누출 · 부분방전은 주의, NG 판정 · 비상정지는 위험.
  // ai 는 고르면 AI 패널(Delta)에 뜨는 두 줄이다.
  // ==================================================================
  var WARNINGS = [
    { sev: "warning", where: "APRO 4F · WP-04 냉각수 배관 이음부", time: "10:11:19",
      title: "누출감지 · 냉각수 배관 이음부",
      ai: { line1: "WP-04 냉각수 배관 이음부에서 누출 패턴이 감지되었습니다.",
        line2: "신뢰도 0.87 로 임계 0.70 을 넘었고 연속 2프레임에서 검출됐습니다. 현장 점검으로 누수 여부를 확인해 주세요." } },
    { sev: "warning", where: "APRO 4F · WP-06 수배전반", time: "10:09:42",
      title: "부분방전 · 이상 점수 9.41",
      ai: { line1: "WP-06 수배전반에서 부분방전 이상 점수가 올랐습니다.",
        line2: "이상 점수 9.41 로 임계 9.23 을 넘었습니다. PRPD 패턴이 코로나 방전 유형과 일치해 다음 순회에서 추이를 보겠습니다." } },
    { sev: "warning", where: "Robot 02 · 터빈 2 / Unit 03", time: "10:06:05",
      title: "통신 불안정 · 재접속 3회 실패",
      ai: { line1: "Robot 02 의 통신이 불안정합니다.",
        line2: "재접속을 3회 실패했고 신호가 −78 dBm 까지 떨어졌습니다. 로봇 위치를 확인하고 필요하면 자동복귀시켜 주세요." } }
  ];

  var CRITICAL = { sev: "critical", where: "APRO 4F · 터빈 2 / Unit 03", time: "10:12:40",
    title: "지하발전소 B3 터빈 2 NG 1건 발견",
    ai: { line1: "지하발전소 B3 터빈 2 에서 NG 1건이 발견되었습니다.",
      line2: "Spiral Casing Pr. 측정값 90 이 기준값 87 을 넘었습니다. 로봇을 멈추고 현장에 연락한 뒤 조치 내용을 입력해 주세요." } };

  var DONE = [
    { time: "10:29:10", title: "온도감지 · WP-03 펌프 하우징", how: "추이 관찰 · 다음 순회 재측정", who: "김현대" },
    { time: "10:18:52", title: "통신 불안정 · Robot 02", how: "재접속 확인 · 조치 불필요", who: "김현대" },
    { time: "10:02:31", title: "진동감지 · WP-02 터빈1 베어링", how: "추이 관찰 · 다음 순회 재측정", who: "홍길동" },
    { time: "09:47:15", title: "온도감지 · WP-03 펌프 하우징", how: "현장 점검 요청 · 이상 없음", who: "홍길동" },
    { time: "09:30:08", title: "배터리 부족 · Robot 06", how: "충전 도크 복귀 확인", who: "김현대" }
  ];

  // 알림이 없을 때 AI 패널 문구. 태그는 Figma 와 같은 "원인 분석 완료 · 후보 1건 확인" 을 주의 · 위험에 쓴다.
  var CALM = { line1: "안녕하세요. 홍길동 님",
    line2: "Robot 01 이 정기 순회를 진행하고 있어요. 지금은 특이사항이 없습니다.", tag: "정기 순회 진행 중" };
  var TAG = "원인 분석 완료 · 후보 1건 확인";

  var RANK = { critical: 0, warning: 1 };

  // ==================================================================
  // 알림 히스토리
  // ==================================================================
  var list = $("[data-ah-list]");
  var doneList = $("[data-done-list]");
  var doneCount = $("[data-done-count]");
  var filters = $$("[data-ah-filter]");
  if (!list) { return; }

  var level = "critical";
  var extra = [];          // E-STOP 처럼 화면에서 생긴 알림
  var filter = "all";
  var picked = null;       // 고른 알림(객체)

  function items() {
    var base = level === "normal" ? [] :
      level === "warning" ? WARNINGS.slice() : [CRITICAL].concat(WARNINGS);
    // "오래된 순 · 위험 우선 정렬" — 위험이 먼저, 같은 단계 안에서는 오래된 것이 위다.
    return extra.concat(base).sort(function (a, b) {
      return (RANK[a.sev] - RANK[b.sev]) || (a.time < b.time ? -1 : a.time > b.time ? 1 : 0);
    });
  }

  function highest(all) {
    if (all.some(function (a) { return a.sev === "critical"; })) { return "critical"; }
    return all.length ? "warning" : "normal";
  }

  function item(a) {
    var node = el("button", "ah-item is-" + a.sev);
    node.type = "button";
    node.setAttribute("role", "listitem");
    node.setAttribute("aria-pressed", a === picked ? "true" : "false");

    var where = el("span", "ah-where t-caption");
    where.appendChild(icon("target"));
    where.appendChild(el("span", null, a.where));
    where.appendChild(el("span", "num", a.time));

    var title = el("span", "ah-title t-label-1");
    title.appendChild(icon(a.sev === "critical" ? "error" : "warning"));
    title.appendChild(el("span", null, a.title));

    node.appendChild(where);
    node.appendChild(title);
    node.addEventListener("click", function () {
      picked = a;
      render();
    });
    return node;
  }

  function doneItem(d) {
    var node = el("div", "done-item");
    node.setAttribute("role", "listitem");
    if (d.fresh) { node.classList.add("is-new"); }

    var head = el("span", "done-title");
    head.appendChild(el("span", "t-label-1", d.title));
    head.appendChild(el("span", "t-caption num", d.time));

    var how = el("span", "done-how t-caption");
    how.appendChild(icon("check"));
    how.appendChild(el("span", null, d.how));
    how.appendChild(el("span", null, d.who));

    node.appendChild(head);
    node.appendChild(how);
    return node;
  }

  function tellAi(tone, glow) {
    var copy = picked ? picked.ai : CALM;
    document.dispatchEvent(new CustomEvent("aprism:severity", {
      detail: {
        level: tone === "normal" ? null : tone,
        glow: glow === "normal" ? null : glow,
        line1: copy.line1,
        line2: copy.line2,
        tag: picked ? TAG : CALM.tag
      }
    }));
  }

  function render() {
    var all = items();
    if (picked && all.indexOf(picked) < 0) { picked = null; }
    if (!picked && all.length) { picked = all[0]; }

    var crit = all.filter(function (a) { return a.sev === "critical"; }).length;
    var warn = all.length - crit;
    var shown = all.filter(function (a) { return filter === "all" || a.sev === filter; });

    list.textContent = "";
    shown.forEach(function (a) { list.appendChild(item(a)); });
    $("[data-ah-count='all']").textContent = all.length;
    $("[data-ah-count='critical']").textContent = crit;
    $("[data-ah-count='warning']").textContent = warn;

    doneList.textContent = "";
    DONE.forEach(function (d) { doneList.appendChild(doneItem(d)); });
    doneCount.textContent = DONE.length + "건";

    // AI 패널은 고른 알림의 단계를 입는다 — 위험이 남아 있어도 주의 알림을 고르면 주의(노랑)다.
    // 화면 테두리(엣지 글로우)는 목록 전체에서 가장 높은 단계를 따른다.
    var top = highest(all);
    body.setAttribute("data-level", top);
    tellAi(picked ? picked.sev : "normal", top);
  }

  filters.forEach(function (btn) {
    btn.addEventListener("click", function () {
      filter = btn.getAttribute("data-ah-filter");
      filters.forEach(function (b) { b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
      render();
    });
  });

  // 비상정지는 위험 알림이다(알림 정책) — 목록에 쌓고 그것을 고른다.
  document.addEventListener("aprism:estop", function () {
    var chosen = $(".robot-strip .robot-card[aria-pressed='true'] .robot-id");
    var name = chosen ? chosen.textContent : "로봇";
    var a = { sev: "critical", where: name + " · 현재 위치", time: clock(),
      title: "비상정지 발동 · 로봇 구동 차단",
      ai: { line1: name + " 에 비상정지가 발동되었습니다.",
        line2: "모터 전원이 차단되었습니다. 현장 안전을 확인한 뒤 조치 내용을 입력하고 해제 절차를 진행하세요." } };
    extra.unshift(a);
    picked = a;
    render();
  });

  // 검토용 — 주소의 #normal · #warning · #critical 로 단계를 고른다.
  function fromHash() {
    var h = (location.hash || "").replace("#", "");
    level = (h === "normal" || h === "warning" || h === "critical") ? h : "critical";
    extra = [];
    picked = null;
    render();
  }

  window.addEventListener("hashchange", fromHash);

  // ==================================================================
  // 로봇 카드 넘겨 보기
  // 화살표는 옆 카드를 누른 것과 같다 — 선택 · 타임라인 · 지도는 screen.js / map.js 가 따라온다.
  // 연결이 끊긴 로봇은 건너뛴다.
  // ==================================================================
  (function () {
    var box = $("[data-robot-carousel]");
    if (!box) { return; }
    var cards = $$(".robot-card[data-robot]", box);

    $$("[data-rc-step]", box).forEach(function (arrow) {
      arrow.addEventListener("click", function () {
        var dir = Number(arrow.getAttribute("data-rc-step"));
        var now = cards.findIndex(function (c) { return c.getAttribute("aria-pressed") === "true"; });
        for (var n = 1; n <= cards.length; n++) {
          var next = cards[(now + dir * n + cards.length * n) % cards.length];
          if (!next.hasAttribute("data-robot-offline")) { next.click(); break; }
        }
      });
    });
  })();

  // screen.js 의 AI 패널 IIFE 가 먼저 돈 뒤에 첫 단계를 알린다(같은 틱에 스크립트 순서로 돈다).
  fromHash();
})();
