/*
 * [11/02 v6] 관제 팝오버 [진단 상세] → 안전진단 상세 모핑(View Transitions, 페이지 사이).
 * 짝이 되는 세 덩어리에 같은 이름을 붙인다(v6.css) — 머리(dx-head) · 사진(dx-shot) · DELTA 조치 판(dx-act).
 * 브라우저가 페이지가 바뀌는 사이 자리 · 크기를 이어 움직인다. 크롬 · 엣지 126+ · http(s) 에서만(file:// · 다른 브라우저는 그냥 넘어간다).
 * 다른 길(GNB · 탭 · 뒤로)로 오가면 전환을 건너뛴다 — [진단 상세] 를 눌렀을 때만 모핑.
 * [11/02] 팝오버에서 고른 조치(체크)와 메모를 상세의 DELTA 조치 판으로 넘긴다(디자이너 — 판이 이어 움직이니 내용도 이어져야 한다).
 *   같은 조치 이름은 체크 상태를 옮기고, 상세 목록에 없는 조치를 팝오버에서 골랐으면 맨 아래 줄로 더한다. 넘긴 값은 한 번 쓰고 지운다.
 */
(function () {
  "use strict";
  var KEY = "aprism-morph";
  var go = false;
  var CARRY = "aprism-ma-carry";
  document.addEventListener("click", function (e) {
    var more = e.target.closest && e.target.closest("[data-ma-more]");
    if (!more) { return; }
    go = true;
    var box = more.closest(".map-alert") || document;
    var acts = Array.prototype.map.call(box.querySelectorAll(".ma-check"), function (row) {
      var l = row.querySelector(".ma-check-label");
      return { t: (l ? l.textContent : row.getAttribute("data-act") || "").trim(), on: row.getAttribute("aria-checked") === "true" || row.getAttribute("aria-pressed") === "true" };
    });
    var memo = box.querySelector("[data-ma-memo-field]");
    try { sessionStorage.setItem(CARRY, JSON.stringify({ href: more.getAttribute("href"), acts: acts, memo: memo ? memo.value : "" })); } catch (err) { /* 저장 막힘 */ }
  }, true);

  // 안전진단 쪽 — 처음 그린 상세에 넘겨받은 값을 얹는다(safety.js 가 body 끝에서 바로 그린 뒤)
  function carryIn() {
    var c = null;
    try { c = JSON.parse(sessionStorage.getItem(CARRY) || "null"); sessionStorage.removeItem(CARRY); } catch (err) { return; }
    if (!c) { return; }
    var dl = document.querySelector(".sf .dl");
    if (!dl) { return; }
    var cks = dl.querySelector(".cks");
    var rows = Array.prototype.slice.call(dl.querySelectorAll("label.c1x"));
    c.acts.forEach(function (a) {
      var hit = rows.filter(function (r) { var b = r.querySelector("b"); return b && b.textContent.trim() === a.t; })[0];
      if (hit) { var inp = hit.querySelector("input"); if (inp) { inp.checked = a.on; } return; }
      if (!a.on || !cks) { return; }
      var lab = document.createElement("label"); lab.className = "c1x";
      var inp2 = document.createElement("input"); inp2.type = "checkbox"; inp2.checked = true;
      var sp = document.createElement("span"); var b = document.createElement("b"); b.textContent = a.t;
      var sm = document.createElement("small"); sm.textContent = "관제 팝오버에서 고름";
      sp.appendChild(b); sp.appendChild(sm); lab.appendChild(inp2); lab.appendChild(sp); cks.appendChild(lab);
    });
    var memo = document.getElementById("sfMemo");
    if (memo && c.memo) { memo.value = c.memo; }
  }
  if (document.querySelector("[data-sf]") || /safety-v6/.test(location.pathname)) {
    document.addEventListener("DOMContentLoaded", carryIn);
  }
  window.addEventListener("pageswap", function (e) {
    if (!e.viewTransition) { return; }
    if (!go) { e.viewTransition.skipTransition(); return; }
    try { sessionStorage.setItem(KEY, "1"); } catch (err) { /* 저장 막힘 */ }
  });
  window.addEventListener("pagereveal", function (e) {
    var ok = false;
    try { ok = sessionStorage.getItem(KEY) === "1"; sessionStorage.removeItem(KEY); } catch (err) { /* 저장 막힘 */ }
    if (e.viewTransition && !ok) { e.viewTransition.skipTransition(); }
  });
})();
