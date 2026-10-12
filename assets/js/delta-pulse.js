/*
 * 위험 박자 — 위험이 있는 동안 빠른 박(body.is-surge, 두근두근 — 쉼)이 이어진다 (2026-10-12, ?delta=glass).
 * 박자 모양은 monitor.css 가 정한다. 여기서는 언제 다시 뛸지만 정한다.
 *   - 화면 단계가 위험으로 올라왔을 때(처음 열 때 포함)
 *   - 비상정지처럼 화면에서 새 위험이 생겼을 때(aprism:estop)
 */
(function () {
  "use strict";
  if (document.documentElement.getAttribute("data-delta") !== "glass") { return; }
  var body = document.body;
  var last = null;

  function surge() {
    body.classList.remove("is-surge");
    void body.offsetWidth;   // 떼었다 다시 붙여야 박자가 처음부터 다시 뛴다
    body.classList.add("is-surge");
    // 10초 뒤 느린 숨으로 가라앉던 것은 뺐다 — 위험이 있는 동안 두근두근이 이어진다(10/12 디자이너).
    // 새 위험이 오면 위에서 떼었다 붙여 박자를 처음부터 다시 뛴다.
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
