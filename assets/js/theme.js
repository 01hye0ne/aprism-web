// Dark Mode를 기본으로 하고, 선택한 테마는 브라우저에 저장한다.
(function () {
  var STORAGE_KEY = "aprism-theme";
  var root = document.documentElement;
  var button = document.querySelector("[data-theme-toggle]");
  var label = document.querySelector("[data-theme-label]");

  function read() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      return null;
    }
  }

  function save(theme) {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      /* 저장이 막힌 환경에서도 페이지는 동작해야 한다. */
    }
  }

  function apply(theme) {
    root.setAttribute("data-theme", theme);
    if (label) {
      label.textContent = theme === "light" ? "Light" : "Dark";
    }
  }

  // ?theme=light 로 링크를 공유하면 상대방도 같은 모드로 본다.
  function forced() {
    var m = /[?&]theme=(light|dark)/.exec(location.search);
    return m ? m[1] : null;
  }

  apply(forced() || (read() === "light" ? "light" : "dark"));

  // ?palette=neutral — 톤 실험실의 제안 팔레트(palette-neutral.css)를 씌워 본다. 저장하지 않는다.
  var palette = /[?&]palette=(neutral)/.exec(location.search);
  if (palette) { root.setAttribute("data-palette", palette[1]); }

  // ?delta=glass · off — 위험 Delta 를 빛으로 강조한 판(v2.2 기본, 10/12 채택)을 켜고 끈다. 저장하지 않는다.
  var delta = /[?&]delta=(glass|off)/.exec(location.search);
  if (delta && delta[1] === "off") { root.removeAttribute("data-delta"); }
  else if (delta) { root.setAttribute("data-delta", delta[1]); }

  // ?glow=top · off — 위험 Delta 의 빛을 왼쪽 위 모서리에서(v2.2 기본, 10/13 채택) · 아래 변에서. 저장하지 않는다.
  var glow = /[?&]glow=(top|off)/.exec(location.search);
  if (glow && glow[1] === "off") { root.removeAttribute("data-glow"); }
  else if (glow) { root.setAttribute("data-glow", glow[1]); }

  if (button) {
    button.addEventListener("click", function () {
      var next = root.getAttribute("data-theme") === "light" ? "dark" : "light";
      apply(next);
      save(next);
    });
  }
})();

/*
 * Signal 막대 — 배율이 소수인 모니터(Windows 125% · 150%)에서 막대마다 굵기가 달라 보이던 것(2026-10-16).
 * CSS 상자로는 크롬이 1/64px 단위로 배치하고 가장자리를 번지게 그려 막을 수 없었다.
 * 그래서 막대를 기기 픽셀 정수로 셈한 SVG(shape-rendering: crispEdges)로 다시 그린다 — 칸 사이에 걸려도
 * 가장자리가 반 칸씩 번지지 않는다. 마크업(<i> 넷 · data-level)과 색(currentColor · 꺼진 칸은 chart-track)은 그대로다.
 */
(function () {
  var HEIGHTS = [5, 8, 11, 14];
  function draw(b) {
    var d = window.devicePixelRatio || 1;
    var w = Math.round(3 * d), g = Math.round(2 * d);
    var hs = HEIGHTS.map(function (h) { return Math.round(h * d); });
    var W = 4 * w + 3 * g, H = hs[3];
    // data-level 이 없으면 넷 다 켠다(상태 바 신호) — Number(null) 은 0 이라 따로 본다.
    var raw = b.getAttribute("data-level");
    var level = raw === null || raw === "" ? 4 : Number(raw);
    if (isNaN(level)) { level = 4; }
    var svg = b.querySelector("svg.signal-svg");
    if (!svg) {
      svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "signal-svg");
      svg.setAttribute("aria-hidden", "true");
      b.appendChild(svg);
    }
    svg.setAttribute("width", String(W / d));
    svg.setAttribute("height", String(H / d));
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.innerHTML = hs.map(function (h, k) {
      // 모서리는 막대 폭의 절반 — CSS 때의 둥근 머리(radius/card 가 3px 폭에 눌린 모양)와 같다.
      // 곧은 변은 정수 기기 픽셀에 놓여 있어 crispEdges 없이도 또렷하다(둥근 끝만 부드럽게 섞인다).
      return '<rect x="' + k * (w + g) + '" y="' + (H - h) + '" width="' + w + '" height="' + h + '" rx="' + (w / 2) + '"' +
        (k < level ? ' fill="currentColor"' : ' class="off"') + "/>";
    }).join("");
    b.classList.add("is-svg");
    // SVG 자신의 왼쪽 위가 칸 사이에 걸리면 곧은 변도 반 칸 번진다 — 모자라는 만큼 민다.
    svg.style.transform = "";
    var r = svg.getBoundingClientRect();
    var ox = (Math.round(r.left * d) - r.left * d) / d;
    var oy = (Math.round(r.top * d) - r.top * d) / d;
    if (Math.abs(ox) > 0.001 || Math.abs(oy) > 0.001) { svg.style.transform = "translate(" + ox.toFixed(4) + "px," + oy.toFixed(4) + "px)"; }
  }
  function all() { Array.prototype.forEach.call(document.querySelectorAll(".signal-bars"), draw); }
  var t = null;
  function later() { clearTimeout(t); t = setTimeout(all, 30); }
  if (document.readyState === "loading") { document.addEventListener("DOMContentLoaded", all); } else { all(); }
  window.addEventListener("load", later);
  window.addEventListener("resize", later);
  // 배율이 바뀌면(창을 다른 모니터로) 다시 그린다. 단계(data-level)가 바뀌어도 다시 그린다.
  if (window.matchMedia) {
    (function watch() {
      var mq = window.matchMedia("(resolution: " + (window.devicePixelRatio || 1) + "dppx)");
      var on = function () { if (mq.removeEventListener) { mq.removeEventListener("change", on); } else { mq.removeListener(on); } all(); watch(); };
      if (mq.addEventListener) { mq.addEventListener("change", on); } else if (mq.addListener) { mq.addListener(on); }
    })();
  }
  if (window.MutationObserver) {
    new MutationObserver(function (ms) {
      for (var i = 0; i < ms.length; i += 1) {
        var m = ms[i];
        if (m.type === "attributes" && m.target.classList && m.target.classList.contains("signal-bars")) { draw(m.target); }
        else if (m.type === "childList") { later(); }
      }
    }).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-level"] });
  }
})();
