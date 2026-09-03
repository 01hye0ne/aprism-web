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

  function draw() {
    // 구워진 배율과의 차이만 transform 이 맡는다. 멎어 있을 때는 늘 1 이다.
    var k = raster ? scale() / raster : scale();
    plane.style.transform = "translate3d(" + x + "px," + y + "px,0) scale(" + k + ")";
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
