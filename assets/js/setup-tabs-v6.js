/*
 * [11/03 v6] 미션 설정 · 사전 점검 상단 탭(.sb-tabs.is-fixed) — 관제 탭과 같은 모양, 동작만 이 화면 몫이다(디자이너).
 *   미션 설정(body[data-stage="setup"])  미션 탭을 누르면 그 탭이 고른 탭이 되고, 미션 이름 입력칸이 탭 이름으로 바뀐다.
 *                                        [전체 미션]은 미션이 아니라서 누르지 않는다.
 *   사전 점검(body[data-stage="precheck"]) 지금 탭 말고 다른 탭을 누르면 "사전점검 진행중입니다." 토스트만 띄운다.
 * 한 화면 안에서 설정 → 점검으로 넘어가므로(sian.js) 누를 때마다 지금 단계를 읽는다.
 */
(function () {
  "use strict";

  var bar = document.querySelector(".sb-tabs.is-fixed");
  if (!bar) { return; }
  var body = document.body;
  var nameInput = document.querySelector("[data-stage-show='setup'] .field-box, input[aria-label='미션 이름']");

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

  function pick(tab) {
    Array.prototype.forEach.call(bar.querySelectorAll(".sb-tab"), function (t) {
      var on = t === tab;
      t.classList.toggle("is-on", on);
      if (on) { t.setAttribute("aria-current", "page"); } else { t.removeAttribute("aria-current"); }
    });
  }

  bar.addEventListener("click", function (event) {
    var tab = event.target.closest && event.target.closest(".sb-tab");
    if (!tab || tab.classList.contains("is-on")) { return; }
    var stage = body.getAttribute("data-stage");
    if (stage === "precheck") { toast("사전점검 진행중입니다."); return; }
    if (stage !== "setup") { return; }
    var mission = tab.getAttribute("data-mission");
    if (!mission) { return; }
    pick(tab);
    if (nameInput) {
      nameInput.value = mission;
      nameInput.dispatchEvent(new Event("input", { bubbles: true }));
      nameInput.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
})();
