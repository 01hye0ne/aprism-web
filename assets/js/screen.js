// 화면 안의 동작.
//
// Delta 요약 패널 여닫기 — Figma AI Assist Panel 의 Emphasis(closed / opened) 를
// 우측 토글 버튼으로 전환한다. 기본값은 closed 다.
(function () {
  var panel = document.querySelector("[data-ai-panel]");
  var button = document.querySelector("[data-ai-toggle]");
  if (!panel || !button) {
    return;
  }

  function apply(open) {
    panel.classList.toggle("is-open", open);
    button.setAttribute("aria-expanded", open ? "true" : "false");
    button.setAttribute("aria-label", open ? "요약 접기" : "요약 펼치기");
  }

  apply(false);

  button.addEventListener("click", function () {
    apply(!panel.classList.contains("is-open"));
  });

  // 펼친 상태에서 Esc 로 닫는다. 닫은 뒤 초점은 버튼에 남긴다.
  panel.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && panel.classList.contains("is-open")) {
      apply(false);
      button.focus();
    }
  });
})();
