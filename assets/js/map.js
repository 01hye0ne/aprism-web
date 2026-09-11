// 지도 — 전주기 맵 3D 모델(assets/model/apro-4f.glb). 자유롭게 돌려 보는 판이다.
//
// 손 쓰는 법
//   휠 · 두 손가락 오므리기   확대·축소(커서 밑이 제자리에 남는다)
//   끌기                      돌아보기 — 좌우로 한 바퀴, 위로는 탑뷰까지
//   Shift · 가운데 · 오른쪽   판 밀기
//   [전체 보기]               처음 자리·처음 배율로
//   [탑뷰]                    바로 위에서 내려다보기
//
// 층 구조
//   .map-view    지도가 보이는 창. .two-col 전체를 덮는다(우측 패널 뒤까지 지도가 깔린다).
//                z-index -1 · pointer-events:none — 눌리지 않는다.
//   .map-scene   WebGL 캔버스. 창을 그대로 채운다.
//   .map-canvas  손이 닿는 자리. 지도 칸에서만 휠·드래그가 먹는다 —
//                우측 미션 패널 위에서 휠을 굴려도 지도가 움직이면 안 된다.
//
// 카메라는 투시인데 아주 약하다. 예전 지도가 아이소메트릭 평면이라 오래 직교를 썼다.
// 원근을 세게 주면 같은 크기의 설비가 자리마다 다르게 보여서 배치를 읽기 어렵다.
// 그래서 카메라를 멀리 세우고 화각을 좁혀, 깊이만 느껴질 만큼만 남겼다(EYE 를 보라).
// 확대·이동은 여전히 "판을 밀고 당기는" 느낌이다.
//
// three.js 는 CDN 에서 온다(importmap 은 화면 <head> 에 있다). 모델은 map-model.js 가
// base64 로 들고 있다 — file:// 로 열어도 보이게 하려는 것이다.
(function () {
  "use strict";

  var view = document.querySelector("[data-map]");
  var hit = document.querySelector(".map-canvas");
  var canvas = view && view.querySelector("[data-map-scene]");
  if (!view || !hit || !canvas) { return; }

  /* ---------- 얼마나 멀리·가까이·어디까지 ---------- */

  // 예전 모델은 덩이 열아홉이라 4배면 벽 하나가 화면을 다 덮었다. 지금은 계단 한 단까지
  // 들어 있어서 더 들어가야 볼 것이 있다. 반대로 멀리서 전체를 훑는 자리도 열어 둔다.
  // 8배가 한 구획에 설비 두엇이 담기는 자리다. 더 들어가면 벽 한 면만 남는다.
  var MAX_ZOOM = 8;
  var MIN_ZOOM = 0.3;

  // zoom 1 에서 모델 둘레에 남기는 여백. 1 이면 지도 칸에 딱 붙는다.
  var FIT_AIR = 1.08;
  var WHEEL_STEP = 1.0015;   // deltaY 1 당 배율. 트랙패드와 휠 둘 다 자연스러운 값.
  var BUTTON_STEP = 1.5;

  /*
   * 카메라가 보는 방향을 각도 둘로 들고 있는다.
   *   yaw    바닥에서 도는 각. 한 바퀴 다 돈다.
   *   pitch  내려다보는 각. 0 이 수평, 90도가 바로 위에서 보는 탑뷰.
   *
   * 처음 자리는 예전 아이소메트릭 각도와 같다 — (1, 0.85, 1) 을 각도로 옮긴 값이다.
   *
   * 위로는 89도에서 멈춘다. 90도 정각에서는 "화면 오른쪽"이 정해지지 않아
   * 카메라가 한 바퀴 뒤집힌다. 89도면 눈으로는 탑뷰이고 셈은 멀쩡하다.
   *
   * 아래로는 바닥을 넘지 않는다. 밑에서 올려다보면 배치가 좌우로 뒤집혀 읽혀서
   * 어느 쪽이 어느 쪽인지 놓친다 — 관제 화면에서 그러면 안 된다.
   * 6도면 거의 눈높이까지 눕는다. 옆면을 보는 데에는 그것으로 넉넉하다.
   */
  var HOME_YAW = Math.PI / 4;
  var HOME_PITCH = Math.asin(0.85 / Math.sqrt(1 + 0.85 * 0.85 + 1));
  var TOP_PITCH = 89 * Math.PI / 180;
  var LOW_PITCH = 6 * Math.PI / 180;
  var TURN = 0.006;       // 커서 1px 당 도는 각(rad)

  // 판을 밀어 낼 수 있는 거리 = 모델 반지름의 몇 배. 자유롭게 보라는 판이라 넉넉히
  // 열어 두되 끝은 둔다 — 완전히 놓치면 화면이 텅 비고 눈으로 돌아올 길이 없다.
  // (그래도 [전체 보기] 한 번이면 처음 자리다.)
  var REACH = 3;

  // 투시의 세기. 카메라를 모델 반지름의 이 배만큼 떨어뜨린다.
  // 클수록 평면에 가깝고 작을수록 투시가 세다. 9 면 앞뒤 크기 차이가 10% 남짓이다.
  var EYE = 9;

  var yaw = HOME_YAW;
  var pitch = HOME_PITCH;
  var dirV = null;
  var WORLD_UP = null;

  /*
   * 다크모드 기술 도면 팔레트 — 레이어별로 색이 다르다.
   *
   * 예전에는 덩이 높이로 색을 어림잡았다. 모델에 이름이 하나도 없어서 그것뿐이었다.
   * 지금 모델은 라이노에서 네 겹으로 나눠 내보내 준다 —
   * 00_floor / 01_wall / 02_equipment / 03_stairs.
   * 그래서 벽은 물러나고 설비가 앞으로 나오게 제대로 가를 수 있다.
   *
   *   face  덩이 면
   *   line  외곽선이 기본으로 갖는 진하기
   *   peak  보고 있는 자리에 들어왔을 때 선이 올라가는 끝. 바닥은 안 올린다 —
   *         바닥은 판이라 모서리가 건물을 가로지르는 긴 선이고, 그것이 밝아지면
   *         화면을 가로지르는 줄이 하나 생긴다
   *
   * 선 색은 레이어마다 다르지 않고 하나다(EDGE). 참고 도면이 그렇다 —
   * 덩이는 색으로 갈리고 외곽선은 어디서나 같은 굵기·같은 회색이다.
   * 선까지 레이어마다 달리하면 도면이 아니라 색칠 공부가 된다.
   *
   * 바탕(#070A10)은 화면의 bg/canvas 가 그대로 비친다 — 캔버스는 투명이다.
   * 바닥은 그 바탕에서 한 단만 올라온 자리에 둔다. 밑에 깔리는 판이라
   * 색이 조금만 올라와도 위에 선 것들을 눌러 버린다.
   * 모르는 이름은 other 로 떨어진다. 레이어를 더 늘리면 여기에 한 줄 보태면 된다.
   */
  var PALETTE = {
    floor:     { face: 0x18202e, line: 0.25, peak: 0.25 },
    wall:      { face: 0x2e3a4e, line: 0.7, peak: 0.9 },
    equipment: { face: 0x41506a, line: 0.7, peak: 1 },
    stairs:    { face: 0x36435a, line: 0.32, peak: 0.5 },
    other:     { face: 0x36435a, line: 0.7, peak: 0.95 }
  };
  var EDGE = 0x7b8fb4;    // 외곽선 — 어디서나 같은 색이다
  var GHOST = 0x6a7890;   // 투명해질 때 다가가는 색
  var GRID = 0x1f2a3c;    // 바닥에 깔리는 격자

  // 눌린 설비 — 디자인 시스템의 main 램프에서 가져온다.
  var PICK_FACE = 0x3b79d5;   // main/700. 눌린 설비가 물드는 면 색
  var PICK_LINE = 0x9ec2ef;   // 고른 설비 외곽선. main/300 과 400 사이 — 너무 희면 눈이 아프다.
  var HOVER_LINE = 0x89b9ed;  // main/400. 손이 얹힌 설비 외곽선

  // 삼각형이 이 비율만큼 모이면 "넓은 면"으로 친다. 둥글린 자리는 한둘씩이라 걸러진다.
  var FACE_SHARE = 0.01;

  /*
   * 로봇 셋. 저마다 도는 자리가 다르고 색이 다르다.
   *
   * 색은 디자인 시스템 램프에서 하나씩 가져온다 — main · safe · warning.
   * danger(빨강)는 남겨 둔다. 관제 화면에서 빨간 선은 로봇 이름이 아니라
   * 사고를 뜻해야 한다.
   *
   *   dock   도킹 스테이션. 길은 여기서 나가 여기로 돌아온다.
   *   stops  들르는 자리를 순서대로. 건물 크기에 대한 비율(가로, 세로)이라
   *          모델이 바뀌어도 산다. 사이는 길찾기가 통로를 따라 이어 준다.
   *   at     왕복의 어디쯤 와 있나. 0 이 도킹, 0.5 가 가장 먼 자리, 1 이 도킹 복귀.
   *   done   지나온 길(실선) · left 남은 길(점선) · dot 멈춰 설 자리
   *
   * 길은 고리가 아니다. 로봇은 도킹 스테이션에서 나가 끝까지 갔다가
   * 같은 길로 되돌아온다 — 그래서 at 은 한 바퀴가 아니라 한 왕복이다.
   *
   * danger(빨강)는 쓰지 않는다 — 관제 화면에서 빨간 선은 로봇 이름이 아니라
   * 사고를 뜻해야 한다. 어느 선이 누구인지는 우측 카드를 눌러 확인한다.
   */
  var ROBOTS = [
    {
      name: "ROBOT 01", at: 0.31,
      dock: [0.59, 0.66],
      stops: [[0.10, 0.66], [0.05, 0.90], [0.10, 0.51], [0.47, 0.51],
              [0.15, 0.11], [0.64, 0.11]],
      done: 0x89b9ed, left: 0x4990e0, dot: 0xc7ddf8      // main
    },
    {
      name: "ROBOT 02", at: 0.58,
      dock: [0.72, 0.06],
      stops: [[0.60, 0.29], [0.30, 0.30], [0.15, 0.20]],
      done: 0x34c759, left: 0x1da67f, dot: 0x72f494      // safe
    },
    {
      name: "ROBOT 03", at: 0.18,
      dock: [0.30, 0.98],
      stops: [[0.62, 0.88], [0.85, 0.88], [0.85, 0.70]],
      done: 0xffcc00, left: 0xeeda6b, dot: 0xf8ebae      // warning
    }
  ];

  // 모델을 이 크기(가장 긴 변)로 키워서 다룬다. 이유는 build() 에 적어 두었다.
  var SPAN_UNITS = 120;

  /*
   * 확대할수록 앞을 가린 것이 비쳐 보인다.
   *
   * 카메라와 보는 지점 사이에 실제로 걸리는 덩이만 낮춘다.
   *
   *   1단계 보통   전부 100
   *   2단계 집중   가린 것 35 · 나머지 100
   *   3단계 X-ray  가린 것 15 · 나머지 100
   *
   * 가리지 않은 것은 손대지 않는다. 예전에는 먼 것도 55~96 으로 같이 낮춰서
   * 보는 자리를 도드라지게 했는데, 그러면 그 면들이 depthWrite 를 놓는다(문턱 95).
   * 깊이를 안 쓰면 뒤에 있는 모서리 선이 앞면을 뚫고 올라온다 — 벽 한가운데를
   * 가로지르는 줄이 그렇게 생겼다. 바닥 모서리가 벽을 뚫고 비친 것이었다.
   *
   * 위계는 이제 면이 아니라 모서리 선이 나른다. 보는 자리는 선이 peak 까지 오르고
   * 배경은 기본값 밑으로 내려간다. 면은 언제나 단단하다.
   */
  var FOCUS_ZOOM = 1.3;   // 여기부터 2단계
  var XRAY_ZOOM = 1.9;    // 여기부터 3단계 — 아직 건물이 보이는 배율이라야 뜻이 있다
  var EASE = 0.08;        // 한 프레임에 목표치로 다가가는 정도
  var SETTLED = 0.002;

  var meshes = [];        // { mesh, mat, edgeMat, base, center, line, now, want, edgeNow, edgeWant }
  var raycaster = null;
  var ticking = false;

  var zoom = 1;
  var scene = null, camera = null, renderer = null;
  var target = null;      // 카메라가 보는 지점
  var home = null;        // 처음 자리 — [전체 보기] 가 돌아오는 곳
  var baseSize = 1;       // zoom 1 에서 화면 세로에 담기는 월드 길이 — fitBase() 가 잡는다
  var fitH = 1, fitV = 1; // 처음 각도에서 모델이 차지하는 가로·세로(월드 길이)
  var right = null, upOnGround = null;   // 화면 가로 · 세로에 맞는 월드 방향
  var span = 1;           // 모델 반지름 — 이동 범위를 가두는 데 쓴다
  var floorY = 0;         // 바닥 높이 — 발자국 테두리를 여기에 놓는다
  var THREE = null;
  var merge = null;       // BufferGeometryUtils.mergeGeometries
  var Fat = null;         // 굵은 선 셋 — Line2 · LineMaterial · LineGeometry

  var tally = 0;          // 설비 번호 매기기
  var picked = null;      // 지금 눌린 설비(meshes 의 한 항목)
  var pickPens = [];      // 고른 설비의 외곽선(굵은 번짐 + 또렷한 선)
  var hoverPens = [];     // 손이 얹힌 설비의 외곽선
  var hovered = null;     // 손이 얹힌 설비
  var card = document.querySelector("[data-map-card]");
  var cardName = card && card.querySelector("[data-map-card-name]");

  var botBox = document.querySelector("[data-map-bot]");
  var botTip = botBox && botBox.querySelector("[data-map-bot-tip]");
  var botName = botBox && botBox.querySelector("[data-map-bot-name]");
  var botTitle = botBox && botBox.querySelector("[data-map-bot-title]");
  var botRows = botBox && botBox.querySelector("[data-map-bot-rows]");
  var onLane = null;   // 지금 지도에 길이 깔린 로봇 — { here, ahead, bot, id }
  var tone = null;        // 색 셈에 쓰는 그릇 — 프레임마다 새로 만들지 않는다
  var PICKED = null, GHOSTC = null;

  // 각도에서 방향 셋을 다시 잡는다. 돌릴 때마다 화면의 가로·세로가 달라진다.
  function orient() {
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    dirV.set(cp * Math.sin(yaw), sp, cp * Math.cos(yaw)).normalize();
    right.crossVectors(WORLD_UP, dirV).normalize();
    upOnGround.crossVectors(dirV, right).normalize();
  }

  // 축에 나란한 상자가 방향 u 로 드리우는 그림자 길이. 화면에 몇 만큼 차지하는지다.
  function across(u, size) {
    return Math.abs(u.x) * size.x + Math.abs(u.y) * size.y + Math.abs(u.z) * size.z;
  }

  /*
   * zoom 1 이 "지도 칸에 꼭 맞는 크기"가 되게 잡는다.
   *
   * 창이 좁아지면 지도 칸(.map-canvas)도 같이 좁아진다. 크기를 한 번 재고 붙박아 두면
   * 좁은 창에서 모델이 칸을 넘어 우측 패널 뒤로 밀려 들어간다. 그래서 그릴 때마다 다시 잡는다.
   *
   * 재는 각도는 언제나 처음 각도다. 지금 각도로 재면 돌릴 때마다 모델이 커졌다 작아졌다 한다.
   */
  function fitBase() {
    var cell = hit.clientWidth || view.clientWidth || 1;
    var h = view.clientHeight || 1;
    baseSize = Math.max(fitV, fitH * h / cell) * FIT_AIR;
  }

  function frame() {
    if (!renderer) { return; }
    var w = view.clientWidth, h = view.clientHeight;
    if (!w || !h) { return; }
    orient();
    fitBase();
    renderer.setSize(w, h, false);

    /*
     * 투시는 아주 조금만 준다.
     *
     * 카메라를 늘 같은 거리(모델 반지름의 EYE 배)에 세우고 화각으로 확대·축소한다.
     * 거리를 당겨서 확대하면 확대할수록 투시가 세져 도면이 사진처럼 휘고,
     * 많이 당기면 카메라가 건물 안으로 들어가 앞쪽이 잘려 나간다.
     * 거리를 붙박아 두면 투시의 세기가 배율과 상관없이 늘 같다 —
     * 앞뒤로 모델 반지름만큼 차이가 나니 크기 차이는 언제나 1/EYE 남짓이다.
     */
    var halfH = (baseSize / zoom) / 2;
    var eye = span * EYE;
    camera.fov = 2 * Math.atan(halfH / eye) * 180 / Math.PI;
    camera.aspect = w / h;
    camera.near = Math.max(0.1, eye - span * 5);
    camera.far = eye + span * 5;
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

    camera.position.copy(look).addScaledVector(dirV, eye);
    camera.up.copy(upOnGround);
    camera.lookAt(look);
    // 굵은 선은 제 굵기를 재려면 화면 크기를 알아야 한다.
    fatMats.forEach(function (mat) { mat.resolution.set(w, h); });

    // 실루엣은 보는 쪽이 달라지면 같이 달라진다. 카메라를 옮길 때마다 다시 센다.
    if (picked) { drawOutline(pickPens, picked); }
    if (hovered && hovered !== picked) { drawOutline(hoverPens, hovered); }

    renderer.render(scene, camera);
    placeCard();
    placeBot();
    placeWp();
  }

  // 창 한 픽셀이 월드에서 갖는 길이. 이동과 확대 셈이 전부 이 값으로 돈다.
  function perPixel() {
    var h = view.clientHeight || 1;
    return (baseSize / zoom) / h;
  }

  // 모델 밖으로 너무 멀리 나가지 않게 가둔다. 완전히 놓치면 돌아오는 길이 없다.
  function clamp() {
    var reach = span * REACH;
    target.x = Math.min(home.x + reach, Math.max(home.x - reach, target.x));
    target.y = Math.min(home.y + reach, Math.max(home.y - reach, target.y));
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
    plan();
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

  /* ---------- 손 ----------
   *
   * 눌린 손가락(마우스도 하나로 친다)을 배열로 들고 있는다. 하나면 돌아보거나 밀고,
   * 둘이면 벌린 만큼 확대하고 한가운데가 움직인 만큼 판을 민다.
   * 태블릿에서 두 손가락이 먹어야 자유롭게 본다는 말이 성립한다.
   */
  var down = [];          // [{ id, x, y }]
  var mode = "";          // "turn" | "slide" | "pinch"
  var gap = 0;            // 두 손가락 사이 거리(px)
  var mid = null;         // 두 손가락 한가운데(창 기준)
  var from = null;        // 누르기 시작한 자리 — 끈 건지 누른 건지 가른다
  var stirred = false;    // 누른 뒤로 손이 움직였나
  var NUDGE = 4;          // 이만큼 안 움직였으면 끈 것이 아니라 누른 것이다(px)

  function seat(id) {
    for (var i = 0; i < down.length; i += 1) {
      if (down[i].id === id) { return i; }
    }
    return -1;
  }

  function spread() {
    var dx = down[0].x - down[1].x, dy = down[0].y - down[1].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function middle() {
    var r = view.getBoundingClientRect();
    return {
      x: (down[0].x + down[1].x) / 2 - r.left,
      y: (down[0].y + down[1].y) / 2 - r.top
    };
  }

  function paint() {
    hit.classList.toggle("is-turning", mode === "turn");
    hit.classList.toggle("is-panning", mode === "slide" || mode === "pinch");
  }

  hit.addEventListener("pointerdown", function (event) {
    // 도구 레일과 설비 카드 위에서 시작한 것은 그쪽 몫이다. 지도를 끌면 안 된다.
    if (event.target.closest(".map-tools, .map-card, .map-bot, .map-wp")) { return; }
    // 왼쪽 · 가운데 · 오른쪽까지만. 옆구리 버튼(뒤로·앞으로)은 브라우저 몫으로 둔다.
    if (event.button > 2) { return; }
    if (seat(event.pointerId) >= 0) { return; }
    down.push({ id: event.pointerId, x: event.clientX, y: event.clientY });
    hit.setPointerCapture(event.pointerId);

    if (down.length === 1) {
      // 그냥 끌면 돌아본다. Shift · 가운데 · 오른쪽 버튼으로 끌면 판이 밀린다.
      mode = (event.shiftKey || event.button === 1 || event.button === 2) ? "slide" : "turn";
      from = { x: event.clientX, y: event.clientY, button: event.button };
      stirred = false;
    } else if (down.length === 2) {
      mode = "pinch";
      gap = spread();
      mid = middle();
    } else {
      mode = "";   // 셋 이상은 아무것도 안 한다 — 손이 미끄러진 것이다.
    }
    paint();
  });

  hit.addEventListener("pointermove", function (event) {
    var i = seat(event.pointerId);
    if (i < 0 || !renderer) { return; }
    var fromX = down[i].x, fromY = down[i].y;
    down[i].x = event.clientX;
    down[i].y = event.clientY;

    if (from && !stirred &&
        Math.abs(event.clientX - from.x) + Math.abs(event.clientY - from.y) > NUDGE) {
      stirred = true;
    }

    if (mode === "pinch") {
      // 손가락 하나가 조용히 사라졌으면(pointerup 을 놓치는 기기가 있다) 남은 하나로 돈다.
      if (down.length < 2) { mode = down.length ? "turn" : ""; paint(); return; }
      var nextGap = spread();
      var nextMid = middle();
      if (gap > 0 && nextGap > 0) {
        // 한가운데가 움직인 만큼 판을 밀고, 벌어진 만큼 확대한다.
        var per = perPixel();
        target.addScaledVector(right, -(nextMid.x - mid.x) * per);
        target.addScaledVector(upOnGround, (nextMid.y - mid.y) * per);
        clamp();
        zoomAt(zoom * (nextGap / gap), nextMid.x, nextMid.y);
      }
      gap = nextGap;
      mid = nextMid;
      plan();
      frame();
      return;
    }

    var dx = event.clientX - fromX;
    var dy = event.clientY - fromY;
    if (mode === "slide") {
      var s = perPixel();
      target.addScaledVector(right, -dx * s);
      target.addScaledVector(upOnGround, dy * s);
      clamp();
    } else if (mode === "turn") {
      // 커서를 따라가는 방향으로 돈다 — 오른쪽으로 끌면 모델이 오른쪽으로 돈다.
      // 좌우로는 한 바퀴 다 돌지만, 위아래는 탑뷰와 바닥 사이에서 멈춘다.
      yaw -= dx * TURN;
      pitch = Math.min(TOP_PITCH, Math.max(LOW_PITCH, pitch + dy * TURN));
    } else {
      return;
    }

    plan();
    frame();
  });

  function lift(event) {
    var i = seat(event.pointerId);
    if (i < 0) { return; }
    down.splice(i, 1);
    if (hit.hasPointerCapture(event.pointerId)) { hit.releasePointerCapture(event.pointerId); }

    /*
     * 끌지 않고 그냥 눌렀다 뗐으면 고르기다.
     * 손가락이 몇 px 은 늘 흔들리므로 NUDGE 만큼은 봐 준다.
     * 왼쪽 버튼만 고른다 — 가운데·오른쪽은 판을 미는 몫이다.
     */
    if (!down.length && from && !stirred && from.button === 0 && event.type === "pointerup") {
      var p = local(event);
      // 웨이포인트가 먼저다. 설비 위에 겹쳐 있어도 작은 표식을 노린 손이 이긴다.
      var mark = wpAt(p.x, p.y);
      if (mark) { chooseWaypoint(mark.id === chosenWp ? null : mark.id, "map"); }
      else { choose(pickAt(p.x, p.y)); }
    }
    if (!down.length) { from = null; stirred = false; }

    // 두 손가락에서 하나가 떨어지면 남은 손가락으로 다시 돌아본다.
    mode = down.length === 1 ? "turn" : "";
    paint();
  }

  // 설비 위에서는 손 모양이 바뀐다 — 누를 수 있다는 것을 알려 주는 유일한 표시다.
  hit.addEventListener("pointermove", function (event) {
    if (down.length || !renderer) { return; }
    if (event.target.closest(".map-tools, .map-card, .map-bot, .map-wp")) {
      hit.classList.remove("is-picking");
      return;
    }
    var p = local(event);
    var mark = wpAt(p.x, p.y);
    var on = mark ? null : pickAt(p.x, p.y);
    hit.classList.toggle("is-picking", !!(mark || on));

    // 이미 고른 것에는 hover 선을 덧그리지 않는다. 두 선이 겹치면 지저분해진다.
    if (on === hovered) { return; }
    hovered = on;
    drawOutline(hoverPens, (hovered && hovered !== picked) ? hovered : null);
    frame();
  });

  hit.addEventListener("pointerleave", function () {
    hit.classList.remove("is-picking");
    hovered = null;
    drawOutline(hoverPens, null);
    frame();
  });

  if (card) {
    var shut = card.querySelector("[data-map-card-close]");
    if (shut) { shut.addEventListener("click", function () { choose(null); }); }
  }

  // Esc 로도 놓는다. 카드가 가린 자리를 보려는데 닫을 데를 찾아야 하면 번거롭다.
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && picked) { choose(null); }
  });

  hit.addEventListener("pointerup", lift);
  hit.addEventListener("pointercancel", lift);

  // 오른쪽 버튼으로도 밀 수 있게 했으니 그 자리에서 메뉴가 뜨면 안 된다.
  hit.addEventListener("contextmenu", function (event) {
    if (event.target.closest(".map-tools")) { return; }
    event.preventDefault();
  });

  var zoomIn = document.querySelector("[data-map-zoom-in]");
  if (zoomIn) {
    zoomIn.addEventListener("click", function () {
      var f = focusPoint();
      zoomAt(zoom * BUTTON_STEP, f.x, f.y);
    });
  }

  /*
   * 자리 옮기기 — 각도와 배율을 부드럽게 몰고 간다.
   * 툭 바뀌면 어디를 보고 있었는지 놓친다. 짧게(320ms) 끌고 가면 따라온다.
   */
  var trip = null;
  // dest 를 주면 보는 지점을 그 자리로 몰고 간다. 안 주면 지금 자리에 둔다.
  function glide(nextYaw, nextPitch, nextZoom, dest) {
    if (!renderer) { return; }
    var from = { yaw: yaw, pitch: pitch, zoom: zoom, t: target.clone() };
    /*
     * 프레임 수가 아니라 시간으로 센다.
     * "19프레임 동안"으로 세면 프레임이 드문 곳에서 가다 말고 어중간한 각도에 멎는다.
     * 시간으로 세면 프레임이 몇 장 안 나와도 마지막 한 장이 끝 자리에 앉는다.
     */
    var began = (window.performance && performance.now) ? performance.now() : Date.now();
    trip = {};
    var mine = trip;

    function put(at) {
      var e = at < 0.5 ? 2 * at * at : 1 - Math.pow(-2 * at + 2, 2) / 2;
      yaw = from.yaw + (nextYaw - from.yaw) * e;
      pitch = from.pitch + (nextPitch - from.pitch) * e;
      zoom = from.zoom + (nextZoom - from.zoom) * e;
      if (dest) { target.lerpVectors(from.t, dest, e); }
      plan();
      frame();
    }

    (function step() {
      if (trip !== mine) { return; }
      var now = (window.performance && performance.now) ? performance.now() : Date.now();
      var at = Math.min(1, (now - began) / 320);
      put(at);
      if (at < 1) { window.requestAnimationFrame(step); }
      else { trip = null; }
    })();

    /*
     * 보험 하나 — 탭이 뒤에 있는 동안에는 화면을 안 그려서 rAF 가 아예 오지 않는다.
     * 그러면 위 줄이 한 번 돌고 멈춰 카메라가 가다 만 각도에 남는다.
     * 타이머는 그때도 오므로 시간이 다 되면 끝 자리에 앉힌다.
     * 이미 도착했으면(trip 이 비었으면) 아무 일도 하지 않는다.
     */
    window.setTimeout(function () {
      if (trip !== mine) { return; }
      put(1);
      trip = null;
    }, 360);
  }

  // 한 바퀴 넘게 돌려 놨으면 가까운 쪽으로 되감는다 — 몇 바퀴를 거꾸로 풀면 어지럽다.
  function unwind(around) {
    yaw -= Math.round((yaw - around) / (Math.PI * 2)) * Math.PI * 2;
  }

  /*
   * 전체 보기 — 처음 각도 · 처음 배율 · 한가운데로 돌아온다.
   * 마음껏 돌려 놓고도 한 번에 제자리로 오는 이 길이, 각도를 열어 둘 수 있는 근거다.
   */
  var reset = document.querySelector("[data-map-track]");
  if (reset) {
    reset.addEventListener("click", function () {
      unwind(HOME_YAW);
      glide(HOME_YAW, HOME_PITCH, 1, home);
    });
  }

  // 탑뷰 — 바로 위에서 내려다본다. yaw 도 0 으로 돌려 벽이 화면 축과 나란해진다.
  var top = document.querySelector("[data-map-top]");
  if (top) {
    top.addEventListener("click", function () {
      unwind(0);
      glide(0, TOP_PITCH, zoom, null);
    });
  }

  function decode(b64) {
    var bin = window.atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) { bytes[i] = bin.charCodeAt(i); }
    return bytes.buffer;
  }

  // 레이어 이름에서 색 이름을 뽑는다. "01_wall" -> "wall".
  function layerKey(name) {
    var slug = String(name || "").toLowerCase().replace(/^[0-9]+[_\-\s]*/, "");
    return PALETTE[slug] ? slug : "other";
  }

  /*
   * 물건 하나를 지오메트리 하나로 만든다.
   *
   * 내보낸 모델은 면 하나하나가 따로 실려 온다 — 물건 155개가 조각 1146개다.
   * 그대로 그리면 조각마다 그리기 명령이 둘씩(면 · 모서리) 나가서 2천 번을 넘고,
   * 앞을 가린 것을 찾는 광선도 조각 수만큼 훑어야 한다. 물건 단위로 합치면 310번이다.
   *
   * 합치면서 좌표를 월드로 굳힌다. 그래야 모서리 선을 뽑을 때
   * 이웃한 면끼리 꼭짓점이 맞아떨어진다.
   */
  function flatten(item, place) {
    item.updateWorldMatrix(true, true);
    var parts = [];
    item.traverse(function (node) {
      // 라이노 곡선은 선(LINE_STRIP)으로 실려 온다. 덩이 밑면과 겹쳐 아른거리기만 해서 뺀다.
      if (!node.isMesh || !node.geometry) { return; }
      var g = node.geometry.clone();
      // 재질에 텍스처가 없다. UV 를 남기면 합칠 때 속성이 어긋나고 메모리만 먹는다.
      g.deleteAttribute("uv");
      g.deleteAttribute("uv1");
      g.applyMatrix4(node.matrixWorld);
      g.applyMatrix4(place);
      parts.push(g);
    });
    if (parts.length < 2) { return parts; }

    var one = merge(parts, false);
    if (!one) { return parts; }   // 속성이 어긋나면 합치지 않고 조각째로 쓴다
    parts.forEach(function (g) { g.dispose(); });
    return [one];
  }

  // 지오메트리 하나에 면 재질과 모서리 선을 입혀 돌려준다.
  function outfit(geo, key) {
    var skin = PALETTE[key];
    var mat = new THREE.MeshStandardMaterial({
      color: skin.face,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: 1
    });
    var mesh = new THREE.Mesh(geo, mat);
    // 덩이는 바닥에 그림자를 드리우고, 서로의 그림자도 받는다.
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    var edgeMat = new THREE.LineBasicMaterial({
      color: EDGE,
      transparent: true,
      opacity: skin.line
    });
    mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), edgeMat));

    geo.computeBoundingBox();
    meshes.push({
      mesh: mesh,
      mat: mat,
      edgeMat: edgeMat,
      key: key,
      // 모델에 이름이 없어서 실린 차례대로 번호를 매긴다.
      // 라이노에서 물건마다 이름을 주시면 그 이름이 그대로 카드에 뜬다.
      title: key === "equipment" ? "설비 " + ("0" + (tally += 1)).slice(-2) : "",
      base: new THREE.Color(skin.face),
      center: geo.boundingBox.getCenter(new THREE.Vector3()),
      line: skin.line,
      peak: skin.peak,
      now: 1, want: 1,
      edgeNow: skin.line, edgeWant: skin.line,
      // 눌리면 파랗게 물든다. 0 이 제 색, 1 이 다 물든 색.
      glowNow: 0, glowWant: 0
    });
    return mesh;
  }

  /*
   * 실려 온 모델을 그릴 수 있는 모양으로 다시 짠다.
   *
   * 왜 크기를 키우는가 — EdgesGeometry 는 좌표를 소수점 넷째 자리로 반올림해서
   * 같은 꼭짓점을 찾는다. 내보낸 모델은 건물 한 변이 0.14 라 계단 한 단이 그 반올림에
   * 통째로 먹힌다. 모서리 선이 엉뚱하게 이어지거나 아예 사라진다.
   * 가장 긴 변을 120 으로 키워 두면 셈이 자릿수를 갖는다. 화면에 보이는 크기는
   * 카메라가 모델에 맞춰 잡으므로 이 숫자와 상관이 없다.
   *
   * 같은 김에 한가운데를 원점으로 옮긴다 — 좌표가 0 근처라야 셈이 눈에 들어온다.
   */
  function build(root) {
    root.updateWorldMatrix(true, true);
    var box = new THREE.Box3().setFromObject(root);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var unit = SPAN_UNITS / Math.max(size.x, size.y, size.z, 1e-9);

    var place = new THREE.Matrix4()
      .makeTranslation(-center.x, -center.y, -center.z)
      .premultiply(new THREE.Matrix4().makeScale(unit, unit, unit));

    var model = new THREE.Group();
    root.children.slice().forEach(function (layer) {
      var key = layerKey(layer.name);
      // 레이어 묶음이면 그 안의 덩이 하나가 물건 하나다. 묶이지 않았으면 그 자체가 하나다.
      var items = layer.children.length ? layer.children.slice() : [layer];
      items.forEach(function (item) {
        flatten(item, place).forEach(function (geo) {
          model.add(outfit(geo, key));
        });
      });
    });
    return model;
  }

  /* ---------- 설비 고르기 ----------
   *
   * 지도에서 집을 수 있는 것은 설비뿐이다. 벽과 바닥과 계단은 배경이라 눌러도
   * 아무 일이 없다 — 누를 수 있는 것이 많으면 무엇을 누르라는 건지 알 수 없다.
   */

  // 창 좌표에서 광선을 쏴 그 밑의 설비를 찾는다. 없으면 null.
  function pickAt(px, py) {
    if (!renderer || !camera || !meshes.length) { return null; }
    if (!raycaster) { raycaster = new THREE.Raycaster(); }

    var w = view.clientWidth || 1, h = view.clientHeight || 1;
    raycaster.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), camera);

    var list = [];
    meshes.forEach(function (item) {
      if (item.key === "equipment") { list.push(item.mesh); }
    });
    var found = raycaster.intersectObjects(list, false);
    if (!found.length) { return null; }
    for (var i = 0; i < meshes.length; i += 1) {
      if (meshes[i].mesh === found[0].object) { return meshes[i]; }
    }
    return null;
  }

  /* ---------- 고른 설비의 외곽선 ----------
   *
   * 설비 실루엣을 그대로 따라 긋는다. 네모난 상자로 두르지 않는다 —
   * 상자는 물건에서 떨어져 떠 보이고, 무엇을 골랐는지가 아니라 어디쯤인지만 말한다.
   *
   * 이 모델의 설비는 곡면이 잘게 쪼개져 있어 꺾인 모서리가 없다. EdgesGeometry 로는
   * 선이 한 줄도 안 나온다. 그래서 다르게 구한다 —
   * 맞닿은 두 면 가운데 하나는 카메라를 보고 하나는 등지는 모서리가 곧 실루엣이다.
   * 카메라를 돌리면 실루엣도 달라지므로 그릴 때마다 다시 센다.
   *
   * 모서리 장부는 물건마다 한 번만 만들어 둔다. 합쳐진 지오메트리는 같은 자리에
   * 꼭짓점이 여러 벌 있어서, 자리로 묶어 한 번호로 본다.
   */
  var books = {};   // mesh.uuid -> 모서리 장부

  function edgeBook(item) {
    if (books[item.mesh.uuid]) { return books[item.mesh.uuid]; }

    var geo = item.mesh.geometry;
    var pos = geo.attributes.position;
    var idx = geo.index;
    var count = idx ? idx.count : pos.count;
    var P = 1e4, v, t, k;

    var spot = {}, seat = new Int32Array(pos.count);
    for (v = 0; v < pos.count; v += 1) {
      var h = Math.round(pos.getX(v) * P) + "," +
              Math.round(pos.getY(v) * P) + "," +
              Math.round(pos.getZ(v) * P);
      if (spot[h] === undefined) { spot[h] = v; }
      seat[v] = spot[h];
    }

    /*
     * 먼저 삼각형마다 법선을 구하고, 같은 쪽을 보는 것끼리 모은다.
     *
     * 왜 이렇게 하는가 — 이 모델의 설비는 모서리가 잘게 둥글려져 있어서
     * 한 번에 꺾이는 각이 13도를 넘지 않는다. "많이 꺾인 자리"를 찾는 흔한 방법으로는
     * 상자 모서리가 한 줄도 안 잡히고, 문턱을 낮추면 둥근 부분이 통째로 잔선이 된다.
     *
     * 대신 평평한 면을 찾는다. 넓은 면 하나는 법선이 모두 똑같아서 한 무리가 되고,
     * 둥글린 자리는 삼각형마다 법선이 달라 무리가 안 된다.
     * 그 넓은 면의 가장자리가 곧 사람이 "모서리"라고 부르는 선이다.
     */
    var faces = [], keys = [], tally = {};
    var e0 = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    var u = new THREE.Vector3(), w = new THREE.Vector3();
    var trio = [];
    for (t = 0; t + 2 < count; t += 3) {
      var a = idx ? idx.getX(t) : t;
      var b = idx ? idx.getX(t + 1) : t + 1;
      var c = idx ? idx.getX(t + 2) : t + 2;
      e0.fromBufferAttribute(pos, a);
      e1.fromBufferAttribute(pos, b);
      e2.fromBufferAttribute(pos, c);
      var nrm = u.subVectors(e1, e0).cross(w.subVectors(e2, e0)).normalize().clone();
      var side = Math.round(nrm.x * 100) + "," + Math.round(nrm.y * 100) + "," + Math.round(nrm.z * 100);
      faces.push(nrm);
      keys.push(side);
      tally[side] = (tally[side] || 0) + 1;
      trio.push([a, b, c]);
    }

    /*
     * 넓은 면을 골라 기둥으로 삼고, 둥글린 자리의 삼각형을 가장 가까운 기둥에 딸려 보낸다.
     *
     * 왜 딸려 보내는가 — 둥글린 모서리는 양쪽 끝이 각각 "넓은 면의 가장자리"라서
     * 그대로 두면 모서리 하나에 선이 두 줄 그어진다. 둥근 부분을 반씩 나눠
     * 양쪽 면에 붙이면 두 무리가 만나는 자리가 딱 한 줄이 된다 — 둥근 부분 한가운데다.
     */
    var cut = Math.max(6, Math.round(faces.length * FACE_SHARE));
    var posts = [];
    Object.keys(tally).forEach(function (side) {
      if (tally[side] < cut) { return; }
      posts.push(faces[keys.indexOf(side)]);
    });

    var home = faces.map(function (nrm) {
      if (!posts.length) { return -1; }
      var best = 0, near = -2;
      for (var s = 0; s < posts.length; s += 1) {
        var d = nrm.dot(posts[s]);
        if (d > near) { near = d; best = s; }
      }
      return best;
    });

    var shelf = {}, list = [];
    for (t = 0; t < trio.length; t += 1) {
      var rim = [[trio[t][0], trio[t][1]], [trio[t][1], trio[t][2]], [trio[t][2], trio[t][0]]];
      for (k = 0; k < 3; k += 1) {
        var p = seat[rim[k][0]], q = seat[rim[k][1]];
        var key = p < q ? p + "_" + q : q + "_" + p;
        if (shelf[key]) {
          shelf[key].n2 = faces[t];
          /*
           * 딸린 기둥이 서로 다르면 두 면이 만나는 자리다 — 어느 쪽에서 보든 늘 긋는다.
           * 상자의 열두 모서리가 여기서 나오고, 모서리 하나에 선은 한 줄뿐이다.
           */
          shelf[key].fold = shelf[key].post >= 0 && home[t] >= 0 && shelf[key].post !== home[t];
        } else {
          shelf[key] = {
            a: rim[k][0], b: rim[k][1], n1: faces[t], n2: null,
            post: home[t], fold: false
          };
          list.push(shelf[key]);
        }
      }
    }
    books[item.mesh.uuid] = list;
    return list;
  }

  // 카메라를 보는 면과 등지는 면이 맞닿은 모서리 — 그것이 지금 보이는 실루엣이다.
  function silhouette(item) {
    var list = edgeBook(item);
    var pos = item.mesh.geometry.attributes.position;
    var out = [];
    for (var i = 0; i < list.length; i += 1) {
      var e = list[i];
      var lit1 = e.n1.dot(dirV) > 0;
      var lit2 = e.n2 ? e.n2.dot(dirV) > 0 : lit1;

      /*
       * 두 면이 다 등을 돌렸으면 덩이 뒤에 숨은 모서리다 — 긋지 않는다.
       * 정육면체라면 이 한 줄로 보이는 아홉만 남고 뒤의 셋이 빠진다.
       */
      if (!lit1 && !lit2) { continue; }

      // 남는 것은 실루엣(앞뒤가 갈리는 자리)이거나 넓은 면의 가장자리다.
      if (lit1 === lit2 && !e.fold) { continue; }
      out.push(pos.getX(e.a), pos.getY(e.a), pos.getZ(e.a),
               pos.getX(e.b), pos.getY(e.b), pos.getZ(e.b));
    }
    return out;
  }

  /*
   * 외곽선 한 벌. 굵기를 픽셀로 주려고 Line2 를 쓴다.
   * 고른 것에는 굵고 옅은 선을 한 겹 더 깔아 은은한 번짐을 만든다.
   */
  function outlinePen(width, color, alpha) {
    var geo = new Fat.LineSegmentsGeometry();
    var mat = new Fat.LineMaterial({
      color: color, linewidth: width, transparent: true, opacity: alpha,
      depthWrite: false, depthTest: false
    });
    mat.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
    fatMats.push(mat);
    var pen = new Fat.LineSegments2(geo, mat);
    pen.frustumCulled = false;   // 선을 갈아 끼우므로 three 가 잰 반경은 못 믿는다
    pen.renderOrder = 5;
    pen.visible = false;
    scene.add(pen);
    return pen;
  }

  function drawOutline(pens, item) {
    if (!pens.length) { return; }
    if (!item) {
      pens.forEach(function (pen) { pen.visible = false; });
      return;
    }
    var line = silhouette(item);
    pens.forEach(function (pen) {
      if (!line.length) { pen.visible = false; return; }
      pen.geometry.setPositions(line);
      pen.computeLineDistances();
      pen.visible = true;
    });
  }

  /*
   * 카드 자리 잡기 — 고른 설비의 꼭대기를 화면 좌표로 옮겨 카드에 넘긴다.
   *
   * 돌리고 밀고 확대할 때마다 다시 잡아야 해서 frame() 끝에서 부른다.
   * 카드는 .map-canvas 안에 있는데 카메라가 재는 좌표는 .map-view 기준이라
   * 두 칸의 차이만큼 옮겨 준다. 지도 칸을 넘어가면 가장자리에 붙여 둔다 —
   * 카드가 우측 패널 뒤로 숨으면 무엇을 골랐는지 알 수 없다.
   */
  function placeCard() {
    if (!card || !picked) { return; }
    var b = picked.mesh.geometry.boundingBox;
    var spot = new THREE.Vector3(
      (b.min.x + b.max.x) / 2,
      b.max.y,
      (b.min.z + b.max.z) / 2
    ).project(camera);

    var v = view.getBoundingClientRect();
    var c = hit.getBoundingClientRect();
    var x = (spot.x * 0.5 + 0.5) * v.width + v.left - c.left;
    var y = (-spot.y * 0.5 + 0.5) * v.height + v.top - c.top;

    var half = card.offsetWidth / 2 || 84;
    var tall = card.offsetHeight + 10 || 90;
    x = Math.min(c.width - half - 8, Math.max(half + 8, x));
    y = Math.min(c.height - 8, Math.max(tall + 8, y));

    card.style.setProperty("--x", x.toFixed(1) + "px");
    card.style.setProperty("--y", y.toFixed(1) + "px");
  }

  // 고른 것을 바꾼다. 같은 것을 다시 누르면 놓는다.
  function choose(item) {
    var next = (item && item === picked) ? null : item;
    if (next === picked) { return; }
    picked = next;
    drawOutline(pickPens, picked);

    if (card) {
      card.hidden = !picked;
      if (picked && cardName) { cardName.textContent = picked.title; }
    }

    plan();
    frame();
  }

  /*
   * 바닥 격자 — 건물 밖까지 깔리는 얇은 판이다.
   *
   * 참고 도면이 갖고 있는 인상의 절반이 이것이다. 건물이 허공에 뜬 덩이가 아니라
   * 넓은 바닥 위 한 자리를 차지한 것으로 읽힌다. 눈금은 크기를 가늠하는 자도 된다.
   *
   * 슬래브보다 한 뼘 아래에 둔다. 같은 높이에 두면 두 면이 서로 앞이라고 다퉈
   * 지지직거린다. 깊이도 쓰지 않는다 — 격자는 배경이지 물건이 아니다.
   */
  function floorGrid(box) {
    var size = box.getSize(new THREE.Vector3());
    var wide = Math.max(size.x, size.z);
    var reach = wide * 2.1;
    // 눈금 한 칸을 건물 너비의 열둘로. 촘촘하면 무늬가 되고 성기면 자가 안 된다.
    var cells = Math.max(6, Math.round(reach / (wide / 12)));

    var grid = new THREE.GridHelper(reach, cells, GRID, GRID);
    grid.position.set(box.min.x + size.x / 2, box.min.y - wide * 0.004, box.min.z + size.z / 2);
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    grid.material.depthWrite = false;
    grid.renderOrder = -1;
    return grid;
  }

  /* ---------- 로봇이 다니는 길 ----------
   *
   * 길은 손으로 찍지 않고 찾는다.
   *
   * 바닥을 격자로 훑어 위에서 광선을 쏘고, 아무것도 안 걸리는 칸만 남긴다.
   * 그 칸들 사이를 너비 우선으로 이어 출발점에서 도착점까지 가는 길을 얻는다.
   * 손으로 좌표를 찍어 두면 모델이 한 번 바뀔 때마다 길이 벽을 뚫는다.
   *
   * 격자를 한 겹 깎아 내는 것은 벽에 바싹 붙어 가지 않게 하려는 것이다.
   * 로봇은 폭이 있고, 도면에서도 길은 통로 한가운데를 지나야 읽힌다.
   */
  var ROUTE_STEP = 0.9;  // 길을 찾는 격자 한 칸(월드 길이). 통로가 좁아 촘촘히 잡는다.
  var routeGrid;         // 격자는 한 번만 만든다 — 로봇마다 바닥을 다시 훑을 이유가 없다

  /*
   * 바닥을 격자로 훑어 빈 칸을 표시한다. 광선을 위에서 아래로 쏴서
   * 아무것도 안 걸리면 그 칸은 지나갈 수 있는 자리다.
   */
  function mapFloor(box) {
    var minX = box.min.x, minZ = box.min.z;
    var cols = Math.ceil((box.max.x - minX) / ROUTE_STEP);
    var rows = Math.ceil((box.max.z - minZ) / ROUTE_STEP);
    if (cols < 6 || rows < 6) { return null; }

    var open = new Uint8Array(cols * rows).fill(1);
    var r, c, i;

    /*
     * 벽과 설비와 계단이 깔고 앉은 칸을 지운다.
     *
     * 예전에는 칸 한가운데로 광선을 한 줄씩 쏴서 봤다. 그런데 벽이 칸과 칸 사이에 끼면
     * 그 한 줄이 벽을 비켜 지나가 버린다 — 벽 두께가 칸보다 얇으면 늘 그렇다.
     * 길이 벽을 뚫고 지나간 것이 그래서였다.
     *
     * 지금은 삼각형을 하나씩 바닥에 눌러 찍는다. 삼각형이 걸치는 칸을 모두 지우므로
     * 아무리 얇은 벽도 빠짐없이 걸린다. 바닥(00_floor)만 빼고 전부 장애물로 본다 —
     * 로봇은 계단도 설비도 통과하지 못한다.
     */
    meshes.forEach(function (item) {
      if (item.key === "floor") { return; }
      var pos = item.mesh.geometry.attributes.position;
      var idx = item.mesh.geometry.index;
      var count = idx ? idx.count : pos.count;
      for (var t = 0; t + 2 < count; t += 3) {
        var lox = Infinity, hix = -Infinity, loz = Infinity, hiz = -Infinity;
        for (var k = 0; k < 3; k += 1) {
          var v = idx ? idx.getX(t + k) : (t + k);
          var x = pos.getX(v), z = pos.getZ(v);
          if (x < lox) { lox = x; }
          if (x > hix) { hix = x; }
          if (z < loz) { loz = z; }
          if (z > hiz) { hiz = z; }
        }
        var c0 = Math.max(0, Math.floor((lox - minX) / ROUTE_STEP));
        var c1 = Math.min(cols - 1, Math.floor((hix - minX) / ROUTE_STEP));
        var r0 = Math.max(0, Math.floor((loz - minZ) / ROUTE_STEP));
        var r1 = Math.min(rows - 1, Math.floor((hiz - minZ) / ROUTE_STEP));
        for (var rr = r0; rr <= r1; rr += 1) {
          for (var cc = c0; cc <= c1; cc += 1) { open[rr * cols + cc] = 0; }
        }
      }
    });

    // 가장자리 한 줄은 늘 막는다 — 건물 밖으로 나가는 길이 생기면 안 된다.
    for (c = 0; c < cols; c += 1) { open[c] = 0; open[(rows - 1) * cols + c] = 0; }
    for (r = 0; r < rows; r += 1) { open[r * cols] = 0; open[r * cols + cols - 1] = 0; }

    /*
     * 한 겹 깎아 낸 격자도 같이 만들어 둔다. 벽에 바싹 붙어 가지 않게 하려는 것이다.
     * 그런데 이 건물은 통로가 좁아서, 깎고 나면 길이 아예 끊기는 데가 있다.
     * 그럴 때는 깎지 않은 격자로 되돌아간다 — 길이 없는 것보다는 벽에 붙는 편이 낫다.
     */
    var room = new Uint8Array(open);
    for (r = 1; r < rows - 1; r += 1) {
      for (c = 1; c < cols - 1; c += 1) {
        i = r * cols + c;
        if (!open[i]) { continue; }
        if (!open[i - 1] || !open[i + 1] || !open[i - cols] || !open[i + cols]) { room[i] = 0; }
      }
    }
    return { cols: cols, rows: rows, minX: minX, minZ: minZ, open: open, room: room };
  }

  function layRoute(box, stops) {
    if (routeGrid === undefined) { routeGrid = mapFloor(box); }
    if (!routeGrid) { return null; }
    var cols = routeGrid.cols, rows = routeGrid.rows;
    var minX = routeGrid.minX, minZ = routeGrid.minZ;
    var open = routeGrid.open, room = routeGrid.room;
    var i;

    // 바라는 자리에 가장 가까운 빈 칸.
    function nearest(grid, fx, fz) {
      var wc = fx * (cols - 1), wr = fz * (rows - 1);
      var best = -1, near = Infinity;
      for (var k = 0; k < grid.length; k += 1) {
        if (!grid[k]) { continue; }
        var kc = k % cols, kr = (k - kc) / cols;
        var d = (kc - wc) * (kc - wc) + (kr - wr) * (kr - wr);
        if (d < near) { near = d; best = k; }
      }
      return best;
    }

    /*
     * 여덟 방향으로 걷는다. 로봇은 바퀴로 도는 것이 아니라 걸어 다녀서
     * 직각으로만 꺾을 이유가 없다. 네 방향만 쓰면 통로를 계단처럼 오르내린다.
     *
     * 대각선은 양옆이 모두 뚫려 있을 때만 허용한다. 안 그러면 기둥 모서리를
     * 사선으로 스쳐 지나가는 길이 나온다 — 도면에서는 벽을 뚫은 것으로 읽힌다.
     */
    var STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

    function walk(grid, from, to) {
      var prev = new Int32Array(grid.length).fill(-1);
      var seen = new Uint8Array(grid.length);
      var queue = [from];
      seen[from] = 1;
      for (var head = 0; head < queue.length && !seen[to]; head += 1) {
        var at = queue[head];
        var ac = at % cols, ar = (at - ac) / cols;
        for (var s = 0; s < STEPS.length; s += 1) {
          var nc = ac + STEPS[s][0], nr = ar + STEPS[s][1];
          if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) { continue; }
          var next = nr * cols + nc;
          if (seen[next] || !grid[next]) { continue; }
          if (STEPS[s][0] && STEPS[s][1] &&
              (!grid[ar * cols + nc] || !grid[nr * cols + ac])) { continue; }
          seen[next] = 1;
          prev[next] = at;
          queue.push(next);
        }
      }
      if (!seen[to]) { return null; }
      var back = [];
      for (var w = to; w !== -1; w = prev[w]) { back.push(w); }
      return back.reverse();
    }

    /*
     * 도킹 스테이션에서 시작해 들르는 자리를 차례로 잇는다.
     *
     * 고리가 아니다 — 마지막 자리에서 첫 자리로 돌아오는 다리를 붙이지 않는다.
     * 로봇은 끝까지 갔다가 온 길로 되돌아온다. 그 되돌아오는 몫은 그림이 아니라
     * 로봇이 서 있는 자리를 셀 때 친다(drawRoute 의 왕복 셈).
     */
    function plot(grid) {
      var cells = [], k;
      for (k = 0; k < stops.length; k += 1) {
        var cell = nearest(grid, stops[k][0], stops[k][1]);
        if (cell < 0) { return null; }
        cells.push(cell);
      }
      var line = [];
      for (k = 0; k < cells.length - 1; k += 1) {
        var leg = walk(grid, cells[k], cells[k + 1]);
        if (!leg) { return null; }
        // 앞 다리의 끝과 이 다리의 처음이 같은 칸이라 하나를 뺀다.
        line = line.concat(line.length ? leg.slice(1) : leg);
      }
      return line.length >= 12 ? line : null;
    }

    var path = plot(room) || plot(open);
    if (!path) { return null; }

    // 꺾이는 자리만 남긴다. 격자 한 칸씩 다 그리면 계단처럼 보인다.
    var turns = [];
    var y = floorY + span * 0.005;
    for (i = 0; i < path.length; i += 1) {
      var keep = i === 0 || i === path.length - 1;
      if (!keep) { keep = (path[i] - path[i - 1]) !== (path[i + 1] - path[i]); }
      if (!keep) { continue; }
      var pc = path[i] % cols, pr = (path[i] - pc) / cols;
      turns.push(new THREE.Vector3(
        minX + (pc + 0.5) * ROUTE_STEP, y, minZ + (pr + 0.5) * ROUTE_STEP
      ));
    }
    return turns.length >= 2 ? turns : null;
  }

  /*
   * 꺾이는 자리를 둥글린다.
   *
   * 로봇은 제자리에서 직각으로 꺾지 않는다. 각진 선은 좌표를 그린 것이고,
   * 둥근 선은 로봇이 실제로 지나갈 자리를 그린 것이다.
   *
   * 모서리에서 양쪽으로 반지름만큼 물러난 두 점을 잡고, 모서리를 제어점 삼아
   * 이차 베지에로 잇는다. 짧은 변에서는 반지름을 변 길이의 절반으로 줄인다 —
   * 안 그러면 물러난 점이 앞 모서리를 넘어가 선이 스스로를 지른다.
   *
   * 웨이포인트 점은 둥글린 자리의 한가운데에 찍는다. 원래 모서리에 찍으면
   * 선에서 떨어져 뜬다 — 선이 이미 그 자리를 지나지 않기 때문이다.
   */
  var ROUTE_ROUND = 1.6;   // 둥글리는 반지름(월드 길이).
                           // 크게 주면 호가 모서리를 질러 벽을 파고든다.
  var ROUND_STEPS = 7;     // 호 하나를 몇 도막으로 나눌지

  function roundOff(turns) {
    var n = turns.length;
    if (n < 3) { return { line: turns.slice(), nodes: turns.slice() }; }

    // 닫힌 고리면 겹쳐 있는 끝점을 빼고 돌린다 — 시작 자리도 모서리이기 때문이다.
    var shut = turns[0].distanceTo(turns[n - 1]) < 1e-6;
    var pts = shut ? turns.slice(0, n - 1) : turns;
    var m = pts.length;
    var line = [], nodes = [];
    var i, s;

    if (!shut) { line.push(pts[0].clone()); }
    for (i = shut ? 0 : 1; i <= (shut ? m - 1 : m - 2); i += 1) {
      var a = pts[(i - 1 + m) % m], b = pts[i], c = pts[(i + 1) % m];
      var back = a.distanceTo(b), ahead = b.distanceTo(c);
      var r = Math.min(ROUTE_ROUND, back / 2, ahead / 2);
      if (r < 1e-3) { line.push(b.clone()); nodes.push(b.clone()); continue; }

      var p = b.clone().lerp(a, r / back);
      var q = b.clone().lerp(c, r / ahead);
      line.push(p);
      for (s = 1; s < ROUND_STEPS; s += 1) {
        var t = s / ROUND_STEPS, k = 1 - t;
        var bend = new THREE.Vector3(
          k * k * p.x + 2 * k * t * b.x + t * t * q.x,
          p.y,
          k * k * p.z + 2 * k * t * b.z + t * t * q.z
        );
        line.push(bend);
        if (s * 2 === ROUND_STEPS) { nodes.push(bend.clone()); }
      }
      line.push(q);
      if (ROUND_STEPS % 2) { nodes.push(p.clone().lerp(q, 0.5).lerp(b, 0.5)); }
    }
    line.push(shut ? line[0].clone() : pts[m - 1].clone());
    return { line: line, nodes: nodes };
  }

  /* ---------- 로봇의 시야 ----------
   *
   * 로봇 앞으로 부채꼴을 깔아 어디를 보고 있는지 보인다.
   * 로봇 곁이 진하고 멀어질수록 사라진다 — 가까울수록 잘 보고, 멀수록 흐릿하다.
   *
   * 화면에 붙은 화살표가 아니라 바닥에 눕힌 3D 다. 카메라를 돌리면 화살표는 바닥과
   * 따로 놀지만, 이 부채꼴은 바닥에 붙은 채로 같이 기운다.
   *
   * 그라데이션은 흰색 한 장으로 만들어 두고 재질 색으로 로봇 색을 입힌다 —
   * 로봇마다 그림을 따로 굽지 않아도 된다.
   */
  var FAN_REACH = 0.17;                  // 시야 길이 = 모델 반지름의 이만큼
  var FAN_SPREAD = 100 * Math.PI / 180;  // 벌어지는 각
  var fanArt = null;

  function fanTexture() {
    if (fanArt) { return fanArt; }
    var size = 128;
    var pad = document.createElement("canvas");
    pad.width = size;
    pad.height = size;
    var ink = pad.getContext("2d");
    var wash = ink.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    wash.addColorStop(0, "rgba(255,255,255,1)");
    wash.addColorStop(0.6, "rgba(255,255,255,0.55)");
    wash.addColorStop(1, "rgba(255,255,255,0)");
    ink.fillStyle = wash;
    ink.fillRect(0, 0, size, size);
    fanArt = new THREE.CanvasTexture(pad);
    return fanArt;
  }

  function viewFan(bot, here, dx, dz) {
    var reach = span * FAN_REACH;
    var steps = 28;
    var pos = [0, 0, 0], uv = [0.5, 0.5], idx = [];
    var i, a, x, z;

    // 꼭짓점이 로봇, 테두리가 시야 끝. UV 한가운데를 꼭짓점에 맞춰
    // 그라데이션이 로봇에서 바깥으로 퍼지게 한다.
    for (i = 0; i <= steps; i += 1) {
      a = -FAN_SPREAD / 2 + FAN_SPREAD * (i / steps);
      x = Math.sin(a) * reach;
      z = Math.cos(a) * reach;
      pos.push(x, 0, z);
      uv.push(0.5 + x / (2 * reach), 0.5 - z / (2 * reach));
    }
    for (i = 0; i < steps; i += 1) { idx.push(0, i + 1, i + 2); }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);

    var fan = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: bot.left, map: fanTexture(), transparent: true,
      depthWrite: false, side: THREE.DoubleSide
    }));
    fan.position.copy(here);
    fan.position.y += span * 0.002;
    // 부채꼴은 +Z 를 보고 만들었다. 가는 쪽으로 돌려 세운다.
    fan.rotation.y = Math.atan2(dx, dz);
    fan.renderOrder = 2;
    return fan;
  }

  /* ---------- 멈춰 서서 볼 자리 ---------- */

  var WAYPOINTS = 7;   // 우측 미션 목록의 웨이포인트와 같은 수다
  var stopArt = {};    // 채운 점 · 빈 점 그림 두 장

  // 길 위에서 출발점으로부터 far 만큼 간 자리.
  function alongRoute(turns, mile, far) {
    var at = 1;
    while (at < mile.length - 1 && mile[at] < far) { at += 1; }
    var leg = Math.max(1e-6, mile[at] - mile[at - 1]);
    return turns[at - 1].clone().lerp(turns[at], (far - mile[at - 1]) / leg);
  }

  /*
   * 점 그림. 흰색으로 구워 두고 재질 색으로 로봇 색을 입힌다.
   * 채운 것은 지나온 자리, 테두리만 있는 것은 앞으로 갈 자리다.
   */
  function stopTexture(kind) {
    if (stopArt[kind]) { return stopArt[kind]; }
    var size = 64, mid = size / 2;
    var pad = document.createElement("canvas");
    pad.width = size;
    pad.height = size;
    var ink = pad.getContext("2d");

    if (kind === "halo") {
      // 고른 웨이포인트를 두르는 바깥 고리. 속은 비운다 — 안의 상태색을 덮으면 안 된다.
      ink.beginPath();
      ink.arc(mid, mid, mid - 5, 0, Math.PI * 2);
      ink.lineWidth = 5;
      ink.strokeStyle = "#ffffff";
      ink.stroke();
      stopArt[kind] = new THREE.CanvasTexture(pad);
      return stopArt[kind];
    }

    // 속은 바탕색으로 막는다 — 길이 비쳐 보이면 점이 아니라 얼룩이 된다.
    var full = kind === "full";
    ink.beginPath();
    ink.arc(mid, mid, mid - 9, 0, Math.PI * 2);
    ink.fillStyle = "#0a0f18";
    ink.fill();
    ink.lineWidth = full ? 9 : 6;
    ink.strokeStyle = "#ffffff";
    ink.stroke();

    // 다녀온 자리는 속에 점을 하나 더 찍는다. 우측 목록의 체크와 같은 뜻이다.
    if (full) {
      ink.beginPath();
      ink.arc(mid, mid, mid * 0.32, 0, Math.PI * 2);
      ink.fillStyle = "#ffffff";
      ink.fill();
    }

    stopArt[kind] = new THREE.CanvasTexture(pad);
    return stopArt[kind];
  }

  /*
   * 도킹 스테이션 — 길이 나가고 돌아오는 자리.
   * 멈춰 설 자리(고리)와 헷갈리지 않게 네모로 둔다. 성격이 다른 것은 모양이 달라야 한다.
   */
  function dockTexture() {
    if (stopArt.dock) { return stopArt.dock; }
    var size = 64, edge = 12, r = 9;
    var pad = document.createElement("canvas");
    pad.width = size;
    pad.height = size;
    var ink = pad.getContext("2d");
    var x = edge, y = edge, w = size - edge * 2, h = size - edge * 2;
    ink.beginPath();
    ink.moveTo(x + r, y);
    ink.arcTo(x + w, y, x + w, y + h, r);
    ink.arcTo(x + w, y + h, x, y + h, r);
    ink.arcTo(x, y + h, x, y, r);
    ink.arcTo(x, y, x + w, y, r);
    ink.closePath();
    ink.fillStyle = "#0a0f18";
    ink.fill();
    ink.lineWidth = 8;
    ink.strokeStyle = "#ffffff";
    ink.stroke();
    stopArt.dock = new THREE.CanvasTexture(pad);
    return stopArt.dock;
  }

  function dockMark(spot, color) {
    var mark = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints([spot]),
      new THREE.PointsMaterial({
        color: color, map: dockTexture(), size: 20, sizeAttenuation: false,
        transparent: true, opacity: 0.95, depthWrite: false
      })
    );
    mark.renderOrder = 3;
    return mark;
  }

  function stopDots(spots, color, kind, size) {
    var dots = new THREE.Points(
      new THREE.BufferGeometry().setFromPoints(spots),
      new THREE.PointsMaterial({
        color: color, map: stopTexture(kind), size: size || 15, sizeAttenuation: false,
        transparent: true, opacity: 0.95, depthWrite: false
      })
    );
    // 길보다 나중에 그린다. 굵어진 길이 점을 덮어 버리기 때문이다.
    dots.renderOrder = 3;
    return dots;
  }

  /* ---------- 웨이포인트 ----------
   *
   * 지도의 웨이포인트와 우측 미션 목록은 같은 것을 가리킨다. 이름(waypointId)도 같다.
   * 이름은 목록이 짓고 지도는 읽기만 한다 — 두 곳에서 지으면 언젠가 어긋난다.
   *
   * 진행 상태(completed · current · upcoming)와 고른 상태(selected)는 따로 둔다.
   * 로봇이 다음 칸으로 넘어갈 때 사람이 들여다보던 칸이 튕겨 나가면 안 된다.
   * 그래서 고른 표시는 상태색을 바꾸지 않고 바깥에 고리를 하나 두르는 것으로 한다.
   */
  var WP_TINT = {
    safe: 0x34c759,       // safe/300
    caution: 0xffcc00,    // warning/500
    danger: 0xff383c,     // danger/500
    current: 0x89b9ed,    // main/400
    upcoming: 0x8894aa    // gray/450 언저리 — 아직 아무 일도 없었다는 뜻이다
  };
  var WP_HALO = 0xffffff;   // 고른 것을 두르는 바깥 고리. 상태색 위에 얹기만 한다.

  var wpMarks = [];    // 지금 깔려 있는 표식들
  var wpSpots = [];    // { id, spot, info } — 누를 때 쓰는 자리표
  var wpHalo = null;   // 고른 것을 두르는 고리
  var chosenWp = null; // selectedWaypointId — 사람이 짚은 것
  var liveWp = null;   // currentWaypointId — 미션이 지금 하는 것

  // 우측 목록에서 웨이포인트를 읽어 온다. 목록이 원본이다.
  function readWaypoints() {
    var rail = document.querySelector("[data-timeline]");
    if (!rail) { return []; }
    return Array.prototype.map.call(rail.querySelectorAll("[data-waypoint]"), function (item) {
      var kind = item.getAttribute("data-wp-state") || "upcoming";
      var title = item.querySelector(".step-title");
      return {
        id: item.getAttribute("data-waypoint"),
        kind: kind,
        // 표식 색은 다녀온 곳이면 검사 결과, 아니면 진행 상태를 따른다.
        tone: kind === "completed" ? (item.getAttribute("data-wp-result") || "safe") : kind,
        name: title ? title.textContent : "",
        // 측정 요약은 목록에 그리지 않는다. 값만 속성에 있고, 보여 주는 곳은 지도 쪽지다.
        read: item.getAttribute("data-wp-read") || ""
      };
    });
  }

  function clearWaypoints() {
    wpMarks.forEach(function (mark) {
      scene.remove(mark);
      mark.geometry.dispose();
      mark.material.dispose();
    });
    wpMarks = [];
    wpSpots = [];
    if (wpHalo) {
      scene.remove(wpHalo);
      wpHalo.geometry.dispose();
      wpHalo.material.dispose();
      wpHalo = null;
    }
  }

  function layWaypoints() {
    if (!scene) { return; }
    clearWaypoints();
    if (!onLane || !onLane.turns) { return; }

    var list = readWaypoints();
    if (!list.length) { return; }

    // 길을 목록 수만큼 잘라 그 경계에 놓는다. 목록이 일곱이면 일곱, 아홉이면 아홉이다.
    var bucket = {};
    list.forEach(function (info, i) {
      var spot = alongRoute(onLane.turns, onLane.mile, onLane.total * (i / list.length));
      wpSpots.push({ id: info.id, spot: spot, info: info });
      (bucket[info.tone] = bucket[info.tone] || []).push(spot);
    });

    Object.keys(bucket).forEach(function (tone) {
      var mark = stopDots(bucket[tone], WP_TINT[tone] || WP_TINT.upcoming,
        tone === "upcoming" ? "ring" : "full", 15);
      scene.add(mark);
      wpMarks.push(mark);
    });

    haloWaypoint();
  }

  function haloWaypoint() {
    if (wpHalo) {
      scene.remove(wpHalo);
      wpHalo.geometry.dispose();
      wpHalo.material.dispose();
      wpHalo = null;
    }
    var found = wpSpots.filter(function (w) { return w.id === chosenWp; });
    if (!found.length || !scene) { return; }
    wpHalo = stopDots(found.map(function (w) { return w.spot; }), WP_HALO, "halo", 28);
    wpHalo.renderOrder = 4;
    scene.add(wpHalo);
  }

  // 커서 밑의 웨이포인트. 점 스프라이트라 광선보다 화면 거리로 재는 편이 정확하다.
  function wpAt(px, py) {
    if (!camera || !wpSpots.length) { return null; }
    var w = view.clientWidth || 1, h = view.clientHeight || 1;
    var near = null, best = 14 * 14;
    wpSpots.forEach(function (mark) {
      var p = mark.spot.clone().project(camera);
      var x = (p.x * 0.5 + 0.5) * w, y = (-p.y * 0.5 + 0.5) * h;
      var gap = (x - px) * (x - px) + (y - py) * (y - py);
      if (gap < best) { best = gap; near = mark; }
    });
    return near;
  }

  /*
   * 길 한 가닥. 지나온 길은 실선, 남은 길은 점선이다.
   *
   * 굵기를 주려고 Line2 를 쓴다. 평범한 THREE.Line 은 WebGL 에서 굵기가 늘 1px 이다 —
   * linewidth 를 아무리 올려도 브라우저가 무시한다. Line2 는 선을 사각형 띠로 바꿔
   * 그리므로 굵기가 먹는다. 대신 화면 크기를 알아야 해서, 창이 바뀔 때마다
   * resolution 을 다시 넣어 줘야 한다(frame() 에서 한다).
   */
  var fatMats = [];

  function strand(points, color, dashed) {
    var flat = [];
    points.forEach(function (p) { flat.push(p.x, p.y, p.z); });

    var geo = new Fat.LineGeometry();
    geo.setPositions(flat);

    var mat = new Fat.LineMaterial({
      color: color,
      linewidth: dashed ? 2.6 : 3.6,
      transparent: true,
      opacity: dashed ? 0.85 : 0.95,
      dashed: !!dashed,
      dashSize: span * 0.014,
      gapSize: span * 0.01,
      depthWrite: false
    });
    mat.resolution.set(view.clientWidth || 1, view.clientHeight || 1);
    fatMats.push(mat);

    var line = new Fat.Line2(geo, mat);
    line.computeLineDistances();
    line.renderOrder = 2;
    return line;
  }

  /*
   * 지도에 보이는 길은 지금 고른 로봇의 것 하나뿐이다.
   *
   * 셋을 한꺼번에 깔면 선이 얽혀서 어느 것이 누구 길인지 읽히지 않는다.
   * 우측 로봇 띠에서 카드를 누르면 그 로봇의 길로 바뀐다.
   * 길이 없는 로봇을 누르면 지도에서 길이 사라진다 — 없는 것을 있는 척하지 않는다.
   */
  var lanes = {};   // data-robot 번호 -> 그 로봇의 길을 이루는 것들

  function showLane(index) {
    var key = String(index);
    onLane = null;
    Object.keys(lanes).forEach(function (id) {
      var on = id === key;
      lanes[id].parts.forEach(function (part) { part.visible = on; });
      if (on) { onLane = lanes[id]; }
    });

    // 길이 바뀌면 웨이포인트도 그 길 위로 옮겨 놓는다. 고른 것은 놓는다 —
    // 다른 미션의 같은 순번은 같은 자리가 아니다.
    chosenWp = null;
    layWaypoints();
    tellWaypoint();

    if (botBox) {
      botBox.hidden = !onLane;
      if (botTip) { botTip.hidden = true; }
      botBox.classList.remove("is-picked");
      if (onLane) {
        botBox.style.setProperty("--bot-tint", "#" + ("00000" + onLane.bot.done.toString(16)).slice(-6));
        if (botName) { botName.textContent = onLane.bot.name; }
        if (botTitle) { botTitle.textContent = onLane.bot.name; }
      }
    }
    frame();
  }

  /*
   * 지도 위 로봇의 자리와 가는 방향.
   *
   * 지금 선 자리와 조금 앞을 나란히 화면 좌표로 옮겨, 그 둘 사이의 각을 방향으로 쓴다.
   * 월드 각을 쓰지 않는 것은 카메라를 돌리면 화면에서의 방향이 달라지기 때문이다.
   * CSS 는 위쪽을 0도로 치므로 atan2(가로, -세로) 로 옮긴다.
   */
  function placeBot() {
    if (!botBox || !onLane || botBox.hidden) { return; }

    var v = view.getBoundingClientRect();
    var c = hit.getBoundingClientRect();
    var a = onLane.here.clone().project(camera);
    var b = onLane.ahead.clone().project(camera);
    var ax = (a.x * 0.5 + 0.5) * v.width + v.left - c.left;
    var ay = (-a.y * 0.5 + 0.5) * v.height + v.top - c.top;
    var bx = (b.x * 0.5 + 0.5) * v.width + v.left - c.left;
    var by = (-b.y * 0.5 + 0.5) * v.height + v.top - c.top;

    // 옆모습이라 왼쪽으로 갈 때는 좌우를 뒤집는다. 안 그러면 뒷걸음질로 보인다.
    // 가는 쪽 자체는 바닥의 시야 부채꼴이 말해 준다.
    var dx = bx - ax, dy = by - ay;
    if (dx * dx + dy * dy > 0.01) {
      botBox.style.setProperty("--flip", dx < 0 ? "-1" : "1");
    }
    botBox.style.setProperty("--x", ax.toFixed(1) + "px");
    botBox.style.setProperty("--y", ay.toFixed(1) + "px");

    /*
     * 배율을 따라 표식도 커진다.
     *
     * 픽셀 크기로 붙박아 두면 확대할수록 건물만 커지고 로봇은 그대로라,
     * 가까이 갈수록 점점 작아 보인다.
     * 배율에 그대로 비례시키면 최대 배율에서 화면을 다 덮으므로 0.7 제곱으로 눌러
     * 2.8배에서 멈춘다 — 표식은 로봇의 실제 크기가 아니라 "여기 있다"는 표시다.
     */
    botBox.style.setProperty("--bot-zoom",
      Math.min(2.8, Math.max(1, Math.pow(zoom, 0.7))).toFixed(2));
  }

  // 우측 카드에서 상태를 그대로 읽어 온다. 값을 두 군데 적어 두면 언젠가 어긋난다.
  function botFacts(card) {
    var out = [];
    Array.prototype.forEach.call(card.querySelectorAll(".robot-row"), function (row) {
      var caps = row.querySelectorAll(".t-caption");
      if (caps.length < 2) { return; }
      out.push([caps[0].textContent.trim(), caps[caps.length - 1].textContent.trim()]);
    });
    return out;
  }

  function tellBot(on) {
    if (!botTip) { return; }
    if (!on || !onLane) { botTip.hidden = true; botBox.classList.remove("is-picked"); return; }
    var card = document.querySelector(".robot-strip .robot-card[data-robot='" + onLane.id + "']");
    if (card && botRows) {
      botRows.textContent = "";
      botFacts(card).forEach(function (fact) {
        var line = document.createElement("div");
        var dt = document.createElement("dt");
        var dd = document.createElement("dd");
        dt.textContent = fact[0];
        dd.textContent = fact[1];
        line.appendChild(dt);
        line.appendChild(dd);
        botRows.appendChild(line);
      });
    }
    botTip.hidden = false;
    botBox.classList.add("is-picked");
  }

  /* ---------- 웨이포인트 쪽지와 고르기 ---------- */

  var wpBox = document.querySelector("[data-map-wp]");
  var wpChip = wpBox && wpBox.querySelector("[data-map-wp-chip]");
  var wpName = wpBox && wpBox.querySelector("[data-map-wp-name]");
  var wpRead = wpBox && wpBox.querySelector("[data-map-wp-read]");

  var WP_WORD = {
    safe: "정상", caution: "주의", danger: "위험",
    current: "측정 중", upcoming: "예정"
  };

  function tellWaypoint() {
    if (!wpBox) { return; }
    var found = wpSpots.filter(function (w) { return w.id === chosenWp; })[0];
    if (!found) { wpBox.hidden = true; return; }
    var info = found.info;
    wpBox.setAttribute("data-result", info.tone);
    if (wpChip) { wpChip.textContent = WP_WORD[info.tone] || "예정"; }
    if (wpName) { wpName.textContent = info.id + " · " + (info.name || "waypoint"); }
    if (wpRead) {
      wpRead.textContent = info.read ||
        (info.kind === "upcoming" ? "아직 가지 않은 자리입니다." : "측정 항목 확인 중");
    }
    wpBox.hidden = false;
    placeWp();
  }

  // 쪽지 자리 — 고른 웨이포인트를 화면 좌표로 옮긴다. 설비 카드와 같은 셈이다.
  function placeWp() {
    if (!wpBox || wpBox.hidden || !camera) { return; }
    var found = wpSpots.filter(function (w) { return w.id === chosenWp; })[0];
    if (!found) { return; }

    var p = found.spot.clone().project(camera);
    var v = view.getBoundingClientRect();
    var c = hit.getBoundingClientRect();
    var x = (p.x * 0.5 + 0.5) * v.width + v.left - c.left;
    var y = (-p.y * 0.5 + 0.5) * v.height + v.top - c.top;

    var half = wpBox.offsetWidth / 2 || 88;
    var tall = wpBox.offsetHeight + 12 || 96;
    x = Math.min(c.width - half - 8, Math.max(half + 8, x));
    y = Math.min(c.height - 8, Math.max(tall + 8, y));
    wpBox.style.setProperty("--x", x.toFixed(1) + "px");
    wpBox.style.setProperty("--y", y.toFixed(1) + "px");
  }

  /*
   * 웨이포인트를 고른다. from 이 "panel" 이면 우측에서 누른 것이라 카메라를 데려간다.
   * 지도에서 누른 것이면 이미 보고 있으므로 카메라는 가만히 둔다.
   * 알림은 온 쪽으로 되돌려 보내지 않는다 — 두 쪽이 서로를 끝없이 부르는 것을 막는다.
   */
  function chooseWaypoint(id, from) {
    chosenWp = id || null;
    haloWaypoint();
    tellWaypoint();

    if (chosenWp && from === "panel") {
      var found = wpSpots.filter(function (w) { return w.id === chosenWp; })[0];
      if (found && renderer) { glide(yaw, pitch, Math.max(zoom, 2.4), found.spot); }
    }
    if (from !== "panel") {
      document.dispatchEvent(new CustomEvent("aprism:waypoint", {
        detail: { id: chosenWp, from: "map" }
      }));
    }
    frame();
  }

  // 우측 목록이 다시 그려졌다 — 표식을 새 상태로 다시 깐다.
  document.addEventListener("aprism:mission", function (event) {
    liveWp = (event.detail && event.detail.current) || null;
    chosenWp = null;
    layWaypoints();
    tellWaypoint();
    frame();
  });

  // 우측에서 웨이포인트를 골랐다.
  document.addEventListener("aprism:waypoint", function (event) {
    if (!event.detail || event.detail.from !== "panel") { return; }
    chooseWaypoint(event.detail.id, "panel");
  });

  if (wpBox) {
    var shutWp = wpBox.querySelector("[data-map-wp-close]");
    if (shutWp) {
      shutWp.addEventListener("click", function () { chooseWaypoint(null, "map"); });
    }
  }

  // 지금 눌려 있는 로봇 카드. 우측 띠가 aria-pressed 로 표시해 둔다.
  function activeRobot() {
    var on = document.querySelector(".robot-strip .robot-card[aria-pressed='true'][data-robot]");
    return on ? on.getAttribute("data-robot") : "0";
  }

  /*
   * 우측에서 로봇을 누르면 지도가 그 로봇에게 간다.
   *
   * 길만 바꾸면 로봇이 화면 밖에 있을 때 아무 일도 안 일어난 것처럼 보인다.
   * 각도는 건드리지 않고 보는 지점만 옮긴다 — 각도까지 돌리면 어디를 보고 있었는지 놓친다.
   */
  document.addEventListener("click", function (event) {
    var picked = event.target.closest && event.target.closest(".robot-strip .robot-card[data-robot]");
    if (!picked || picked.hasAttribute("data-robot-offline")) { return; }
    showLane(picked.getAttribute("data-robot"));
    if (onLane && renderer) { glide(yaw, pitch, Math.max(zoom, 2.2), onLane.here); }
  });

  if (botBox) {
    var open = botBox.querySelector("[data-map-bot-open]");
    var shutBot = botBox.querySelector("[data-map-bot-close]");
    if (open) {
      open.addEventListener("click", function () { tellBot(botTip.hidden); });
    }
    if (shutBot) {
      shutBot.addEventListener("click", function () { tellBot(false); });
    }
  }

  function drawRoute(corners, bot, id) {
    if (!corners || corners.length < 2) { return; }
    var parts = [];
    var soft = roundOff(corners);
    var turns = soft.line;

    // 길이를 재서 로봇이 선 자리를 찾는다.
    var mile = [0], total = 0, i;
    for (i = 1; i < turns.length; i += 1) {
      total += turns[i].distanceTo(turns[i - 1]);
      mile.push(total);
    }
    /*
     * 왕복 셈 — at 은 한 바퀴가 아니라 한 왕복이다.
     * 0 이 도킹, 0.5 가 가장 먼 자리, 1 이 도킹 복귀다.
     * 그래서 0.5 를 넘으면 길을 거꾸로 되짚는다. 길 자체는 한 벌만 그린다 —
     * 갈 때와 올 때가 같은 길이라 두 번 그리면 겹쳐서 더 밝아지기만 한다.
     */
    var back = bot.at > 0.5;
    var trip = back ? (1 - bot.at) * 2 : bot.at * 2;
    var mark = total * Math.max(0, Math.min(1, trip));
    var at = 1;
    while (at < mile.length - 1 && mile[at] < mark) { at += 1; }
    var leg = Math.max(1e-6, mile[at] - mile[at - 1]);
    var here = turns[at - 1].clone().lerp(turns[at], (mark - mile[at - 1]) / leg);

    parts.push(strand(turns.slice(0, at).concat([here]), bot.done, false));
    parts.push(strand([here].concat(turns.slice(at)), bot.left, true));

    /*
     * 멈춰 서서 볼 자리 일곱 — 우측 미션 목록의 웨이포인트 일곱과 같은 수다.
     * 길을 일곱 토막으로 잘라 그 경계에 찍는다. 지나온 것은 속을 채우고,
     * 앞으로 갈 것은 테두리만 남긴다. 목록의 체크 표시와 같은 뜻이다.
     *
     * 꺾이는 자리마다 찍던 점은 걷어냈다. 일곱과 섞이면 어느 것이 멈출 자리인지
     * 알 수 없다 — 꺾임은 길의 생김새일 뿐 서야 할 자리가 아니다.
     */
    // 웨이포인트 표식은 여기서 만들지 않는다. 우측 목록이 들고 있는 상태에 따라
    // 색이 달라지고 목록이 바뀌면 같이 바뀌어야 해서, 길을 깔 때가 아니라
    // 길을 켤 때 다시 그린다(layWaypoints).

    // 도킹 스테이션 — 길의 첫 점이 곧 그 자리다.
    parts.push(dockMark(turns[0], bot.done));

    parts.forEach(function (part) {
      part.visible = false;
      scene.add(part);
    });

    /*
     * 조금 앞의 점 — 어느 쪽으로 가는지를 여기서 잰다.
     * 돌아오는 길이면 앞이 아니라 뒤를 본다. 같은 길을 거꾸로 가는 중이기 때문이다.
     */
    var step = back ? at - 1 : at;
    var ahead = turns[Math.max(0, Math.min(step, turns.length - 1))];
    while (ahead.distanceTo(here) < span * 0.002 &&
           step > 0 && step < turns.length - 1) {
      step += back ? -1 : 1;
      ahead = turns[Math.max(0, Math.min(step, turns.length - 1))];
    }

    // 시야 부채꼴. 길보다 위에 깔려 로봇이 보는 쪽을 덮는다.
    var fan = viewFan(bot, here, ahead.x - here.x, ahead.z - here.z);
    fan.visible = false;
    scene.add(fan);
    parts.push(fan);

    lanes[String(id)] = {
      id: String(id), bot: bot, parts: parts,
      // 웨이포인트를 나중에 다시 놓으려면 길과 그 길이를 들고 있어야 한다.
      turns: turns, mile: mile, total: total,
      here: here.clone(), ahead: ahead.clone()
    };
  }

  /*
   * 카메라에서 보는 지점으로 광선을 쏴 그 사이에 걸리는 덩이를 찾는다.
   * 한가운데 한 줄만 쏘면 정작 눈앞의 벽이 안 걸릴 때가 있어서
   * 십자로 다섯 줄을 쏜다 — 물건 단위로 합쳐 155개만 훑으면 되니 값이 싸다.
   */
  function blocking() {
    var hitSet = {};
    if (!raycaster) { raycaster = new THREE.Raycaster(); }
    var reach = span * 0.35;
    var spots = [
      target,
      target.clone().addScaledVector(right, reach),
      target.clone().addScaledVector(right, -reach),
      target.clone().addScaledVector(upOnGround, reach),
      target.clone().addScaledVector(upOnGround, -reach)
    ];
    var list = meshes.map(function (item) { return item.mesh; });

    spots.forEach(function (spot) {
      var from = spot.clone().addScaledVector(dirV, span * 4);
      var dir = new THREE.Vector3().subVectors(spot, from).normalize();
      raycaster.set(from, dir);
      var far = from.distanceTo(spot);
      // 모서리 선은 자식이라 false 로 두면 안 걸린다 — 면만 센다.
      raycaster.intersectObjects(list, false).forEach(function (found) {
        // 보는 지점보다 앞에 있는 것만 가린 것이다.
        if (found.distance < far - span * 0.02) { hitSet[found.object.uuid] = true; }
      });
    });
    return hitSet;
  }

  // 배율에서 단계를 읽는다. 두 문턱 사이는 이어서 섞는다 — 툭 끊기면 어색하다.
  function level() {
    if (zoom <= FOCUS_ZOOM) { return 1; }
    if (zoom >= XRAY_ZOOM) { return 3; }
    return 2;
  }

  function plan() {
    if (!meshes.length) { return; }
    var stage = level();
    var hits = stage === 1 ? {} : blocking();
    var near = span * 0.55;

    meshes.forEach(function (item) {
      var blocked = !!hits[item.mesh.uuid];
      var close = item.center.distanceTo(target) < near;
      var want = 1, edge = item.line;

      if (stage === 2) {
        want = blocked ? 0.35 : 1;
        edge = blocked ? item.line * 0.6 : (close ? item.peak : item.line * 0.8);
      } else if (stage === 3) {
        want = blocked ? 0.15 : 1;
        edge = blocked ? item.line * 0.4 : (close ? item.peak : item.line * 0.6);
      }

      // 고른 설비는 단계와 상관없이 단단하고 또렷하다.
      if (item === picked) { want = 1; edge = 1; }

      item.want = want;
      item.edgeWant = edge;
      item.glowWant = item === picked ? 1 : 0;
    });
    settle();
  }

  // 목표치로 조금씩 다가간다. 다 닿으면 멈춘다 — 관제 화면이라 계속 돌릴 이유가 없다.
  function settle() {
    if (ticking) { return; }
    ticking = true;
    (function step() {
      var moving = false;
      meshes.forEach(function (item) {
        item.now += (item.want - item.now) * EASE;
        item.edgeNow += (item.edgeWant - item.edgeNow) * EASE;
        item.glowNow += (item.glowWant - item.glowNow) * EASE;
        if (Math.abs(item.want - item.now) > SETTLED) { moving = true; }
        else { item.now = item.want; }
        if (Math.abs(item.edgeWant - item.edgeNow) > SETTLED) { moving = true; }
        else { item.edgeNow = item.edgeWant; }
        if (Math.abs(item.glowWant - item.glowNow) > SETTLED) { moving = true; }
        else { item.glowNow = item.glowWant; }

        item.mat.opacity = item.now;
        // 눌린 설비는 파랗게 물들고, 옅어질수록 납작한 유령색으로 간다.
        // 유령색을 나중에 섞는다 — 사라지는 중인 것이 파랗게 빛나면 안 된다.
        tone.copy(item.base).lerp(PICKED, item.glowNow);
        item.mat.color.copy(tone).lerp(GHOSTC, 1 - item.now);
        item.mat.depthWrite = item.now > 0.95;
        item.edgeMat.opacity = item.edgeNow;
        // 비쳐 보이게 낮춘 덩이가 그림자만 멀쩡히 남으면 유령이 선 것처럼 보인다.
        item.mesh.castShadow = item.now > 0.5;
      });
      frame();
      if (moving) { window.requestAnimationFrame(step); }
      else { ticking = false; }
    })();
  }

  function start(three, utils, gltf) {
    THREE = three;
    merge = utils.mergeGeometries;
    tone = new THREE.Color();
    PICKED = new THREE.Color(PICK_FACE);
    GHOSTC = new THREE.Color(GHOST);
    scene = new THREE.Scene();

    /*
     * 조명 — 아이소메트릭 도면처럼 윗면과 옆면이 또렷하게 갈리게 한다.
     *
     * 반구광(위 밝고 아래 어두운) 하나가 그 일을 거의 다 한다. 윗면은 하늘색을 받고
     * 옆면은 중간, 밑면은 바탕으로 떨어진다. 방향광은 옆면 둘을 서로 다르게 만드는
     * 몫만 맡는다 — 세게 주면 반짝이는 재질처럼 보여서 도면 맛이 사라진다.
     * 앰비언트는 돌려세운 뒷면이 새까맣게 죽지 않을 만큼만 깐다.
     */
    scene.add(new THREE.AmbientLight(0xffffff, 0.25));
    scene.add(new THREE.HemisphereLight(0xe4edfb, 0x05070c, 1.25));
    var key = new THREE.DirectionalLight(0xffffff, 1);
    scene.add(key);
    scene.add(key.target);

    var model = build(gltf.scene);
    scene.add(model);

    var box = new THREE.Box3().setFromObject(model);
    var size = box.getSize(new THREE.Vector3());
    span = size.length() / 2;

    home = box.getCenter(new THREE.Vector3());
    target = home.clone();
    /*
     * 바닥 판의 윗면을 찾는다. 모델의 가장 낮은 곳이 아니다.
     *
     * 이 건물은 계단이 아래층으로 내려가서, box.min.y 는 바닥보다 세 뼘 아래다.
     * 거기에 길을 깔면 바닥 판 밑으로 들어가 한 점도 안 보인다.
     * 고른 설비 표시도 같은 이유로 엉뚱한 자리에 뜬 선처럼 보였다 —
     * 아이소메트릭에서 아래로 밀린 것은 옆으로 밀린 것과 구별되지 않는다.
     */
    floorY = box.min.y;
    var deck = -Infinity;
    meshes.forEach(function (item) {
      if (item.key === "floor") { deck = Math.max(deck, item.mesh.geometry.boundingBox.max.y); }
    });
    if (deck > -Infinity) { floorY = deck; }

    /*
     * 외곽선 펜을 미리 만들어 둔다.
     * 고른 것은 굵고 옅은 선을 한 겹 깔고 그 위에 또렷한 선을 얹는다 — 약한 번짐이 된다.
     * 손만 얹힌 것은 얇고 옅은 선 한 줄이다. 둘의 차이가 곧 hover 와 selected 의 차이다.
     */
    pickPens = [outlinePen(6, PICK_LINE, 0.14), outlinePen(2, PICK_LINE, 0.85)];
    hoverPens = [outlinePen(1.6, HOVER_LINE, 0.6)];

    // 로봇마다 제 고리를 깐다. 바닥 격자는 첫 로봇이 만들고 나머지가 나눠 쓴다.
    // 깔아만 두고 보이지는 않는다 — 지금 고른 로봇의 것 하나만 켠다.
    ROBOTS.forEach(function (bot, id) {
      // 길은 도킹 스테이션에서 시작한다.
      drawRoute(layRoute(box, [bot.dock].concat(bot.stops)), bot, id);
    });
    showLane(activeRobot());
    layWaypoints();

    /*
     * 키 라이트를 모델 크기에 맞춰 세운다. 그림자 카메라가 여기서 나온다.
     *
     * 방위는 처음 카메라에서 90도 옆이다. 카메라와 같은 쪽에 두면 그림자가 전부
     * 덩이 뒤로 숨어 한 점도 안 보인다 — 처음에 그렇게 뒀다가 그림자가 안 나온다고
     * 한참을 들여다봤다. 옆에서 비추면 그림자가 화면 왼쪽으로 눕는다.
     */
    key.position.copy(home).add(new THREE.Vector3(0.62, 0.8, -0.62).normalize().multiplyScalar(span * 2));
    key.target.position.copy(home);

    scene.add(floorGrid(box));

    WORLD_UP = new THREE.Vector3(0, 1, 0);
    dirV = new THREE.Vector3();
    right = new THREE.Vector3();
    upOnGround = new THREE.Vector3();
    orient();   // yaw · pitch 가 아직 처음 각도다 — 여기서 잰 것이 fit 의 기준이 된다.

    fitH = across(right, size);
    fitV = across(upOnGround, size);
    fitBase();

    camera = new THREE.PerspectiveCamera(10, 1, 1, span * 40);

    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearAlpha(0);

    /*
     * 그림자 — 덩이가 바닥에서 떠 있는 것으로 읽히게 하는 것이 전부다.
     * 어두운 바닥에 지는 그림자라 세게 넣을 수 없다. 흐릿하게 한 겹만 깐다.
     * 그림자 카메라는 직교라 모델을 감싸게 크기를 직접 잡아 준다.
     */
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.radius = 3;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.15;
    var cam = key.shadow.camera;
    cam.left = -span; cam.right = span;
    cam.top = span; cam.bottom = -span;
    cam.near = span * 0.2; cam.far = span * 4;
    cam.updateProjectionMatrix();

    plan();
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
    import("three/addons/loaders/GLTFLoader.js"),
    import("three/addons/utils/BufferGeometryUtils.js"),
    // 굵은 선 셋 — 길에 굵기를 주려면 이것이 있어야 한다. strand() 를 보라.
    import("three/addons/lines/Line2.js"),
    import("three/addons/lines/LineMaterial.js"),
    import("three/addons/lines/LineGeometry.js"),
    import("three/addons/lines/LineSegments2.js"),
    import("three/addons/lines/LineSegmentsGeometry.js")
  ]).then(function (mods) {
    Fat = {
      Line2: mods[3].Line2,
      LineMaterial: mods[4].LineMaterial,
      LineGeometry: mods[5].LineGeometry,
      LineSegments2: mods[6].LineSegments2,
      LineSegmentsGeometry: mods[7].LineSegmentsGeometry
    };
    var loader = new mods[1].GLTFLoader();
    loader.parse(decode(window.APRISM_MAP_GLB), "", function (gltf) {
      start(mods[0], mods[2], gltf);
    });
  }).catch(function () { /* 지도 없이 화면은 그대로 쓴다 */ });
})();
