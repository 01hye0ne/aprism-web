// 지도 — APRO 4F 3D 모델. 휠로 확대·축소, 끌어서 이동.
//
// 예전에는 Figma 에서 내보낸 평면 SVG 한 장이었다. 지금은 실제 3D 모델
// (assets/model/apro-4f.glb)이고, 그 위에 있던 표식(구역 이름 · 웨이포인트 ·
// 경로 · 로봇 · 상태 뱃지)은 모델에 없어서 함께 걷어냈다.
//
// 층 구조
//   .map-view    지도가 보이는 창. .two-col 전체를 덮는다(우측 패널 뒤까지 지도가 깔린다).
//                z-index -1 · pointer-events:none — 눌리지 않는다.
//   .map-scene   WebGL 캔버스. 창을 그대로 채운다.
//   .map-canvas  손이 닿는 자리. 지도 칸에서만 휠·드래그가 먹는다 —
//                우측 미션 패널 위에서 휠을 굴려도 지도가 움직이면 안 된다.
//
// 왜 직교(orthographic) 카메라인가 — 예전 지도가 아이소메트릭 평면이었다.
// 원근을 주면 같은 크기의 설비가 자리마다 다르게 보여서 배치를 읽기 어렵다.
// 각도를 고정해 두면 확대·이동이 예전과 똑같이 "판을 밀고 당기는" 느낌으로 남는다.
//
// three.js 는 CDN 에서 온다(importmap 은 화면 <head> 에 있다). 모델은 map-model.js 가
// base64 로 들고 있다 — file:// 로 열어도 보이게 하려는 것이다.
(function () {
  "use strict";

  var view = document.querySelector("[data-map]");
  var hit = document.querySelector(".map-canvas");
  var canvas = view && view.querySelector("[data-map-scene]");
  if (!view || !hit || !canvas) { return; }

  var MAX_ZOOM = 6;
  var MIN_ZOOM = 0.6;
  var WHEEL_STEP = 1.0015;   // deltaY 1 당 배율. 트랙패드와 휠 둘 다 자연스러운 값.
  var BUTTON_STEP = 1.5;

  // 카메라가 보는 방향. y 를 x·z 보다 낮게 두면 예전 지도처럼 옆면이 보인다.
  var DIR = [1, 0.85, 1];

  var zoom = 1;
  var scene = null, camera = null, renderer = null;
  var target = null;      // 카메라가 보는 지점(바닥 위)
  var home = null;        // 처음 자리 — [전체 보기] 가 돌아오는 곳
  var baseSize = 1;       // zoom 1 에서 화면 세로에 담기는 월드 길이
  var right = null, upOnGround = null;
  var span = 1;           // 모델 반지름 — 이동 범위를 가두는 데 쓴다
  var THREE = null;

  function frame() {
    if (!renderer) { return; }
    var w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) { return; }
    renderer.setSize(w, h, false);

    var halfH = (baseSize / zoom) / 2;
    var halfW = halfH * (w / h);
    camera.left = -halfW;
    camera.right = halfW;
    camera.top = halfH;
    camera.bottom = -halfH;
    camera.updateProjectionMatrix();

    /*
     * 창(.map-view)은 우측 패널 뒤까지 덮는다. 창 한가운데에 맞춰 두면 모델이
     * 패널에 반쯤 가린 자리에 선다. 그래서 사람이 보는 칸(.map-canvas)의
     * 한가운데로 오도록 카메라가 보는 지점을 그만큼 밀어 준다.
     */
    var s = (baseSize / zoom) / h;
    var v = view.getBoundingClientRect();
    var c = hit.getBoundingClientRect();
    var dx = (c.left + c.width / 2) - (v.left + v.width / 2);
    var dy = (c.top + c.height / 2) - (v.top + v.height / 2);
    var look = target.clone()
      .addScaledVector(right, -dx * s)
      .addScaledVector(upOnGround, dy * s);

    camera.position.set(
      look.x + DIR[0] * span * 4,
      look.y + DIR[1] * span * 4,
      look.z + DIR[2] * span * 4
    );
    camera.lookAt(look);
    renderer.render(scene, camera);
  }

  // 창 한 픽셀이 월드에서 갖는 길이. 이동과 확대 셈이 전부 이 값으로 돈다.
  function perPixel() {
    var h = view.clientHeight || 1;
    return (baseSize / zoom) / h;
  }

  // 모델 밖으로 너무 멀리 나가지 않게 가둔다. 완전히 놓치면 돌아오는 길이 없다.
  function clamp() {
    var reach = span * 1.2;
    target.x = Math.min(home.x + reach, Math.max(home.x - reach, target.x));
    target.z = Math.min(home.z + reach, Math.max(home.z - reach, target.z));
  }

  // 커서 밑의 지점이 제자리에 남도록 배율을 바꾼다.
  function zoomAt(next, px, py) {
    next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
    if (next === zoom) { return; }
    var w = view.clientWidth, h = view.clientHeight;
    var dx = px - w / 2;
    var dy = py - h / 2;

    var before = perPixel();
    zoom = next;
    var after = perPixel();
    var move = before - after;

    target.addScaledVector(right, dx * move);
    target.addScaledVector(upOnGround, -dy * move);
    clamp();
    frame();
  }

  // 창(.map-view)은 우측 패널 뒤까지 덮지만 사람이 보는 지도는 .map-canvas 뿐이다.
  // 버튼으로 확대할 때의 기준점은 그 칸의 한가운데다 —
  // 창 한가운데로 잡으면 패널에 가린 자리를 겨누게 된다.
  function focusPoint() {
    var v = view.getBoundingClientRect();
    var c = hit.getBoundingClientRect();
    return { x: c.left + c.width / 2 - v.left, y: c.top + c.height / 2 - v.top };
  }

  function local(event) {
    var r = view.getBoundingClientRect();
    return { x: event.clientX - r.left, y: event.clientY - r.top };
  }

  hit.addEventListener("wheel", function (event) {
    // 브라우저 확대(ctrl+휠)와 페이지 스크롤을 가로챈다.
    event.preventDefault();
    if (!renderer) { return; }
    var p = local(event);
    // deltaMode 가 줄(1)·쪽(2)이면 픽셀로 환산한다 — 파이어폭스가 줄 단위로 준다.
    var d = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
    zoomAt(zoom * Math.pow(WHEEL_STEP, -d), p.x, p.y);
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
    if (!dragging || event.pointerId !== pid || !renderer) { return; }
    var s = perPixel();
    target.addScaledVector(right, -(event.clientX - lastX) * s);
    target.addScaledVector(upOnGround, (event.clientY - lastY) * s);
    lastX = event.clientX;
    lastY = event.clientY;
    clamp();
    frame();
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

  var zoomIn = document.querySelector("[data-map-zoom-in]");
  if (zoomIn) {
    zoomIn.addEventListener("click", function () {
      var f = focusPoint();
      zoomAt(zoom * BUTTON_STEP, f.x, f.y);
    });
  }

  // 전체 보기 — 처음 자리로 돌아온다. 예전에는 "로봇 추적" 이었는데
  // 따라갈 로봇이 모델에 없어서 이 자리로 바꿨다.
  var reset = document.querySelector("[data-map-track]");
  if (reset) {
    reset.addEventListener("click", function () {
      if (!renderer) { return; }
      zoom = 1;
      target.copy(home);
      frame();
    });
  }

  function decode(b64) {
    var bin = window.atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) { bytes[i] = bin.charCodeAt(i); }
    return bytes.buffer;
  }

  /*
   * 면과 모서리를 따로 그린다.
   * 모델이 가진 재질은 순검정 하나뿐이라 그대로 두면 실루엣만 남는다.
   * 면은 어두운 회색, 모서리는 한 단 밝은 선 — 예전 평면 지도가 갖고 있던 인상이다.
   */
  function dress(root) {
    var face = new THREE.MeshStandardMaterial({
      color: 0x2c3443,
      metalness: 0.0,
      roughness: 0.9
    });
    var edge = new THREE.LineBasicMaterial({ color: 0x4e576a, transparent: true, opacity: 0.55 });
    var meshes = [];
    root.traverse(function (node) { if (node.isMesh) { meshes.push(node); } });
    meshes.forEach(function (mesh) {
      mesh.material = face;
      var line = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 25), edge);
      mesh.add(line);
    });
    return meshes.length;
  }

  function start(three, gltf) {
    THREE = three;
    scene = new THREE.Scene();

    // 위는 하늘빛, 아래는 화면 바탕색 — 바닥으로 갈수록 어두워져 층이 읽힌다.
    scene.add(new THREE.HemisphereLight(0x9fb4d8, 0x070a10, 2.2));
    var key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(3, 6, 4);
    scene.add(key);

    var root = gltf.scene;
    dress(root);
    scene.add(root);

    var box = new THREE.Box3().setFromObject(root);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    span = size.length() / 2;

    // 모델을 원점으로 옮겨 놓고 본다 — 좌표가 0 근처라야 셈이 눈에 들어온다.
    root.position.sub(center);
    home = new THREE.Vector3(0, 0, 0);
    target = home.clone();

    // zoom 1 에서 세로로 모델이 다 담기고 조금 남게.
    baseSize = span * 1.7;

    var dir = new THREE.Vector3(DIR[0], DIR[1], DIR[2]).normalize();
    right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), dir).normalize();
    // 화면 세로 방향을 바닥에 눕힌 것 — 끌면 판이 미끄러지는 방향이다.
    upOnGround = new THREE.Vector3().crossVectors(dir, right).normalize();

    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, span * 40);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);

    frame();

    if (window.ResizeObserver) {
      new ResizeObserver(frame).observe(view);
    } else {
      window.addEventListener("resize", frame);
    }
  }

  // three.js 는 모듈이라 동적 import 로 가져온다. 화면 <head> 의 importmap 이
  // "three" 와 "three/addons/" 를 CDN 으로 이어 준다.
  // 못 가져오면 지도 자리는 바탕색으로 남는다 — 나머지 화면은 그대로 돈다.
  if (!window.APRISM_MAP_GLB) { return; }
  Promise.all([
    import("three"),
    import("three/addons/loaders/GLTFLoader.js")
  ]).then(function (mods) {
    var three = mods[0];
    var loader = new mods[1].GLTFLoader();
    loader.parse(decode(window.APRISM_MAP_GLB), "", function (gltf) {
      start(three, gltf);
    });
  }).catch(function () { /* 지도 없이 화면은 그대로 쓴다 */ });
})();
