/*
 * [11/12 디자이너 v7] 미션 탭을 바꿀 때 로봇 카드 진행 % 와 웨이포인트 머리 수(7/20)를 0 에서 세어 올린다 — 막대도 0 에서 같이 차오른다.
 *   · 탭 전환(= 로봇 카드 선택 → screen.js 가 목록을 다시 그리고 aprism:mission)과 첫 화면에서만. 진행 중 갱신(route-sim)은 지금처럼 바로 바뀐다
 *   · 글자(textContent)는 그대로 둔다 — Delta 답 · 팝오버가 이 글을 읽는다. 보이는 숫자만 CSS 카운터(--cu-n, @property 정수)로 센다(v7.css "카운팅")
 *   · 분모(20)는 바로 · 0 이면 세지 않는다 · 움직임 줄이기 설정이면 끈다
 */
(function () {
  "use strict";
  if (!document.body.classList.contains("ver-7")) { return; }
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)");
  var DUR = 600;
  var timer = 0;

  function pct() { return document.querySelector("[data-progress-percent]"); }
  function wpn() { return document.querySelector(".rr-wp-head .rr-wp-n"); }
  function track() { return document.querySelector(".rc-box [data-progress-track]"); }

  // 지금 글자에서 셀 목표를 읽는다 — % 는 숫자, 머리 수는 "7/20" 의 7(분모는 data-cu-total 로 바로 보여 준다)
  function target(el) {
    if (!el) { return null; }
    var t = el.textContent.trim(), m = /^(\d+)\s*(?:%|\/\s*(\d+))?$/.exec(t);
    if (!m) { return null; }
    if (m[2] !== undefined) { el.setAttribute("data-cu-total", m[2]); }
    return Number(m[1]);
  }

  // 진짜 숫자(첫 글자 덩이)만 칸(.cu-raw)으로 감싼다 — 글자(textContent)는 그대로, 카운터는 이 칸 안에 겹친다(v7.css)
  function wrap(el) {
    var tn = el.firstChild;
    if (!tn || tn.nodeType !== 3 || !tn.nodeValue.trim()) { return false; }
    var sp = document.createElement("span");
    sp.className = "cu-raw";
    if (el.hasAttribute("data-cu-total")) { sp.setAttribute("data-cu-total", el.getAttribute("data-cu-total")); }
    el.insertBefore(sp, tn); sp.appendChild(tn);
    return true;
  }
  function unwrap(el) {
    Array.prototype.forEach.call(el.querySelectorAll(".cu-raw"), function (sp) {
      while (sp.firstChild) { sp.parentNode.insertBefore(sp.firstChild, sp); }
      sp.remove();
    });
    el.normalize();
  }

  function stop() {
    clearTimeout(timer);
    [pct(), wpn()].forEach(function (el) { if (el) { el.classList.remove("is-counting"); el.style.removeProperty("--cu-n"); unwrap(el); } });
    var tr = track(); if (tr) { tr.classList.remove("cu-zero", "cu-run"); }
  }

  function run() {
    if (reduce && reduce.matches) { return; }
    stop();
    var els = [pct(), wpn()].filter(function (el) { return el && target(el) && wrap(el); });   // 0 · 읽지 못한 값은 뺀다
    var tr = track();
    if (!els.length) { return; }
    els.forEach(function (el) { el.style.setProperty("--cu-n", "0"); el.classList.add("is-counting"); });
    if (tr) { tr.classList.add("cu-zero"); }
    void document.body.offsetWidth;   // 0 을 한 번 그려야 거기서부터 옮겨 간다
    els.forEach(function (el) { el.style.setProperty("--cu-n", String(target(el))); });
    if (tr) { tr.classList.remove("cu-zero"); tr.classList.add("cu-run"); }
    timer = setTimeout(stop, DUR + 80);
  }

  // 세는 사이에 값이 바뀌면(route-sim 이 한 박자 늦게 적는 경우) 목표만 갈아 끼운다
  function follow(el) {
    if (!el) { return; }
    new MutationObserver(function () {
      if (!el.classList.contains("is-counting")) { return; }
      var n = target(el);
      if (n === null) { stop(); } else { el.style.setProperty("--cu-n", String(n)); }
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  // screen.js · map-v6.js(머리 수 · % 단위 나누기)가 setTimeout 0 으로 마저 적은 뒤에 센다
  function soon() { clearTimeout(timer); timer = setTimeout(run, 40); }
  document.addEventListener("aprism:mission", soon);
  window.addEventListener("load", function () {
    setTimeout(function () { follow(pct()); run(); }, 120);   // 머리 수는 map-v6.js 가 바뀔 때마다 새로 만들어 따라갈 필요가 없다(새 칸은 진짜 값)
  });
})();
