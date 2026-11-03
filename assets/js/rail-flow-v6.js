/*
 * [11/03 v6] 웨이포인트 레일 "지금 가는 길" 빛줄기 — 한 줄로 이어 흐르게(디자이너 "빛이 다 끊긴 채로").
 *   예전엔 위 칸 선(rail-line) · 지금 칸 머리(rail-stub)에 따로 흘러 칸 경계에서 사라졌다 다시 나타났고(0.9초 늦춤), 고리 자리엔 빛이 없었다.
 *   지나온 지점 점 가운데 → 지금 지점 고리 가운데를 덮는 판(.rail-flow) 하나를 레일 위에 얹고 그 안에서만 빛 띠가 흐른다.
 *   이동 중(.rr-flow)에만 흐른다 — route-sim 이 켜고 끈다. 판 자리는 목록이 바뀌거나 스크롤 · 크기가 바뀔 때 다시 잰다.
 */
(function () {
  "use strict";
  var tl = null, flow = null, raf = 0;

  function place() {
    raf = 0;
    tl = tl || document.querySelector("[data-timeline]");
    if (!tl) { return; }
    // [11/03] 지나온 길 점선 위상 — 칸 선 · 칸 머리 · 표식 자리가 따로 점선을 시작해 경계마다 간격이 어긋났다. 목록 맨 위에서 6 마다 오게 맞춘다
    var hb = tl.getBoundingClientRect();
    tl.querySelectorAll(".timeline-item.is-done .rail-stub, .timeline-item.is-done .rail-line, .timeline-item.is-done .rail-mark").forEach(function (el) {
      var y = el.getBoundingClientRect().top - hb.top + tl.scrollTop;
      el.style.setProperty("--dy", (-(((y % 6) + 6) % 6)).toFixed(2) + "px");
    });
    var run = tl.querySelector(".timeline-item.is-running"), prev = run && run.previousElementSibling;
    var a = prev && (prev.querySelector(".rail-mark") || prev.querySelector(".rail-capsule"));
    var b = run && run.querySelector(".rail-mark");
    if (!flow) { flow = document.createElement("span"); flow.className = "rail-flow"; flow.setAttribute("aria-hidden", "true"); }
    if (!a || !b) { flow.hidden = true; return; }
    if (flow.parentNode !== tl) { tl.appendChild(flow); }
    var host = tl.getBoundingClientRect(), ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    var pd = prev.querySelector(".rail-dot"), top = (pd ? pd.getBoundingClientRect().bottom : ra.top + ra.height / 2) - host.top + tl.scrollTop,   // [11/03] 지나온 표식(세모 · 점) 아랫변에서 시작 — 빛이 표식 위로 지나지 않게
      bottom = (run.querySelector(".rail-dot") || b).getBoundingClientRect().top - host.top + tl.scrollTop;   // 고리 윗변에서 끝 — 고리 안으로 빛이 새지 않게
    var cx = rb.left + rb.width / 2 - host.left + tl.scrollLeft;
    flow.hidden = false;
    flow.style.top = top + "px";
    flow.style.height = Math.max(0, bottom - top) + "px";
    flow.style.left = (cx - 5) + "px";
    flow.style.setProperty("--h", Math.max(0, bottom - top) + "px");
  }
  function later() { if (!raf) { raf = requestAnimationFrame(place); } }

  function start() {
    if (!document.body.classList.contains("ver-6")) { return; }   // <head> 에서 읽혀 body 를 여기서 본다
    tl = document.querySelector("[data-timeline]");
    if (!tl) { setTimeout(start, 300); return; }
    if (getComputedStyle(tl).position === "static") { tl.style.position = "relative"; }
    new MutationObserver(later).observe(tl, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    window.addEventListener("resize", later);
    later();
  }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", start); } else { start(); }
})();
