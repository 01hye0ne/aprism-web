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

    // 레일 — 선 18, (표식), 남은 선. 대기 단계에는 표식이 없다.
    var capsule = el("span", "rail-capsule");
    capsule.appendChild(el("span", "rail-stub"));
    if (meta.icon) {
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
})();
