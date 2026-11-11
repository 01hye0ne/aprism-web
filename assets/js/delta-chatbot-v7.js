/*
 * [11/11 v7 디자이너] Delta 챗봇형 시안(main-v7-chat · body.d3-chat).
 *   웹사이트 챗봇처럼 지도 오른쪽 아래(지도 도구 줄 밑)에 Delta 오브 단추가 서고, Delta 가 하는 말(요약 두 줄)은 그 옆 말풍선으로 뜬다.
 *   말풍선 · 오브를 누르면 대화창이 열린다 — 대화창은 원래 Delta 창(.delta3.is-open)을 오른쪽 아래로 옮겨 쓴다(답 · 묻기 · 대화가 그대로 돈다).
 *   왼쪽 위 Delta 카드는 숨는다 — 비는 자리는 알림 팝오버가 위까지 채워 쓴다(map-v6.js v7Room · v7.css).
 *   말풍선 글은 Delta 카드의 두 줄(.ai-line-1 · .ai-line-2)을 그대로 비춘다 — 카드 글이 바뀌면 따라 바뀐다. 단계 색(위험 · 주의)도 카드를 따른다.
 *   말풍선 [×] 로 닫으면 Delta 글이 새로 바뀔 때 다시 뜬다.
 */
(function () {
  "use strict";
  var body = document.body;
  if (!body.classList.contains("d3-chat")) { return; }
  var win = document.querySelector("[data-delta3]");
  var toggle = win && win.querySelector("[data-ai-toggle]");
  var stage = win && win.parentElement;
  if (!win || !toggle || !stage) { return; }

  var dock = document.createElement("div");
  dock.className = "dchat";
  dock.innerHTML =
    '<div class="dchat-bubble" role="status">' +
      '<button type="button" class="dchat-bubble-body" aria-label="Delta 대화창 열기"><span class="dchat-l1"></span><span class="dchat-l2"></span></button>' +
      '<button type="button" class="dchat-x" aria-label="말풍선 닫기"><span class="i i-16" style="--i:var(--ic-close)" aria-hidden="true"></span></button>' +
    '</div>' +
    '<button type="button" class="dchat-orb" aria-label="Delta 대화창 열기" aria-expanded="false"><span class="dchat-orb-in" aria-hidden="true"></span><span class="dchat-badge" hidden></span></button>';
  stage.appendChild(dock);
  var bubble = dock.querySelector(".dchat-bubble"), l1 = dock.querySelector(".dchat-l1"), l2 = dock.querySelector(".dchat-l2");
  var orbBtn = dock.querySelector(".dchat-orb"), badge = dock.querySelector(".dchat-badge");

  // 오브 — 관제 Delta 와 같은 Prism Orb(WebGL2). 못 쓰면 CSS 그라데이션 원이 남는다
  var orb = null;
  function sev() { return win.classList.contains("is-critical") ? "critical" : win.classList.contains("is-warning") ? "warning" : win.classList.contains("is-safe") ? "safe" : "info"; }
  if (window.PrismOrb) { orb = window.PrismOrb.mount(dock.querySelector(".dchat-orb-in"), { palette: sev() }); }

  var dismissed = "", lastKey = "";
  function sync() {
    var a = win.querySelector(".delta3-card .ai-line-1"), b = win.querySelector(".delta3-card .ai-line-2");
    var t1 = a ? a.textContent.trim() : "", t2 = b ? b.textContent.trim() : "";
    var key = t1 + "|" + t2;
    if (key !== lastKey) {
      lastKey = key;
      l1.textContent = t1;
      l2.innerHTML = b ? b.innerHTML : "";   // 번호 원(.dl-wp) 같은 표식을 그대로 — 같은 화면이 만든 글이다
    }
    var s = sev();
    dock.setAttribute("data-sev", s);
    if (orb && orb.setPalette) { orb.setPalette(s); }
    var open = win.classList.contains("is-open");
    body.classList.toggle("dchat-open", open);
    orbBtn.setAttribute("aria-expanded", String(open));
    orbBtn.setAttribute("aria-label", open ? "Delta 대화창 닫기" : "Delta 대화창 열기");
    bubble.hidden = open || dismissed === key || !t1;
    // 말풍선을 닫아 두었을 때 위험 · 주의면 오브에 점
    badge.hidden = open || !bubble.hidden || (s !== "critical" && s !== "warning");
  }
  new MutationObserver(sync).observe(win, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });

  function openChat() { if (!win.classList.contains("is-open")) { toggle.click(); } sync(); }
  dock.querySelector(".dchat-bubble-body").addEventListener("click", openChat);
  orbBtn.addEventListener("click", function () { toggle.click(); sync(); });
  dock.querySelector(".dchat-x").addEventListener("click", function () { dismissed = lastKey; sync(); });

  /*
   * 자리 — 오브의 오른쪽 끝 = 지도 도구 줄 오른쪽 끝, 아래 끝 = 우측 패널 아래 끝(지도 칸 바닥에서 같은 여백).
   *   대화창은 오브 위에 오른쪽 끝을 맞춰 선다(--dchat-r · --dchat-b 를 v7.css 가 쓴다)
   */
  function place() {
    var sb = stage.getBoundingClientRect();
    var tools = document.querySelector(".map-canvas > .map-tools");
    var tb = tools && tools.getClientRects().length ? tools.getBoundingClientRect() : null;
    var panel = document.querySelector(".right-panel"), pb = panel && panel.getClientRects().length ? panel.getBoundingClientRect() : null;
    var r = tb ? Math.max(8, sb.right - tb.right) : 16;
    var b = pb ? Math.max(8, sb.bottom - pb.bottom) : 16;
    stage.style.setProperty("--dchat-r", Math.round(r) + "px");
    stage.style.setProperty("--dchat-b", Math.round(b) + "px");
    // 시안 리모콘(.rsim)이 펼쳐져 있으면 말풍선 · 대화창은 그 위로 — 오브는 리모콘 오른쪽이라 그 자리
    var sim = document.querySelector(".rsim"), sr = sim && !sim.classList.contains("is-folded") && sim.getClientRects().length ? sim.getBoundingClientRect() : null;
    var lift = sr ? Math.max(b, Math.round(sb.bottom - sr.top + 8)) : b;
    stage.style.setProperty("--dchat-lift", lift + "px");
  }
  place();
  window.addEventListener("resize", place);
  if (window.ResizeObserver) { new ResizeObserver(place).observe(stage); }
  setTimeout(place, 600);
  var simEl = document.querySelector(".rsim");
  if (simEl) { new MutationObserver(place).observe(simEl, { attributes: true, attributeFilter: ["class", "hidden", "style"] }); }
  document.addEventListener("click", function () { setTimeout(place, 0); });
  sync();
})();
