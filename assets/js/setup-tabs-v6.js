/*
 * [11/03 v6] 미션 설정 · 사전 점검 상단 탭(.sb-tabs.is-fixed) — 관제 탭과 같은 모양, 동작만 이 화면 몫이다(디자이너).
 *
 * 탭은 "이미 있는 미션의 창"이다(11/03 결정). 미션 설정은 새 미션을 만들 때만 나온다 — 끝의 [새 미션] 탭이 지금 탭이다.
 *   미션 설정(body[data-stage="setup"])   다른 탭을 누르면 "작성 중인 설정을 버릴까요?" 확인(모달 discard) 뒤 그 미션의 관제로 간다.
 *                                         [전체 미션]은 통합 순회 현황(building-v6)으로.
 *   사전 점검(body[data-stage="precheck"]) 다른 탭을 누르면 "사전점검 진행중입니다." 토스트만 — 점검은 멈추지 않는다.
 * 한 화면 안에서 설정 → 점검으로 넘어가므로(sian.js) 누를 때마다 지금 단계를 읽는다.
 * 완료 미션의 [다시 실행](mission-done-v6.js)은 ?mission= 으로 들어온다 — 미션 이름 칸을 그 이름으로 채운다.
 */
(function () {
  "use strict";

  var bar = document.querySelector(".sb-tabs.is-fixed");
  if (!bar) { return; }
  var body = document.body;
  var nameInput = document.querySelector("input[aria-label='미션 이름']");

  var again = /[?&]mission=([^&#]+)/.exec(window.location.search);
  if (again && nameInput) { nameInput.value = decodeURIComponent(again[1]); }

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

  // 설정 버리기 확인 — 모달은 screen.js 가 연다(숨은 [data-modal-open="discard"] 단추). 갈 곳 · 문구만 여기서 채운다.
  function askDiscard(name, href) {
    var scrim = document.querySelector("[data-modal='discard']");
    var opener = document.querySelector("[data-discard-open]");
    if (!scrim || !opener) { window.location.href = href; return; }
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
    if (mission) { askDiscard(mission + " 관제", "./main-v6.html?mission=" + encodeURIComponent(mission)); }
    else { askDiscard("통합 순회 현황", "./building-v6.html"); }
  });
})();
