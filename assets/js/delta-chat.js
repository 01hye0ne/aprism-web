/*
 * Delta 대화 — 펼친 창의 설명 칸이 대화창이 된다 (v2.2 · 2026-10-13 시안, 답은 정해 둔 가짜다).
 *
 *   · 묻기 칸에서 보내면 창이 .is-chat 이 된다. 설명 문장은 Delta 의 첫 메시지로 남고 그 아래로 대화가 쌓인다.
 *   · 제목 줄(지금 상황 요약)은 고정이다. 고정 조치 줄은 숨기고, 조치는 마지막 답 아래 칩으로 따라 내려간다.
 *   · 답 안의 칩은 화면과 이어진다 — 누르면 알림 쪽지가 열리거나 목록이 걸러진다.
 *   · 창은 아래 변을 그대로 두고 위로 자란다. 지도 높이의 60% 에서 멈추고 그다음은 안에서 스크롤된다(CSS).
 *   · 대화 중에 단계가 바뀌면 덮어쓰지 않고 시스템 한 줄을 끼운다. 창을 닫았다 열어도 대화는 남고, 관제사가 교대하면 지운다.
 *   · 답을 기다리는 동안 Delta 아이콘 점이 하얗게 차례로 숨 쉰다(.is-thinking) — 주의 · 위험의 깜빡임과 색이 다르다.
 */
