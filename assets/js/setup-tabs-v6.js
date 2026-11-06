/*
 * [11/03 v6] 미션 설정 · 사전 점검 상단 탭(.sb-tabs.is-fixed) — 관제 탭과 같은 모양, 동작만 이 화면 몫이다(디자이너).
 *
 * 탭 = 이미 있는 미션의 창. 미션은 다른 곳(스케줄러 · 미션 관리)에서 만들어져 있고, 미션 설정은 "실행 전 미션"을 설정하는 단계다(11/03 결정).
 *   지금 탭 = 설정 중인 미션 — ?mission= (관제의 대기 탭 · 완료 미션 [다시 실행]이 붙여 온다), 없으면 정기 순회 점검.
 *   미션 이름 칸은 읽기 전용이고 지금 탭 이름이 들어간다.
 *   미션 설정(body[data-stage="setup"])   다른 탭 = 그 미션의 지금 상태로 — 대기면 그 미션 설정, 수행중 · 완료면 관제, [전체 미션]은 통합 순회 현황.
 *                                         입력을 바꿨으면 "바꾼 설정을 버릴까요?"(모달 discard)를 먼저 묻고, 안 바꿨으면 바로 간다.
 *   사전 점검(body[data-stage="precheck"]) 다른 탭을 누르면 "사전점검 진행중입니다." 토스트만 — 점검은 멈추지 않는다.
 * 한 화면 안에서 설정 → 점검으로 넘어가므로(sian.js) 누를 때마다 지금 단계를 읽는다.
 */
(function () {
  "use strict";

  var bar = document.querySelector(".sb-tabs.is-fixed");
  if (!bar) { return; }

  // 폼 스크롤 — 판(우물)을 걷어 "더 있다"를 그림자가 못 하니, 스크롤되면 위쪽 · 아래가 잘려 있으면 아래쪽에 선을 긋는다(v6.css)
  Array.prototype.forEach.call(document.querySelectorAll(".mp-stage .mp-scroll"), function (sc) {
    var mark = function () {
      sc.classList.toggle("is-scrolled", sc.scrollTop > 0);
      sc.classList.toggle("has-more", sc.scrollTop + sc.clientHeight < sc.scrollHeight - 1);   // 아래가 잘려 있으면 아래쪽 선
    };
    sc.addEventListener("scroll", mark, { passive: true });
    window.addEventListener("resize", mark);
    mark();
  });

  var body = document.body;
  var tabs = Array.prototype.slice.call(bar.querySelectorAll(".sb-tab"));
  var nameInput = document.querySelector("input.field-box.is-readonly");   // 영문판은 aria-label 이 번역돼 있어 꼴로 찾는다

  // 지금 탭 — 설정 중인 미션
  // 영문판 관제는 번역된 이름을 ?mission= 로 붙여 오므로 사전(APRISM_EN)으로도 찾는다
  var EN = window.APRISM_EN || {};
  function tabOf(name) { return tabs.filter(function (t) { var k = t.getAttribute("data-mission"); return k === name || EN[k] === name; })[0]; }
  var asked = /[?&]mission=([^&#]+)/.exec(window.location.search);
  var current = asked ? decodeURIComponent(asked[1]) : "";
  // [11/06] 탭 차례 — 관제 · 전체 미션에서 끌어 바꾼 차례(mission-tabs-v6.js)를 그대로 따른다. 처음 보는 미션은 기본 차례로 뒤에
  var saved = [];
  try { saved = JSON.parse(localStorage.getItem("aprism-v6-tab-order") || "[]") || []; } catch (e) { /* 못 읽으면 기본 차례 */ }
  if (saved.length) {
    var pos = function (t, i) { var k = t.getAttribute("data-mission"), n = saved.indexOf(k); if (n < 0) { n = saved.indexOf(EN[k]); } return n >= 0 ? n : 1e3 + i; };
    tabs.filter(function (t) { return t.hasAttribute("data-mission"); })
      .map(function (t, i) { return [pos(t, i), t]; })
      .sort(function (a, b) { return a[0] - b[0]; })
      .forEach(function (e) { bar.appendChild(e[1]); });
  }
  var mine = tabOf(current) || tabOf("정기 순회 점검");
  current = mine ? mine.getAttribute("data-mission") : "정기 순회 점검";
  if (mine) { mine.classList.add("is-on"); mine.setAttribute("aria-current", "page"); }
  // 설정 중인 미션은 아직 돌기 전이다 — 수행중 탭(정기 순회 점검)을 열어도 알림 기호는 뺀다
  if (mine) { Array.prototype.forEach.call(mine.querySelectorAll(".sb-tab-sev"), function (s) { s.remove(); }); }
  // 영문판은 번역기가 칸 값을 먼저 쓰므로 값 · 속성을 둘 다, 번역한 이름으로 넣는다
  if (nameInput) {
    nameInput.value = window.APRISM_TR ? window.APRISM_TR(current) : current;
    nameInput.setAttribute("value", nameInput.value);
  }
  // 관제로 넘어갈 때 이 미션을 연다(sian.js 가 body[data-monitor-href] 로 간다)
  var monitor = body.getAttribute("data-monitor-href");
  if (monitor) { body.setAttribute("data-monitor-href", monitor.split("?")[0] + "?mission=" + encodeURIComponent(current)); }

  // 입력을 바꿨는가 — 폼 안 값이 바뀌거나, 고르기 · 점검항목 · 스위치를 눌렀으면
  var dirty = false;
  var form = document.querySelector("[data-stage-show='setup'] .mp-form");
  if (form) {
    form.addEventListener("input", function () { dirty = true; });
    form.addEventListener("change", function () { dirty = true; });
    form.addEventListener("click", function (event) {
      if (event.target.closest && event.target.closest(".field-option, .check-row, .switch")) { dirty = true; }
    });
  }

  var toastTimer = 0;
  function toast(msg) {
    Array.prototype.forEach.call(body.querySelectorAll(".toast.sb-toast"), function (t) { t.remove(); });
    var t = document.createElement("div");
    t.className = "toast sb-toast";
    t.setAttribute("role", "status");
    var s = document.createElement("span");
    s.className = "t-label-2";
    s.textContent = msg;
    t.appendChild(s);
    body.appendChild(t);
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { t.remove(); }, 2600);
  }

  // 바꾼 설정 버리기 확인 — 모달은 screen.js 가 연다(숨은 [data-modal-open="discard"] 단추). 갈 곳 · 이름만 여기서 채운다.
  function go(name, href) {
    var scrim = document.querySelector("[data-modal='discard']");
    var opener = document.querySelector("[data-discard-open]");
    if (!dirty || !scrim || !opener) { window.location.href = href; return; }
    scrim.querySelector("[data-modal-confirm]").setAttribute("data-modal-confirm", href);
    scrim.querySelector("[data-discard-to]").textContent = name;
    opener.click();
  }

  bar.addEventListener("click", function (event) {
    var tab = event.target.closest && event.target.closest(".sb-tab");
    if (!tab || tab.classList.contains("is-on")) { return; }
    var stage = body.getAttribute("data-stage");
    if (stage === "precheck") { toast("사전점검 진행중입니다."); return; }
    if (stage !== "setup") { return; }
    var mission = tab.getAttribute("data-mission");
    if (!mission) { go("통합 순회 현황", "./building-v6.html"); return; }
    var q = "?mission=" + encodeURIComponent(mission);
    if (tab.getAttribute("data-run") === "idle") { go(mission + " 미션 설정", "./mission-setup-v6.html" + q); }
    else { go(mission + " 관제", "./main-v6.html" + q); }
  });
})();
