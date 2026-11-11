/*
 * [11/11 v7 디자이너] Delta 챗봇형 시안(main-v7-chat · body.d3-chat).
 *   웹사이트 챗봇처럼 지도 오른쪽 아래(지도 도구 줄 밑)에 Delta 오브 단추가 서고, Delta 가 하는 말(요약 두 줄)은 그 옆 말풍선으로 뜬다.
 *   말풍선 · 오브를 누르면 대화창이 열린다 — 대화창은 원래 Delta 창(.delta3.is-open)을 오른쪽 아래로 옮겨 쓴다(답 · 묻기 · 대화가 그대로 돈다).
 *   왼쪽 위 Delta 카드는 숨는다 — 비는 자리는 알림 팝오버가 위까지 채워 쓴다(map-v6.js v7Room · v7.css).
 *   말풍선 글은 Delta 카드의 두 줄(.ai-line-1 · .ai-line-2)을 그대로 비춘다 — 카드 글이 바뀌면 따라 바뀐다. 단계 색(위험 · 주의)도 카드를 따른다.
 *   [11/11 디자이너] 말풍선 [×] 는 뺐다 — 대화창이 열려 있을 때만 숨는다.
 *   [11/11 디자이너] 대화창 자리 = 크롬 개발자 도구처럼 고른다(창 머리 [∧] 왼쪽 단추 셋) —
 *     ① 떠 있기(기본, 오브 옆) ② 오른쪽 붙임(지도 칸이 좁아지고 지도와 우측 패널 사이에 선다, 왼쪽 끝을 끌어 320~560)
 *     ③ 새 창(Delta 창 요소를 그대로 새 브라우저 창으로 옮긴다 — 답 · 묻기가 이 화면 스크립트로 그대로 돈다).
 *     ①② 는 기억한다(localStorage). ③ 은 팝업 차단이 있어 기억하지 않는다 — 다시 들어오면 ①.
 *     오브 · 말풍선은 어느 자리든 지도 오른쪽 아래 그대로(위험 알림이 늘 같은 곳에 뜨게)
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
    '</div>' +
    '<button type="button" class="dchat-orb" aria-label="Delta 대화창 열기" aria-expanded="false"><span class="dchat-orb-in" aria-hidden="true"></span><span class="dchat-badge" hidden></span></button>';
  stage.appendChild(dock);
  var bubble = dock.querySelector(".dchat-bubble"), l1 = dock.querySelector(".dchat-l1"), l2 = dock.querySelector(".dchat-l2");
  var orbBtn = dock.querySelector(".dchat-orb"), badge = dock.querySelector(".dchat-badge");

  // 오브 — 관제 Delta 와 같은 Prism Orb(WebGL2). 못 쓰면 CSS 그라데이션 원이 남는다
  var orb = null;
  function sev() { return win.classList.contains("is-critical") ? "critical" : win.classList.contains("is-warning") ? "warning" : win.classList.contains("is-safe") ? "safe" : "info"; }
  if (window.PrismOrb) { orb = window.PrismOrb.mount(dock.querySelector(".dchat-orb-in"), { palette: sev() }); }

  var lastKey = "";
  // [11/11 디자이너] 말풍선 둘째 줄은 첫 문장("…있어요.") 뒤에서 한 번 줄을 바꾼다
  function brAfterFirst(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while ((n = w.nextNode())) {
      var m = /[.?!](?=\s|$)/.exec(n.nodeValue);
      if (!m) { continue; }
      var r = document.createRange(); r.setStart(n, m.index + 1); r.setEnd(root, root.childNodes.length);
      if (!r.toString().trim()) { return; }   // 한 문장뿐이면 그대로
      var rest = n.splitText(m.index + 1);
      rest.nodeValue = rest.nodeValue.replace(/^\s+/, "");
      n.parentNode.insertBefore(document.createElement("br"), rest);
      return;
    }
  }

  function sync() {
    var a = win.querySelector(".delta3-card .ai-line-1"), b = win.querySelector(".delta3-card .ai-line-2");
    var t1 = a ? a.textContent.trim() : "", t2 = b ? b.textContent.trim() : "";
    var key = t1 + "|" + t2;
    if (key !== lastKey) {
      lastKey = key;
      l1.textContent = t1;
      l2.innerHTML = b ? b.innerHTML : "";   // 번호 원(.dl-wp) 같은 표식을 그대로 — 같은 화면이 만든 글이다
      brAfterFirst(l2);
    }
    var s = sev();
    dock.setAttribute("data-sev", s);
    if (orb && orb.setPalette) { orb.setPalette(s); }
    var open = win.classList.contains("is-open");
    body.classList.toggle("dchat-open", open);
    orbBtn.setAttribute("aria-expanded", String(open));
    orbBtn.setAttribute("aria-label", open ? "Delta 대화창 닫기" : "Delta 대화창 열기");
    bubble.hidden = open || !t1;
    // 말풍선을 닫아 두었을 때 위험 · 주의면 오브에 점
    badge.hidden = open || !bubble.hidden || (s !== "critical" && s !== "warning");
  }
  new MutationObserver(sync).observe(win, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["class"] });

  function openChat() {
    if (mode === "window" && pop && !pop.closed) { pop.focus(); return; }
    if (!win.classList.contains("is-open")) { toggle.click(); } sync();
  }
  dock.querySelector(".dchat-bubble-body").addEventListener("click", openChat);
  orbBtn.addEventListener("click", function () {
    if (mode === "window" && pop && !pop.closed) { pop.focus(); return; }
    toggle.click(); sync();
  });

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
    // 리모콘이 오브 위까지 덮으면(오른쪽 붙임으로 지도 칸이 좁아졌을 때) 오브도 그 위로
    var orbL = sb.right - r - 56, ob = sr && sr.right > orbL && sr.left < sb.right - r ? lift : b;
    stage.style.setProperty("--dchat-ob", Math.round(ob) + "px");
    // 오른쪽 붙임 자리 — 우측 패널(.floating) 왼쪽에 칸 사이(gap)를 두고, 위 · 아래 끝은 지도 칸과 같은 줄
    var fl = stage.querySelector(":scope > .floating"), mp = stage.querySelector(":scope > .map-panel");
    if (fl && mp && fl.getClientRects().length) {
      var fb = fl.getBoundingClientRect(), mb = mp.getBoundingClientRect();
      var gap = parseFloat(getComputedStyle(stage).columnGap) || 20;
      stage.style.setProperty("--dchat-gap", gap + "px");
      stage.style.setProperty("--dchat-dock-r", Math.round(sb.right - fb.left + gap) + "px");
      stage.style.setProperty("--dchat-dock-t", Math.round(mb.top - sb.top) + "px");
      stage.style.setProperty("--dchat-dock-b", Math.round(sb.bottom - mb.bottom) + "px");
    }
  }
  place();
  window.addEventListener("resize", place);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(place); ro.observe(stage);
    var mpEl = stage.querySelector(":scope > .map-panel"); if (mpEl) { ro.observe(mpEl); }   // 오른쪽 붙임으로 지도 칸이 좁아지면 오브도 따라 선다
  }
  setTimeout(place, 600);
  var simEl = document.querySelector(".rsim");
  if (simEl) { new MutationObserver(place).observe(simEl, { attributes: true, attributeFilter: ["class", "hidden", "style"] }); }
  document.addEventListener("click", function () { setTimeout(place, 0); });

  /* ================= 대화창 자리 ================= */
  var KEY_DOCK = "aprism.v7.dchat.dock", KEY_W = "aprism.v7.dchat.w", W_MIN = 320, W_MAX = 560;
  var mode = "float", pop = null, home = null;
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 저장 못 해도 이번 화면은 그 자리 */ } }
  function setW(w) { w = Math.max(W_MIN, Math.min(W_MAX, Math.round(w))); stage.style.setProperty("--dchat-w", w + "px"); return w; }
  setW(Number(load(KEY_W)) || 380);

  // 고르는 단추 — 창 머리 [∧ 접기] 왼쪽. 크롬 개발자 도구 Dock side 와 같은 그림(선 아이콘 16)
  var SVG = {
    float: '<rect x="1.5" y="1.5" width="13" height="13" rx="2"/><rect x="7.5" y="7.5" width="5" height="5" rx="1" fill="currentColor"/>',
    right: '<rect x="1.5" y="1.5" width="13" height="13" rx="2"/><path d="M10 2v12h3a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 13 2z" fill="currentColor"/>',
    window: '<path d="M9.5 1.5h5v5M14.5 1.5 8 8"/><path d="M12.5 9.5v3a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>'
  };
  var LABEL = { float: "떠 있기", right: "오른쪽에 붙이기", window: "새 창으로 열기" };
  var bar = document.createElement("span");
  bar.className = "dchat-dockbar"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "대화창 자리");
  ["float", "right", "window"].forEach(function (m) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "dchat-dock"; b.setAttribute("data-dock", m);
    b.setAttribute("aria-label", LABEL[m]); b.title = LABEL[m];
    b.innerHTML = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SVG[m] + '</svg>';
    b.addEventListener("click", function (event) { event.stopPropagation(); setMode(m); });
    bar.appendChild(b);
  });
  var closeBtn = win.querySelector("[data-delta3-close]");
  if (closeBtn) { closeBtn.parentNode.insertBefore(bar, closeBtn); }

  // 오른쪽 붙임 — 왼쪽 끝을 끌어 폭을 바꾼다
  var edge = document.createElement("span");
  edge.className = "dchat-edge"; edge.setAttribute("role", "separator"); edge.setAttribute("aria-orientation", "vertical"); edge.setAttribute("aria-label", "대화창 폭");
  win.appendChild(edge);
  var drag = null;
  edge.addEventListener("pointerdown", function (event) {
    drag = { x: event.clientX, w: win.getBoundingClientRect().width };
    edge.setPointerCapture(event.pointerId); body.classList.add("dchat-resizing"); event.preventDefault();
  });
  edge.addEventListener("pointermove", function (event) { if (drag) { setW(drag.w + (drag.x - event.clientX)); } });
  function endDrag() {
    if (!drag) { return; }
    drag = null; body.classList.remove("dchat-resizing");
    save(KEY_W, String(Math.round(win.getBoundingClientRect().width)));
    roomChanged();
  }
  edge.addEventListener("pointerup", endDrag);
  edge.addEventListener("pointercancel", endDrag);

  // 지도 칸 폭이 바뀌면 지도가 가운데를 다시 잡게 알린다(map-v6.js) — 넘어가는 0.2초가 끝난 뒤
  var roomT = 0;
  function roomChanged() { clearTimeout(roomT); roomT = setTimeout(function () { place(); document.dispatchEvent(new CustomEvent("aprism:map-room")); }, 240); }

  function paintBar() {
    bar.querySelectorAll("[data-dock]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-dock") === mode)); });
    body.classList.toggle("dchat-dock-right", mode === "right");
    body.classList.toggle("dchat-dock-window", mode === "window");
  }

  function setMode(m) {
    if (m === mode) { return; }
    if (m === "window") { if (!popOut()) { return; } }
    else if (mode === "window") { popIn(true); }
    mode = m;
    if (m !== "window") { save(KEY_DOCK, m); }
    paintBar(); place(); roomChanged(); sync();
  }

  /* ---------- 새 창 — 창 요소를 그대로 옮긴다(이 화면 스크립트가 계속 돌린다) ---------- */
  function popOut() {
    var r = win.getBoundingClientRect();
    var w = Math.max(360, Math.round(r.width) || 380), h = Math.max(520, (Math.round(r.height) || 560) + 40);
    var p = window.open("", "aprism-delta", "popup=yes,width=" + w + ",height=" + h);
    if (!p) { return false; }   // 팝업 차단 — 지금 자리 그대로
    var d = p.document;
    d.open(); d.write('<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>Delta · APRISM</title></head><body></body></html>'); d.close();
    // 이 화면의 스타일 · 글꼴을 그대로(주소는 절대 경로로)
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="stylesheet"], style'), function (n) {
      var c = d.importNode(n, true);
      if (n.tagName === "LINK") { c.href = n.href; }
      d.head.appendChild(c);
    });
    // 테마 · 단계 표시는 이 화면을 따라간다
    var mirror = function () {
      Array.prototype.forEach.call(document.documentElement.attributes, function (a) { d.documentElement.setAttribute(a.name, a.value); });
      d.body.className = body.className.replace(/\bdchat-[\w-]+/g, "") + " dchat-popup";
    };
    mirror();
    var mo = new MutationObserver(mirror);
    mo.observe(document.documentElement, { attributes: true });
    mo.observe(body, { attributes: true, attributeFilter: ["class"] });
    home = { next: win.nextSibling, mo: mo };
    d.body.appendChild(d.adoptNode(win));
    if (!win.classList.contains("is-open")) { toggle.click(); }
    pop = p;
    p.addEventListener("pagehide", function () { if (pop === p) { popIn(false); } });
    var watch = setInterval(function () { if (p.closed) { clearInterval(watch); if (pop === p) { popIn(false); } } }, 500);   // pagehide 가 안 오는 경우까지
    p.focus();
    return true;
  }
  // keep = 단추로 자리를 바꿈(대화창은 연 채로) · 아니면 사용자가 창을 닫은 것(떠 있기로 돌아가 접는다)
  function popIn(keep) {
    var p = pop; pop = null;
    if (home) { home.mo.disconnect(); stage.insertBefore(document.adoptNode(win), home.next && home.next.parentNode === stage ? home.next : null); home = null; }
    if (p && !p.closed) { try { p.close(); } catch (e) { /* 이미 닫힘 */ } }
    if (!keep) {
      mode = "float"; paintBar();
      if (win.classList.contains("is-open")) { toggle.click(); }
      place(); roomChanged(); sync();
    }
  }
  window.addEventListener("pagehide", function () { if (pop && !pop.closed) { pop.close(); } });

  // 오른쪽 붙임 — 대화창이 열리고 닫힐 때마다 지도 칸이 좁아지고 넓어진다
  var wasOpen = win.classList.contains("is-open");
  new MutationObserver(function () {
    var o = win.classList.contains("is-open");
    if (o !== wasOpen) { wasOpen = o; if (mode === "right") { roomChanged(); } }
  }).observe(win, { attributes: true, attributeFilter: ["class"] });

  if (load(KEY_DOCK) === "right") { mode = "right"; }
  paintBar();
  sync();
})();
