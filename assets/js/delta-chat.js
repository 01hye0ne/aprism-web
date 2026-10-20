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
      thread.appendChild(aiMsg(first.textContent, []));
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
  function reply(q) {
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
    if (/주의|묶|5건|추세/.test(q)) {
      return {
        text: "주의 4건은 냉각수 밸브 누출 · 수배전반 부분방전 · 냉각 펌프 진동 · 공기 압축기 압력 편차예요. 셋이 Robot 02 순회 구간에 몰려 있어 한 번에 점검 계획을 세우면 이동이 줄어요.",
        chips: [
          { label: "주의만 목록에서 보기", go: true, act: function () { filterTo("warning"); } },
          { label: "점검 계획 초안 만들어 줘" }
        ]
      };
    }
    if (/로봇|robot|배터리|위치/i.test(q)) {
      return {
        text: "이 미션에는 2대가 배정돼 있어요. Robot 01 은 WP-04 를 점검 중(배터리 78%)이고, Robot 02 는 순회를 마치고 대기 중입니다.",
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
      text: "네, 말씀하세요. 지금은 위험 1건을 포함해 알림 6건이 쌓여 있어요. 위험 알림부터 보시겠어요?",
      chips: [
        { label: "위험 알림 설명해 줘" },
        { label: "주의 5건 묶어서 정리해 줘" }
      ]
    };
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
    wait.appendChild(el("span", "dc-typing"));
    add(wait);
    setTimeout(function () {
      wait.remove();
      win.classList.remove("is-thinking");
      busy = false;
      sync();
      var r = reply(text);
      add(aiMsg(r.text, r.chips));
    }, 900);
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