(function () {
  "use strict";

  var body = document.body;
  if (!body.classList.contains("v2-2")) { return; }

  var win = document.querySelector("[data-delta3]");
  var box = document.querySelector("#ai-ask");
  var input = document.querySelector("[data-ai-ask]");
  var send = box && box.querySelector(".ai-send");
  var bodyBox = win && win.querySelector(".delta3-body");
  var first = bodyBox && bodyBox.querySelector(".ai-line-2");
  if (!win || !box || !input || !bodyBox || !first) { return; }

  var thread = null;
  var busy = false;

  // 입력 칸을 설명 칸(대화 칸) 안 아래로 옮긴다 — 상자 하나 안에서 1px 선으로만 나뉜다(10/13 디자이너, 네모 안의 네모를 없앤다).
  bodyBox.appendChild(box);
  // 조치 버튼도 설명 문장 바로 아래로 — 대화 때 답 아래 칩과 같은 자리(10/13). 입력 칸은 늘 열어 둔다.
  var acts = win.querySelector("[data-ai-actions]");
  if (acts) { bodyBox.insertBefore(acts, box); }
  box.hidden = false;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text) { n.textContent = text; }
    return n;
  }

  // 창은 아래 변을 두고 위로 자란다 — 바꾸기 전 아래 변을 재 두었다가 바꾼 뒤 위치를 다시 잡는다.
  function grow(change) {
    var bottom = win.offsetTop + win.offsetHeight;
    change();
    if (!win.classList.contains("is-open")) { return; }
    win.style.top = Math.max(8, bottom - win.offsetHeight) + "px";
  }

  function scrollEnd() { if (thread) { thread.scrollTop = thread.scrollHeight; } }

  function start() {
    if (thread) { return; }
    grow(function () {
      thread = el("div", "dc-thread");
      thread.setAttribute("role", "log");
      thread.setAttribute("aria-live", "polite");
      // 접힘 두 줄이 대화의 첫 말로 남는다(v5 는 줄마다 감싸 data-raw 에 원문이 있다)
      thread.appendChild(aiMsg((first.getAttribute("data-raw") || first.textContent).replace(/\n/g, " "), []));
      bodyBox.insertBefore(thread, box);
      win.classList.add("is-chat");
    });
    hint();
  }

  function aiMsg(text, chips) {
    var m = el("div", "dc-msg is-ai");
    m.appendChild(el("p", null, text));
    if (chips && chips.length) {
      var row = el("div", "dc-chips");
      chips.forEach(function (c) {
        var b = el("button", "btn is-xs dc-chip" + (c.go ? " is-go" : ""), c.label);
        b.type = "button";
        b.addEventListener("click", function () { c.act ? c.act() : ask(c.label); });
        row.appendChild(b);
      });
      m.appendChild(row);
    }
    return m;
  }

  function add(node) {
    grow(function () {
      // 조치 칩은 마지막 답에만 둔다 — 지난 답의 칩은 걷는다(화면 잇기 칩은 남긴다).
      if (node.classList.contains("is-ai")) {
        Array.prototype.forEach.call(thread.querySelectorAll(".dc-chip:not(.is-go)"), function (b) { b.remove(); });
      }
      thread.appendChild(node);
    });
    scrollEnd();
  }

  // ---------- 화면과 잇는 일 ----------
  function openCritical() {
    var item = document.querySelector("[data-ah-list] .ah-item.is-critical");
    // 창을 먼저 접는다 — 펼친 창이 지도 가운데에 떠 있어 팝오버를 가렸다(10/20). 대화는 남는다.
    var tg = document.querySelector("[data-ai-toggle]");
    if (tg && win.classList.contains("is-open")) { tg.click(); }
    if (item && item.getAttribute("aria-pressed") !== "true") { item.click(); }
  }
  function filterTo(sev) {
    var b = document.querySelector("[data-ah-filter='" + sev + "']");
    if (b) { b.click(); }
  }

  // ---------- 정해 둔 답 ----------
  // 건수는 Delta 판단(monitor.js APRISM_DELTA_COUNT · 전체 미션)에서 읽는다 — 조치 버튼 숫자와 같아야 한다(10/20).
  function count() { return window.APRISM_DELTA_COUNT || { crit: 1, warn: 5, total: 6 }; }
  function reply(q) {
    var n = count();
    if (/위험|NG|터빈|압력|조치/.test(q)) {
      return {
        text: "지하발전소 B3 터빈 2 의 N₂ 배관 압력계(WP-04)에서 Spiral Casing 압력이 90 으로 기준 87 을 넘었어요. 최근 3회 측정이 잇달아 올랐습니다. 현장 무전으로 작업을 멈추고 점검을 요청하는 것을 권해요.",
        chips: [
          { label: "WP-04 지도에서 보기", go: true, act: openCritical },
          { label: "현장 무전 연락 요청" },
          { label: "재측정 후 판단" }
        ]
      };
    }
    if (/주의|묶|추세/.test(q)) {
      return {
        text: "주의 " + n.warn + "건이 쌓여 있어요. 냉각수 밸브 누출 · 수배전반 부분방전 · 냉각 펌프 진동 · 공기 압축기 압력 편차가 Robot 05 순회 구간에 몰려 있어, 한 번에 점검 계획을 세우면 이동이 줄어요.",
        chips: [
          { label: "주의만 목록에서 보기", go: true, act: function () { filterTo("warning"); } },
          { label: "점검 계획 초안 만들어 줘" }
        ]
      };
    }
    if (/로봇|robot|배터리|위치/i.test(q)) {
      return {
        text: "이 미션에는 Robot 01 한 대가 배정돼 있어요. 지금 WP-04 를 점검 중이고 배터리는 78% 입니다.",
        chips: [{ label: "Robot 01 다음 지점은?" }]
      };
    }
    if (/요청|계획|초안|연락|재측정/.test(q)) {
      return {
        text: "요청을 정리해 두었어요. 실제 전송은 아직 연결되지 않은 시안입니다 — 화면에서는 확인 처리 전까지 알림이 그대로 남아요.",
        chips: [{ label: "위험 알림 열기", go: true, act: openCritical }]
      };
    }
    return {
      text: "네, 말씀하세요. 지금은 " + (n.crit ? "위험 " + n.crit + "건을 포함해 " : "") + "알림 " + n.total + "건이 쌓여 있어요." + (n.crit ? " 위험 알림부터 보시겠어요?" : ""),
      chips: [
        { label: "위험 알림 설명해 줘" },
        { label: "주의 " + n.warn + "건 묶어서 정리해 줘" }
      ]
    };
  }

  /*
   * v5 — 펼침 대화의 답(10/30 디자이너 "Delta 라이팅 시스템" 8 · 9).
   *   답은 세 칸 — 첫 줄(굵게) 질문에 바로 답하는 한 문장, 가운데 알림 줄이나 근거 글머리(3개 이내), 끝은 단추(최대 2, 채운 단추 하나).
   *   질문으로 맺지 않는다. 문체는 ~요 하나, WP 번호 · 계측 태그 · 가운뎃점은 문장에 쓰지 않는다(알림 쪽지의 몫).
   *   건수는 접힘 위젯 · 왼쪽 목록과 같은 기준(전체 미션). 여러 건은 이 미션 먼저, 다른 미션은 미션 이름을 붙인다.
   *   쓰는 동안 Delta 표식의 네모 셋이 1 → 2 → 3 차례로 켜진다(한 바퀴 1.2초). 첫 줄은 글자가 차례로, 알림 줄과 단추는 한 덩어리씩.
   */
  var V5 = body.classList.contains("ver-5");
  var CALM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function alerts() { return window.APRISM_DELTA_ALERTS || { all: [], mine: [], mission: null, missionOf: function () { return null; } }; }
  function hhmm(t) { return (t || "").slice(0, 5); }
  function robotName(a) { var n = (a.robot || 0) + 1; return "Robot " + (n < 10 ? "0" : "") + n; }
  function label(a) { return a.eq ? a.eq + " " + a.phen : a.title; }
  // 받침 — 숫자 · 단위 끝까지 읽어 고른다(0.86으로 · 250 Pa를)
  function batchim(w) {
    var ch = w.trim().slice(-1), c = ch.charCodeAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) { var b = (c - 0xac00) % 28; return b ? (b === 8 ? "l" : "y") : ""; }
    var D = { "0": "y", "1": "l", "3": "y", "6": "y", "7": "l", "8": "l" };
    return D[ch] || "";
  }
  function euro(w) { var b = batchim(w); return w + (b && b !== "l" ? "으로" : "로"); }
  function eul(w) { return w + (batchim(w) ? "을" : "를"); }
  function floorOf(m, list) {
    var f = (window.APRISM_MISSION_FLOORS || {})[m];
    if (f && f.length) { return f[0]; }
    var a = list.filter(function (x) { return x.floor; })[0];
    return a ? a.floor : "";
  }
  // 질문에 이름이 나온 알림, 없으면 이 미션의 가장 급한 알림
  function target(q, list) {
    var hit = list.filter(function (a) { return a.eq && q.indexOf(a.eq) >= 0; })[0];
    if (hit) { return hit; }
    var A = alerts();
    return A.mine.filter(function (a) { return a.sev === "critical"; })[0] || A.mine[0] || list[0] || null;
  }
  function openA(a) { return function () { if (a && window.APRISM_OPEN_ALERT) { window.APRISM_OPEN_ALERT(a); } }; }
  function replyV5(q) {
    var A = alerts(), n = count();
    var all = A.all || [];
    var top = target(q, all);
    var mapBtn = top ? { label: "지도에서 보기", act: openA(top) } : null;
    var aiBtn = top ? { label: top.btn || "알림 열기", primary: true, act: openA(top) } : null;
    // 인사 · 잡담
    if (/^(안녕|하이|hi|hello)/i.test(q)) {
      return { lead: "안녕하세요. " + (n.crit ? "지금 위험이 " + n.crit + "건 있어요." : n.total ? "지금 알림이 " + n.total + "건 있어요." : "지금은 알림이 없어요."),
        btns: n.total ? [{ label: (n.crit ? "위험 " + n.crit : "알림 " + n.total) + "건 보기", primary: true, act: function () { ask(n.crit ? "위험 몇 개야" : "알림 몇 개야"); } }] : [] };
    }
    // 못 하는 일
    if (/보고서|메일|전송|보내/.test(q)) {
      return { lead: "보내기는 Delta가 할 수 없어요. 보고서 화면에서 보내 주세요.",
        btns: [{ label: "보고서 화면으로", primary: true, act: function () { location.href = "./report-v5.html"; } }] };
    }
    if (!top) { return { lead: "지금은 확인할 알림이 없어요.", btns: [] }; }
    // 이유
    if (/왜|이유|원인|근거/.test(q)) {
      var why = [];
      if (top.trend) { why.push(top.trend); }
      why.push(hhmm(top.time) + " " + robotName(top) + " 측정");
      if (top.fp !== undefined) { why.push("오탐 가능성 " + top.fpLabel + " " + top.fp + "%"); }
      return { lead: top.val ? (top.mname || "측정값") + " " + euro(top.val) + " 기준 " + eul(top.std) + " 넘었어요." : label(top) + (batchim(label(top)) ? "이" : "가") + " 감지됐어요.",
        why: why.slice(0, 3), btns: [aiBtn, { label: "재측정 후 판단", act: openA(top) }] };
    }
    // 위치
    if (/어디|위치/.test(q)) {
      var mm = A.missionOf(top);
      return { lead: (top.floor ? top.floor + " " : "") + (mm ? mm + " 미션의 " : "") + (top.eq || top.title) + (/[가-힣]$/.test(top.eq || "") && batchim(top.eq || "") ? "이에요." : "예요."),
        btns: [{ label: "지도에서 보기", primary: true, act: openA(top) }] };
    }
    // 할 일
    if (/뭐부터|무엇부터|할 일|할일|어떻게|조치/.test(q)) {
      var todo = all.filter(function (a) { return a.sev === "critical"; }).concat(all.filter(function (a) { return a.sev !== "critical"; })).slice(0, 3);
      return { lead: (todo[0].next || (todo[0].btn ? todo[0].btn + "부터 하세요." : "위험 알림부터 보세요.")),
        todo: todo.map(function (a) { return label(a) + ", " + (a.btn || "알림 확인"); }),
        btns: [{ label: todo[0].btn || "알림 열기", primary: true, act: openA(todo[0]) }] };
    }
    // 개수 · 목록(기본) — 위험을 물으면 위험, 주의를 물으면 주의, 아니면 전체
    var sev = /주의|묶|추세/.test(q) ? "warning" : /위험/.test(q) || n.crit ? "critical" : null;
    var pool = all.filter(function (a) { return !sev || a.sev === sev; });
    var mine = pool.filter(function (a) { return A.mine.indexOf(a) >= 0; });
    var rest = pool.filter(function (a) { return A.mine.indexOf(a) < 0; });
    var rows = [], shown = 0;
    function group(title, list) {
      if (!list.length || shown >= 3) { return; }
      rows.push({ grp: title });
      list.forEach(function (a) { if (shown < 3) { rows.push({ a: a }); shown += 1; } });
    }
    group("이 미션: " + floorOf(A.mission, A.mine) + " " + A.mission, mine);
    var byM = {};
    rest.forEach(function (a) { var m = A.missionOf(a) || "기타"; (byM[m] = byM[m] || []).push(a); });
    Object.keys(byM).forEach(function (m) { group("다른 미션: " + floorOf(m, byM[m]) + " " + m, byM[m]); });
    if (pool.length > shown) { rows.push({ more: "나머지 " + (pool.length - shown) + "건은 목록에서 보세요." }); }
    var first = mine[0] || rest[0] || top;
    if (first) { rows.push({ tail: "가장 급한 것은 " + (first.eq || first.title) + (batchim(first.eq || first.title) ? "이에요." : "예요.") }); }
    return { lead: (sev === "critical" ? "위험은 " : sev === "warning" ? "주의는 " : "알림은 ") + pool.length + "건이에요.", rows: rows,
      btns: first ? [{ label: first.btn || "알림 열기", primary: true, act: openA(first) }, { label: "지도에서 보기", act: openA(first) }] : [] };
  }
  // 답 한 덩어리씩 — 첫 줄은 글자가 차례로(45ms), 나머지는 220ms 간격
  function aiMsgV5(r) {
    var m = el("div", "dc-msg is-ai dc-v5");
    var lead = el("p", "dc-lead");
    m.appendChild(lead);
    var blocks = [];
    (r.rows || []).forEach(function (x) {
      if (x.grp) { blocks.push(el("p", "dc-grp", x.grp)); return; }
      if (x.more) { blocks.push(el("p", "dc-more", x.more)); return; }
      if (x.tail) { blocks.push(el("p", "dc-tail", x.tail)); return; }
      var row = el("button", "dc-arow is-" + x.a.sev);
      row.type = "button";
      row.appendChild(el("i"));
      row.appendChild(el("span", null, label(x.a)));
      row.appendChild(el("small", "num", hhmm(x.a.time)));
      row.addEventListener("click", openA(x.a));
      blocks.push(row);
    });
    if (r.why && r.why.length) {
      var ul = el("ul", "dc-why");
      r.why.forEach(function (t) { ul.appendChild(el("li", null, t)); });
      blocks.push(ul);
    }
    if (r.todo && r.todo.length) {
      var ol = el("ol", "dc-todo");
      r.todo.forEach(function (t) { ol.appendChild(el("li", null, t)); });
      blocks.push(ol);
    }
    var btns = (r.btns || []).filter(Boolean).slice(0, 2);
    if (btns.length) {
      var row2 = el("div", "dc-btns");
      btns.forEach(function (c, i) {
        var b = el("button", "btn is-xs " + (c.primary && i === 0 ? "btn-primary" : "btn-secondary"), c.label);
        b.type = "button";
        b.addEventListener("click", c.act || function () { ask(c.label); });
        row2.appendChild(b);
      });
      blocks.push(row2);
    }
    if (CALM) { lead.textContent = r.lead; blocks.forEach(function (b) { m.appendChild(b); }); return m; }
    var chars = Array.from(r.lead);
    chars.forEach(function (ch, i) { setTimeout(function () { lead.textContent += ch; scrollEnd(); }, i * 45); });
    blocks.forEach(function (b, i) {
      setTimeout(function () { grow(function () { m.appendChild(b); }); scrollEnd(); }, chars.length * 45 + 200 + i * 220);
    });
    return m;
  }
  // 쓰는 중 표시 — Delta 표식의 네모 셋(왼쪽 위 → 오른쪽 위 → 왼쪽 아래)
  function typingMark() {
    var s = el("span", "dc-dmark");
    s.setAttribute("aria-label", "Delta가 답을 쓰는 중");
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="r1" x="3" y="3" width="8" height="8" rx="1.2"/><rect class="r2" x="13" y="3" width="8" height="8" rx="1.2"/><rect class="r3" x="3" y="13" width="8" height="8" rx="1.2"/></svg>';
    return s;
  }

  function ask(text) {
    text = (text || "").trim();
    if (!text || busy) { return; }
    start();
    add(el("div", "dc-msg is-me", text));
    busy = true;
    sync();
    win.classList.add("is-thinking");
    var wait = el("div", "dc-msg is-ai is-wait");
    wait.appendChild(V5 ? typingMark() : el("span", "dc-typing"));
    add(wait);
    setTimeout(function () {
      wait.remove();
      win.classList.remove("is-thinking");
      busy = false;
      sync();
      if (V5) { add(aiMsgV5(replyV5(text))); return; }
      var r = reply(text);
      add(aiMsg(r.text, r.chips));
    }, V5 ? 1200 : 900);
  }

  // 묻기 칸 안내 문구 — 단계에 맞춰 '더 알고 싶은 것'으로 좁힌다(10/13 디자이너). 대화 중엔 "이어서".
  //   설비 이름은 넣지 않는다(알림이 바뀌면 낡고 칸을 넘친다). 조치 버튼과 겹치지 않게 '묻기'로만 둔다.
  var HINT = {
    critical: "원인이나 조치를 물어보세요",
    warning: "주의 알림에 대해 물어보세요",
    normal: "현장이나 로봇 상황을 물어보세요"
  };
  function hint() {
    input.placeholder = thread ? "이어서 물어보세요" : (HINT[body.getAttribute("data-level")] || HINT.normal);
  }
  hint();

  // 보내기 단추는 글이 있고 답을 기다리지 않을 때만 보인다(CSS .has-text).
  function sync() {
    box.classList.toggle("has-text", !busy && input.value.trim() !== "");
  }

  function submit() {
    var text = input.value;
    input.value = "";
    ask(text);
    sync();
    input.focus();
  }

  // 조치 버튼(monitor.js)이 대화를 건다 — 버튼 문구를 내 말로 보낸다.
  window.APRISM_DELTA = { ask: ask };

  input.addEventListener("input", sync);
  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.isComposing) { event.preventDefault(); submit(); }
  });
  if (send) { send.addEventListener("click", submit); }

  // 대화 중 단계가 바뀌면 — 덮어쓰지 않고 시스템 한 줄을 끼운다.
  var lastLevel = body.getAttribute("data-level");
  var WORD = { critical: "위험", warning: "주의", normal: "정상" };
  new MutationObserver(function () {
    var now = body.getAttribute("data-level");
    if (now === lastLevel) { return; }
    lastLevel = now;
    hint();
    if (!thread) { return; }
    var sys = el("div", "dc-sys is-" + now, "상황이 바뀌었어요 — 지금 " + (WORD[now] || now) + " 단계");
    add(sys);
  }).observe(body, { attributes: true, attributeFilter: ["data-level"] });

  document.addEventListener("aprism:estop", function () {
    if (thread) { add(el("div", "dc-sys is-critical", "새 위험 — 비상정지 발동")); }
  });

  // 관제사 교대 — 대화를 지운다.
  document.addEventListener("aprism:shift", function () {
    if (!thread) { return; }
    thread.remove();
    thread = null;
    win.classList.remove("is-chat");
    hint();
  });
})();
