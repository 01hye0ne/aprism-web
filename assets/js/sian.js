// 시안 1 · 2 화면 동작 — screens/sian-1.html · sian-2.html
//
// 셸의 동작(로봇 선택 · 타임라인 · 모달 · Drawer · AI 패널 · 지도)은 screen.js 와 map.js 가 그대로 한다.
// 여기서는 시안에서 새로 생긴 것만 한다.
//
//   단계      body[data-stage]  setup → precheck → monitor
//   알림 단계  body[data-level]  normal · warning · critical   (알림 정책 UI_99 1016:1055 의 주의 · 위험)
//
// 값은 검토용으로 이 파일 안에 있다. 서버가 없는 퍼블리싱이다.

(function () {
  "use strict";

  var body = document.body;
  if (!body.classList.contains("sian")) { return; }

  var SIAN = body.classList.contains("sian-2") ? 2 : 1;
  var app = document.querySelector(".app");
  var twoCol = document.querySelector("[data-sian-twocol]");

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

  function clock(date) {
    var d = date || new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(function (n) { return (n < 10 ? "0" : "") + n; }).join(":");
  }

  // ==================================================================
  // 알림 데이터
  // 시안 1 은 알림 히스토리(최근 24시간), 시안 2 는 미확인 알림 카드다.
  // 위험도는 알림 정책을 따른다 — 통신 불안정 · 누출 · 부분방전은 주의, 사람 · 비상정지는 위험.
  // ==================================================================
  var WARNINGS_1 = [
    { sev: "warning", where: "APRO 4F · WP-04 냉각수 배관 이음부", time: "10:11:19",
      title: "누출감지 · 냉각수 배관 이음부", state: "조치 필요 · 현장 점검 대기" },
    { sev: "warning", where: "APRO 4F · WP-06 수배전반", time: "10:09:42",
      title: "부분방전 · 이상 점수 9.41", state: "조치 필요 · 추이 관찰 중" },
    { sev: "warning", where: "Robot 02 · 터빈 2 / Unit 03", time: "10:06:05",
      title: "통신 불안정 · 재접속 3회 실패", state: "조치 필요 · 신호 확인 중" }
  ];

  var CRITICAL_1 = { sev: "critical", where: "APRO 4F · 터빈 2 / Unit 03", time: "10:12:40",
    title: "지하발전소 B3 터빈 2 NG 1건 발견", state: "조치 필요 · 조치 입력 후 해제" };

  var DELTA_1 = {
    normal: {
      line1: "안녕하세요. 홍길동 님",
      line2: "Robot 01 이 정기 순회를 진행하고 있어요. 지금은 특이사항이 없습니다."
    },
    warning: {
      line1: "현재 지하발전소 B3 터빈2 NG 1건이 발견 되었습니다.",
      line2: "Spiral Casing Pr. 기준값 87 이하 측정값 90으로 3 정도 높습니다. 4% 미만으로 다음 검사에서 추이를 보겠습니다.",
      actions: ["현장 점검 요청", "추이 보기", "재진단 예약"]
    },
    critical: {
      line1: "지하발전소 B3 터빈 2 에서 위험 알림이 발생했습니다.",
      line2: "Spiral Casing Pr. 이 기준값을 크게 넘었습니다. 로봇을 멈추고 현장에 연락한 뒤 조치 내용을 입력해 주세요.",
      actions: ["로봇 정지", "현장 연락", "조치 입력"]
    }
  };

  // 시안 2 — 미확인 카드와 그 상세. 상세(①②③)는 Figma 알림 상세보기의 내용을 따른다.
  function alerts2(sev) {
    var s = sev === "critical" ? "critical" : "warning";
    return [
      {
        id: "belt", sev: s,
        title: "안전벨트 미착용 · WP-04",
        desc: "P2 작업자의 안전벨트가 검출되지 않았습니다 — 판정 기준 “미착용 1명 이상”을 충족했습니다.",
        meta: "10:32:14 KST · 3분 경과 · 담당 R-01 · WP-04 냉각수 배관 이음부",
        evTitle: "P2 안전벨트 미착용", model: "RF-DETR · 24 ms", cam: "CAM · R-01 · 10:32:14",
        boxes: [
          { label: "P1 · 헬멧 ✓  안전벨트 ✓  안전화 ✓", x: 140, y: 79, bx: 180, by: 98, bw: 158, bh: 298 },
          { label: "P2 · 헬멧 ✓  안전벨트 ✗  안전화 ✓", x: 359, y: 83, bx: 313, by: 102, bw: 160, bh: 289, hit: true }
        ],
        judge: "P2 작업자 · 안전벨트 미착용",
        judgeDesc: "P1은 헬멧 · 안전벨트 · 안전화 3종 모두 착용 · 검출 신뢰도 0.91 · 판정 기준 “미착용 1명 이상 → " + (s === "critical" ? "위험" : "주의") + "”",
        wp: "WP-04", wpName: "WP-04 냉각수 배관 이음부", wpSub: "APRO 4F · R-01 미션 (12개 지점) · WP-04",
        near: "WP-03 펌프 하우징 · 12 m", recent: "10:31:47 정상 · 10:29:10 확인됨"
      },
      {
        id: "pd", sev: s,
        title: "부분방전 · WP-06",
        desc: "이상 점수 9.41 — 임계 9.23을 초과했습니다. PRPD 패턴이 코로나 방전 유형과 일치합니다.",
        meta: "10:31:44 KST · 4분 경과 · 담당 R-02 · WP-06 수배전반",
        evTitle: "WP-06 부분방전 패턴", model: "PRPD 분류 · 41 ms", cam: "UHF 센서 · R-02 · 10:31:44",
        boxes: [
          { label: "코로나 방전 · 이상 점수 9.41", x: 200, y: 120, bx: 200, by: 139, bw: 232, bh: 180, hit: true }
        ],
        judge: "수배전반 · 코로나 방전 의심",
        judgeDesc: "임계 9.23 초과 · 최근 3회 측정 상승 추세 · 판정 기준 “임계 초과 → " + (s === "critical" ? "위험" : "주의") + "”",
        wp: "WP-06", wpName: "WP-06 수배전반", wpSub: "APRO 4F · R-02 미션 (8개 지점) · WP-06",
        near: "WP-05 비상 발전기실 · 18 m", recent: "10:24:02 정상 · 10:12:40 확인됨"
      }
    ];
  }

  var DONE_2 = [
    { time: "10:29:10", title: "온도감지 · WP-03 펌프 하우징", how: "추이 관찰 · 다음 순회 재측정", who: "김현대" },
    { time: "10:18:52", title: "통신 불안정 · Robot 02", how: "재접속 확인 · 조치 불필요", who: "김현대" },
    { time: "10:02:31", title: "진동감지 · WP-02 터빈1 베어링", how: "추이 관찰 · 다음 순회 재측정", who: "홍길동" },
    { time: "09:47:15", title: "온도감지 · WP-03 펌프 하우징", how: "현장 점검 요청 · 이상 없음", who: "홍길동" },
    { time: "09:30:08", title: "배터리 부족 · Robot 06", how: "충전 도크 복귀 확인", who: "김현대" }
  ];

  var DELTA_2 = {
    normal: { level: null, tag: "원인 분석 중",
      line1: "안녕하세요. 홍길동 님", line2: "Robot 01 이 정기 순회를 진행하고 있어요. 지금은 특이사항이 없습니다." },
    warning: { level: "warning", tag: "원인 분석 완료 · 후보 1건 확인",
      line1: "안녕하세요. 홍길동 님", line2: "Spiral Casing Pr. 기준값 87이하 측정값 90으로 3정도 높습니다. 4% 미만으로 다음 검사에서 추이를 보겠습니다." },
    critical: { level: "critical", tag: "원인 분석 완료 · 후보 1건 확인",
      line1: "안녕하세요. 홍길동 님", line2: "Spiral Casing Pr. 기준값 87이하 측정값 90으로 3정도 높습니다. 4% 미만으로 다음 검사에서 추이를 보겠습니다." }
  };

  // ==================================================================
  // 단계 — setup · precheck · monitor
  // ==================================================================
  var stage = "setup";
  var reviewBar = $("[data-sian-review]");

  function setStage(next) {
    stage = next;
    body.setAttribute("data-stage", next);

    $$("[data-stage-show]").forEach(function (node) {
      node.hidden = node.getAttribute("data-stage-show") !== next;
    });

    // 시안 2 — 설정 · 점검은 지도 위 모달이다. 떠 있는 동안 뒤 화면은 닿지 않는다.
    var stageModalOpen = false;
    $$("[data-stage-modal]").forEach(function (node) {
      var on = node.getAttribute("data-stage-modal") === next;
      node.hidden = !on;
      if (on) { stageModalOpen = true; }
    });
    if (SIAN === 2 && app) { app.inert = stageModalOpen; }

    if (next === "precheck") { precheck.start(); } else { precheck.stop(); }
    if (next === "monitor") {
      var input = $("[data-stage-show='setup'] .field-box, [data-stage-modal='setup'] .field-box");
      var name = input && input.value ? input.value : "";
      $$("[data-sian-mission-name]").forEach(function (h) { if (name) { h.textContent = name; } });
    }

    paintReview();
  }

  document.addEventListener("click", function (event) {
    var go = event.target.closest && event.target.closest("[data-sian-go]");
    if (!go || go.disabled) { return; }
    var to = go.getAttribute("data-sian-go");
    if (to === "monitor") { setLevel("normal"); }
    setStage(to);
  });

  // ==================================================================
  // 사전 점검 — 항목이 하나씩 통과하고, 넷이 다 통과하면 잠시 뒤 모니터링으로 간다.
  // screen.js 의 같은 동작은 다른 페이지로 이동해 버려서 여기서 다시 짰다(모양은 같은 클래스).
  // ==================================================================
  var precheck = (function () {
    var lists = $$("[data-sian-precheck]");
    var initial = lists.map(function (list) { return list.innerHTML; });
    var timers = [];

    function clear() {
      timers.forEach(function (t) { window.clearTimeout(t); });
      timers = [];
    }

    function run(list, index) {
      list.innerHTML = initial[index];
      var scope = list.closest(".mission-panel") || document;
      var startBtn = scope.querySelector(".btn-line.is-start");
      if (startBtn) { startBtn.disabled = true; }
      var rows = $$("[data-precheck-row]", list);
      var tag = list.querySelector("[data-precheck-tag]");
      var STEP = parseFloat(getComputedStyle(list).getPropertyValue("--precheck-step")) || 1400;

      function promote(row) {
        row.classList.remove("is-pending");
        row.classList.add("is-running", "is-active");
        var meta = row.querySelector(".meta");
        if (meta) { meta.textContent = row.getAttribute("data-running-meta") || "확인중.."; }
      }

      function complete(row) {
        row.classList.remove("is-running", "is-active", "is-pending");
        row.classList.add("is-done");
        var i = row.querySelector(".i");
        if (i) { i.style.setProperty("--i", "var(--ic-delta)"); }
        var meta = row.querySelector(".meta");
        if (meta) {
          meta.textContent = row.getAttribute("data-done-meta") || "";
          meta.classList.remove("is-plain");
        }
      }

      function tick() {
        var next = rows.shift();
        if (!next) {
          if (tag) { tag.textContent = "완료"; }
          if (startBtn) { startBtn.disabled = false; }
          timers.push(window.setTimeout(function () {
            if (stage === "precheck") { setLevel("normal"); setStage("monitor"); }
          }, 1600));
          return;
        }
        complete(next);
        if (rows[0]) { promote(rows[0]); }
        timers.push(window.setTimeout(tick, STEP));
      }

      timers.push(window.setTimeout(tick, STEP));
    }

    return {
      start: function () {
        clear();
        lists.forEach(function (list, i) {
          // 보이는 쪽만 돌린다(시안 1 은 패널, 시안 2 는 모달 한 벌뿐이다).
          run(list, i);
        });
      },
      stop: clear
    };
  })();

  // ==================================================================
  // 알림 단계 — normal · warning · critical
  // ==================================================================
  var level = "normal";

  function setLevel(next) {
    level = next;
    body.setAttribute("data-level", next);
    if (SIAN === 1) { side1.render(); } else { side2.render(); }
    paintReview();
  }

  function glow(next) {
    if (!twoCol) { return; }
    twoCol.classList.toggle("is-warning", next === "warning");
    twoCol.classList.toggle("is-critical", next === "critical");
  }

  // ==================================================================
  // 시안 1 — 알림 히스토리 + Delta
  // ==================================================================
  var side1 = (function () {
    if (SIAN !== 1) { return null; }

    var list = $("[data-ah-list]");
    var needText = $("[data-ah-need-text]");
    var filters = $$("[data-ah-filter]");
    var extra = [];            // E-STOP 처럼 화면에서 생긴 알림
    var filter = null;
    var picked = 0;

    var line1 = $("[data-dl-line1]");
    var line2 = $("[data-dl-line2]");
    var chips = $("[data-dl-chips]");
    var actions = $("[data-dl-actions]");
    var mark = $(".dl-mark");
    var orb = (mark && window.PrismOrb) ? window.PrismOrb.mount(mark, { palette: "info" }) : null;
    if (orb && mark) { mark.classList.add("has-orb"); }

    function items() {
      var base = level === "normal" ? [] :
        level === "warning" ? WARNINGS_1.slice() : [CRITICAL_1].concat(WARNINGS_1);
      return extra.concat(base);
    }

    function item(data, index) {
      var node = el("button", "ah-item is-" + data.sev);
      node.type = "button";
      node.setAttribute("role", "listitem");
      node.setAttribute("aria-pressed", index === picked ? "true" : "false");

      var where = el("span", "ah-where t-caption");
      where.appendChild(icon("target"));
      where.appendChild(el("span", null, data.where));
      where.appendChild(el("span", "num", data.time));

      var text = el("span", "ah-text");
      var title = el("span", "ah-title t-label-1");
      title.appendChild(icon(data.sev === "critical" ? "error" : "warning"));
      title.appendChild(el("span", null, data.title));
      text.appendChild(title);
      text.appendChild(el("span", "ah-state t-label-2", data.state));

      node.appendChild(where);
      node.appendChild(text);
      node.addEventListener("click", function () {
        picked = index;
        render();
      });
      return node;
    }

    function render() {
      var all = items();
      var crit = all.filter(function (a) { return a.sev === "critical"; }).length;
      var warn = all.filter(function (a) { return a.sev === "warning"; }).length;
      var shown = all.filter(function (a) { return !filter || a.sev === filter; });

      if (level === "normal" && extra.length) { level = crit ? "critical" : "warning"; body.setAttribute("data-level", level); }

      list.textContent = "";
      shown.forEach(function (a) { list.appendChild(item(a, all.indexOf(a))); });
      $("[data-ah-count='critical']").textContent = crit;
      $("[data-ah-count='warning']").textContent = warn;
      needText.textContent = "조치 필요 " + all.length;

      var copy = DELTA_1[level];
      line1.textContent = copy.line1;
      line2.textContent = copy.line2;
      chips.hidden = level !== "normal";
      actions.hidden = level === "normal";
      actions.textContent = "";
      (copy.actions || []).forEach(function (label, i) {
        var b = el("button", "btn is-md " + (i === 0 ? "btn-primary" : "btn-secondary"), label);
        b.type = "button";
        if (label === "로봇 정지") { b.setAttribute("data-modal-open", "estop"); }
        actions.appendChild(b);
      });

      glow(level === "normal" ? null : level);
      if (orb) { orb.setPalette(level === "normal" ? "info" : level); }
    }

    filters.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var k = chip.getAttribute("data-ah-filter");
        filter = filter === k ? null : k;
        filters.forEach(function (c) { c.setAttribute("aria-pressed", c.getAttribute("data-ah-filter") === filter ? "true" : "false"); });
        render();
      });
    });

    // [로봇 정지] 는 screen.js 의 모달 여닫기에 물려야 해서, 새로 그린 버튼이 눌렸을 때 원래 트리거를 대신 누른다.
    actions.addEventListener("click", function (event) {
      var b = event.target.closest("[data-modal-open='estop']");
      if (!b) { return; }
      var real = $(".rc-actions [data-modal-open='estop']");
      if (real) { real.click(); }
    });

    // 비상정지는 위험 알림이다(알림 정책) — 목록 맨 위에 쌓는다.
    document.addEventListener("aprism:estop", function () {
      var chosen = $(".robot-strip .robot-card[aria-pressed='true'] .robot-id");
      extra.unshift({ sev: "critical", where: (chosen ? chosen.textContent : "Robot") + " · 현재 위치",
        time: clock(), title: "비상정지 발동 · 로봇 구동 차단", state: "조치 필요 · 조치 입력 후 해제" });
      picked = 0;
      if (stage === "monitor") { setLevel("critical"); }
    });

    return {
      render: function () {
        if (level === "normal") { extra = []; }
        picked = 0;
        render();
      }
    };
  })();

  // ==================================================================
  // 시안 1 — 로봇 카드 넘겨 보기
  // 화살표는 옆 카드를 누른 것과 같다 — 선택 · 타임라인 · 지도는 screen.js / map.js 가 따라온다.
  // 연결이 끊긴 로봇(Robot 10)은 건너뛴다.
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
  // 시안 2 — 미확인 알림 + 알림 상세
  // ==================================================================
  var side2 = (function () {
    if (SIAN !== 2) { return null; }

    var list = $("[data-ua-list]");
    var doneList = $("[data-ua-done-list]");
    var badge = $("[data-ua-badge]");
    var badgeText = $("[data-ua-badge-text]");
    var filters = $$("[data-ua-filter]");
    var unread = [];
    var done = DONE_2.slice();
    var filter = "all";
    var fresh = null;

    function severityNow() {
      if (unread.some(function (a) { return a.sev === "critical"; })) { return "critical"; }
      if (unread.length) { return "warning"; }
      return "normal";
    }

    function tellAi(lv) {
      var copy = DELTA_2[lv];
      document.dispatchEvent(new CustomEvent("aprism:severity", {
        detail: { level: copy.level, line1: copy.line1, line2: copy.line2, tag: copy.tag }
      }));
    }

    function card(a) {
      var node = el("article", "ua-card is-" + a.sev);
      node.appendChild(el("span", "ua-edge"));
      var text = el("div", "ua-text");
      var row = el("div", "ua-row");
      var b = el("span", "sev-badge" + (a.sev === "critical" ? " is-critical" : ""));
      b.appendChild(el("span", "badge-dot"));
      b.appendChild(document.createTextNode(a.sev === "critical" ? "위험" : "주의"));
      row.appendChild(b);
      // 제목은 " · " 조각 단위로만 줄을 넘긴다 — "WP-06" 이 하이픈에서 끊기지 않게.
      var h = el("h3", "ua-card-title");
      a.title.split(" · ").forEach(function (part, i, all) {
        h.appendChild(el("span", "ua-nb", part + (i < all.length - 1 ? " ·" : "")));
        if (i < all.length - 1) { h.appendChild(document.createTextNode(" ")); }
      });
      row.appendChild(h);
      text.appendChild(row);
      // 한 줄씩 말줄임한다. 전체 문장은 올려 두면 보이고, 상세(확인하기)에 다 나온다.
      var desc = el("p", "ua-desc", a.desc);
      var meta = el("p", "ua-meta num", a.meta);
      desc.title = a.desc;
      meta.title = a.meta;
      text.appendChild(desc);
      text.appendChild(meta);
      node.appendChild(text);
      var open = el("button", "btn is-md btn-accent", "확인하기");
      open.type = "button";
      node.appendChild(open);
      // 버튼은 hover 에서만 보인다 — 카드 어디를 눌러도 같은 상세를 연다(초점은 버튼으로 돌아온다).
      node.addEventListener("click", function () { detail.open(a, open); });
      return node;
    }

    function doneItem(d) {
      var node = el("div", "ua-done-item");
      if (d === fresh) { node.classList.add("is-new"); }
      var t = el("div", "t");
      t.appendChild(el("span", "time num", d.time));
      t.appendChild(el("span", "title", d.title));
      node.appendChild(t);
      var how = el("div", "how");
      how.appendChild(el("span", "ok", "✓"));
      how.appendChild(el("span", null, d.how));
      how.appendChild(el("span", null, d.who));
      node.appendChild(how);
      return node;
    }

    function render() {
      var crit = unread.filter(function (a) { return a.sev === "critical"; });
      var warn = unread.filter(function (a) { return a.sev === "warning"; });
      // 위험 우선, 같은 단계 안에서는 오래된 순(목록 순서가 이미 오래된 순이다).
      var ordered = crit.concat(warn);
      var shown = ordered.filter(function (a) { return filter === "all" || a.sev === filter; });

      list.textContent = "";
      shown.forEach(function (a) { list.appendChild(card(a)); });

      $("[data-ua-count='all']").textContent = unread.length;
      $("[data-ua-count='critical']").textContent = crit.length;
      $("[data-ua-count='warning']").textContent = warn.length;

      badge.hidden = !unread.length;
      badge.classList.toggle("is-critical", crit.length > 0);
      badgeText.textContent = unread.length + "건";

      doneList.textContent = "";
      done.forEach(function (d) { doneList.appendChild(doneItem(d)); });
      $("[data-ua-done-count]").textContent = done.length + "건";

      var lv = severityNow();
      body.setAttribute("data-level", lv);
      glow(lv === "normal" ? null : lv);
    }

    filters.forEach(function (f) {
      f.addEventListener("click", function () {
        filter = f.getAttribute("data-ua-filter");
        filters.forEach(function (o) { o.setAttribute("aria-pressed", o === f ? "true" : "false"); });
        render();
      });
    });

    /*
     * AI 패널의 [확인] — screen.js 는 누르면 곧바로 일반(파랑)으로 되돌린다.
     * 알림 정책에서 위험은 "조치 내용 입력 후 수동 해제"다. 그래서 위험이 남아 있으면
     * 되돌리지 않고 그 알림의 상세를 연다(③ 에서 조치를 골라야 풀린다).
     * 주의는 관제사가 직접 확인하는 단계라 [확인] 으로 글로우만 끄고, 카드는 미확인으로 남긴다.
     */
    var ack = $("[data-ai-ack]");
    if (ack) {
      ack.addEventListener("click", function (event) {
        var first = unread.filter(function (a) { return a.sev === "critical"; })[0];
        if (!first) { return; }
        event.stopImmediatePropagation();
        detail.open(first, ack);
      }, true);
    }

    function resolve(a, how) {
      unread = unread.filter(function (x) { return x !== a; });
      fresh = { time: clock(), title: a.title, how: how, who: "홍길동" };
      done.unshift(fresh);
      render();
      tellAi(severityNow());
    }

    return {
      render: function () {
        unread = level === "normal" ? [] : alerts2(level);
        fresh = null;
        render();
        tellAi(level);
      },
      list: function () { return unread.slice(); },
      resolve: resolve
    };
  })();

  // ------------------------------------------------------------------
  // 알림 상세보기 모달 (시안 2)
  // ------------------------------------------------------------------
  var detail = (function () {
    var scrim = $("[data-alert-detail]");
    if (!scrim) { return { open: function () {} }; }

    var current = null;
    var back = null;
    var frame = $("[data-ad-frame]", scrim);
    var steps = $$("[data-ad-step]", scrim);
    var sevBadge = $("[data-ad-sev]", scrim);
    var pin = $("[data-ad-pin]", scrim);
    var mapCanvas = $("[data-ad-map]", scrim);
    var select = $("[data-ad-select]", scrim);

    function fill(key, value) {
      $$("[data-ad='" + key + "']", scrim).forEach(function (n) { n.textContent = value; });
    }

    function drawBoxes(a) {
      $$(".ad-box, .ad-box-label", frame).forEach(function (n) { n.remove(); });
      a.boxes.forEach(function (b) {
        var box = el("span", "ad-box" + (b.hit ? " is-hit" : ""));
        box.style.setProperty("--x", b.bx + "px");
        box.style.setProperty("--y", b.by + "px");
        box.style.setProperty("--w", b.bw + "px");
        box.style.setProperty("--h", b.bh + "px");
        var label = el("span", "ad-box-label" + (b.hit ? " is-hit" : ""), b.label);
        label.style.setProperty("--x", b.x + "px");
        label.style.setProperty("--y", b.y + "px");
        frame.appendChild(box);
        frame.appendChild(label);
      });
    }

    function setOpen(step, on) {
      step.classList.toggle("is-open", on);
      var toggle = $("[data-ad-toggle]", step);
      toggle.setAttribute("aria-expanded", on ? "true" : "false");
      $(".ad-body", step).hidden = !on;
      if (on && step.getAttribute("data-ad-step") === "2") { snapMap(); }
    }

    // ② 작은 지도 — 뒤 3D 지도 캔버스에서 로봇 둘레를 잘라 옮긴다(map.js 가 data-map-keep 로 판을 남겨 둔다).
    function snapMap() {
      var src = $("[data-map-scene]");
      if (!src || !mapCanvas) { return; }
      var box = mapCanvas.getBoundingClientRect();
      var ratio = window.devicePixelRatio || 1;
      mapCanvas.width = Math.round(box.width * ratio);
      mapCanvas.height = Math.round(box.height * ratio);
      var ctx = mapCanvas.getContext("2d");
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--bg-canvas") || "#070a10";
      ctx.fillRect(0, 0, mapCanvas.width, mapCanvas.height);

      var srcBox = src.getBoundingClientRect();
      if (!srcBox.width || !src.width) { return; }
      var dot = $(".map-bot:not([hidden]) .map-bot-dot");
      var cx = srcBox.left + srcBox.width / 2;
      var cy = srcBox.top + srcBox.height / 2;
      if (dot) {
        var d = dot.getBoundingClientRect();
        cx = d.left + d.width / 2;
        cy = d.top + d.height / 2;
      }
      var ZOOM = 1.6;
      var scale = src.width / srcBox.width;
      var sw = box.width / ZOOM * scale;
      var sh = box.height / ZOOM * scale;
      var sx = (cx - srcBox.left) * scale - sw / 2;
      var sy = (cy - srcBox.top) * scale - sh / 2;
      try {
        ctx.drawImage(src, sx, sy, sw, sh, 0, 0, mapCanvas.width, mapCanvas.height);
      } catch (e) { /* 지도가 아직 안 떴다 — 빈 판으로 둔다 */ }
    }

    function open(a, from) {
      current = a;
      back = from || null;
      fill("evTitle", a.evTitle);
      fill("model", a.model);
      fill("cam", a.cam);
      fill("judge", a.judge);
      fill("judgeDesc", a.judgeDesc);
      fill("sevText", a.sev === "critical" ? "위험" : "주의");
      fill("wp", a.wp);
      fill("wpName", a.wpName);
      fill("wpSub", a.wpSub);
      fill("near", a.near);
      fill("recent", a.recent);
      fill("now", "지금 · " + clock() + " KST");
      fill("left", Math.max(0, side2.list().length - 1));
      sevBadge.classList.toggle("is-critical", a.sev === "critical");
      pin.classList.toggle("is-critical", a.sev === "critical");
      drawBoxes(a);
      steps.forEach(function (s) { setOpen(s, false); });

      scrim.hidden = false;
      if (app) { app.inert = true; }
      var first = $("[data-ad-toggle]", scrim);
      if (first) { first.focus(); }
    }

    function close() {
      scrim.hidden = true;
      if (app) { app.inert = false; }
      if (back && back.isConnected && back.focus) { back.focus(); }
      current = null;
    }

    steps.forEach(function (step) {
      $("[data-ad-toggle]", step).addEventListener("click", function () {
        setOpen(step, !step.classList.contains("is-open"));
      });
    });

    // 조치 내용 드롭다운 — screen.js 의 Select 와 같은 모양이지만 모달이 나중에 열려서 여기서 묶는다.
    if (select) {
      var trigger = $("[data-ad-select-trigger]", select);
      var menu = $(".field-menu", select);
      var value = $("[data-ad-select-value]", select);
      trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        var on = menu.hidden;
        menu.hidden = !on;
        trigger.setAttribute("aria-expanded", on ? "true" : "false");
        if (on) { select.setAttribute("data-open", ""); } else { select.removeAttribute("data-open"); }
      });
      $$(".field-option", menu).forEach(function (opt) {
        opt.addEventListener("click", function () {
          value.textContent = opt.textContent;
          $$(".field-option", menu).forEach(function (o) { o.removeAttribute("aria-selected"); });
          opt.setAttribute("aria-selected", "true");
          menu.hidden = true;
          select.removeAttribute("data-open");
          trigger.setAttribute("aria-expanded", "false");
        });
      });
      scrim.addEventListener("click", function (event) {
        if (!select.contains(event.target)) {
          menu.hidden = true;
          select.removeAttribute("data-open");
          trigger.setAttribute("aria-expanded", "false");
        }
      });
    }

    $("[data-ad-confirm]", scrim).addEventListener("click", function () {
      if (!current) { return; }
      var how = $("[data-ad-select-value]", scrim).textContent;
      var a = current;
      close();
      side2.resolve(a, how);
    });

    $("[data-ad-next]", scrim).addEventListener("click", function () {
      var rest = side2.list().filter(function (x) { return x !== current; });
      if (rest.length) { open(rest[0], back); } else { close(); }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !scrim.hidden) { close(); }
    });

    $("[data-ad-close]", scrim).addEventListener("click", close);

    return { open: open };
  })();

  // ==================================================================
  // 검토용 단계 바
  // ==================================================================
  function paintReview() {
    if (!reviewBar) { return; }
    $$("[data-review-stage]", reviewBar).forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-review-stage") === stage ? "true" : "false");
    });
    $$("[data-review-level]", reviewBar).forEach(function (b) {
      b.setAttribute("aria-pressed", stage === "monitor" && b.getAttribute("data-review-level") === body.getAttribute("data-level") ? "true" : "false");
      b.disabled = stage !== "monitor";
    });
  }

  if (reviewBar) {
    if (/[?&]review=0\b/.test(window.location.search)) { reviewBar.hidden = true; }
    reviewBar.addEventListener("click", function (event) {
      var b = event.target.closest("button");
      if (!b) { return; }
      if (b.hasAttribute("data-review-stage")) {
        var s = b.getAttribute("data-review-stage");
        if (s === "monitor" && stage !== "monitor") { setLevel("normal"); }
        setStage(s);
      }
      if (b.hasAttribute("data-review-level")) { setLevel(b.getAttribute("data-review-level")); }
    });
  }

  // 주소로 바로 열기 — #precheck · #monitor · #warning · #critical
  // 시안 2 는 #warning-detail · #critical-detail 로 알림 상세를 ②③ 까지 펼친 채 연다(검토 · 캡처용).
  var hash = (window.location.hash || "").replace("#", "");
  var wantDetail = /-detail$/.test(hash);
  hash = hash.replace(/-detail$/, "");
  if (hash === "warning" || hash === "critical") {
    setStage("monitor");
    setLevel(hash);
    if (wantDetail && SIAN === 2) {
      window.setTimeout(function () {
        detail.open(side2.list()[0], null);
        $$("[data-alert-detail] [data-ad-toggle]").forEach(function (t) { t.click(); });
      }, 1500);
    }
  } else if (hash === "monitor") {
    setStage("monitor");
    setLevel("normal");
  } else {
    setStage(hash === "precheck" ? "precheck" : "setup");
    level = "normal";
  }
})();
