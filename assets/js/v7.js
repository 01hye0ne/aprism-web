/*
 * v7 한글판 주소 잇기 — v7 화면은 v6 과 같은 JS 를 쓰고, 그 JS 는 화면 사이 주소를 "*-v6.html" 로 만든다.
 * v7 화면(*-v7.html)에서만 실어, v6 화면으로 가는 주소를 같은 이름의 v7 화면으로 바꾼다.
 *   1) JS 가 부르는 window.aprismHref(영문판 주소 바꾸개와 같은 자리)  2) 링크 · iframe 등의 속성(바뀔 때마다)
 *   3) 그래도 빠진 이동(location.href = …)은 Navigation API 로 가로채 v7 로 돌린다.
 * 영문판(*-v6-en.html)은 v7 한글판에서 만들지만 이 파일은 빼고 만든다(tools/build-en.mjs) — 영문판 주소는 i18n-en.js 가 맡는다.
 */
(function () {
  "use strict";
  var RX = /(^|\/)(mission-setup|mission-precheck|building|main|control|alert-center|safety|report)-v6\.html(?=$|[?#])/;
  function to7(u) { return typeof u === "string" ? u.replace(RX, "$1$2-v7.html") : u; }
  window.APRISM_VER = 7;
  window.aprismHref = to7;
  var ATTRS = ["href", "src", "data-goto", "data-monitor-href", "data-modal-confirm", "action"];
  function fix(el) {
    if (!el || !el.getAttribute) { return; }
    for (var i = 0; i < ATTRS.length; i++) {
      var v = el.getAttribute(ATTRS[i]);
      if (v && RX.test(v)) { el.setAttribute(ATTRS[i], to7(v)); }
    }
  }
  function sweep(root) {
    if (!root || root.nodeType !== 1) { return; }
    fix(root);
    var list = root.querySelectorAll("[href],[src],[data-goto],[data-monitor-href],[data-modal-confirm],[action]");
    for (var i = 0; i < list.length; i++) { fix(list[i]); }
  }
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      if (m.type === "attributes") { fix(m.target); } else { m.addedNodes.forEach(sweep); }
    });
  }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ATTRS });
  document.addEventListener("DOMContentLoaded", function () { sweep(document.documentElement); });
  if (window.navigation) {
    window.navigation.addEventListener("navigate", function (e) {
      if (!e.cancelable || e.hashChange || e.downloadRequest) { return; }
      var u = e.destination.url;
      if (!RX.test(new URL(u).pathname)) { return; }
      e.preventDefault();
      location.href = to7(u);
    });
  }
})();
