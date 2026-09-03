// 12컬럼 그리드를 눈으로 확인하는 겹판.
//   ?grid=1 로 열면 켜진 채로 뜬다(?theme=light 와 같은 방식이라 링크로 공유된다).
//   화면에서 g 를 누르면 껐다 켰다 한다.
//
// 컬럼 수·거터는 CSS 가 정한다(--grid-columns / --grid-gutter). 여기서는 칸만 만든다 —
// 겹판이 실제 그리드와 어긋날 방법이 없다.
(function () {
  "use strict";

  var host = document.querySelector(".two-col");
  if (!host) { return; }

  var overlay = null;

  function columns() {
    var v = getComputedStyle(document.documentElement).getPropertyValue("--grid-columns");
    return parseInt(v, 10) || 12;
  }

  function show() {
    if (overlay) { return; }
    overlay = document.createElement("div");
    overlay.className = "grid-overlay";
    overlay.setAttribute("aria-hidden", "true");
    for (var i = 0, n = columns(); i < n; i++) {
      overlay.appendChild(document.createElement("i"));
    }
    host.appendChild(overlay);
  }

  function hide() {
    if (!overlay) { return; }
    host.removeChild(overlay);
    overlay = null;
  }

  if (/[?&]grid=1/.test(location.search)) { show(); }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "g" && event.key !== "G") { return; }
    if (event.metaKey || event.ctrlKey || event.altKey) { return; }
    // 입력 중에는 가로채지 않는다.
    var el = event.target;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) { return; }
    if (overlay) { hide(); } else { show(); }
  });
})();
