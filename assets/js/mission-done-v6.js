/*
 * [11/03 v6] 관제 — 탭은 "이미 있는 미션의 창"이다(11/03 결정). 누르면 그 미션의 지금 상태:
 *   대기   → 그 미션의 미션 설정으로 간다(미션은 다른 곳에서 이미 만들어져 있고, 설정은 실행 전 단계다)
 *   완료   → 끝난 관제 + 진행 머리(순회 완료 100%) 밑에 [보고서 보기] [다시 실행](→ 그 미션의 미션 설정)
 *   수행중 → 관제 그대로
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

  // 대기 미션 탭 — 관제로 바꾸지 않고(mission-tabs-v6.js 의 클릭보다 먼저 잡는다) 그 미션의 설정으로
  // 끌어서 순서만 바꾼 뒤 오는 click 은 건너뛴다(눌린 자리에서 5 넘게 움직였으면 끌기)
  var downX = 0;
  left.addEventListener("pointerdown", function (event) { downX = event.clientX; }, true);
  left.addEventListener("click", function (event) {
    var tab = event.target.closest && event.target.closest(".sb-tab[data-run='idle']");
    if (!tab || Math.abs(event.clientX - downX) > 5) { return; }
    event.stopPropagation();
    event.preventDefault();
    window.location.href = "./mission-setup-v6.html?mission=" + encodeURIComponent(tab.getAttribute("data-mission") || "");
  }, true);

  sync();
  new MutationObserver(sync).observe(left, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
})();
