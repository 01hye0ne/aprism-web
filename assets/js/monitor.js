// 04.1 통합 관제 메인 · 모니터링 — Template ver.2 (Figma UI_00 826:8887)
// screens/dashboard-home.html (body.v2) 에서만 돈다.
//
// 셸의 동작(로봇 선택 · 타임라인 · 모달 · Drawer · AI 패널 · 지도)은 screen.js 와 map.js 가 그대로 한다.
// 여기서는 ver.2 에서 새로 생긴 것만 한다.
//
//   왼쪽 알림 히스토리 — 처리 필요 목록 · 거르기 · 고르기 · 오늘 확인 완료
//   Delta(AI 패널) — 목록 전체를 종합한 판단 · 문구 · 행동 버튼
//   오른쪽 로봇 카드 — 한 대씩 넘겨 보기
//   알림 단계 body[data-level] — normal · warning · critical (알림 정책 UI_99 1016:1055 의 주의 · 위험)
//
// 값은 검토용으로 이 파일 안에 있다. 서버가 없는 퍼블리싱이다.
// 주소 끝에 #normal · #few · #warning · #critical 을 붙이면 그 단계로 열린다. 없으면 Figma 와 같은 위험이다.
//   few — 알림이 있지만 Delta 종합 기준(5건)에 못 미친 판

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
  // 목록은 설비 이상만 채운다(디자이너 요청) — 로봇 상태(통신 · 경로 · 배터리)는 넣지 않는다.
  // 위험도는 알림 정책을 따른다 — 기준치를 넘은 이상징후(누출 · 부분방전 · 진동 · 과열 · 압력)는 주의,
  // NG 판정은 위험. 비상정지(E-STOP)는 사람이 누른 것이라 그대로 목록에 쌓인다.
  // ==================================================================
  // robot 은 우측 로봇 카드 번호(data-robot), wp 는 그 로봇 미션의 웨이포인트다 — 고르면 지도의
  // 그 자리 위에 쪽지가 선다. sum 은 쪽지의 원인 요약(두 줄), acts 는 "상황 조치" 선택지다.
  // live 는 쪽지 라이브 뷰에 까는 임시 그림(assets/img/alert-live-*.webp) — 디자이너가 준 검출 캡처 두 장을
  // 배관 · 펌프 계열(discharge)과 나머지(ppe)로 나눠 붙였다. 알림 내용과 딱 맞는 그림은 아니다.
  var WARNINGS = [
    { sev: "warning", robot: 0, wp: "WP-03", live: "discharge", where: "APRO 4F · WP-03 냉각수 배관 밸브", time: "10:11:19",
      title: "누출감지 · 냉각수 배관 밸브",
      sum: "밸브 이음부에서 누출 패턴이 신뢰도 0.87 로 검출됐습니다. 임계 0.70 을 넘었고 연속 2프레임에서 나왔습니다.",
      acts: ["현장 점검 요청", "다음 순회 재측정", "추이 관찰"] },
    { sev: "warning", robot: 1, wp: "WP-06", live: "discharge", where: "Robot 02 · WP-06 수배전반", time: "10:09:42",
      title: "부분방전 · 이상 점수 9.41",
      sum: "이상 점수 9.41 로 임계 9.23 을 넘었습니다. PRPD 패턴이 코로나 방전 유형과 일치합니다.",
      acts: ["재진단 예약", "현장 점검 요청", "추이 관찰"] },
    { sev: "warning", robot: 1, wp: "WP-12", live: "discharge", where: "Robot 02 · WP-12 냉각 펌프 P-2", time: "10:06:05",
      title: "진동 상승 · 냉각 펌프 P-2",
      sum: "진동 RMS 4.8 mm/s 로 주의 기준 4.5 를 넘었습니다. 최근 3회 측정에서 계속 오르고 있습니다.",
      acts: ["베어링 점검 요청", "다음 순회 재측정", "추이 관찰"] },
    { sev: "warning", robot: 4, wp: "WP-02", live: "ppe", where: "Robot 05 · WP-02 발전기 베어링", time: "10:03:27",
      title: "과열 · 발전기 베어링 68.4℃",
      sum: "베어링 표면 온도 68.4℃ 로 주의 기준 65℃ 를 넘었습니다. 주변 온도보다 31℃ 높습니다.",
      acts: ["윤활 상태 점검 요청", "열화상 재촬영", "추이 관찰"] },
    { sev: "warning", robot: 1, wp: "WP-20", live: "discharge", where: "Robot 02 · WP-20 공기 압축기 C-1", time: "10:01:12",
      title: "압력 편차 · 공기 압축기 C-1",
      sum: "토출 압력 7.9 bar 로 정상 범위(8.2~8.8) 아래입니다. 흡입 필터가 막혔을 가능성이 있습니다.",
      acts: ["필터 점검 요청", "재측정 예약", "추이 관찰"] }
  ];

  var CRITICAL = { sev: "critical", robot: 0, wp: "WP-04", live: "ppe", where: "터빈 2 / Unit 03 · WP-04 N₂ 배관 압력계", time: "10:12:40",
    title: "지하발전소 B3 터빈 2 NG 1건 발견",
    sum: "Spiral Casing Pr. 측정값 90 이 기준값 87 을 넘었습니다. 최근 3회 측정이 잇달아 올라 NG 로 판정했습니다.",
    acts: ["현장 무전 연락 · 작업 중지 요청", "로봇 정지 · 현장 점검 요청", "재측정 후 판단"] };

  // 검토용 단계 — 주소 끝 #… 로 고른다. few 는 알림은 있지만 Delta 종합 기준에 못 미친 판이다.
  var SETS = {
    normal: function () { return []; },
    few: function () { return [CRITICAL, WARNINGS[0], WARNINGS[1]]; },
    warning: function () { return WARNINGS.slice(); },
    critical: function () { return [CRITICAL].concat(WARNINGS); }
  };

  // ==================================================================
  // Delta — 알림 하나가 아니라 목록 전체를 종합해서 판단한다(2026-09-21 디자이너 정의).
  //
  //   주의 + 위험이 DELTA_MIN 건 이상 쌓이면 그 전체를 보고 주의 또는 위험으로 표시한다.
  //   그 아래에서는 종합 판단을 하지 않는다 — Delta 는 정상(파랑) 색으로 건수만 알린다.
  //
  // ※ 기준은 아직 정해지지 않았다. 아래 judge() 는 임시 규칙이다 —
  //    DELTA_MIN 건 이상일 때 위험이 한 건이라도 있으면 위험, 아니면 주의.
  //    기준이 정해지면 judge() 만 바꾸면 된다.
  //
  // 화면의 경고 색은 하나다(2026-09-21 정책 보완 — 델타는 파랑인데 테두리는 노랑이던 어색함).
  //   색(엣지 글로우 · Delta) = max(목록에서 가장 높은 단계, Delta 종합 판단 단계)
  //   파랑은 주의 · 위험이 하나도 없을 때만이다.
  // Delta 의 종합 판단은 색이 아니라 내용으로 드러난다 — 5건 이상이면 태그에 "종합" 이 붙고 행동 버튼이 뜬다.
  // 기준이 정해져 종합 판단이 단계를 올리면(예: 주의 5건 → 위험) 테두리와 Delta 가 함께 올라간다.
  // ==================================================================
  var DELTA_MIN = 5;

  function judge(all) {
    var crit = all.filter(function (a) { return a.sev === "critical"; }).length;
    var warn = all.length - crit;
    var level = all.length < DELTA_MIN ? "normal" : (crit ? "critical" : "warning");
    return { level: level, total: all.length, crit: crit, warn: warn };
  }

  // Delta 가 하는 말 — 닫힘은 둘째 줄이 한 줄 말줄임이라 앞쪽에 요지를 둔다.
  function deltaCopy(j) {
    if (!j.total) {
      return { tag: "정기 순회 진행 중", line1: "안녕하세요. 홍길동 님",
        line2: "Robot 01 이 정기 순회를 진행하고 있어요. 지금은 특이사항이 없습니다." };
    }
    var mix = "위험 " + j.crit + " · 주의 " + j.warn;
    if (j.level === "normal") {
      return { tag: "알림 " + j.total + "건 관찰 중", line1: "안녕하세요. 홍길동 님",
        line2: "확인할 알림이 " + j.total + "건 있어요(" + mix + "). 왼쪽 목록에서 하나씩 살펴봐 주세요." };
    }
    if (j.level === "warning") {
      return { tag: "알림 " + j.total + "건 종합 · 주의", line1: "주의 알림이 " + j.total + "건 쌓였습니다.",
        line2: "여러 설비에서 이상징후가 겹칩니다. 개별 대응보다 전체 추세를 함께 보고 점검 순서를 정하는 것을 권합니다." };
    }
    return { tag: "알림 " + j.total + "건 종합 · 위험", line1: "위험 " + j.crit + "건을 포함해 알림이 " + j.total + "건 쌓였습니다.",
      line2: "위험 알림부터 조치하고, 겹치는 주의 알림은 한꺼번에 점검 계획을 세우는 것을 권합니다." };
  }

  // Delta 를 펼쳤을 때의 행동 버튼 — 알림 여러 건을 한꺼번에 다룬다.
  // ※ 문구는 아직 정해지지 않은 초안이다. 누르면 아무 일도 하지 않는다.
  function deltaActions(j) {
    if (j.level === "critical") {
      return ["위험 " + j.crit + "건부터 조치", "주의 " + j.warn + "건 묶어서 확인", "현장 점검 한꺼번에 요청"];
    }
    if (j.level === "warning") {
      return ["주의 " + j.warn + "건 묶어서 확인", "추세 한 번에 보기", "현장 점검 한꺼번에 요청"];
    }
    return [];
  }

  var DONE_BASE = [
    { time: "10:29:10", title: "온도감지 · WP-03 펌프 하우징", how: "추이 관찰 · 다음 순회 재측정", who: "김현대" },
    { time: "10:18:52", title: "소음 이상 · 변압기 TR-1", how: "현장 점검 요청 · 이상 없음", who: "김현대" },
    { time: "10:02:31", title: "진동감지 · WP-02 터빈1 베어링", how: "추이 관찰 · 다음 순회 재측정", who: "홍길동" },
    { time: "09:47:15", title: "온도감지 · WP-03 펌프 하우징", how: "현장 점검 요청 · 이상 없음", who: "홍길동" },
    { time: "09:30:08", title: "누유 흔적 · 유압 유닛 HU-2", how: "청소 후 재측정 · 정상", who: "김현대" }
  ];
  var DONE = DONE_BASE.slice();

  var RANK = { critical: 0, warning: 1 };

  // ==================================================================
  // 알림 히스토리
  // ==================================================================
  var list = $("[data-ah-list]");
  var doneList = $("[data-done-list]");
  var doneCount = $("[data-done-count]");
  var filters = $$("[data-ah-filter]");
  if (!list) { return; }

  var aiActions = $("[data-ai-actions]");

  var level = "critical";
  var extra = [];          // E-STOP 처럼 화면에서 생긴 알림
  var filter = "all";
  var picked = null;       // 고른 알림(객체) — 지도에 쪽지가 열려 있는 알림
  var resolved = [];       // 확인 처리한 알림 — 목록에서 빠지고 오늘 확인 완료로 간다

  function items() {
    var base = (SETS[level] || SETS.critical)().filter(function (a) { return resolved.indexOf(a) < 0; });
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
    // 고르면 그 알림이 난 웨이포인트 위에 쪽지가 선다. 같은 것을 다시 누르면 닫는다.
    // Delta 문구는 목록 전체를 종합한 것이라 바뀌지 않는다.
    node.addEventListener("click", function () {
      if (picked === a) { note.close(); } else { note.open(a); }
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

  var TONE = { normal: 0, warning: 1, critical: 2 };

  function tellAi(j, top) {
    var copy = deltaCopy(j);
    // 테두리와 Delta 가 같은 색을 입는다 — 목록 최고 단계와 종합 판단 중 높은 쪽.
    var tone = TONE[j.level] > TONE[top] ? j.level : top;
    document.dispatchEvent(new CustomEvent("aprism:severity", {
      detail: {
        level: tone === "normal" ? null : tone,
        glow: tone === "normal" ? null : tone,
        line1: copy.line1,
        line2: copy.line2,
        tag: copy.tag
      }
    }));

    if (!aiActions) { return; }
    var labels = deltaActions(j);
    aiActions.textContent = "";
    aiActions.hidden = !labels.length;
    labels.forEach(function (label, i) {
      var b = el("button", "btn is-md " + (i === 0 ? "btn-primary" : "btn-secondary"), label);
      b.type = "button";
      aiActions.appendChild(b);
    });
  }

  function render() {
    var all = items();
    if (picked && all.indexOf(picked) < 0) { picked = null; }

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
    // 다시 그리면 내용 길이가 바뀌어 스크롤 자리도 바뀔 수 있다 — 그림자를 다시 맞춘다.
    $$(".ah-box").forEach(shade);

    // Delta 는 목록 전체를 종합한다 — 목록에서 무엇을 골랐는지와는 상관없다.
    // 화면 테두리(엣지 글로우)는 목록에서 가장 높은 단계를 따른다.
    var top = highest(all);
    body.setAttribute("data-level", top);
    tellAi(judge(all), top);
    markWaypoints();
  }

  /*
   * 알림이 걸린 웨이포인트에 그 단계를 적는다 — 우측 타임라인 표식과 지도의 점이 이 값을 읽는다.
   * 알림 목록이 원본이다. 미션 더미(screen.js)의 검사 결과는 여기서 덮는다 — 알림이 없는 칸은 정상이다.
   * 확인 처리해서 목록에서 빠지면 표식도 정상으로 돌아간다.
   */
  var WP_ALERT = { warning: "caution", critical: "danger" };

  function markWaypoints() {
    var rail = $("[data-timeline]");
    if (!rail) { return; }
    var robot = activeRobot();
    var hits = {};
    items().forEach(function (a) {
      if (a.robot !== robot || !a.wp) { return; }
      if (!hits[a.wp] || TONE[a.sev] > TONE[hits[a.wp]]) { hits[a.wp] = a.sev; }
    });
    $$("[data-waypoint]", rail).forEach(function (node) {
      var sev = hits[node.getAttribute("data-waypoint")];
      if (sev) { node.setAttribute("data-wp-alert", WP_ALERT[sev]); } else { node.removeAttribute("data-wp-alert"); }
      if (node.getAttribute("data-wp-state") === "completed") {
        node.setAttribute("data-wp-result", sev ? WP_ALERT[sev] : "safe");
      }
    });
    document.dispatchEvent(new CustomEvent("aprism:wp-marks"));
  }

  // 로봇을 바꾸면 타임라인이 새로 그려진다 — 그 로봇의 알림을 다시 적는다.
  document.addEventListener("aprism:mission", markWaypoints);

  // 목록을 내렸을 때만 상자 위쪽 안쪽 그림자를 켠다 — 맨 위에서는 가려진 것이 없다.
  function shade(box) {
    var inner = box && box.querySelector(".ah-list");
    if (inner) { box.classList.toggle("is-scrolled", inner.scrollTop > 0); }
  }

  $$(".ah-box").forEach(function (box) {
    var inner = box.querySelector(".ah-list");
    if (inner) { inner.addEventListener("scroll", function () { shade(box); }, { passive: true }); }
  });

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
      robot: activeRobot(), wp: currentWp(),
      sum: "모터 전원이 차단되었습니다. 현장 안전을 확인한 뒤 해제 절차를 진행하세요.",
      acts: ["현장 무전 연락 · 안전 확인", "해제 절차 진행", "로봇 회수 요청"] };
    extra.unshift(a);
    render();
  });

  // ==================================================================
  // 알림 쪽지 — Figma Messages(948:31737)
  //
  // 고르면: 그 알림의 로봇으로 카드를 넘기고(지도 · 타임라인이 그 로봇 미션으로 바뀐다),
  //        타임라인에서 그 웨이포인트를 골라 지도가 그리로 가게 한 뒤 쪽지를 세운다.
  // 닫기:  같은 알림을 다시 누르거나 Esc. 지도나 타임라인에서 다른 곳을 골라도 닫힌다(map.js).
  // 확인 처리: 상황 조치를 골라야 켜진다. 고른 조치와 함께 오늘 확인 완료로 옮긴다
  //           — 위험은 조치를 적어야 풀린다(알림 정책). 고르기와 확정이 두 번에 나뉜다.
  // ==================================================================
  function activeRobot() {
    var on = $(".robot-strip .robot-card[aria-pressed='true'][data-robot]");
    return on ? Number(on.getAttribute("data-robot")) : 0;
  }

  function currentWp() {
    var t = $("[data-timeline]");
    return (t && t.getAttribute("data-current-waypoint")) || "WP-01";
  }

  var note = (function () {
    var box = $("[data-map-alert]");
    var timeline = $("[data-timeline]");
    if (!box) { return { open: function () {}, close: function () {} }; }

    var sev = $("[data-ma-sev]", box);
    var time = $("[data-ma-time]", box);
    var title = $("[data-ma-title]", box);
    var sum = $("[data-ma-sum]", box);
    var live = $(".ma-live", box);
    var options = $("[data-ma-options]", box);
    var confirm = $("[data-ma-confirm]", box);
    var opening = false;

    // 고른 조치. 알림을 새로 열 때마다 비운다 — 조치를 골라야 [확인 처리] 가 켜진다.
    function chosen() {
      var on = $("input:checked", options);
      return on ? on.value : "";
    }

    function fill(a) {
      box.classList.toggle("is-critical", a.sev === "critical");
      sev.textContent = a.sev === "critical" ? "위험" : "주의";
      time.textContent = a.time;
      title.textContent = a.title;
      title.title = a.title;
      sum.textContent = a.sum;
      sum.title = a.sum;
      // 라이브 뷰 — 그림이 없는 알림(E-STOP 등)은 빈 면(#262626)으로 남고 [크게보기] 도 숨는다.
      live.style.backgroundImage = a.live ? "url(" + liveSrc(a) + ")" : "";
      live.classList.toggle("has-photo", !!a.live);
      options.textContent = "";
      a.acts.forEach(function (label) {
        var row = el("label", "ma-option");
        var input = el("input");
        input.type = "radio";
        input.name = "ma-act";
        input.value = label;
        var dot = el("span", "ma-radio");
        dot.setAttribute("aria-hidden", "true");
        row.appendChild(input);
        row.appendChild(dot);
        row.appendChild(el("span", "t-body-3", label));
        options.appendChild(row);
      });
      confirm.disabled = true;
    }

    options.addEventListener("change", function () { confirm.disabled = !chosen(); });

    function liveSrc(a) { return "../assets/img/alert-live-" + a.live + ".webp"; }

    // ---------- 크게보기 ----------
    var zoomBox = $("[data-ma-zoom-box]");
    var zoomBtn = $("[data-ma-zoom]", box);
    var zoomImg = zoomBox && $("[data-ma-zoom-img]", zoomBox);
    var zoomClose = zoomBox && $("[data-ma-zoom-close]", zoomBox);

    function openZoom() {
      var a = picked;
      if (!zoomBox || !a || !a.live) { return; }
      zoomBox.classList.toggle("is-critical", a.sev === "critical");
      $("[data-ma-zoom-sev]", zoomBox).textContent = a.sev === "critical" ? "위험" : "주의";
      $("[data-ma-zoom-title]", zoomBox).textContent = a.title;
      $("[data-ma-zoom-time]", zoomBox).textContent = a.time;
      zoomImg.src = liveSrc(a);
      zoomImg.alt = a.title + " — 라이브 뷰";
      zoomBox.hidden = false;
      zoomClose.focus();
    }

    function closeZoom() {
      if (!zoomBox || zoomBox.hidden) { return false; }
      zoomBox.hidden = true;
      if (!box.hidden && zoomBtn) { zoomBtn.focus(); }
      return true;
    }

    if (zoomBox) {
      zoomBtn.addEventListener("click", openZoom);
      zoomClose.addEventListener("click", closeZoom);
      // 카드 바깥(어두운 면)을 누르면 닫힌다.
      zoomBox.addEventListener("click", function (event) { if (event.target === zoomBox) { closeZoom(); } });
    }

    // 타임라인에서 그 칸을 고른다 — 타임라인이 지도에 알리고, 지도가 카메라를 데려간다.
    // 이미 골라져 있으면 누르지 않는다(누르면 놓아 버린다). 그때는 지도에 직접 다시 알린다.
    function pointAt(wp) {
      var item = timeline && timeline.querySelector("[data-waypoint='" + wp + "']");
      if (item && timeline.getAttribute("data-selected-waypoint") !== wp) {
        item.click();
      } else {
        document.dispatchEvent(new CustomEvent("aprism:waypoint", { detail: { id: wp, from: "panel" } }));
      }
      if (item && item.scrollIntoView) { item.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    }

    function open(a) {
      opening = true;
      if (a.robot !== activeRobot()) {
        var card = $(".robot-strip .robot-card[data-robot='" + a.robot + "']");
        if (card) { card.click(); }
      }
      picked = a;
      fill(a);
      box.setAttribute("data-wp", a.wp);
      box.hidden = false;
      pointAt(a.wp);
      opening = false;
      render();
    }

    function close() {
      closeZoom();
      if (box.hidden) { picked = null; return; }
      var wp = box.getAttribute("data-wp");
      box.hidden = true;
      picked = null;
      // 타임라인 · 지도의 고른 칸도 놓는다.
      if (timeline && timeline.getAttribute("data-selected-waypoint") === wp) {
        var item = timeline.querySelector("[data-waypoint='" + wp + "']");
        if (item) { item.click(); }
      }
      render();
    }

    confirm.addEventListener("click", function () {
      var a = picked;
      var how = chosen();
      if (!a || !how) { return; }
      DONE.forEach(function (d) { d.fresh = false; });
      DONE.unshift({ time: clock(), title: a.title, how: how, who: "홍길동", fresh: true });
      if (extra.indexOf(a) >= 0) { extra.splice(extra.indexOf(a), 1); } else { resolved.push(a); }
      close();
    });

    // 지도가 다른 웨이포인트로 옮겨 가며 쪽지를 닫았다 — 목록의 고른 표시도 놓는다.
    document.addEventListener("aprism:map-alert", function (event) {
      if (opening || (event.detail && event.detail.open)) { return; }
      picked = null;
      render();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") { return; }
      // 크게보기가 떠 있으면 그것만 닫는다 — 쪽지는 남긴다.
      if (closeZoom()) { return; }
      if (box.hidden) { return; }
      close();
    });

    /*
     * 쪽지가 떠 있는 동안 Delta(AI 패널)는 잠시 비킨다 — 쪽지와 겹친다.
     * 쪽지는 목록 · Esc · 확인 처리 · 지도(다른 웨이포인트를 고름) 여러 곳에서 여닫히므로
     * 여닫는 자리마다 챙기지 않고 쪽지의 hidden 을 지켜본다.
     */
    function syncDelta() { body.classList.toggle("has-map-alert", !box.hidden); }
    new MutationObserver(syncDelta).observe(box, { attributes: true, attributeFilter: ["hidden"] });
    syncDelta();

    return { open: open, close: close };
  })();

  // 검토용 — 주소의 #normal · #few · #warning · #critical 로 단계를 고른다.
  function fromHash() {
    var h = (location.hash || "").replace("#", "");
    level = SETS[h] ? h : "critical";
    extra = [];
    resolved = [];
    DONE = DONE_BASE.slice();
    note.close();
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

  // ==================================================================
  // Delta 묻기 칸 — 펼친 판의 행동 버튼 줄 맨 오른쪽 [돋보기] 로 열고 닫는다. 열면 바로 적을 수 있게 초점을 준다.
  // ==================================================================
  (function () {
    var open = $("[data-ai-ask-open]");
    var box = $("#ai-ask");
    if (!open || !box) { return; }
    var input = $("[data-ai-ask]", box);
    open.addEventListener("click", function () {
      var on = box.hidden;
      box.hidden = !on;
      open.setAttribute("aria-expanded", on ? "true" : "false");
      open.setAttribute("aria-label", on ? "Delta 에게 묻기 닫기" : "Delta 에게 묻기 열기");
      if (on && input) { input.focus(); }
    });
  })();

  // screen.js 의 AI 패널 IIFE 가 먼저 돈 뒤에 첫 단계를 알린다(같은 틱에 스크립트 순서로 돈다).
  fromHash();
})();
