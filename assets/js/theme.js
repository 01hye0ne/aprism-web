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

  apply(read() === "light" ? "light" : "dark");

  if (button) {
    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      save(next);
    });
  }
})();
