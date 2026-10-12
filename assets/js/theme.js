// Dark Mode를 기본으로 하고, 선택한 테마는 브라우저에 저장한다.
(function () {
  var STORAGE_KEY = "aprism-theme";
  var root = document.documentElement;
  var button = document.querySelector("[data-theme-toggle]");
  var label = document.querySelector("[data-theme-label]");

  function read() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function save(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* 저장이 막힌 환경에서도 페이지는 동작해야 한다. */
    }
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    if (label) {
      label.textContent = theme === "light" ? "Light" : "Dark";
    }
  }

  // ?theme=light 로 링크를 공유하면 상대방도 같은 모드로 본다.
  function forced() {
    var m = /[?&]theme=(light|dark)/.exec(location.search);
    return m ? m[1] : null;
  }

  apply(forced() || (read() === "light" ? "light" : "dark"));

  // ?palette=neutral — 톤 실험실의 제안 팔레트(palette-neutral.css)를 씌워 본다. 저장하지 않는다.
  var palette = /[?&]palette=(neutral)/.exec(location.search);
  if (palette) { root.setAttribute("data-palette", palette[1]); }

  // ?delta=glass — 톤 실험실의 위험 Delta 제안(빛으로 강조)을 씌워 본다. 저장하지 않는다.
  var delta = /[?&]delta=(glass)/.exec(location.search);
  if (delta) { root.setAttribute("data-delta", delta[1]); }

  if (button) {
    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      save(next);
    });
  }
})();
