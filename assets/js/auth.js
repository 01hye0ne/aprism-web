// 진입 화면 동작 — 스플래시 자동 진행, 비밀번호 보기, 로그인 제출.
// 두 화면이 같은 파일을 쓴다. 해당 요소가 없는 화면에서는 아무 일도 하지 않는다.
(function () {
  "use strict";

  // ---------- 스플래시 → 로그인 ----------
  //
  // 로고를 읽을 만큼만 머문다. 기다리기 싫으면 아무 데나 누르거나 키를 치면 바로 넘어간다.
  // ?hold=0 으로 열면 멈춰 있는다 — 화면을 캡처하거나 들여다볼 때 쓴다.
  var splash = document.querySelector("[data-splash]");
  if (splash) {
    var HOLD = 2000;
    var m = /[?&]hold=(\d+)/.exec(location.search);
    var hold = m ? parseInt(m[1], 10) : HOLD;
    var gone = false;

    var leave = function () {
      if (gone) { return; }
      gone = true;
      splash.classList.add("is-leaving");
      // 빠지는 동안만 기다렸다 넘어간다. 애니메이션이 꺼진 환경이면 곧바로 끝난다.
      window.setTimeout(function () { location.href = "./login.html"; }, 240);
    };

    if (hold > 0) {
      window.setTimeout(leave, hold);
      document.addEventListener("pointerdown", leave);
      document.addEventListener("keydown", leave);
    }
  }

  // ---------- 비밀번호 보기 ----------
  var toggle = document.querySelector("[data-pw-toggle]");
  if (toggle) {
    var input = document.getElementById(toggle.getAttribute("aria-controls"));
    toggle.addEventListener("click", function () {
      var shown = toggle.getAttribute("aria-pressed") === "true";
      toggle.setAttribute("aria-pressed", shown ? "false" : "true");
      toggle.setAttribute("aria-label", shown ? "비밀번호 보기" : "비밀번호 숨기기");
      if (input) {
        input.type = shown ? "password" : "text";
        input.focus();
      }
    });
  }

  // ---------- 로그인 ----------
  //
  // 붙일 인증이 없는 퍼블리싱 화면이라 값을 확인하지 않고 다음 화면으로 넘긴다.
  // 들어오면 바로 미션을 짜는 흐름이라 미션 설정으로 간다.
  // 서버가 붙으면 이 자리가 요청으로 바뀐다.
  var form = document.querySelector("[data-login-form]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      location.href = "./mission-setup.html";
    });
  }
})();
