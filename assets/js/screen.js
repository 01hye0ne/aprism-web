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

    function apply(open) {
      panel.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", open ? "true" : "false");
      button.setAttribute("aria-label", open ? "요약 접기" : "요약 펼치기");
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

    // closed 상태의 [확인] — 주의 알림을 받았다는 응답. 누르면 화면·패널을 일반(파란) 상태로
    // 되돌리고, 두 줄을 일반 상태 멘트로 바꾼다.
    //
    // 첫 줄은 인사, 둘째 줄이 본문이다(닫힘 16/24, 펼침 20/32 — 크기는 CSS 가 정한다).
    // 닫힘·펼침 두 판에 같은 클래스가 하나씩 있어서 넷을 다 바꾼다.
    var ack = panel.querySelector("[data-ai-ack]");
    if (ack) {
      var NORMAL_LINE_1 = "안녕하세요, 홍길동 님.";
      var NORMAL_LINE_2 = "인계된 알림 3건과 진행 예정인 미션 1건이 있어요. 먼저 살펴볼까요?";
      // 태그도 같이 바꾼다 — 주의 상태 문구가 그대로 남으면 새 멘트와 안 맞는다.
      var NORMAL_TAG = "인계 알림 3건 · 예정 미션 1건";

      function setLines(one, two) {
        Array.prototype.slice.call(panel.querySelectorAll(".ai-line-1"))
          .forEach(function (el) { el.textContent = one; });
        Array.prototype.slice.call(panel.querySelectorAll(".ai-line-2"))
          .forEach(function (el) { el.textContent = two; });
      }

      ack.addEventListener("click", function () {
        panel.classList.remove("is-warning");
        if (orb) { orb.setPalette(severity()); }
        var twoCol = panel.closest(".two-col");
        if (twoCol) {
          twoCol.classList.remove("is-warning");
        }
        setLines(NORMAL_LINE_1, NORMAL_LINE_2);
        var tag = panel.querySelector("[data-ai-tag-text]");
        if (tag) { tag.textContent = NORMAL_TAG; }
      });
    }

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
    }

    cards.forEach(function (card) {
      card.addEventListener("click", function () {
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
