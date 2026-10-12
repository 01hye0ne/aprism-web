/*
 * 위험 박자 — 새 위험이 들어온 뒤 10초는 빠른 박(body.is-surge), 그다음은 느린 숨으로 (2026-10-12 제안, ?delta=glass).
 * 박자 모양은 monitor.css 가 정한다. 여기서는 언제 다시 뛸지만 정한다.
 *   - 화면 단계가 위험으로 올라왔을 때(처음 열 때 포함)
 *   - 비상정지처럼 화면에서 새 위험이 생겼을 때(aprism:estop)
 */
(function () {
  "use strict";
  if (document.documentElement.getAttribute("data-delta") !== "glass") { return; }
  var body = document.body;
  var SURGE_MS = 10000;
  var timer = null;
  var last = null;

  function surge() {
    body.classList.remove("is-surge");
    void body.offsetWidth;   // 떼었다 다시 붙여야 박자가 처음부터 다시 뛴다
    body.classList.add("is-surge");
    clearTimeout(timer);
    timer = setTimeout(function () { body.classList.remove("is-surge"); }, SURGE_MS);
  }

  function check() {
    var now = body.getAttribute("data-level");
    if (now === "critical" && last !== "critical") { surge(); }
    last = now;
  }

  new MutationObserver(check).observe(body, { attributes: true, attributeFilter: ["data-level"] });
  document.addEventListener("aprism:estop", function () { setTimeout(surge, 0); });
  check();
})();
