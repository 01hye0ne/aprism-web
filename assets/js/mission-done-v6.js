/*
 * [11/03 v6] 관제 — 완료 미션을 고르면 진행 머리(순회 완료 100%) 밑에 [보고서 보기] [다시 실행]을 붙인다(디자이너).
 * 탭은 "이미 있는 미션의 창"이다(11/03 결정): 완료 미션은 끝난 상태로 보이고, 다시 돌리려면 [다시 실행] → 미션 설정(이름이 채워진 채).
 * 지금 탭(.sb-tab.is-on)의 data-run 으로 판단한다 — 탭 줄은 미션을 바꿀 때마다 다시 그려진다(mission-tabs-v6.js).
 * 두 단추 모두 무채색(Secondary) — 파랑은 상태 또는 단 하나의 주요 행동(색 위계 10/12).
 */
(function () {
  "use strict";

  var left = document.querySelector(".status-bar-left");
  var head = document.querySelector(".right-panel .mission-header");
  if (!left || !head) { return; }

  var box = document.createElement("div");
  box.className = "md-actions";
  box.hidden = true;
  box.innerHTML =
    '<a class="btn is-xs btn-secondary" href="./report-v6.html" data-md-report>' +
      '<span class="i i-16" style="--i:var(--ic-document)" aria-hidden="true"></span>보고서 보기</a>' +
    '<a class="btn is-xs btn-secondary" href="./mission-setup-v6.html" data-md-again>다시 실행</a>';
  head.appendChild(box);
  var again = box.querySelector("[data-md-again]");

  function sync() {
    var on = left.querySelector(".sb-tab.is-on");
    var done = !!(on && on.getAttribute("data-run") === "done");
    box.hidden = !done;
    if (done) { again.href = "./mission-setup-v6.html?mission=" + encodeURIComponent(on.getAttribute("data-mission") || ""); }
  }

  sync();
  new MutationObserver(sync).observe(left, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
})();
