// 화면 안의 동작. 셋이다 — AI 요약 여닫기, 사이트 패널 접기, 로봇 선택.
//
// 데이터는 이 파일 안에 있다. 서버가 없는 퍼블리싱이라 검토용 값만 들고 있으면 된다.

(function () {
  "use strict";

  // ------------------------------------------------------------------
  // Delta 요약 패널 여닫기
  // Figma AI Assist Panel 의 Emphasis(closed / opened) 를 우측 토글로 전환한다.
  // 기본값은 closed 다.
  // ------------------------------------------------------------------
  (function () {
    var panel = document.querySelector("[data-ai-panel]");
    var button = document.querySelector("[data-ai-toggle]");
    if (!panel || !button) {
      return;
    }

    // 접힌 판은 opacity 0 + overflow hidden 이라 눈에는 안 보이지만 DOM 에는 남는다.
    // inert 를 걸어 탭 순서와 스크린리더에서도 빼 준다 — 안 그러면 안 보이는 입력칸에
    // 초점이 들어가 글자를 치게 된다(캡슐·보내기 버튼도 같은 문제였다).
    var foldClosed = panel.querySelector(".ai-fold-closed");
    var foldOpen = panel.querySelector(".ai-fold-open");

    function apply(open) {
      panel.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.setAttribute("aria-label", open ? "요약 접기" : "요약 펼치기");
      if (foldClosed) { foldClosed.inert = open; }
      if (foldOpen) { foldOpen.inert = !open; }
    }

    apply(false);

    button.addEventListener("click", function () {
      apply(!panel.classList.contains("is-open"));
    });

    // Delta 얼굴 — Prism Orb 를 그래픽 자리에 붙인다. 색은 패널의 심각도를 따라간다.
    // WebGL2 를 못 쓰면 mount 가 null 을 주고, 자리표시자 원이 그대로 남는다.
    function severity() {
      if (panel.classList.contains("is-critical")) { return "critical"; }
      if (panel.classList.contains("is-warning")) { return "warning"; }
      if (panel.classList.contains("is-safe")) { return "safe"; }
      return "info";
    }

    var mark = panel.querySelector(".ai-delta-mark");
    var orb = (mark && window.PrismOrb) ? window.PrismOrb.mount(mark, { palette: severity() }) : null;

    // 화면 전체(엣지 글로우)도 같이 물들어야 해서 바깥 .two-col 을 잡아 둔다.
    var twoCol = panel.closest(".two-col");

    // 첫 줄은 인사·상황, 둘째 줄이 본문이다(닫힘 16/24, 펼침 20/32 — 크기는 CSS 가 정한다).
    // 닫힘·펼침 두 판에 같은 클래스가 하나씩 있어서 넷을 다 바꾼다.
    function setLines(one, two) {
      Array.prototype.slice.call(panel.querySelectorAll(".ai-line-1"))
        .forEach(function (el) { el.textContent = one; });
      Array.prototype.slice.call(panel.querySelectorAll(".ai-line-2"))
        .forEach(function (el) { el.textContent = two; });
    }

    function setTag(text) {
      var tag = panel.querySelector("[data-ai-tag-text]");
      if (tag) { tag.textContent = text; }
    }

    // 심각도를 한 자리에서 갈아 끼운다 — 패널·화면(엣지 글로우)·오브 셋이 같이 간다.
    function setSeverity(level) {
      ["is-warning", "is-critical", "is-safe"].forEach(function (cls) {
        panel.classList.remove(cls);
        if (twoCol) { twoCol.classList.remove(cls); }
      });
      if (level) {
        panel.classList.add("is-" + level);
        if (twoCol) { twoCol.classList.add("is-" + level); }
      }
      if (orb) { orb.setPalette(severity()); }
    }

    // closed 상태의 [확인] — 알림을 받았다는 응답. 주의(warning)·위험(critical) 둘 다에서
    // 같은 자리에 나오고, 누르면 화면·패널을 일반(파란) 상태로 되돌리며 두 줄을 일반 멘트로
    // 바꾼다. 심각도마다 다르게 굴 이유가 없다 — 어느 쪽이든 "봤다" 는 한 가지 뜻이다.
    var ack = panel.querySelector("[data-ai-ack]");
    if (ack) {
      var NORMAL_LINE_1 = "안녕하세요, 홍길동 님.";
      var NORMAL_LINE_2 = "인계된 알림 3건과 진행 예정인 미션 1건이 있어요. 먼저 살펴볼까요?";
      // 태그도 같이 바꾼다 — 주의 상태 문구가 그대로 남으면 새 멘트와 안 맞는다.
      var NORMAL_TAG = "인계 알림 3건 · 예정 미션 1건";

      ack.addEventListener("click", function () {
        setSeverity(null);
        setLines(NORMAL_LINE_1, NORMAL_LINE_2);
        setTag(NORMAL_TAG);
      });
    }

    // E-STOP 모달에서 [중지하기] 를 누르면 위험(critical) 로 간다.
    // 모달 쪽과 직접 엮히지 않고 문서 이벤트로 받는다 — 둘은 다른 닫힘이고,
    // 앞으로 다른 자리에서도 같은 상태를 불러야 할 수 있다.
    document.addEventListener("aprism:estop", function () {
      setSeverity("critical");
      setLines("비상정지 발동 — 로봇 구동이 차단되었습니다",
               "현장 안전을 확인한 뒤 해제 절차를 진행하세요.");
      setTag("비상정지 발동 · 해제 절차 필요");
    });

    // 펼친 상태에서 Esc 로 닫는다. 닫은 뒤 초점은 버튼에 남긴다.
    panel.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && panel.classList.contains("is-open")) {
        apply(false);
        button.focus();
      }
    });
  })();

  // ------------------------------------------------------------------
  // 사이트 컨텍스트 패널 접기
  // 접힌 모습은 Figma 에 없다. 버튼만 남는 44 폭으로 줄인다(app-shell.css).
  // ------------------------------------------------------------------
  (function () {
    var panel = document.getElementById("site-panel");
    var button = document.querySelector("[data-panel-toggle]");
    if (!panel || !button) {
      return;
    }

    button.addEventListener("click", function () {
      var collapsed = panel.classList.toggle("is-collapsed");
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      button.setAttribute("aria-label", collapsed ? "사이트 패널 펼치기" : "사이트 패널 접기");
    });
  })();

  // ------------------------------------------------------------------
  // Status Bar 드롭다운 — Account · Signal
  // Figma Account / Signal 컴포넌트의 Closed <-> Opened 를 클릭으로 전환한다.
  // 한 번에 하나만 열리고, 바깥 클릭이나 Esc 로 닫힌다.
  // ------------------------------------------------------------------
  (function () {
    var menus = Array.prototype.slice.call(document.querySelectorAll("[data-status-menu]"));
    if (!menus.length) {
      return;
    }

    function set(menu, open) {
      var trigger = menu.querySelector("[data-menu-trigger]");
      var dropdown = menu.querySelector(".dropdown-menu");
      trigger.setAttribute("aria-expanded", open ? "true" : "false");
      dropdown.hidden = !open;
    }

    function closeAll(except) {
      menus.forEach(function (menu) {
        if (menu !== except) {
          set(menu, false);
        }
      });
    }

    menus.forEach(function (menu) {
      var trigger = menu.querySelector("[data-menu-trigger]");

      trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = trigger.getAttribute("aria-expanded") === "true";
        closeAll(menu);
        set(menu, !open);
      });

      menu.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && trigger.getAttribute("aria-expanded") === "true") {
          set(menu, false);
          trigger.focus();
        }
      });
    });

    document.addEventListener("click", function (event) {
      var inside = menus.some(function (menu) {
        return menu.contains(event.target);
      });
      if (!inside) {
        closeAll(null);
      }
    });
  })();

  // ------------------------------------------------------------------
  // 로봇 선택 모달 안쪽 — 카드 고르기 · 이름 거르기 (Figma 734:8981)
  //
  // 카드에 data-robot 을 안 쓴다. 그 이름은 우측 패널의 로봇 띠가 이미 쓰고 있어서
  // 같이 붙이면 띠 선택이 모달 카드까지 집는다.
  // ------------------------------------------------------------------
  (function () {
    var box = document.querySelector("[data-modal='robots']");
    if (!box) {
      return;
    }

    var picks = Array.prototype.slice.call(box.querySelectorAll("[data-robot-pick]"));

    picks.forEach(function (card) {
      card.addEventListener("click", function () {
        if (card.hasAttribute("data-robot-offline")) { return; }
        picks.forEach(function (other) {
          other.setAttribute("aria-pressed", other === card ? "true" : "false");
        });
      });
    });

    // 모달과 우측 띠는 같은 열두 대를 본다 — 순번(0..11)이 같은 카드끼리 짝이다.
    // 띠 카드는 data-robot, 모달 카드는 data-robot-pick 으로 이름만 다르다.
    function panelCard(index) {
      return document.querySelector(".robot-strip .robot-card[data-robot='" + index + "']");
    }

    // 열 때 띠에서 고른 것을 모달로 가져온다 — 안 그러면 늘 첫 장이 골라진 채로 열린다.
    function syncFromPanel() {
      var current = document.querySelector(".robot-strip .robot-card[aria-pressed='true']");
      if (!current) { return; }
      var index = current.getAttribute("data-robot");
      picks.forEach(function (card) {
        card.setAttribute("aria-pressed", card.getAttribute("data-robot-pick") === index ? "true" : "false");
      });
    }

    var opener = document.querySelector("[data-robot-more]");
    if (opener) {
      opener.addEventListener("click", syncFromPanel);
    }

    // [선택] — 모달에서 고른 것을 띠에 그대로 옮긴다.
    // 띠 카드를 직접 누른다. 선택 표시와 아래 타임라인 갱신을 그쪽이 이미 하고 있어서,
    // 같은 일을 여기서 다시 짜면 두 곳이 갈라진다.
    var confirmButton = box.querySelector("[data-modal-confirm]");
    if (confirmButton) {
      confirmButton.addEventListener("click", function () {
        var picked = picks.filter(function (card) {
          return card.getAttribute("aria-pressed") === "true";
        })[0];
        if (!picked) { return; }
        var target = panelCard(picked.getAttribute("data-robot-pick"));
        if (!target) { return; }
        target.click();
        // 고른 카드가 띠 밖에 있으면 보이는 자리로 끌어온다(셋만 보인다).
        if (target.scrollIntoView) {
          target.scrollIntoView({ block: "nearest", inline: "center" });
        }
      });
    }

    // 이름으로 거르기. 지금은 카드 이름이 모두 자리표시자("로봇명")라
    // 다 남거나 다 사라지지만, 진짜 이름이 들어오면 그대로 걸린다.
    var search = box.querySelector("[data-robot-search]");
    var empty = box.querySelector("[data-robot-empty]");

    if (search) {
      search.addEventListener("input", function () {
        var q = search.value.trim().toLowerCase();
        var shown = 0;
        picks.forEach(function (card) {
          var name = card.querySelector(".robot-id");
          var text = (name ? name.textContent : "").toLowerCase();
          var hit = !q || text.indexOf(q) >= 0;
          card.hidden = !hit;
          if (hit) { shown += 1; }
        });
        if (empty) { empty.hidden = shown > 0; }
      });
    }
  })();

  // ------------------------------------------------------------------
  // 모달 — Figma "Modal" 71:492
  //
  // 두 자리에서 뜬다. 문구만 다르고 짜임은 같다.
  //   logout  계정 메뉴의 [로그아웃] — 타이머 있음(35s), 0 이 되면 그대로 나간다
  //   estop   우측 패널의 [E-STOP]  — 타이머 없음
  //
  // 초점은 .app 에 inert 를 걸어 가둔다. 모달이 떠 있는 동안 뒤 화면은
  // 탭으로도 스크린리더로도 닿지 않는다 — 직접 짠 탭 트랩보다 새는 구멍이 없다.
  // ------------------------------------------------------------------
  (function () {
    var scrims = Array.prototype.slice.call(document.querySelectorAll("[data-modal]"));
    if (!scrims.length) {
      return;
    }

    var app = document.querySelector(".app");
    var open = null;
    var lastFocus = null;
    var tick = null;

    function stopTimer() {
      if (tick) {
        window.clearInterval(tick);
        tick = null;
      }
    }

    function close() {
      if (!open) {
        return;
      }
      stopTimer();
      open.hidden = true;
      open = null;
      if (app) {
        app.inert = false;
      }
      // 초점을 부른 자리로 돌린다. 계정 메뉴 항목처럼 그 사이 닫혀서 사라진
      // 자리면 그 메뉴를 여는 칩으로 보낸다 — 안 보이는 곳에 초점을 두면
      // 다음 탭이 화면 맨 앞에서 다시 시작한다.
      var back = lastFocus;
      if (back && back.offsetParent === null) {
        var owner = back.closest ? back.closest("[data-status-menu]") : null;
        back = owner ? owner.querySelector("[data-menu-trigger]") : null;
      }
      if (back && back.focus) {
        back.focus();
      }
      lastFocus = null;
    }

    function confirm(scrim) {
      var button = scrim.querySelector("[data-modal-confirm]");
      var to = button ? button.getAttribute("data-modal-confirm") : "";
      var then = button ? button.getAttribute("data-modal-then") : null;
      close();

      // 자동복귀는 모달 문구가 그대로 약속한 일을 한다 —
      // "복귀 중에는 자동복귀 버튼이 비활성화됩니다".
      if (then === "recall") {
        var recall = document.querySelector("[data-recall-button]");
        if (recall) { recall.disabled = true; }
        document.dispatchEvent(new CustomEvent("aprism:recall"));
      }

      // 비상정지는 Delta 를 위험(critical)으로 넘긴다. 패널 쪽이 듣는다.
      if (then === "estop") {
        document.dispatchEvent(new CustomEvent("aprism:estop"));
      }

      // 갈 곳이 적혀 있으면 간다. E-STOP 처럼 비어 있으면 닫기만 한다 —
      // 서버가 없는 퍼블리싱이라 "정지됨" 화면이 아직 없다.
      if (to) {
        window.location.href = to;
      }
    }

    // 타이머 — Figma 는 "00s" 한 칸이다. 여기서는 실제로 줄어들게 두었다.
    // 멈춘 숫자는 고장으로 읽힌다.
    function startTimer(scrim) {
      var el = scrim.querySelector("[data-modal-timer]");
      if (!el) {
        return;
      }
      var left = Number(el.getAttribute("data-modal-timer")) || 0;
      el.textContent = left + "s";
      tick = window.setInterval(function () {
        left -= 1;
        el.textContent = (left > 0 ? left : 0) + "s";
        if (left <= 0) {
          confirm(scrim);
        }
      }, 1000);
    }

    // 로그아웃 문구의 이름은 상태바 계정 칩에서 가져온다 —
    // 같은 화면에 두 이름이 뜨면 누구의 세션인지가 흐려진다.
    function fillUser(scrim) {
      var slot = scrim.querySelector("[data-modal-user]");
      var chip = document.querySelector(".account-chip");
      if (!slot || !chip) {
        return;
      }
      var parts = Array.prototype.slice.call(chip.querySelectorAll(".t-label-2"))
        .map(function (el) { return el.textContent.trim(); })
        .filter(function (t) { return t && t !== "|"; });
      if (parts.length) {
        slot.textContent = parts.join(" · ");
      }
    }

    function show(name) {
      var scrim = scrims.filter(function (s) { return s.getAttribute("data-modal") === name; })[0];
      if (!scrim || open) {
        return;
      }
      lastFocus = document.activeElement;
      // 계정 메뉴에서 부른 경우 그 메뉴를 접는다 — scrim 뒤에 열린 채로 남으면
      // 모달을 닫았을 때 메뉴가 다시 나타난다.
      Array.prototype.slice.call(document.querySelectorAll("[data-menu-trigger]"))
        .forEach(function (trigger) {
          if (trigger.getAttribute("aria-expanded") !== "true") { return; }
          trigger.setAttribute("aria-expanded", "false");
          var owner = trigger.closest("[data-status-menu]");
          var dropdown = owner && owner.querySelector(".dropdown-menu");
          if (dropdown) { dropdown.hidden = true; }
        });
      fillUser(scrim);
      scrim.hidden = false;
      open = scrim;
      if (app) {
        app.inert = true;
      }
      var first = scrim.querySelector("[data-modal-dismiss]:not(.modal-close)") ||
                  scrim.querySelector("[data-modal-dismiss]");
      if (first) {
        first.focus();
      }
      startTimer(scrim);
    }

    Array.prototype.slice.call(document.querySelectorAll("[data-modal-open]"))
      .forEach(function (trigger) {
        trigger.addEventListener("click", function (event) {
          event.preventDefault();
          show(trigger.getAttribute("data-modal-open"));
        });
      });

    scrims.forEach(function (scrim) {
      Array.prototype.slice.call(scrim.querySelectorAll("[data-modal-dismiss]"))
        .forEach(function (b) { b.addEventListener("click", close); });

      var go = scrim.querySelector("[data-modal-confirm]");
      if (go) {
        go.addEventListener("click", function () { confirm(scrim); });
      }

      // 바탕을 누르면 닫는다. 카드 안쪽 클릭은 여기까지 안 온다.
      scrim.addEventListener("click", function (event) {
        if (event.target === scrim) {
          close();
        }
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && open) {
        close();
      }
    });
  })();

  // ------------------------------------------------------------------
  // 로봇 선택 -> 아래 waypoint 목록이 바뀐다
  //
  // Figma 에는 타임라인이 하나뿐이라 나머지 두 대의 내용은 여기서 지었다.
  // 문구는 Figma 와 같은 자리표시자(waypoint name)를 그대로 쓴다.
  // 진행률은 steps 에서 계산한다 — Figma 의 "3 / 5"·"00%" 는 서로 맞지 않는 값이었다.
  // ------------------------------------------------------------------
  var ROBOTS = [
    {
      // State=Running · 78% · Strong
      current: "현재 수행명",
      steps: [
        { title: "waypoint name", state: "done", time: "09:12 – 09:31", duration: "19분" },
        { title: "waypoint name", state: "done", time: "09:31 – 09:52", duration: "21분" },
        { title: "waypoint name", state: "done", time: "09:52 – 10:08", duration: "16분" },
        {
          title: "Thust BRG Cooling Water Flow",
          state: "running",
          time: "10:08 – 10:24",
          duration: "16분",
          desc: "압력·온도 센서 판독 중. 기준값 대비 편차를 실시간 비교합니다."
        },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" }
      ]
    },
    {
      // State=Returning · 18% · Weak — 미션을 마치고 복귀 중이다
      current: "복귀 중",
      steps: [
        { title: "waypoint name", state: "done", time: "08:40 – 08:58", duration: "18분" },
        { title: "waypoint name", state: "done", time: "08:58 – 09:14", duration: "16분" },
        { title: "waypoint name", state: "done", time: "09:14 – 09:37", duration: "23분" },
        { title: "waypoint name", state: "done", time: "09:37 – 09:55", duration: "18분" },
        { title: "waypoint name", state: "done", time: "09:55 – 10:11", duration: "16분" }
      ]
    },
    {
      // State=Idle · 35% · Good — 아직 시작하지 않았다
      current: "대기 중",
      steps: [
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" }
      ]
    },
    {
      // 4 · 완료 · 92% · Strong — 끝까지 돌고 돌아왔다
      current: "순회 완료",
      steps: [
        { title: "waypoint name", state: "done", time: "07:20 – 07:38", duration: "18분" },
        { title: "waypoint name", state: "done", time: "07:38 – 07:59", duration: "21분" },
        { title: "waypoint name", state: "done", time: "07:59 – 08:14", duration: "15분" },
        { title: "waypoint name", state: "done", time: "08:14 – 08:33", duration: "19분" },
        { title: "waypoint name", state: "done", time: "08:33 – 08:47", duration: "14분" },
        { title: "waypoint name", state: "done", time: "08:47 – 09:06", duration: "19분" }
      ]
    },
    {
      // 5 · 수행중 · 64% · Good — 첫 구간을 지나는 중이다
      current: "현재 수행명",
      steps: [
        { title: "waypoint name", state: "done", time: "10:02 – 10:17", duration: "15분" },
        {
          title: "Generator Bearing Vibration",
          state: "running",
          time: "10:17 – 10:31",
          duration: "14분",
          desc: "진동 스펙트럼을 모으는 중. 기준 대비 과대치를 찾습니다."
        },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" }
      ]
    },
    {
      // 6 · 대기 · 8% 충전 · Weak — 배터리가 바닥이라 못 나간다
      current: "충전 중",
      steps: [
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" }
      ]
    },
    {
      // 7 · 완료 · 96% 충전 · Strong — 도킹에서 다음 미션을 기다린다
      current: "순회 완료",
      steps: [
        { title: "waypoint name", state: "done", time: "06:05 – 06:24", duration: "19분" },
        { title: "waypoint name", state: "done", time: "06:24 – 06:41", duration: "17분" },
        { title: "waypoint name", state: "done", time: "06:41 – 07:02", duration: "21분" },
        { title: "waypoint name", state: "done", time: "07:02 – 07:16", duration: "14분" }
      ]
    },
    {
      // 8 · 대기 · 47% · Good — 불러온 미션이 있고 시작 전이다
      current: "대기 중",
      steps: [
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" }
      ]
    },
    {
      // 9 · 완료 · 88% · Strong
      current: "순회 완료",
      steps: [
        { title: "waypoint name", state: "done", time: "05:10 – 05:29", duration: "19분" },
        { title: "waypoint name", state: "done", time: "05:29 – 05:46", duration: "17분" },
        { title: "waypoint name", state: "done", time: "05:46 – 06:03", duration: "17분" },
        { title: "waypoint name", state: "done", time: "06:03 – 06:20", duration: "17분" },
        { title: "waypoint name", state: "done", time: "06:20 – 06:41", duration: "21분" }
      ]
    },
    {
      // 10 · 대기 · 29% · Weak — 신호가 약해 보내지 못한다
      current: "대기 중",
      steps: [
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" }
      ]
    },
    {
      // 11 · 수행중 · 71% · Strong — 막바지에 가까워졌다
      current: "현재 수행명",
      steps: [
        { title: "waypoint name", state: "done", time: "09:40 – 09:58", duration: "18분" },
        { title: "waypoint name", state: "done", time: "09:58 – 10:12", duration: "14분" },
        { title: "waypoint name", state: "done", time: "10:12 – 10:29", duration: "17분" },
        {
          title: "Switchgear Room Thermal Scan",
          state: "running",
          time: "10:29 – 10:44",
          duration: "15분",
          desc: "배전반 발열을 훑는 중. 기준보다 높은 지점을 표시합니다."
        },
        { title: "waypoint name", state: "pending" }
      ]
    },
    {
      // 12 · 대기 · 55% 충전 · Good
      current: "충전 중",
      steps: [
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" },
        { title: "waypoint name", state: "pending" }
      ]
    }
  ];

  /*
   * 로봇 상세 Drawer 의 값 — Figma "Drawer / 로봇 상세" 778:11895.
   *
   * 여기 적은 것은 카드에서 읽을 수 없는 것들뿐이다.
   * 상태 · 배터리 · 신호는 카드 DOM 에서 그대로 읽는다 — 정의서 3번이
   * "Drawer 값은 로봇 실시간 상태를 그대로 표시" 라, 같은 값을 두 곳에
   * 적어 두면 언젠가 어긋난다. 한 곳(카드)만 고치면 Drawer 도 따라온다.
   *
   * 자리 · 시각 · 이벤트는 Figma 의 자리표시자를 본떠 지었다(서버가 없다).
   * dbm 은 신호 등급과 짝이 맞게 골랐다 — Strong ≥ −55, Good ≥ −67, Weak < −70.
   */
  var DETAILS = [
    {
      where: "터빈 2 / Unit 01 · SPOT-DD-0206 · 192.168.10.59",
      dbm: -47, last: "10:24:02 (방금)", odom: "X 41.2 / Y 18.6", dock: "DOCK_Station_01",
      events: [
        { text: "터빈2 순회 미션 시작", time: "10:04" },
        { text: "Spiral Casing 판독 완료", time: "09:52" },
        { text: "도킹 해제 · 자율주행 전환", time: "09:12" }
      ]
    },
    {
      // Figma 에 그려진 그 로봇이다 — 알림 문구도 컴포넌트 값 그대로 옮겼다.
      where: "터빈 2 / Unit 03 · SPOT-DD-0209 · 192.168.10.62",
      dbm: -78, last: "10:22:41 (2분 전)", odom: "X 12.8 / Y 44.1", dock: "DOCK_Station_02",
      notice: {
        title: "통신 불안정",
        desc: "RSSI −78dBm. 10:18부터 3회 재접속했습니다. 통신을 점검하기 전에는 새 미션을 배정할 수 없습니다."
      },
      events: [
        { text: "재접속 3회 실패 · RSSI −78", time: "10:22", tone: "warning" },
        { text: "신호 약함 감지 · 미션 일시정지", time: "10:18", tone: "warning" },
        { text: "터빈2 순회 미션 시작", time: "10:04" }
      ]
    },
    {
      where: "터빈 3 / Unit 02 · SPOT-DD-0211 · 192.168.10.64",
      dbm: -58, last: "10:23:19 (1분 전)", odom: "X 63.5 / Y 07.4", dock: "DOCK_Station_02",
      events: [
        { text: "충전 시작 · 35%", time: "10:11" },
        { text: "도킹 완료", time: "10:09" }
      ]
    },
    {
      where: "터빈 1 / Unit 04 · SPOT-DD-0203 · 192.168.10.55",
      dbm: -51, last: "10:23:47 (1분 전)", odom: "X 08.1 / Y 22.9", dock: "DOCK_Station_01",
      events: [
        { text: "순회 6구간 완료 · 이상 없음", time: "09:06" },
        { text: "터빈1 순회 미션 시작", time: "07:20" }
      ]
    },
    {
      where: "터빈 3 / Unit 01 · SPOT-DD-0214 · 192.168.10.67",
      dbm: -61, last: "10:24:05 (방금)", odom: "X 27.6 / Y 51.3", dock: "DOCK_Station_03",
      events: [
        { text: "Generator Bearing 진동 수집 중", time: "10:17" },
        { text: "터빈3 순회 미션 시작", time: "10:02" }
      ]
    },
    {
      where: "터빈 4 / Unit 02 · SPOT-DD-0216 · 192.168.10.69",
      dbm: -74, last: "10:21:58 (3분 전)", odom: "X 55.0 / Y 33.7", dock: "DOCK_Station_03",
      notice: {
        title: "배터리 부족",
        desc: "잔량 8%. 충전이 끝날 때까지 미션을 배정할 수 없습니다."
      },
      events: [
        { text: "저전압 경고 · 8%", time: "10:12", tone: "warning" },
        { text: "충전 시작", time: "10:10" },
        { text: "긴급 복귀 · 도킹", time: "10:07" }
      ]
    },
    {
      where: "터빈 1 / Unit 02 · SPOT-DD-0201 · 192.168.10.53",
      dbm: -49, last: "10:23:52 (방금)", odom: "X 03.4 / Y 11.2", dock: "DOCK_Station_01",
      events: [
        { text: "충전 96% · 대기 전환", time: "09:41" },
        { text: "순회 4구간 완료", time: "07:16" }
      ]
    },
    {
      where: "터빈 2 / Unit 05 · SPOT-DD-0210 · 192.168.10.63",
      dbm: -63, last: "10:23:30 (1분 전)", odom: "X 38.9 / Y 26.5", dock: "DOCK_Station_02",
      events: [
        { text: "미션 배정 대기", time: "10:15" },
        { text: "자가 점검 통과", time: "10:13" }
      ]
    },
    {
      where: "터빈 3 / Unit 04 · SPOT-DD-0215 · 192.168.10.68",
      dbm: -53, last: "10:24:00 (방금)", odom: "X 71.2 / Y 48.0", dock: "DOCK_Station_03",
      events: [
        { text: "순회 5구간 완료 · 이상 없음", time: "06:03" },
        { text: "터빈3 순회 미션 시작", time: "05:10" }
      ]
    },
    {
      // 연결이 끊긴 로봇 — 정의서 1·2번의 예외가 걸리는 자리다.
      where: "터빈 4 / Unit 05 · SPOT-DD-0218 · 192.168.10.71",
      dbm: null, last: "09:58:12 (26분 전)", odom: "X 84.7 / Y 19.3", dock: "DOCK_Station_04",
      events: [
        { text: "연결 끊김 · 응답 없음", time: "09:58", tone: "critical" },
        { text: "재접속 5회 실패", time: "09:56", tone: "warning" },
        { text: "신호 약함 감지", time: "09:47", tone: "warning" }
      ]
    },
    {
      where: "터빈 1 / Unit 01 · SPOT-DD-0200 · 192.168.10.52",
      dbm: -45, last: "10:24:07 (방금)", odom: "X 19.5 / Y 05.8", dock: "DOCK_Station_01",
      events: [
        { text: "Switchgear Room 열화상 촬영 중", time: "10:19" },
        { text: "터빈1 순회 미션 시작", time: "10:06" }
      ]
    },
    {
      where: "터빈 4 / Unit 01 · SPOT-DD-0217 · 192.168.10.70",
      dbm: -60, last: "10:23:41 (1분 전)", odom: "X 47.3 / Y 60.1", dock: "DOCK_Station_04",
      events: [
        { text: "충전 시작 · 55%", time: "10:20" },
        { text: "도킹 완료", time: "10:18" }
      ]
    }
  ];

  // 상태 배지는 Figma 에서 사라졌다 — 레일 표식과 카드 면이 그 역할을 한다.
  var STATE = {
    done: { klass: "is-done", icon: "var(--ic-check)" },
    running: { klass: "is-running", icon: "var(--ic-play-sm)" },
    pending: { klass: "is-pending", icon: null }
  };

  function el(tag, klass, text) {
    var node = document.createElement(tag);
    if (klass) {
      node.className = klass;
    }
    if (text !== undefined) {
      node.textContent = text;
    }
    return node;
  }

  /*
   * 점선 레일의 마디를 이어 붙인다.
   *
   * 점선은 .rail-line 마다 따로 그려지고(무늬는 CSS mask 다 — app-shell.css 참고),
   * 무늬(점 2 · 빈 6 · 주기 8)가 요소 맨 위에서 다시 시작한다. 칸 높이가 8 의 배수가
   * 아니라서 — 화면에서 재 보니 대기 칸이 84, 수행 칸이 82 다 — 칸이 바뀔 때마다 리듬이 깨진다.
   *   84 = 8*10 + 4  ->  점이 2px 남고 다음 칸이 곧바로 점을 찍어 사이가 6 이 아니라 2 가 된다
   *   82 = 8*10 + 2  ->  점끼리 붙어 4px 짜리 긴 점이 된다
   *
   * CSS 만으로는 못 고친다. 앞 칸이 얼마나 높은지를 뒤 칸이 알 방법이 없다.
   * 그래서 첫 점선을 기준으로 삼고, 그 아래 선들은 내려온 거리만큼 무늬를 밀어 준다.
   * 첫 점선은 안 민다 — 표식 바로 밑이 잘린 점으로 시작하면 그게 더 눈에 띈다.
   */
  var RAIL_DASH = 8;

  function phaseRails(timeline) {
    var lines = Array.prototype.slice.call(
      timeline.querySelectorAll(".is-running .rail-line, .is-pending .rail-line")
    );
    if (!lines.length) { return; }
    // 스크롤을 걷어낸 내용 좌표계로 옮긴다.
    var base = timeline.getBoundingClientRect().top - timeline.scrollTop;
    var origin = null;
    lines.forEach(function (line) {
      var y = line.getBoundingClientRect().top - base;
      if (origin === null) { origin = y; }
      var shift = (y - origin) % RAIL_DASH;
      var pos = "0 " + (-shift).toFixed(2) + "px";
      // background-position 이 아니라 mask-position 이다 — 무늬는 mask 로 도려낸다.
      line.style.maskPosition = pos;
      line.style.webkitMaskPosition = pos;
    });
  }

  function stepNode(step, index) {
    var meta = STATE[step.state];

    // 레일 — 선 18, (표식), 남은 선.
    // 대기 단계에는 표식이 없고 머리 선도 없다 — 점선 하나가 처음부터 끝까지 지난다.
    // 머리 선은 표식을 18 만큼 내려 카드 첫 줄 한가운데에 맞추는 몫이라 표식과 짝이다.
    var capsule = el("span", "rail-capsule");
    if (meta.icon) {
      capsule.appendChild(el("span", "rail-stub"));
      var mark = el("span", "rail-mark");
      var icon = el("span", "i i-14");
      icon.style.setProperty("--i", meta.icon);
      mark.appendChild(icon);
      capsule.appendChild(mark);
    }
    capsule.appendChild(el("span", "rail-line"));

    // 머리 첫 줄 — 번호는 왼쪽, 시각과 소요는 오른쪽으로 밀린다.
    var metaRow = el("div", "step-meta-row");
    metaRow.appendChild(el("span", "step-no t-label-1", String(index + 1)));
    var times = el("span", "step-times");
    if (step.time) {
      times.appendChild(el("span", "t-caption step-time num", step.time));
      times.appendChild(el("span", "t-caption step-duration", step.duration));
    }
    metaRow.appendChild(times);

    var titleRow = el("div", "step-title-row");
    titleRow.appendChild(el("span", "t-title-2 step-title", step.title));

    var head = el("div", "step-head");
    head.appendChild(metaRow);
    head.appendChild(titleRow);

    var card = el("div", "step-card");
    card.appendChild(head);

    if (step.desc) {
      card.appendChild(el("p", "t-caption step-desc", step.desc));
    }

    var wrap = el("div", "step-wrap");
    wrap.appendChild(card);

    var item = el("article", "timeline-item " + meta.klass);
    item.appendChild(capsule);
    item.appendChild(wrap);
    return item;
  }

  (function () {
    var timeline = document.querySelector("[data-timeline]");
    var cards = Array.prototype.slice.call(document.querySelectorAll("[data-robot]"));
    if (!timeline || !cards.length) {
      return;
    }

    var title = document.querySelector("[data-progress-title]");
    var count = document.querySelector("[data-progress-count]");
    var percent = document.querySelector("[data-progress-percent]");
    var track = document.querySelector("[data-progress-track]");

    function render(index) {
      var robot = ROBOTS[index];
      if (!robot) {
        return;
      }

      var total = robot.steps.length;
      var done = robot.steps.filter(function (s) { return s.state === "done"; }).length;

      title.textContent = robot.current;
      count.textContent = done + " / " + total;
      percent.textContent = Math.round((done / total) * 100) + "%";

      // 칸과 단계는 1:1 이다. 칸 색이 그 단계의 상태를 그대로 따른다.
      track.textContent = "";
      robot.steps.forEach(function (step) {
        track.appendChild(el("span", STATE[step.state].klass));
      });
      track.setAttribute("aria-label", total + "단계 중 " + done + "단계 완료");

      timeline.textContent = "";
      robot.steps.forEach(function (step, i) {
        timeline.appendChild(stepNode(step, i));
      });
      timeline.scrollTop = 0;
      phaseRails(timeline);
    }

    // 폭이 바뀌면 제목이 다르게 접혀 칸 높이가 달라진다 — 무늬를 다시 맞춘다.
    if (window.ResizeObserver) {
      new ResizeObserver(function () { phaseRails(timeline); }).observe(timeline);
    }

    cards.forEach(function (card) {
      card.addEventListener("click", function () {
        // 정의서 1번 — "연결 끊김 로봇은 클릭 불가". 선택도 타임라인도 그대로 둔다.
        if (card.hasAttribute("data-robot-offline")) { return; }
        cards.forEach(function (other) {
          other.setAttribute("aria-pressed", other === card ? "true" : "false");
        });
        render(Number(card.getAttribute("data-robot")));
      });
    });

    var initial = cards.filter(function (c) { return c.getAttribute("aria-pressed") === "true"; })[0] || cards[0];
    initial.setAttribute("aria-pressed", "true");
    render(Number(initial.getAttribute("data-robot")));
  })();

  // ------------------------------------------------------------------
  // 로봇 상세 Drawer — Figma "Drawer / 로봇 상세" 778:11895
  // 동작은 정의서(UI_99 862:42223) 를 그대로 따른다.
  //
  //   1  카드 1회 클릭       선택만 바뀐다 (위 블록이 한다)
  //   2  더블클릭 · 우클릭    Drawer 가 열린다. 선택은 건드리지 않는다.
  //                         이미 열려 있으면 그 로봇 값으로 갈아 끼운다.
  //   3  값                 카드에서 읽을 수 있는 것은 카드에서 읽는다.
  //                         최근 이벤트는 최신순으로 세운다.
  //   4  닫기               [✕] 와 ESC 뿐이다. 밖을 눌러도 열려 있다.
  //   5  알림               자동복귀 · 비상정지 때 알림이 뜨고 이벤트가 쌓인다.
  //
  // 모달이 아니다 — 배경막도 없고 뒤 화면에 inert 도 걸지 않는다.
  // 지도와 미션 패널을 그대로 쓰면서 옆에서 값을 읽는 자리다.
  // ------------------------------------------------------------------
  (function () {
    var drawer = document.querySelector("[data-robot-drawer]");
    var cards = Array.prototype.slice.call(document.querySelectorAll(".robot-strip [data-robot]"));
    if (!drawer || !cards.length) {
      return;
    }

    var slots = {};
    Array.prototype.slice.call(drawer.querySelectorAll("[data-rd]")).forEach(function (node) {
      slots[node.getAttribute("data-rd")] = node;
    });
    var nameSlot = drawer.querySelector("[data-rd-name]");
    var whereSlot = drawer.querySelector("[data-rd-where]");
    var notice = drawer.querySelector("[data-rd-notice]");
    var noticeTitle = drawer.querySelector("[data-rd-notice-title]");
    var noticeDesc = drawer.querySelector("[data-rd-notice-desc]");
    var eventList = drawer.querySelector("[data-rd-events]");
    var closeButton = drawer.querySelector("[data-rd-close]");

    var current = null;

    function card(index) {
      return document.querySelector(".robot-strip .robot-card[data-robot='" + index + "']");
    }

    function text(node) {
      return node ? node.textContent.trim() : "";
    }

    // 카드 배지 · 신호 등급을 Drawer 의 말로 옮긴다.
    var STATES = { "수행중": "미션 수행 중", "대기": "대기 중", "완료": "순회 완료", "끊김": "연결 끊김" };
    var SIGNALS = { Strong: "강함", Good: "보통", Weak: "약함", "끊김": "끊김" };

    /*
     * 정의서 3번 — "Drawer 값은 로봇 실시간 상태를 그대로 표시".
     * 상태 · 배터리 · 신호는 카드가 이미 들고 있다. 여기서 다시 적어 두면
     * 언젠가 두 값이 어긋나므로 카드 DOM 에서 그대로 읽는다.
     */
    function readCard(node) {
      var rows = node.querySelectorAll(".robot-row");
      var badge = text(node.querySelector(".badge"));
      var battery = rows[1] ? rows[1].querySelector(".battery") : null;
      var percent = text(rows[1] ? rows[1].querySelector(".num") : null);
      var level = text(rows[2] ? rows[2].querySelector(".t-caption:last-child") : null);
      var charging = !!(battery && battery.classList.contains("is-charging"));
      var number = parseInt(percent, 10);

      return {
        state: STATES[badge] || badge,
        // 충전 중이면 그렇게, 아니면 30% 이하일 때만 충전이 필요하다고 적는다.
        battery: percent + (charging ? " · 충전 중" : (number <= 30 ? " · 충전 필요" : "")),
        signal: SIGNALS[level] || level
      };
    }

    // 새 이벤트의 시각. 화면의 mock 시계가 10:24 언저리라 그 뒤로 한 칸씩 붙인다.
    var clock = 10 * 60 + 24;
    function nextTime() {
      clock += 1;
      var h = Math.floor(clock / 60) % 24;
      var m = clock % 60;
      return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
    }

    function fill(index) {
      var node = card(index);
      var detail = DETAILS[index] || {};
      var robot = ROBOTS[index] || {};
      if (!node) {
        return;
      }
      var read = readCard(node);

      // 이름은 아직 자리표시자다 — 카드도 Drawer 도 한 이름(Robot 00)으로 맞춰 뒀다.
      // 진짜 이름 규칙이 정해지면 여기 한 줄과 카드 라벨만 바꾸면 된다.
      nameSlot.textContent = "Robot 00";
      whereSlot.textContent = detail.where || "";

      slots.state.textContent = read.state;
      // \ubbf8\uc158\uc740 \uc218\ud589 \uc911\uc77c \ub54c\ub9cc \uc788\ub2e4. ROBOTS[].current \ub294 \ub300\uae30 \u00b7 \ubcf5\uadc0 \u00b7 \ucda9\uc804 \uac19\uc740
      // \uc0c1\ud0dc \ubb38\uad6c\ub3c4 \ub2f4\uace0 \uc788\uc5b4\uc11c, \uadf8\ub300\ub85c \uc4f0\uba74 \ubc14\ub85c \uc717\uc904\uacfc \uac19\uc740 \ub9d0\uc744 \ub450 \ubc88 \uc801\uac8c \ub41c\ub2e4.
      slots.mission.textContent = read.state === "\ubbf8\uc158 \uc218\ud589 \uc911" ? (robot.current || "\u2014") : "\u2014";
      slots.battery.textContent = read.battery;
      slots.last.textContent = detail.last || "\u2014";
      // Figma 는 "약함 · −78dBm" 이다. 끊긴 로봇은 셀 값이 없다.
      slots.signal.textContent = read.signal + (detail.dbm === null || detail.dbm === undefined
        ? "" : " · \u2212" + Math.abs(detail.dbm) + "dBm");
      slots.odom.textContent = detail.odom || "\u2014";
      slots.dock.textContent = detail.dock || "\u2014";

      if (detail.notice) {
        notice.hidden = false;
        notice.classList.toggle("is-critical", detail.notice.tone === "critical");
        notice.classList.toggle("is-warning", detail.notice.tone !== "critical");
        noticeTitle.textContent = detail.notice.title;
        noticeDesc.textContent = detail.notice.desc;
      } else {
        notice.hidden = true;
      }

      // 정의서 3번 — 최근 이벤트는 최신순이다. 데이터 순서에 기대지 않고 여기서 세운다.
      eventList.textContent = "";
      (detail.events || []).slice()
        .sort(function (a, b) { return a.time < b.time ? 1 : (a.time > b.time ? -1 : 0); })
        .forEach(function (item) {
          var row = el("li", "rd-event" + (item.tone ? " is-" + item.tone : ""));
          row.appendChild(el("span", "t-caption rd-event-text", item.text));
          row.appendChild(el("span", "t-caption num rd-event-time", item.time));
          eventList.appendChild(row);
        });
    }

    function open(index) {
      var node = card(index);
      // 정의서 1·2번 — 연결이 끊긴 로봇은 열리지 않는다.
      if (!node || node.hasAttribute("data-robot-offline")) {
        return;
      }
      fill(index);
      drawer.hidden = false;
      current = index;
      if (closeButton) {
        closeButton.focus();
      }
    }

    function close() {
      if (drawer.hidden) {
        return;
      }
      var back = current === null ? null : card(current);
      drawer.hidden = true;
      current = null;
      if (back && back.focus) {
        back.focus();
      }
    }

    cards.forEach(function (node) {
      var index = Number(node.getAttribute("data-robot"));
      // 더블클릭 — 선택은 앞선 클릭이 이미 했다. 여기서 다시 건드리지 않는다.
      node.addEventListener("dblclick", function (event) {
        event.preventDefault();
        open(index);
      });
      // 우클릭 — 선택을 아예 지나친다. 브라우저 메뉴는 띠 위에서 막는다.
      node.addEventListener("contextmenu", function (event) {
        event.preventDefault();
        open(index);
      });
    });

    if (closeButton) {
      closeButton.addEventListener("click", close);
    }

    // ESC 로 닫는다. 모달이 떠 있으면 그쪽이 먼저다 — 위에 있는 것부터 닫힌다.
    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || drawer.hidden) {
        return;
      }
      if (document.querySelector("[data-modal]:not([hidden])")) {
        return;
      }
      close();
    });

    /*
     * 정의서 5번 — "일시정지 · 자동복귀 시 Drawer 에 Alert 노출, [최근 이벤트]에 이력 추가".
     * 알림은 DETAILS 에 쌓는다. Drawer 가 닫혀 있어도 남았다가 다음에 열 때 보인다.
     * 화면에 "일시정지" 버튼은 없다 — 미션을 멈추는 자리가 E-STOP 이라 그 자리를 썼다.
     */
    function raise(next, item) {
      var chosen = document.querySelector(".robot-strip .robot-card[aria-pressed='true']");
      if (!chosen) {
        return;
      }
      var index = Number(chosen.getAttribute("data-robot"));
      var detail = DETAILS[index];
      if (!detail) {
        return;
      }
      detail.notice = next;
      detail.events = (detail.events || []).concat([
        { text: item.text, time: nextTime(), tone: item.tone }
      ]);
      if (current === index) {
        fill(index);
      }
    }

    document.addEventListener("aprism:estop", function () {
      raise({
        tone: "critical",
        title: "비상정지 발동",
        desc: "모터 전원이 차단되었습니다. 자세·안전 점검을 마친 뒤에 해제할 수 있습니다."
      }, { text: "비상정지 발동 · 모터 전원 차단", tone: "critical" });
    });

    document.addEventListener("aprism:recall", function () {
      raise({
        tone: "warning",
        title: "자동복귀 중",
        desc: "진행 중이던 미션을 중단하고 도킹 스테이션으로 복귀합니다. 복귀가 끝나면 대기 상태가 됩니다."
      }, { text: "자동복귀 시작 · 도킹 스테이션 이동", tone: "warning" });
    });
  })();

  // ------------------------------------------------------------------
  // 화면 이동 — [data-goto] 버튼을 누르면 같은 폴더의 그 페이지로 간다.
  // disabled 인 버튼은 무시한다(사전 점검이 끝나야 "미션 시작" 이 열린다).
  // ------------------------------------------------------------------
  (function () {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("[data-goto]"));
    buttons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.disabled) { return; }
        window.location.href = btn.getAttribute("data-goto");
      });
    });
  })();

  // ------------------------------------------------------------------
  // 미션 설정 폼 — 체크박스 · 스위치 · Select 드롭다운
  // 퍼블리싱용이라 값은 화면 안에서만 바뀐다.
  // ------------------------------------------------------------------
  (function () {
    // 체크박스: 클릭 / Space / Enter 로 토글, "N개 선택" 갱신
    var rows = Array.prototype.slice.call(document.querySelectorAll('.check-row[role="checkbox"]'));
    var countEl = document.querySelector(".check-group-head .count");

    function refreshCount() {
      if (!countEl) { return; }
      var n = document.querySelectorAll('.check-row[aria-checked="true"]').length;
      countEl.textContent = n + "개 선택";
    }

    rows.forEach(function (row) {
      function toggle() {
        row.setAttribute("aria-checked", row.getAttribute("aria-checked") === "true" ? "false" : "true");
        refreshCount();
      }
      row.addEventListener("click", toggle);
      row.addEventListener("keydown", function (event) {
        if (event.key === " " || event.key === "Enter") { event.preventDefault(); toggle(); }
      });
    });

    // 스위치
    Array.prototype.slice.call(document.querySelectorAll('.switch[role="switch"]')).forEach(function (sw) {
      sw.addEventListener("click", function () {
        sw.setAttribute("aria-checked", sw.getAttribute("aria-checked") === "true" ? "false" : "true");
      });
    });

    // Select 드롭다운
    var selects = Array.prototype.slice.call(document.querySelectorAll("[data-select]"));

    function closeSelects(except) {
      selects.forEach(function (sel) {
        if (sel === except) { return; }
        sel.removeAttribute("data-open");
        sel.querySelector("[data-select-trigger]").setAttribute("aria-expanded", "false");
        sel.querySelector(".field-menu").hidden = true;
      });
    }

    selects.forEach(function (sel) {
      var trigger = sel.querySelector("[data-select-trigger]");
      var menu = sel.querySelector(".field-menu");
      var valueEl = sel.querySelector("[data-select-value]");
      var options = Array.prototype.slice.call(sel.querySelectorAll(".field-option"));

      trigger.addEventListener("click", function (event) {
        event.stopPropagation();
        var open = sel.hasAttribute("data-open");
        closeSelects(sel);
        if (open) {
          sel.removeAttribute("data-open");
          trigger.setAttribute("aria-expanded", "false");
          menu.hidden = true;
        } else {
          sel.setAttribute("data-open", "");
          trigger.setAttribute("aria-expanded", "true");
          menu.hidden = false;
        }
      });

      options.forEach(function (opt) {
        opt.addEventListener("click", function () {
          valueEl.textContent = opt.textContent;
          options.forEach(function (o) { o.removeAttribute("aria-selected"); });
          opt.setAttribute("aria-selected", "true");
          sel.removeAttribute("data-open");
          trigger.setAttribute("aria-expanded", "false");
          menu.hidden = true;
        });
      });

      sel.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && sel.hasAttribute("data-open")) {
          sel.removeAttribute("data-open");
          trigger.setAttribute("aria-expanded", "false");
          menu.hidden = true;
          trigger.focus();
        }
      });
    });

    if (selects.length) {
      document.addEventListener("click", function (event) {
        var inside = selects.some(function (sel) { return sel.contains(event.target); });
        if (!inside) { closeSelects(null); }
      });
    }
  })();

  // ------------------------------------------------------------------
  // 사전 점검 — 항목이 하나씩 통과한다. 넷이 다 통과하면
  // "미션 시작" 이 열리고, 잠시 뒤 자동으로 미션 모니터링으로 넘어간다.
  // (Figma 안내: "점검이 끝나면 자동으로 시작합니다")
  // ------------------------------------------------------------------
  (function () {
    var list = document.querySelector("[data-precheck]");
    if (!list) { return; }

    var pending = Array.prototype.slice.call(list.querySelectorAll("[data-precheck-row]"));
    var tag = list.querySelector("[data-precheck-tag]");
    var startBtn = document.querySelector(".btn-line.is-start");
    // 간격은 CSS 가 정한다(--precheck-step) — 게이지가 차는 시간과 같은 값이어야 한다.
    var STEP = parseFloat(getComputedStyle(list).getPropertyValue("--precheck-step")) || 1400;

    function complete(row) {
      row.classList.remove("is-running", "is-active", "is-pending");
      row.classList.add("is-done");
      var icon = row.querySelector(".i");
      if (icon) { icon.style.setProperty("--i", "var(--ic-delta)"); }
      var meta = row.querySelector(".meta");
      if (meta) {
        meta.textContent = row.getAttribute("data-done-meta") || "";
        meta.classList.remove("is-plain");
      }
    }

    function tick() {
      var next = pending.shift();
      if (!next) {
        if (tag) { tag.textContent = "완료"; }
        if (startBtn) { startBtn.disabled = false; }
        window.setTimeout(function () {
          window.location.href = "dashboard-home.html";
        }, 1600);
        return;
      }
      complete(next);
      // 다음 대기 항목을 "확인 중" 으로 승격
      if (pending[0]) {
        pending[0].classList.remove("is-pending");
        pending[0].classList.add("is-running", "is-active");
        var m = pending[0].querySelector(".meta");
        if (m) { m.textContent = "확인중.."; }
      }
      window.setTimeout(tick, STEP);
    }

    window.setTimeout(tick, STEP);
  })();
})();
