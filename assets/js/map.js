// 지도 — 휠로 확대·축소, 끌어서 이동.
//
// 그림은 assets/figma/map-temp.svg 한 장이다(Figma "Map" 538:12727 을 통째로 내보낸 것).
// 레이어 그룹(Layer_Ground · Layer_Routes · Layer_Robots …)이 id 로 남아 있어서
// 나중에 레이어를 켜고 끄려면 <img> 를 인라인 <svg> 로 바꾸기만 하면 된다.
//
// 층 구조
//   .map-view   지도가 보이는 창. .two-col 전체를 덮는다(우측 패널 뒤까지 지도가 깔린다).
//               z-index -1 · pointer-events:none — 눌리지 않는다.
//   .map-plane  실제로 움직이는 판. transform 하나만 바꾼다.
//   .map-canvas 손이 닿는 자리. 지도 칸에서만 휠·드래그가 먹는다 —
//               우측 미션 패널 위에서 휠을 굴려도 지도가 움직이면 안 된다.
(function () {
  "use strict";

  var view = document.querySelector("[data-map]");
  var hit = document.querySelector(".map-canvas");
  if (!view || !hit) { return; }

  var plane = view.querySelector(".map-plane");
  var image = view.querySelector(".map-image");
  if (!plane || !image) { return; }

  // 그림의 제 크기. SVG viewBox 와 같아서 1 배율이 곧 1:1 이다.
  var MAP_W = 1716;
  var MAP_H = 967;

  // 배율은 "칸을 채우는 배율"(cover)을 1 로 보고 그 위로만 키운다 —
  // 그보다 작아지면 지도 밖 빈자리가 생긴다.
  var MAX_ZOOM = 4;

  // 그림을 구워 두는 크기의 상한(긴 변). GPU 텍스처 한계가 보통 8192 다.
  var MAX_RASTER_PX = 8192;

  /*
   * 확대해도 커지지 않는 것들 — 글자와 뱃지.
   *
   * 지도를 키우면 그림만 커져야 한다. 이름표와 상태 뱃지까지 같이 커지면
   * 화면이 금세 글자로 덮인다. 그래서 그 그룹에는 배율의 역수를 걸어
   * 화면에서의 크기를 붙들어 둔다.
   *
   * 두 가지 규칙이 있다.
   *   이름표 · 웨이포인트 뱃지 · 로봇 번호 — zoom 1 에서 보이던 크기 그대로 얼린다.
   *   로봇 상태 뱃지 — Delta 태그와 같은 높이(26)로 줄인 뒤 얼린다.
   *     Figma 에서 수행 중인 로봇 것만 45 로 그려져 있어 혼자 크게 떴다.
   *     넷을 한 크기로 맞춘다 — 같은 컴포넌트가 자리마다 다른 크기일 이유가 없다.
   */
  var BADGE_PX = 26;

  /*
   * 너무 작게 그려진 표식은 조금 키워서 얼린다.
   * 확대해도 안 커지게 만들고 나니, Figma 에서 4~6 으로 그려진 것들
   * (WP-01 이름 4 · 웨이포인트 상태 뱃지 6 · 로봇 번호 둘이 4)이
   * 어느 배율에서도 읽히지 않게 됐다. 바닥값을 준다.
   */
  var LABEL_MIN = 13;   // 구역 이름 — 작은 쪽이 10.8 이었다
  var MARK_MIN = 12;    // 웨이포인트 · 로봇 번호처럼 지도 위에 흩어진 표식
  var FROZEN = [
    "[id^='map-Robot_Status_Badge']",   // 로봇 상태 뱃지 — 유일하게 크기도 줄인다
    "[id^='map-Robot_ID_Label']",       // R-01 같은 로봇 번호
    "[id^='map-DS_Step']",              // 웨이포인트 순번 칩 (1 · 2 · 3 · 4)
    "[id^='map-DS_Mission_Badge']",     // 웨이포인트 상태 뱃지
    "[id^='map-WP_Label']"              // WP-01 같은 웨이포인트 이름
  ].join(", ");

  // 배율이 멎고 이만큼 지나면 그림을 그 배율로 다시 굽는다.
  var SETTLE_MS = 140;
  var WHEEL_STEP = 1.0015;   // deltaY 1 당 배율. 트랙패드와 휠 둘 다 자연스러운 값.
  var BUTTON_STEP = 1.5;

  // 수행 중인 로봇(R-01)의 그림 안 좌표. Figma 프레임 기준 (1007,354) 192x228 의 한가운데를
  // 그림 좌표로 옮긴 값이다(프레임 -> 내보내기 -216, 내보내기 -> 그림 +319/-13).
  var ROBOT = { x: 1206, y: 455, zoom: 1.8 };

  var cover = 0;      // 칸을 채우는 배율. 0 이면 아직 재기 전이다.
  var zoom = 1;       // cover 대비 배수
  var x = 0, y = 0;   // 판의 왼쪽 위 모서리 자리
  var raster = 0;     // 지금 그림이 구워져 있는 배율
  var settle = null;

  function scale() { return cover * zoom; }

  // 지도가 창을 늘 덮게 가둔다. 남는 쪽이 있으면 그 축은 가운데로 붙인다.
  function clamp() {
    var k = scale();
    var w = view.clientWidth - MAP_W * k;
    var h = view.clientHeight - MAP_H * k;
    x = w >= 0 ? w / 2 : Math.min(0, Math.max(w, x));
    y = h >= 0 ? h / 2 : Math.min(0, Math.max(h, y));
  }

  // 지도 한가운데를 창 한가운데에 둔다. 처음 모습과 "전체 보기"가 이 자리다.
  function center() {
    var k = scale();
    x = (view.clientWidth - MAP_W * k) / 2;
    y = (view.clientHeight - MAP_H * k) / 2;
  }

  /*
   * 왜 두 단계인가 —
   * transform: scale() 만으로 키우면 브라우저는 그림을 제 크기(1716)로 한 번 굽고
   * 그 비트맵을 GPU 가 늘린다. 벡터인데도 확대하면 뭉개진다.
   * 굴리는 동안에는 그 방식이 빠르니 그대로 쓰고, 손을 떼면 그 배율로 다시 구워
   * 또렷하게 만든다. transform 의 배율은 그때 1 로 돌아온다.
   */
  function bake() {
    var k = scale();
    var capped = Math.min(k, MAX_RASTER_PX / MAP_W, MAX_RASTER_PX / MAP_H);
    if (Math.abs(capped - raster) < 0.001) { return; }
    raster = capped;
    image.style.width = MAP_W * raster + "px";
    image.style.height = MAP_H * raster + "px";
    draw();
  }

  function later() {
    if (settle) { clearTimeout(settle); }
    settle = setTimeout(function () { settle = null; bake(); }, SETTLE_MS);
  }

  /*
   * 얼려 둘 그룹을 한 번만 모은다. 각자의 bbox 한가운데를 축으로 삼아
   * translate -> scale -> translate 로 제자리에서 줄인다.
   * getBBox() 는 그려진 뒤라야 값이 나와서 여기서 한 번만 잰다.
   */
  var pins = [];
  var zone = null;
  function collect() {
    if (pins.length || !image.querySelector) { return; }
    var found = [];
    zone = image.querySelector("#map-Layer_Zone_Labels");
    if (zone) {
      Array.prototype.slice.call(zone.children).forEach(function (g) { found.push(g); });
    }
    Array.prototype.slice.call(image.querySelectorAll(FROZEN))
      .forEach(function (g) { found.push(g); });

    found.forEach(function (g) {
      var box;
      try { box = g.getBBox(); } catch (e) { return; }
      if (!box || !box.height) { return; }
      var isBadge = g.id.indexOf("map-Robot_Status_Badge") === 0;
      pins.push({
        el: g,
        cx: box.x + box.width / 2,
        cy: box.y + box.height / 2,
        h: box.height,
        // 상태 뱃지만 Delta 태그 높이로 못 박는다. 나머지는 제 크기를 쓰되 바닥값이 있다.
        fixed: isBadge ? BADGE_PX : 0,
        min: g.parentNode === zone ? LABEL_MIN : MARK_MIN
      });
    });
  }

  // 배율이 바뀔 때만 다시 쓴다 — 끌어 옮기는 동안에는 크기가 그대로다.
  var pinnedAt = 0;
  function freeze() {
    var k = scale();
    if (!k || Math.abs(k - pinnedAt) < 0.0001) { return; }
    pinnedAt = k;
    pins.forEach(function (p) {
      // 화면에서 갖고 싶은 높이 — 뱃지는 못 박은 값, 나머지는 제 크기와 바닥값 중 큰 쪽.
      var want = p.fixed || Math.max(p.h * cover, p.min);
      var s = want / (p.h * k);
      p.el.setAttribute("transform",
        "translate(" + p.cx + " " + p.cy + ") scale(" + s + ") translate(" + (-p.cx) + " " + (-p.cy) + ")");
    });
  }

  function draw() {
    // 구워진 배율과의 차이만 transform 이 맡는다. 멎어 있을 때는 늘 1 이다.
    var k = raster ? scale() / raster : scale();
    plane.style.transform = "translate3d(" + x + "px," + y + "px,0) scale(" + k + ")";
    collect();
    freeze();
  }

  // 창 크기가 바뀌면 cover 를 다시 잡는다. 보고 있던 지점은 그대로 둔다.
  function measure() {
    var w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) { return; }
    var next = Math.max(w / MAP_W, h / MAP_H);
    if (cover) {
      // 창 한가운데가 가리키던 지도 위 점을 새 배율에서도 한가운데에 둔다.
      var k = scale();
      var cx = (w / 2 - x) / k;
      var cy = (h / 2 - y) / k;
      cover = next;
      var nk = scale();
      x = w / 2 - cx * nk;
      y = h / 2 - cy * nk;
    } else {
      cover = next;
      center();
    }
    clamp();
    draw();
  }

  // 커서 밑의 지점이 제자리에 남도록 배율을 바꾼다.
  function zoomAt(nextZoom, px, py) {
    nextZoom = Math.min(MAX_ZOOM, Math.max(1, nextZoom));
    if (nextZoom === zoom) { return; }
    var k = scale();
    var mx = (px - x) / k;
    var my = (py - y) / k;
    zoom = nextZoom;
    var nk = scale();
    x = px - mx * nk;
    y = py - my * nk;
    clamp();
    bake();
    draw();
  }

  // 창(.map-view)은 우측 패널 뒤까지 덮지만 사람이 보는 지도는 .map-canvas 뿐이다.
  // 버튼으로 확대하거나 로봇을 따라갈 때의 기준점은 그 칸의 한가운데다 —
  // 창 한가운데로 잡으면 패널에 가린 자리를 겨누게 된다.
  function focus() {
    var v = view.getBoundingClientRect();
    var h = hit.getBoundingClientRect();
    return { x: h.left + h.width / 2 - v.left, y: h.top + h.height / 2 - v.top };
  }

  // 커서 좌표를 창 기준으로 옮긴다. 손이 닿는 자리(.map-canvas)와 창(.map-view)이
  // 다른 요소라 매번 실제 위치로 환산한다.
  function local(event) {
    var r = view.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  hit.addEventListener("wheel", function (event) {
    // 브라우저 확대(ctrl+휠)와 페이지 스크롤을 가로챈다.
    event.preventDefault();
    var p = local(event);
    // deltaMode 가 줄(1)·쪽(2)이면 픽셀로 환산한다 — 파이어폭스가 줄 단위로 준다.
    var d = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
    zoomAt(zoom * Math.pow(WHEEL_STEP, -d), p.x, p.y);
    later();
  }, { passive: false });

  // 끌어서 이동. 버튼 위에서 시작한 것은 무시한다.
  var dragging = false, lastX = 0, lastY = 0, pid = null;

  hit.addEventListener("pointerdown", function (event) {
    if (event.button !== 0) { return; }
    if (event.target.closest(".map-tools")) { return; }
    dragging = true;
    pid = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    hit.setPointerCapture(pid);
    hit.classList.add("is-panning");
  });

  hit.addEventListener("pointermove", function (event) {
    if (!dragging || event.pointerId !== pid) { return; }
    x += event.clientX - lastX;
    y += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    clamp();
    draw();
  });

  function endDrag(event) {
    if (!dragging || (event && event.pointerId !== pid)) { return; }
    dragging = false;
    if (pid !== null && hit.hasPointerCapture(pid)) { hit.releasePointerCapture(pid); }
    pid = null;
    hit.classList.remove("is-panning");
  }

  hit.addEventListener("pointerup", endDrag);
  hit.addEventListener("pointercancel", endDrag);

  // 확대 버튼 — 창 한가운데를 잡고 한 단계 키운다.
  var zoomIn = document.querySelector("[data-map-zoom-in]");
  if (zoomIn) {
    zoomIn.addEventListener("click", function () {
      var f = focus();
      zoomAt(zoom * BUTTON_STEP, f.x, f.y);
      bake();
    });
  }

  // 로봇 추적 — 수행 중인 로봇을 한가운데로. 이미 그 자리면 다시 눌러 전체 보기로 돌아온다.
  var track = document.querySelector("[data-map-track]");
  if (track) {
    track.addEventListener("click", function () {
      var atRobot = Math.abs(zoom - ROBOT.zoom) < 0.01;
      if (atRobot) {
        zoom = 1;
        center();
      } else {
        zoom = ROBOT.zoom;
        var k = scale();
        var f = focus();
        x = f.x - ROBOT.x * k;
        y = f.y - ROBOT.y * k;
      }
      clamp();
      bake();
      draw();
    });
  }

  // 그림이 다 실려야 크기를 잴 수 있다. 캐시에서 바로 오면 complete 다.
  if (image.complete) { measure(); }
  else { image.addEventListener("load", measure); }

  if (window.ResizeObserver) {
    new ResizeObserver(measure).observe(view);
  } else {
    window.addEventListener("resize", measure);
  }
})();
