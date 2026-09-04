// 진입 화면 동작 — 스플래시 자동 진행, 비밀번호 보기, 로그인 · 비밀번호 변경 제출.
// 세 화면이 같은 파일을 쓴다. 해당 요소가 없는 화면에서는 아무 일도 하지 않는다.
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
  //
  // 칸마다 하나씩 붙는다 — 비밀번호 변경 화면에는 셋이다.
  // (예전에는 querySelector 로 첫 하나만 잡아서 나머지 눈 아이콘이 죽어 있었다.)
  Array.prototype.slice.call(document.querySelectorAll("[data-pw-toggle]")).forEach(function (toggle) {
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
  });

  // ---------- 로그인 ----------
  //
  // 붙일 인증이 없는 퍼블리싱 화면이라 값을 확인하지 않고 다음 화면으로 넘긴다.
  // 들어오면 바로 미션을 짜는 흐름이라 미션 설정으로 간다.
  // 서버가 붙으면 이 자리가 요청으로 바뀐다.
  var form = document.querySelector("[data-login-form]");
  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      // 친 아이디만 남긴다. 비밀번호 변경 화면의 "아이디와 3자 이상 연속 일치 금지" 가
      // 이 값을 본다 — 그 화면에는 아이디 칸이 없다. 비밀번호는 남기지 않는다.
      var id = form.querySelector("#login-id");
      try {
        sessionStorage.setItem("aprism.user", id ? id.value.trim() : "");
      } catch (e) {
        // 사파리 프라이빗 모드처럼 막힌 곳에서는 그냥 넘어간다 — 규칙 3 이 통과로 잡힌다.
      }
      location.href = "./mission-setup.html";
    });
  }

  // ---------- 비밀번호 변경 강제 (677:7468) ----------
  //
  // Figma 는 규칙 네 줄의 체크를 두 색으로 그려 뒀다 — 첫 줄만 status/normal/fg(초록)이고
  // 나머지 셋은 fg/disabled(회색)다. 채워진 줄과 아닌 줄을 색으로 가르는 화면이라는 뜻이라
  // 친 값에 따라 네 줄을 실시간으로 켜고 끈다. 버튼(State=Disabled 로 그려져 있다)은
  // 네 줄이 다 켜지고 새 비밀번호 두 번이 같아야 열린다.
  var pwForm = document.querySelector("[data-password-form]");
  if (pwForm) {
    var current = pwForm.querySelector("[data-pwx-current]");
    var next = pwForm.querySelector("[data-pwx-new]");
    var confirm = pwForm.querySelector("[data-pwx-confirm]");
    var submit = pwForm.querySelector("[data-pwx-submit]");
    var confirmField = pwForm.querySelector("[data-pwx-confirm-field]");
    var confirmHelp = pwForm.querySelector("[data-pwx-confirm-help]");

    // 확인 칸을 한 번 떠난 적이 있는지. 치는 도중에 "다르다"고 하면 첫 글자부터 빨개진다 —
    // 한 번 떠난 뒤부터만 말하고, 그다음부터는 고치는 대로 실시간으로 따라간다.
    var confirmTouched = false;

    // 로그인에서 넘어왔으면 그때 친 아이디가 남아 있다. 없으면 견줄 것이 없다.
    var userId = "";
    try {
      userId = (sessionStorage.getItem("aprism.user") || "").toLowerCase();
    } catch (e) {
      userId = "";
    }

    var RULES = {
      // 4자 이상
      length: function (pw) { return pw.length >= 4; },

      // 영문 · 숫자 · 특수문자 중 2종 이상
      kinds: function (pw) {
        var n = 0;
        if (/[A-Za-z]/.test(pw)) { n += 1; }
        if (/[0-9]/.test(pw)) { n += 1; }
        if (/[^A-Za-z0-9]/.test(pw)) { n += 1; }
        return n >= 2;
      },

      // 아이디와 3자 이상 연속 일치 금지. 아이디의 3글자 창을 훑어 하나라도 들어 있으면 걸린다.
      // 아이디를 모르면(바로 이 주소로 들어온 경우) 어길 것이 없어 통과로 본다.
      notid: function (pw) {
        if (!pw) { return false; }
        if (userId.length < 3) { return true; }
        var low = pw.toLowerCase();
        for (var i = 0; i + 3 <= userId.length; i += 1) {
          if (low.indexOf(userId.slice(i, i + 3)) !== -1) { return false; }
        }
        return true;
      },

      // 최근 비밀번호와 중복 금지. 이 화면이 아는 "최근"은 위 칸에 친 현재 비밀번호뿐이다 —
      // 그 이전 이력은 서버가 볼 자리다.
      notreused: function (pw) { return pw.length > 0 && pw !== current.value; }
    };

    var rows = Array.prototype.slice.call(pwForm.querySelectorAll("[data-rule]"));

    var check = function () {
      var pw = next.value;
      var all = true;
      rows.forEach(function (row) {
        var test = RULES[row.getAttribute("data-rule")];
        var met = !!test && test(pw);
        row.classList.toggle("is-met", met);
        if (!met) { all = false; }
      });

      var matched = pw === confirm.value;
      var showError = confirmTouched && confirm.value.length > 0 && !matched;
      confirmField.classList.toggle("is-error", showError);
      confirmHelp.hidden = !showError;
      confirm.setAttribute("aria-invalid", showError ? "true" : "false");

      submit.disabled = !(all && current.value.length > 0 && matched);
    };

    [current, next, confirm].forEach(function (input) {
      input.addEventListener("input", check);
    });

    // 확인 칸을 떠나는 순간부터 어긋난 것을 말한다. 새 비밀번호 쪽을 고쳐도 다시 본다.
    confirm.addEventListener("blur", function () {
      confirmTouched = true;
      check();
    });

    check();

    // 붙일 서버가 없는 퍼블리싱 화면이라 값을 보내지 않고 다음 화면으로 넘긴다.
    // 비밀번호를 바꾸고 나면 그대로 들어가는 흐름이라 로그인과 같은 자리로 간다.
    pwForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (submit.disabled) { return; }
      location.href = "./mission-setup.html";
    });
  }
})();
