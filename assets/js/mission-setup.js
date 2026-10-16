/*
 * 미션 설정 — 점검항목 · 방문 순서 · 실행 로봇이 요약을 움직인다.
 *
 * 여기서 고치는 것은 셋이고, 셋이 다 같은 셈을 건드린다.
 *   · 점검항목을 끄면  → 그 자리를 건너뛰고 길이 다음 자리로 이어진다
 *   · 순서를 바꾸면    → 자리 사이 거리가 달라진다 (가까운 순서로 돌면 짧아진다)
 *   · 로봇을 바꾸면    → 배터리가 달라지고, 충전소 밖에 있으면 출발 전 구간이 더 붙는다
 * 그래서 소요시간 · Way-point 수 · 배터리가 한 셈에서 같이 나온다. 하나만 고치면 서로 어긋난다.
 *
 * 거리 — 지도(map.js)의 3D 길은 층 전체를 도는 미리 짜인 고리라 "고른 자리만 잇는 길" 을
 * 되묻을 수 없다. 그래서 거리는 아래 평면 그래프에서 따로 센다. 지도에 그리는 선이 아니라
 * 시간과 배터리를 셈하기 위한 자(尺)다. 1칸 = 2 m, 최단 경로는 다익스트라.
 *
 * 줄 자체가 role="checkbox" 라 그 안의 [지도]·[손잡이] 단추는 클릭을 가로챈다 —
 * 알림 센터의 줄(.ac-row)이 [보고서] 를 품는 방법과 같다.
 */
(function () {
  "use strict";

  var plan = document.querySelector("[data-mp-plan]");
  if (!plan) { return; }

  var list = plan.querySelector("[data-mp-list]");
  var countEl = plan.querySelector("[data-mp-count]");
  var resetBtn = plan.querySelector("[data-mp-reset]");
  var timeEl = document.querySelector("[data-mp-time]");
  var wpEl = document.querySelector("[data-mp-wp]");
  var batState = document.querySelector("[data-mp-bat-state]");
  var batBar = document.querySelector("[data-mp-bat-bar]");
  var batNow = document.querySelector("[data-mp-bat-now]");
  var batNote = document.querySelector("[data-mp-bat-note]");
  var cta = document.querySelector("[data-mp-cta]");

  function $$(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ================================================================
   * 자(尺) — 평면 그래프
   * ================================================================ */
  var METER = 2;        // 평면 1칸 = 2 m
  var SPEED = 0.5;      // m/s — 로봇의 순회 속도
  var RESERVE = 20;     // 복귀 예비 %. 이만큼은 남겨 두어야 스스로 충전소로 돌아온다
  var MOVE_RATE = 1.3;  // 이동 중 소모 %/분
  var INSP_RATE = 0.9;  // 점검 중 소모 %/분 (멈춰서 재기만 하니 이동보다 덜 쓴다)

  // D = 충전 스테이션(출발·복귀). n* 는 통로가 갈라지는 자리다.
  // 웨이포인트는 미션 모니터링과 같은 것이다(2026-10-16 디자이너) — 지도(map.js) ROBOT 01 의 WP-01 ~ 04,
  // 이름도 모니터링 타임라인(screen.js)과 같다. 좌표는 APRISM_ROUTE.report() 의 도면 좌표(m)를 칸(2 m)으로 나눈 값.
  //   D (43.5, 40) · WP-01 (25.5, 40) · WP-02 (8, 40.5) · WP-03 (3.5, 25) · WP-04 (3.5, 17)
  // 통로는 모니터링의 한 바퀴를 따라 D → WP-01 → 02 → 03 → 04 로 이어진다. n7 은 ROBOT 01 이 돌아오는 길 위의 자리.
  var NODES = {
    "D": [21.75, 20], "n7": [27, 20],
    "WP-01": [12.75, 20], "WP-02": [4, 20.25], "n2": [1.75, 20.25],
    "WP-03": [1.75, 12.5], "WP-04": [1.75, 8.5]
  };
  var LINKS = [
    ["n7", "D"], ["D", "WP-01"], ["WP-01", "WP-02"], ["WP-02", "n2"], ["n2", "WP-03"], ["WP-03", "WP-04"]
  ];

  var ADJ = {};
  LINKS.forEach(function (pair) {
    var a = pair[0], b = pair[1];
    var d = Math.hypot(NODES[a][0] - NODES[b][0], NODES[a][1] - NODES[b][1]);
    (ADJ[a] = ADJ[a] || []).push([b, d]);
    (ADJ[b] = ADJ[b] || []).push([a, d]);
  });

  // 자리 수가 열 몇 개뿐이라 매번 다익스트라를 돌려도 되지만, 끄는 동안 매 프레임 불리므로 한 번만 센다.
  var SPAN = {};
  (function () {
    Object.keys(NODES).forEach(function (from) {
      var dist = {}, left = Object.keys(NODES).slice();
      dist[from] = 0;
      while (left.length) {
        var pick = -1;
        left.forEach(function (k, i) {
          if (dist[k] !== undefined && (pick < 0 || dist[k] < dist[left[pick]])) { pick = i; }
        });
        if (pick < 0) { break; }
        var u = left.splice(pick, 1)[0];
        (ADJ[u] || []).forEach(function (step) {
          var v = step[0], nd = dist[u] + step[1];
          if (dist[v] === undefined || nd < dist[v]) { dist[v] = nd; }
        });
      }
      SPAN[from] = dist;
    });
  })();

  function span(a, b) { return (SPAN[a] && SPAN[a][b]) || 0; }

  /* ================================================================
   * 로봇 — 이름 · 배터리 · 지금 서 있는 자리
   * 충전소(D) 밖에 있으면 미션을 시작하기 전에 거기까지 가는 구간이 먼저 붙는다.
   * ROBOT 01 은 순회에서 돌아오는 길이라 통로 한가운데(n7)에 있고 배터리가 적다 —
   * 배터리가 모자라 못 떠나는 경우를 실제로 눌러 볼 수 있어야 이 셈이 보인다.
   * ================================================================ */
  var ROBOTS = {
    "ROBOT 01": { bat: 31, at: "n7" },
    "ROBOT 02": { bat: 82, at: "D" },
    "ROBOT 03": { bat: 91, at: "D" }
  };

  function robotNow() {
    var box = document.querySelector("[data-mp-robot]") ||
      (function () {
        var found = null;
        $$("[data-select]").forEach(function (sel) {
          var label = sel.querySelector("[data-select-trigger]");
          var id = label && label.getAttribute("aria-labelledby");
          if (id && /robot/i.test(id)) { found = sel; }
        });
        return found;
      })();
    var value = box && box.querySelector("[data-select-value]");
    var text = value ? value.textContent : "";
    var key = (text.match(/ROBOT\s*\d+/i) || ["ROBOT 02"])[0].toUpperCase();
    return { key: key, spec: ROBOTS[key] || ROBOTS["ROBOT 02"] };
  }

  /* ================================================================
   * 상태 — 원본 순서는 처음 마크업 그대로다. 되돌리기가 돌아갈 자리.
   * ================================================================ */
  var WPS = $$(".check-row", list).map(function (row) {
    return {
      id: row.getAttribute("data-wp"),
      dwell: Number(row.getAttribute("data-dwell")) || 0,
      text: row.querySelector("span").textContent.trim()
    };
  });
  var BY_ID = {};
  WPS.forEach(function (w) { BY_ID[w.id] = w; });

  var FIRST = WPS.map(function (w) { return w.id; });
  var order = FIRST.slice();
  var on = {};
  FIRST.forEach(function (id) { on[id] = true; });

  function chosen(ord) { return (ord || order).filter(function (id) { return on[id]; }); }
  function reordered() {
    return order.some(function (id, i) { return id !== FIRST[i]; });
  }

  /* ================================================================
   * 셈 — 한 번 돌고 오는 데 걸리는 시간과 쓰는 배터리
   * ================================================================ */
  function trip(ids, spec) {
    var hops = ["D"].concat(ids).concat(["D"]);
    var units = 0;
    // 충전소 밖에 서 있으면 거기까지 먼저 간다.
    if (spec.at !== "D") { units += span(spec.at, "D"); }
    if (ids.length) {
      for (var i = 0; i < hops.length - 1; i += 1) { units += span(hops[i], hops[i + 1]); }
    }
    var moveSec = (units * METER) / SPEED;
    var inspSec = ids.reduce(function (sum, id) { return sum + BY_ID[id].dwell; }, 0);
    return { moveSec: moveSec, inspSec: inspSec, sec: moveSec + inspSec };
  }

  function power(ids, spec) {
    var t = trip(ids, spec);
    var use = (t.moveSec / 60) * MOVE_RATE + (t.inspSec / 60) * INSP_RATE;
    var left = spec.bat - use;
    return {
      use: use,
      left: left,
      state: left < RESERVE ? "no" : left < RESERVE + 10 ? "low" : "ok"
    };
  }

  /* ================================================================
   * 그리기
   * ================================================================ */
  var ICON_PIN = '<span class="i" style="--i:var(--ic-map-pin)" aria-hidden="true"></span>';
  var ICON_GRIP = '<span class="i" style="--i:var(--ic-grip)" aria-hidden="true"></span>';
  var ICON_CHECK = '<span class="i" style="--i:var(--ic-check)" aria-hidden="true"></span>';

  function drawList() {
    var nth = 0;
    list.innerHTML = order.map(function (id) {
      var w = BY_ID[id];
      var yes = on[id];
      if (yes) { nth += 1; }
      return '<div class="check-row" role="checkbox" aria-checked="' + (yes ? "true" : "false") +
        '" tabindex="0" data-wp="' + id + '" data-dwell="' + w.dwell + '">' +
        '<span class="check-ord" title="방문 순서">' + (yes ? nth : "") + "</span>" +
        '<span class="check-text">' + w.text + "</span>" +
        '<span class="check-skip t-caption">건너뜀</span>' +
        '<button type="button" class="check-act" data-mp-locate aria-label="' + id +
          ' 지도에서 보기" title="지도에서 보기">' + ICON_PIN + "</button>" +
        '<button type="button" class="check-act check-grip" data-mp-grip aria-label="' + id +
          ' 순서 바꾸기. 위아래 화살표로 옮깁니다" title="끌어서 순서 바꾸기">' + ICON_GRIP + "</button>" +
        '<span class="check-box">' + ICON_CHECK + "</span>" +
        "</div>";
    }).join("");
  }

  // 끄는 동안에는 줄을 새로 그릴 수 없다(끌고 있는 바로 그 줄이 사라진다) — 번호만 고쳐 끼운다.
  function drawOrd() {
    var nth = 0;
    order.forEach(function (id) {
      if (on[id]) { nth += 1; }
      var row = list.querySelector('.check-row[data-wp="' + id + '"] .check-ord');
      if (row) { row.textContent = on[id] ? nth : ""; }
    });
  }

  var lastMin = null, lastCount = null;

  function flash(node) {
    if (!node) { return; }
    node.classList.remove("is-changed");
    void node.offsetWidth;
    node.classList.add("is-changed");
  }

  function drawSummary() {
    var ids = chosen();
    var bot = robotNow();
    var n = ids.length;

    if (countEl) { countEl.textContent = n + "개 선택"; }
    if (resetBtn) { resetBtn.hidden = !reordered(); }

    // 소요시간 — 아무것도 안 고르면 셀 것이 없다.
    var min = Math.round(trip(ids, bot.spec).sec / 60);
    var was = Math.round(trip(FIRST, bot.spec).sec / 60);
    if (timeEl) {
      timeEl.innerHTML = n
        ? (min !== was ? '<s class="was">' + was + "분</s>" : "") + "약 " + min + "분"
        : "—";
      if (lastMin !== null && lastMin !== min) { flash(timeEl); }
    }
    lastMin = n ? min : null;

    if (wpEl) {
      wpEl.textContent = n + "개";
      if (lastCount !== null && lastCount !== n) { flash(wpEl); }
    }
    lastCount = n;

    drawBattery(ids, bot);

    if (cta) {
      var p = power(ids, bot.spec);
      var blocked = !n || p.state === "no";
      cta.disabled = blocked;
      cta.textContent = !n ? "점검항목을 1개 이상 골라 주세요"
        : p.state === "no" ? "배터리가 모자라 시작할 수 없어요"
        : "사전 점검 시작";
    }
  }

  function drawBattery(ids, bot) {
    if (!batBar) { return; }
    var spec = bot.spec;
    if (batNow) { batNow.textContent = "현재 " + bot.key + " " + spec.bat + "%"; }

    if (!ids.length) {
      if (batState) { batState.innerHTML = "—"; }
      batBar.className = "mp-bat-bar";
      batBar.querySelector(".rest").style.width = spec.bat + "%";
      batBar.querySelector(".use").style.cssText = "left:" + spec.bat + "%;width:0%";
      batBar.querySelector(".mark").style.left = RESERVE + "%";
      if (batNote) { batNote.className = "mp-bat-note t-caption"; batNote.innerHTML = "고른 점검항목이 없어요."; }
      return;
    }

    var p = power(ids, spec);
    var left = Math.max(0, Math.min(spec.bat, p.left));
    var used = spec.bat - left;

    if (batState) {
      var word = { ok: "수행 가능", low: "여유 부족", no: "수행 불가" }[p.state];
      var tone = { ok: "badge-normal", low: "badge-warning", no: "badge-danger" }[p.state];
      batState.innerHTML = '<span class="badge ' + tone + ' t-caption">' +
        '<span class="badge-dot" aria-hidden="true"></span>' + word + "</span>";
    }

    batBar.className = "mp-bat-bar" + (p.state === "ok" ? "" : " is-" + p.state);
    batBar.setAttribute("aria-label",
      "현재 " + spec.bat + "%, 이 미션 예상 소모 " + Math.round(p.use) + "%, 복귀 예비 " + RESERVE + "%");
    batBar.querySelector(".rest").style.width = left + "%";
    batBar.querySelector(".use").style.cssText = "left:" + left + "%;width:" + used + "%";
    batBar.querySelector(".mark").style.left = RESERVE + "%";

    if (batNote) {
      batNote.className = "mp-bat-note t-caption" + (p.state === "ok" ? "" : " is-" + p.state);
      batNote.innerHTML = p.state === "no"
        ? "복귀 예비 " + RESERVE + "%를 남기려면 약 <b>" + Math.ceil(RESERVE - p.left) +
          "%</b>가 더 필요해요. 점검항목을 줄이거나 다른 로봇을 골라 주세요."
        : p.state === "low"
        ? "끝나면 약 <b>" + Math.round(p.left) + "%</b>가 남아요. 복귀 예비 " + RESERVE + "%에 가까워 여유가 적어요."
        : "예상 소모 약 <b>" + Math.round(p.use) + "%</b>, 끝나면 약 <b>" + Math.round(p.left) + "%</b>가 남아요.";
    }
  }

  /*
   * 지도에 계획을 넘긴다 — 지도는 이 차례대로 도커에서 떠나 도커로 돌아오는 길을 다시 찾는다(map.js).
   * 끈 자리도 같이 보낸다. 지도에서 아예 지워 버리면 "안 가기로 했다" 가 아니라 "없다" 로 읽힌다.
   */
  // 설정 단계일 때만 알린다. 사전 점검 · 모니터링에서는 지도가 우측 타임라인을 원본으로 쓴다
  // (같은 판을 쓰는 사전 점검 화면은 [취소] 로 설정으로 돌아올 수 있다).
  function inSetup() {
    var now = document.body.getAttribute("data-stage");
    return !now || now === "setup";
  }

  function tellMap() {
    if (!inSetup()) { return; }
    var names = {};
    WPS.forEach(function (w) { names[w.id] = w.text; });
    document.dispatchEvent(new CustomEvent("aprism:mission-plan", {
      detail: {
        stops: chosen(),
        skip: order.filter(function (id) { return !on[id]; }),
        names: names
      }
    }));
  }

  function draw() { drawList(); drawSummary(); tellMap(); }

  /* ================================================================
   * 손놀림
   * ================================================================ */
  function toggle(id) {
    on[id] = !on[id];
    draw();
  }

  list.addEventListener("click", function (event) {
    var act = event.target.closest("[data-mp-locate]");
    if (act) {
      // 지도에 "이 자리를 보여 달라" 고 알린다 — 지도가 카메라를 데려가고 그 점에 고리를 두른다(map.js).
      var id = act.closest(".check-row").getAttribute("data-wp");
      document.dispatchEvent(new CustomEvent("aprism:waypoint", { detail: { id: id, from: "panel" } }));
      return;
    }
    if (event.target.closest("[data-mp-grip]")) { return; }
    var row = event.target.closest(".check-row");
    if (row) { toggle(row.getAttribute("data-wp")); }
  });

  /*
   * 짚기 — 줄에 손을 얹으면 지도의 그 자리와 앞뒤 구간이 밝아진다. 반대쪽도 같다(map.js).
   * 고르는 것(체크)과는 다른 일이라 상태를 따로 둔다 — 손만 지나가도 계획이 바뀌면 안 된다.
   */
  function hover(id) {
    document.dispatchEvent(new CustomEvent("aprism:mission-hover", {
      detail: { id: id, from: "panel" }
    }));
  }

  list.addEventListener("pointerover", function (event) {
    if (drag) { return; }
    var row = event.target.closest(".check-row");
    hover(row ? row.getAttribute("data-wp") : null);
  });
  list.addEventListener("pointerleave", function () { if (!drag) { hover(null); } });
  list.addEventListener("focusin", function (event) {
    var row = event.target.closest(".check-row");
    if (row) { hover(row.getAttribute("data-wp")); }
  });

  // 지도 쪽에서 짚었다 — 같은 줄을 밝힌다.
  document.addEventListener("aprism:mission-hover", function (event) {
    if (!event.detail || event.detail.from !== "map") { return; }
    var id = event.detail.id;
    $$(".check-row", list).forEach(function (row) {
      row.classList.toggle("is-hot", row.getAttribute("data-wp") === id);
    });
  });

  // 지도의 번호를 눌렀다 — 그 줄로 데려간다.
  document.addEventListener("aprism:mission-pick", function (event) {
    var row = event.detail && list.querySelector('.check-row[data-wp="' + event.detail.id + '"]');
    if (!row) { return; }
    row.focus();
    if (row.scrollIntoView) { row.scrollIntoView({ block: "nearest", behavior: "smooth" }); }
  });

  list.addEventListener("keydown", function (event) {
    var grip = event.target.closest("[data-mp-grip]");
    if (grip && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      move(grip.closest(".check-row").getAttribute("data-wp"), event.key === "ArrowUp" ? -1 : 1, true);
      return;
    }
    if (grip) { return; }
    var row = event.target.closest(".check-row");
    if (row && (event.key === " " || event.key === "Enter")) {
      event.preventDefault();
      toggle(row.getAttribute("data-wp"));
      var again = list.querySelector('.check-row[data-wp="' + row.getAttribute("data-wp") + '"]');
      if (again) { again.focus(); }
    }
  });

  function move(id, step, keepFocus) {
    var i = order.indexOf(id), j = i + step;
    if (j < 0 || j >= order.length) { return; }
    order.splice(i, 1);
    order.splice(j, 0, id);
    draw();
    mark(id);
    if (keepFocus) {
      var grip = list.querySelector('.check-row[data-wp="' + id + '"] [data-mp-grip]');
      if (grip) { grip.focus(); }
    }
  }

  // 놓은 자리를 한 번 짚어 준다 — 줄이 제자리로 돌아가고 나면 어디에 떨궜는지 놓치기 쉽다.
  function mark(id) {
    var row = list.querySelector('.check-row[data-wp="' + id + '"]');
    if (!row) { return; }
    row.classList.remove("is-moved");
    void row.offsetWidth;
    row.classList.add("is-moved");
  }

  /*
   * 끌어 옮기기 — 잡은 줄만 손끝을 따라가고, 비켜설 줄은 한 칸(줄 높이)씩 밀린다.
   * 놓기 전까지 목록을 다시 그리지 않는다. 대신 요약과 번호는 끄는 동안에도 따라 바뀐다 —
   * "여기 놓으면 20분" 을 손을 떼기 전에 봐야 순서를 고를 수 있다.
   */
  var drag = null;

  list.addEventListener("pointerdown", function (event) {
    var grip = event.target.closest("[data-mp-grip]");
    if (!grip || event.button !== 0) { return; }
    event.preventDefault();
    var row = grip.closest(".check-row");
    var rows = $$(".check-row", list);
    drag = {
      row: row, rows: rows, from: rows.indexOf(row), to: rows.indexOf(row),
      h: row.offsetHeight, y0: event.clientY,
      id: row.getAttribute("data-wp"), base: order.slice()
    };
    try { grip.setPointerCapture(event.pointerId); } catch (err) { /* 못 잡아도 move 는 받는다 */ }
    list.classList.add("is-sorting");
    row.classList.add("is-dragging");
  });

  list.addEventListener("pointermove", function (event) {
    if (!drag) { return; }
    var top = -drag.from * drag.h;
    var bottom = (drag.rows.length - 1 - drag.from) * drag.h;
    var dy = Math.max(top, Math.min(bottom, event.clientY - drag.y0));
    drag.row.style.transform = "translateY(" + dy + "px)";

    var to = Math.max(0, Math.min(drag.rows.length - 1, Math.round(drag.from + dy / drag.h)));
    if (to === drag.to) { return; }
    drag.to = to;
    drag.rows.forEach(function (other, i) {
      if (other === drag.row) { return; }
      var shift = 0;
      if (drag.from < to && i > drag.from && i <= to) { shift = -drag.h; }
      if (drag.from > to && i < drag.from && i >= to) { shift = drag.h; }
      other.style.transform = shift ? "translateY(" + shift + "px)" : "";
    });

    var next = drag.base.slice();
    next.splice(next.indexOf(drag.id), 1);
    next.splice(to, 0, drag.id);
    order = next;
    drawOrd();
    drawSummary();
    tellMap();
  });

  function drop() {
    if (!drag) { return; }
    var id = drag.id;
    drag = null;
    list.classList.remove("is-sorting");
    draw();
    mark(id);
  }

  list.addEventListener("pointerup", drop);
  list.addEventListener("pointercancel", drop);

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      order = FIRST.slice();
      draw();
    });
  }

  // 실행 로봇이 바뀌었다 — 배터리도 출발 전 구간도 달라진다(screen.js 가 알린다).
  document.addEventListener("aprism:select", function () {
    lastMin = null;
    drawSummary();
  });

  // 단계가 설정으로 돌아오면 계획을 다시 알린다.
  if (window.MutationObserver) {
    new MutationObserver(function () { if (inSetup()) { tellMap(); } })
      .observe(document.body, { attributes: true, attributeFilter: ["data-stage"] });
  }

  draw();
})();
