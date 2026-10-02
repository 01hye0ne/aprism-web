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
   * 면은 모두 채운다(불투명). 예전에는 벽 45% · 설비 60% 로 비쳐 보이게 깔았는데 구조물끼리
   * 구분이 안 되고 X-ray 처럼 읽혔고, 벽 뒤 설비는 탑뷰에서만 보였다. 앞을 가린 것만 골라
   * 비치게 하는 일은 아래 OPT(Focus Point 가림 판정)가 맡는다.
   *
   *   face  덩이 면
   *   line  외곽선이 기본으로 갖는 진하기
   *   lift  면을 제 색으로 스스로 밝히는 정도(emissive). 반구광이 옆면을 바닥만큼 눌러서
   *         (옆면 밝기 32 · 바닥 29) 채운 벽이 외곽선만 남은 유리판처럼 읽혔다. 바닥 < 벽 < 설비 사다리를 세운다.
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
    floor:     { face: 0x18202e, line: 0.25, peak: 0.25, lift: 0 },
    wall:      { face: 0x3a475f, line: 0.7, peak: 0.9, lift: 0.55 },
    equipment: { face: 0x41506a, line: 0.7, peak: 1, lift: 0.4 },   // 면 색은 AS-IS 그대로
    stairs:    { face: 0x34405a, line: 0.32, peak: 0.5, lift: 0.45 },
    other:     { face: 0x36435a, line: 0.7, peak: 0.95, lift: 0.4 }
  };

  /*
   * 지도 설정.
   *
   *   Focus Point 가림 판정 — 대상(Focus Point · 로봇)과 카메라 사이에 낀 구조물만 비친다.
   *   radius     판정 영역 반지름(px). 24~40.
   *   enter      구조물이 판정 영역을 이 비율 이상 가리면 투명해진다(20%).
   *   leave      투명해진 것은 이 밑으로 내려가야 돌아온다 — 문턱에서 깜빡이지 않게 한다.
   *   fadeTo     대상을 직접 가린 구조물(카메라 -> 대상 중심선에 걸린 것)의 면 불투명도.
   *   fadeSoft   판정 영역만 일부 가린 구조물의 면 불투명도. 설비는 가려도 이 밑으로 안 내린다.
   *              둘 다 모서리 선은 거의 그대로 둬서 "벽이 사라졌다"가 아니라 "벽 너머가 비친다"로 읽히게 한다
   *              (14% 로 두었더니 벽이 통째로 없어진 것처럼 보였다).
   *   samples    판정 영역에 뿌리는 광선 수. 비율의 해상도다.
   *   topPitch   이 각도보다 위에서 내려다보면 영역 판정을 쉰다 — 탑뷰에선 벽이 아무것도 가리지 않는다.
   *   robotTarget 로봇도 늘 대상이다 — 누르지 않아도 로봇을 가린 구조물은 투명해진다.
   *
   *   routeGhost 벽 뒤로 들어간 경로를 옅게 비쳐 보인다(벽을 채우면 경로가 끊겨 보인다).
   *   stairTags  두 층을 잇는 계단 입구에 "↓ B4" · "↑ B3" 칩을 단다.
   *   arriveOverview 직접 층을 옮기면(층 버튼 · 계단) 도착한 층을 줌아웃해 한눈에 담는다. 트래킹 이동은 제외.
   */
  var OPT = {
    radius: 32,
    enter: 0.2,
    leave: 0.12,
    fadeTo: 0.35,
    fadeSoft: 0.55,
    samples: 48,
    topPitch: 75,
    robotTarget: true,
    routeGhost: true,
    stairTags: true,
    arriveOverview: true
  };

  var EDGE = 0x7b8fb4;    // 외곽선 — 어디서나 같은 색이다
  var GHOST = 0x6a7890;   // 투명해질 때 다가가는 색
  var GRID = 0x1f2a3c;    // 바닥에 깔리는 격자

  // 눌린 설비 — 디자인 시스템의 main 램프에서 가져온다.
  /*
   * 설비 고르기 색은 밝은 회색 계열이다. 파랑(main)은 경로 · 웨이포인트 · 로봇에만 쓴다 —
   * 고른 설비가 파랗게 물들면 웨이포인트와 같은 색으로 읽혀 무엇이 길이고 무엇이 설비인지 헷갈렸다.
   */
  var PICK_FACE = 0xafb7c8;   // gray/400. 눌린 설비가 물드는 면 색
  var PICK_LINE = 0xe0e3e9;   // gray/200. 고른 설비 외곽선 — 순백(gray/0)은 눈이 아프다.
  var HOVER_LINE = 0xd1d5de;  // gray/300. 손이 얹힌 설비 외곽선

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

  // 앞을 가린 것만 비쳐 보이는 규칙은 plan() 에 있다(Focus Point · 로봇 가림 판정).
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
  var Bvh = null;         // three-mesh-bvh — 없으면 null

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

  /*
   * 층 — 2차 모델부터 지하 4층 · 지하 3층 두 판이 한 파일에 들어 있다.
   *
   * 한 번에 한 층만 보인다. 층 사이를 오갈 때만 잠깐 둘이 겹친다 —
   * 떠나는 층이 옅어지는 동안 갈 층이 떠오르고, 그 사이에 카메라가 높이를 옮긴다.
   * 그래야 "다른 그림으로 갈아 끼웠다" 가 아니라 "건물 안에서 층을 옮겼다" 로 읽힌다.
   *
   *   floors     아래층부터 차례로 — { id, label, box, deck, stairs }
   *   floorNow   지금 보는 층
   *   floorFade  층마다 0~1. 덩이의 불투명도에 곱해진다(1 이면 제 색, 0 이면 아예 안 그린다).
   *   ROBOT_ON   로봇 · 길 · 웨이포인트가 있는 층. 다른 층을 보는 동안에는 걷어 둔다.
   */
  var gridMesh = null;   // 바닥 격자 — 층을 옮기면 같이 올라간다
  var floors = [];
  var floorNow = "";
  var floorFade = {};
  var floorBusy = false;
  var floorNext = "";     // 옮기는 중에 또 누른 층
  var ROBOT_ON = "B4";
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
    renderer.setSize(w, h, false);
    aim();
    // 굵은 선은 제 굵기를 재려면 화면 크기를 알아야 한다.
    fatMats.forEach(function (mat) { mat.resolution.set(w, h); });

    // 실루엣은 보는 쪽이 달라지면 같이 달라진다. 카메라를 옮길 때마다 다시 센다.
    if (picked) { drawOutline(pickPens, picked); }
    if (hovered && hovered !== picked) { drawOutline(hoverPens, hovered); }

    syncStairTags();   // 계단 입구 표
    syncDock();        // 도커 — 시작 · 복귀 한 아이콘
    travelSync();   // 층 이동 — 층마다 선을 켜고 끄고 표식을 놓는다
    renderer.render(scene, camera);
    placeCard();
    placeBot();
    placeWp();
  }

  /*
   * 카메라만 지금 각도 · 배율 · 자리로 맞춘다(그리지는 않는다).
   * frame() 에서 떼어 냈다 — plan() 은 frame() 보다 먼저 불리는 일이 많아서
   * 광선 판정이 한 프레임 전 카메라로 돌았다. 판정 전에 이것부터 부른다.
   */
  function aim() {
    var w = view.clientWidth, h = view.clientHeight;
    if (!camera || !w || !h) { return; }
    orient();
    fitBase();

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
    camera.updateMatrixWorld();
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
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
    // 한동안 쉬었다 다시 굴리면 새 확대다 — 그 자리를 Focus Point 로 찍는다.
    // 한 번 굴리는 동안에는 다시 찍지 않는다. 커서가 조금 흔들려도 기준이 따라 흔들리지 않는다.
    var now = Date.now();
    if (now - wheelAt > WHEEL_GAP && d < 0) { setFocusAt(p.x, p.y); }
    wheelAt = now;
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
    // 도구 레일과 설비 카드 · 알림 쪽지 위에서 시작한 것은 그쪽 몫이다. 지도를 끌면 안 된다.
    // (여기서 붙잡으면 setPointerCapture 때문에 클릭이 지도로 넘어가 쪽지 안 버튼이 눌리지 않는다.)
    if (event.target.closest(".map-tools, .map-card, .map-bot, .map-wp, .map-alert")) { return; }
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
      setFocusAt(mid.x, mid.y);   // 핀치 확대를 시작한 자리
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
      setFocusAt(p.x, p.y);       // 누른 자리가 Focus Point 다
      // 웨이포인트가 먼저다. 설비 위에 겹쳐 있어도 작은 표식을 노린 손이 이긴다.
      var mark = wpAt(p.x, p.y);
      var item = mark ? null : pickAt(p.x, p.y);
      var hop = null;
      if (mark) { chooseWaypoint(mark.id === chosenWp ? null : mark.id, "map"); }
      // 설비가 먼저다. 설비가 아닌 자리에서 계단을 눌렀으면 그 계단으로 층을 옮긴다.
      // 계단이 잇는 층으로 간다. 모델 밖으로 오르는 계단(B2 행)은 눌러도 가지 않는다.
      else if (!item && (hop = stairTo(p.x, p.y))) { goFloor(hop.floor, "stairs", hop.at); }
      else { choose(item); }
    }
    if (!down.length) { from = null; stirred = false; }

    // 두 손가락에서 하나가 떨어지면 남은 손가락으로 다시 돌아본다.
    mode = down.length === 1 ? "turn" : "";
    paint();
  }

  // 설비 위에서는 손 모양이 바뀐다 — 누를 수 있다는 것을 알려 주는 유일한 표시다.
  hit.addEventListener("pointermove", function (event) {
    if (down.length || !renderer) { return; }
    if (event.target.closest(".map-tools, .map-card, .map-bot, .map-wp, .map-alert")) {
      hit.classList.remove("is-picking");
      return;
    }
    var p = local(event);
    var mark = wpAt(p.x, p.y);
    var on = mark ? null : pickAt(p.x, p.y);
    // 계단도 누를 수 있다 — 손 모양으로만 알린다(계단은 고르는 것이 아니라 지나가는 곳이다).
    hit.classList.toggle("is-picking", !!(mark || on || (!on && stairTo(p.x, p.y))));

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
    if (event.key === "Escape" && focus) { clearFocus(); plan(); }
  });

  hit.addEventListener("pointerup", lift);
  hit.addEventListener("pointercancel", lift);

  // 오른쪽 버튼으로도 밀 수 있게 했으니 그 자리에서 메뉴가 뜨면 안 된다.
  hit.addEventListener("contextmenu", function (event) {
    if (event.target.closest(".map-tools")) { return; }
    event.preventDefault();
  });

  // 축소 — 확대 버튼과 같은 걸음(BUTTON_STEP)으로 칸 한가운데를 기준으로 물러난다.
  // 멀어지는 것이라 Focus Point 는 새로 찍지 않는다.
  var zoomOut = document.querySelector("[data-map-zoom-out]");
  if (zoomOut) {
    zoomOut.addEventListener("click", function () {
      var f = focusPoint();
      zoomAt(zoom / BUTTON_STEP, f.x, f.y);
    });
  }

  var zoomIn = document.querySelector("[data-map-zoom-in]");
  if (zoomIn) {
    zoomIn.addEventListener("click", function () {
      var f = focusPoint();
      // 이미 찍힌 기준이 있으면 그대로 둔다. 없을 때만 칸 한가운데를 한 번 찍는다.
      if (!focus) { setFocusAt(f.x, f.y); }
      zoomAt(zoom * BUTTON_STEP, f.x, f.y);
    });
  }

  /*
   * 자리 옮기기 — 각도와 배율을 부드럽게 몰고 간다.
   * 툭 바뀌면 어디를 보고 있었는지 놓친다. 짧게(320ms) 끌고 가면 따라온다.
   */
  var trip = null;
  // dest 를 주면 보는 지점을 그 자리로 몰고 간다. 안 주면 지금 자리에 둔다.
  function glide(nextYaw, nextPitch, nextZoom, dest, duration) {
    if (!renderer) { return; }
    var glideMs = duration || 320;
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
      var at = Math.min(1, (now - began) / glideMs);
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
    }, glideMs + 40);
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
      clearFocus();               // 전체 보기는 기준을 푼다
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

  /*
   * 레이어 이름에서 색 이름을 뽑는다. "01_wall" -> "wall".
   * 층을 복제해 만든 판은 이름 뒤에 " - 복사" 가 붙어 온다("00_floor - 복사").
   * 뒤에 붙은 말은 떼고 첫 낱말만 본다 — 안 그러면 위층이 통째로 "other" 색이 된다.
   */
  function layerKey(name) {
    var slug = String(name || "").toLowerCase()
      .replace(/^[0-9]+[_\-\s]*/, "")
      .split(/[\s\-–_]/)[0];
    return PALETTE[slug] ? slug : "other";
  }

  /*
   * 층 이름에서 층 아이디를 뽑는다. "지하 4층" -> "B4".
   * 층으로 안 읽히면 빈 문자열이다 — 층이 하나뿐이던 옛 모델이 그렇다.
   */
  function floorId(name) {
    // GLTFLoader 가 이름의 빈칸을 밑줄로 바꾼다 — "지하 4층" 이 "지하_4층" 으로 온다.
    var m = String(name || "").match(/지하[\s_]*([0-9]+)[\s_]*층/);
    return m ? "B" + m[1] : "";
  }

  function floorLabel(id) {
    return id ? "지하 " + id.slice(1) + "층" : "";
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

  // 지오메트리 하나에 면 재질과 모서리 선을 입혀 돌려준다. fid 는 이 덩이가 선 층이다.
  function outfit(geo, key, fid) {
    var skin = PALETTE[key];
    var alpha = 1;
    var mat = new THREE.MeshStandardMaterial({
      color: skin.face,
      roughness: 0.85,
      metalness: 0.05,
      transparent: true,
      opacity: alpha,
      depthWrite: alpha >= 1,
      // 면을 채우면 모서리 선이 면과 같은 깊이에서 다툰다. 면을 살짝 뒤로 민다.
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
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
    // 위층 바닥의 계단실 구멍만 셰이더로 뚫는다. 층 전환 효과에는 사용하지 않는다.
    if (fid) {
      mat.onBeforeCompile = stairHoleFor(fid, key === "floor");
      edgeMat.onBeforeCompile = stairHoleFor(fid, key === "floor");
      mat.customProgramCacheKey = edgeMat.customProgramCacheKey = function () { return key === "floor" ? "stair-hole-slab" : "stair-hole"; };
    }

    geo.computeBoundingBox();
    meshes.push({
      mesh: mesh,
      mat: mat,
      edgeMat: edgeMat,
      key: key,
      floor: fid || "",
      // 모델에 이름이 없어서 실린 차례대로 번호를 매긴다.
      // 라이노에서 물건마다 이름을 주시면 그 이름이 그대로 카드에 뜬다.
      title: key === "equipment" ? "설비 " + ("0" + (tally += 1)).slice(-2) : "",
      base: new THREE.Color(skin.face),
      center: geo.boundingBox.getCenter(new THREE.Vector3()),
      line: skin.line,
      peak: skin.peak,
      alpha: alpha,
      now: alpha, want: alpha,
      faded: false,     // Focus Point 판정으로 투명해져 있나(히스테리시스)
      cover: 0,         // 판정 영역을 가린 비율 0~1
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

    function layLayer(layer, fid) {
      var key = layerKey(layer.name);
      // 레이어 묶음이면 그 안의 덩이 하나가 물건 하나다. 묶이지 않았으면 그 자체가 하나다.
      var items = layer.children.length ? layer.children.slice() : [layer];
      items.forEach(function (item) {
        flatten(item, place).forEach(function (geo) {
          model.add(outfit(geo, key, fid));
        });
      });
    }

    /*
     * 2차 모델부터 맨 위가 층("지하 4층" · "지하 3층")이고 그 안이 레이어다.
     * 층으로 안 읽히는 것은 옛 모델처럼 그 자체를 레이어로 친다 — 층 없는 판이 된다.
     */
    root.children.slice().forEach(function (top) {
      var fid = floorId(top.name);
      if (fid && top.children.length) {
        top.children.slice().forEach(function (layer) { layLayer(layer, fid); });
      } else {
        layLayer(top, "");
      }
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
      // 안 보이는 층의 설비는 집히지 않는다 — 광선은 보이지 않는 덩이도 그대로 맞힌다.
      if (item.floor && item.floor !== floorNow) { return; }
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
  function floorGrid(box, atY) {
    var size = box.getSize(new THREE.Vector3());
    var wide = Math.max(size.x, size.z);
    var reach = wide * 2.1;
    // 눈금 한 칸을 건물 너비의 열둘로. 촘촘하면 무늬가 되고 성기면 자가 안 된다.
    var cells = Math.max(6, Math.round(reach / (wide / 12)));

    var grid = new THREE.GridHelper(reach, cells, GRID, GRID);
    var base = (atY === undefined ? box.min.y : atY);
    grid.position.set(box.min.x + size.x / 2, base - wide * 0.004, box.min.z + size.z / 2);
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
      // 로봇이 선 층만 본다. 위층 벽까지 눌러 찍으면 통로가 통째로 막혀 길이 안 나온다.
      if (item.floor && item.floor !== ROBOT_ON) { return; }
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

    // 로봇이 쏘는 빛은 그 로봇의 가장 밝은 색이다 — 길이 흰빛이면 빛도 흰빛이다.
    var fan = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: bot.dot, map: fanTexture(), transparent: true,
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
        transparent: true, opacity: 0.95, depthWrite: false,
        depthTest: false   // 벽을 채워도 표식은 가려지지 않는다
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
        transparent: true, opacity: 0.95, depthWrite: false,
        depthTest: false   // 벽을 채워도 표식은 가려지지 않는다
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
        // 알림이 걸린 칸(monitor.js 가 data-wp-alert 로 적는다)은 진행 상태와 상관없이 그 단계 색이다.
        tone: item.getAttribute("data-wp-alert") ||
          (kind === "completed" ? (item.getAttribute("data-wp-result") || "safe") : kind),
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
      // 웨이포인트 좌표가 있으면 그 중심에 놓는다(길이 그 중심을 지난다). 없으면 예전처럼 길을 등분.
      var spot = onLane.wps && onLane.wps[i] ? onLane.wps[i].clone()
        : alongRoute(onLane.turns, onLane.mile, onLane.total * (i / list.length));
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
  var ghosts = [];   // 벽 뒤 경로의 옅은 선

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

    /*
     * 벽 뒤로 들어간 토막 — 같은 선을 깊이 검사 없이 옅게 한 벌 더 깐다.
     * 채운 벽 앞에서는 본 선이, 벽 뒤에서는 이 옅은 선만 보인다. 길이 끊겨 읽히지 않게 한다.
     * 선의 자식이라 길을 켜고 끌 때 같이 따라간다.
     */
    var ghostMat = mat.clone();
    ghostMat.depthTest = false;
    ghostMat.opacity = mat.opacity * 0.3;
    ghostMat.resolution.copy(mat.resolution);
    fatMats.push(ghostMat);
    var ghost = new Fat.Line2(geo, ghostMat);
    ghost.computeLineDistances();
    ghost.renderOrder = 1;
    ghost.visible = OPT.routeGhost;
    ghosts.push(ghost);
    line.add(ghost);
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

  function showLane(index, keep) {
    var key = String(index);
    onLane = null;
    Object.keys(lanes).forEach(function (id) {
      var on = id === key;
      lanes[id].parts.forEach(function (part) { part.visible = on; });
      if (on) { onLane = lanes[id]; }
    });

    // 길이 바뀌면 웨이포인트도 그 길 위로 옮겨 놓는다. 고른 것은 놓는다 —
    // 다른 미션의 같은 순번은 같은 자리가 아니다.
    // 처음 깔 때(keep)는 놓지 않는다 — 지도가 뜨기 전에 알림 목록 · 타임라인에서 이미 골랐을 수 있다.
    if (!keep) { chosenWp = null; }
    layWaypoints();
    tellWaypoint();

    tellHeading();

    if (botBox) {
      botBox.hidden = !onLane;
      if (botTip) { botTip.hidden = true; }
      botBox.classList.remove("is-picked");
      if (onLane) {
        botBox.style.setProperty("--bot-tint", "#" + ("00000" + (onLane.bot.mark || onLane.bot.done).toString(16)).slice(-6));
        if (botName) { botName.textContent = onLane.bot.name; }
        if (botTitle) { botTitle.textContent = onLane.bot.name; }
      }
    }
    frame();
  }

  /*
   * 로봇이 보는 쪽을 우측 패널에 알린다 — 거기 3D 로봇이 같은 쪽을 본다
   * (assets/js/robot-stage.js). 월드 각이다. 패널의 카메라는 지도의 처음 방위와
   * 같은 45도로 붙박여 있어서, 지도를 돌리지 않은 상태에서 둘이 같은 쪽을 가리킨다.
   */
  var toldHeading = null;

  function tellHeading() {
    var h = null;
    if (onLane) { h = Math.atan2(onLane.ahead.x - onLane.here.x, onLane.ahead.z - onLane.here.z); }
    if (h === toldHeading) { return; }
    toldHeading = h;
    document.dispatchEvent(new CustomEvent("aprism:robot-heading", {
      detail: { id: onLane ? onLane.id : null, heading: h }
    }));
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
        window.APRISM_TEXT.fill(dd, fact[1]);
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

  /*
   * 알림 쪽지(04.1 ver.2 · Figma Messages) — 왼쪽 알림 목록에서 알림을 고르면 monitor.js 가
   * 내용을 채워 열고 data-wp 에 웨이포인트 이름을 적는다. 여기서는 자리만 잡는다.
   * 그 웨이포인트가 골라져 있는 동안에는 작은 쪽지 대신 이것이 선다.
   * 다른 웨이포인트로 옮겨 가거나 고른 것을 놓으면 닫고 aprism:map-alert 로 알린다.
   */
  var alertBox = document.querySelector("[data-map-alert]");

  function alertOn() {
    return !!(alertBox && !alertBox.hidden && chosenWp && alertBox.getAttribute("data-wp") === chosenWp);
  }

  var WP_WORD = {
    safe: "정상", caution: "주의", danger: "위험",
    current: "측정 중", upcoming: "예정"
  };

  function tellWaypoint() {
    if (alertBox && !alertBox.hidden && alertBox.getAttribute("data-wp") !== chosenWp) {
      alertBox.hidden = true;
      document.dispatchEvent(new CustomEvent("aprism:map-alert", { detail: { open: false } }));
    }
    if (!wpBox) { return; }
    var found = wpSpots.filter(function (w) { return w.id === chosenWp; })[0];
    if (!found) { wpBox.hidden = true; return; }
    if (alertOn()) { wpBox.hidden = true; placeWp(); return; }
    var info = found.info;
    wpBox.setAttribute("data-result", info.tone);
    if (wpChip) { wpChip.textContent = WP_WORD[info.tone] || "예정"; }
    if (wpName) { window.APRISM_TEXT.fill(wpName, [info.id, info.name || "waypoint"]); }
    if (wpRead) {
      window.APRISM_TEXT.fill(wpRead, info.read ||
        (info.kind === "upcoming" ? "아직 가지 않은 자리입니다." : "측정 항목 확인 중"));
    }
    wpBox.hidden = false;
    placeWp();
  }

  // 쪽지 자리 — 고른 웨이포인트를 화면 좌표로 옮긴다. 설비 카드와 같은 셈이다.
  function placeWp() {
    if (!camera) { return; }
    var showAlert = alertOn();
    if (!showAlert && (!wpBox || wpBox.hidden)) { return; }
    var found = wpSpots.filter(function (w) { return w.id === chosenWp; })[0];
    if (!found) { return; }

    var p = found.spot.clone().project(camera);
    var v = view.getBoundingClientRect();
    var c = hit.getBoundingClientRect();
    var x = (p.x * 0.5 + 0.5) * v.width + v.left - c.left;
    var y = (-p.y * 0.5 + 0.5) * v.height + v.top - c.top;

    if (showAlert) { placeAlert(x, y, c.width, c.height); return; }

    var half = wpBox.offsetWidth / 2 || 88;
    var tall = wpBox.offsetHeight + 12 || 96;
    x = Math.min(c.width - half - 8, Math.max(half + 8, x));
    y = Math.min(c.height - 8, Math.max(tall + 8, y));
    wpBox.style.setProperty("--x", x.toFixed(1) + "px");
    wpBox.style.setProperty("--y", y.toFixed(1) + "px");
  }

  /*
   * 알림 쪽지 자리. 꼬리 끝이 웨이포인트 8 위에 오도록 쪽지를 그 위에 세운다.
   * 칸 밖으로 나가면 가로는 쪽지만 밀고 꼬리는 점을 계속 가리키게 둔다(--tail).
   * 위에 설 자리가 없으면 아래로 뒤집는다.
   */
  function placeAlert(x, y, W, H) {
    var half = alertBox.offsetWidth / 2;
    var tall = alertBox.offsetHeight + 16;
    var below = y - tall < 8 && y + tall <= H - 8;
    alertBox.classList.toggle("is-below", below);
    var cx = Math.min(W - half - 8, Math.max(half + 8, x));
    var tail = Math.max(-(half - 16), Math.min(half - 16, x - cx));
    var cy = below ? Math.min(y, H - tall - 8) : Math.max(tall + 8, y);
    alertBox.style.setProperty("--x", cx.toFixed(1) + "px");
    alertBox.style.setProperty("--y", cy.toFixed(1) + "px");
    alertBox.style.setProperty("--tail", tail.toFixed(1) + "px");
  }

  /*
   * 카메라가 갈 곳. 알림 쪽지가 열려 있으면 웨이포인트를 칸 한가운데가 아니라 쪽지 높이의
   * 절반만큼 아래에 세운다 — 한가운데에 두면 쪽지(516)가 위로 설 자리가 없다.
   * frame() 의 셈과 같다: 화면 1px 은 (baseSize / zoom) / 높이 만큼의 월드 길이다.
   */
  function aimAt(spot, z) {
    if (!alertOn() || !upOnGround) { return spot; }
    var lift = (alertBox.offsetHeight + 16) / 2;
    var s = (baseSize / z) / (view.clientHeight || 1);
    return spot.clone().addScaledVector(upOnGround, lift * s);
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
      if (found && renderer) {
        var z = Math.max(zoom, 2.4);
        setFocusWorld(found.spot);     // 고른 웨이포인트가 기준이다
        glide(yaw, pitch, z, aimAt(found.spot, z));
      }
    }
    if (from !== "panel") {
      document.dispatchEvent(new CustomEvent("aprism:waypoint", {
        detail: { id: chosenWp, from: "map" }
      }));
    }
    frame();
  }

  // 우측 목록이 다시 그려졌다 — 표식을 새 상태로 다시 깐다.
  // 알림이 바뀌어 웨이포인트 색이 달라졌다 — 고른 것은 그대로 두고 점만 다시 깐다.
  document.addEventListener("aprism:wp-marks", function () {
    if (!scene) { return; }
    layWaypoints();
    if (wpBox && !wpBox.hidden) { tellWaypoint(); }
    frame();
  });

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
   * 길 색은 로봇의 상태에서 나온다 — 상태는 우측 로봇 카드가 들고 있는 것이 원본이다.
   *
   * 대기 중인 로봇은 회색이다. 전에는 노랑이었는데 이 화면에서 노랑은 주의 알림 색이라
   * 가만히 선 로봇이 경고처럼 읽혔다(디자이너 요청).
   *   수행중  main      움직이는 중이다
   *   완료    safe      한 바퀴 다 돌았다
   *   대기 · 끊김  gray  아직 · 더는 아무 일도 하지 않는다
   */
  var BOT_TINT = {
    /*
     * 수행 중인 로봇 — 길의 앞뒤를 색으로 가른다(디자이너 요청).
     *
     *   done  지나온 길   회색. 이미 한 일이라 뒤로 물러난다.
     *   left  앞으로 갈 길 파랑. 관제에서 쓰는 쪽은 이쪽이다 — 어디로 가는지가 판단에 든다.
     *   dot   시야 빛      흰빛
     *   mark  로봇 · 도커 표식  흰빛 — "지금 여기" 는 화면에서 가장 밝다.
     *
     * 흰빛을 길에서 표식으로 옮긴 것이다. 세 층위가 갈린다 —
     * 로봇(흰빛) · 앞으로 갈 길(파랑) · 지나온 길(회색).
     * 대기 로봇도 회색이라 지나온 길과 톤이 겹치는데, 수행 중인 로봇은 흰 표식과
     * 파란 앞길이 함께 서 있어 멀리서도 갈린다.
     */
    "수행중": { done: 0x9ea8bb, left: 0x89b9ed, dot: 0xffffff, mark: 0xf7f8fa },
    "완료":   { done: 0x34c759, left: 0x1da67f, dot: 0x72f494 },
    "대기":   { done: 0x8894aa, left: 0x5d6675, dot: 0xaeb8c8 },
    "끊김":   { done: 0x667085, left: 0x4e576a, dot: 0x8894aa }
  };

  function botState(id) {
    var badge = document.querySelector(".robot-strip .robot-card[data-robot='" + id + "'] .badge");
    return badge ? badge.textContent.trim() : "";
  }

  // 길을 깔기 전에 그 로봇의 상태색을 입힌다. 상태를 못 읽으면 들고 있던 색 그대로다.
  function tintRobot(bot, id) {
    var tint = BOT_TINT[botState(id)];
    if (!tint) { return bot; }
    bot.done = tint.done;
    bot.left = tint.left;
    bot.dot = tint.dot;
    // 표식 색을 따로 들지 않는 상태는 지나온 길 색을 그대로 쓴다.
    bot.mark = tint.mark || tint.done;
    return bot;
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
    if (onLane && renderer) { setFocusWorld(onLane.here); glide(yaw, pitch, Math.max(zoom, 2.2), onLane.here); }
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

  function drawRoute(corners, bot, id, plan) {
    if (!corners || corners.length < 2) { return; }
    var parts = [];
    // 계획한 길은 45° · 90° 로 꺾인 그대로 그린다 — 둥글리면 웨이포인트 중심을 비켜 간다.
    var soft = plan ? { line: corners.map(function (q) { return q.clone(); }) } : roundOff(corners);
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
    // 폐회로는 왕복이 아니다 — at 이 한 바퀴(도커 0 -> 도커 1)다.
    var back = !plan && bot.at > 0.5;
    var trip = plan ? bot.at : (back ? (1 - bot.at) * 2 : bot.at * 2);
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
    // 폐회로의 도커는 화면 아이콘 하나(syncDock)가 시작 · 복귀를 함께 보인다.
    if (!plan) { parts.push(dockMark(turns[0], bot.mark || bot.done)); }

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
      here: here.clone(), ahead: ahead.clone(),
      plan: plan || null, wps: plan ? plan.wpWorld : null, dock: turns[0].clone()
    };
  }

  /* ---------- Focus Point ----------
   *
   * 투명 판정의 기준을 화면 한가운데가 아니라 "사용자가 보려고 한 자리"로 옮긴다.
   *
   *   찍히는 때   지도를 누른 자리 · 휠(핀치) 확대를 시작한 자리 · 우측에서 고른 웨이포인트 · 로봇
   *   붙는 곳     월드 좌표. 벽은 건너뛰고 그 뒤의 바닥 · 설비에 붙는다 — 벽을 누른 손은
   *               벽이 아니라 벽 너머를 보려는 것이다.
   *   풀리는 때   [전체 보기] · 층 이동 · Esc
   *
   * 화면 가운데를 계속 기준으로 삼으면 판을 밀 때마다 기준이 벽 경계를 넘나들어 구조물이
   * 깜빡인다. 월드에 붙여 두면 판을 밀거나 돌려도 기준은 같은 물건 위에 남는다.
   */
  var focus = null;        // { world: Vector3, item: meshes 항목 | null }
  var wheelAt = 0;         // 마지막 휠 시각 — 이만큼 쉬었다 다시 굴리면 새 확대로 친다
  var WHEEL_GAP = 450;
  var diskCache = null;

  function currentDeck() {
    var f = floorOf(floorNow);
    return f ? f.deck : floorY;
  }

  // 창 좌표 (px, py) 밑의 바닥 · 설비 한 점. 벽 · 계단은 뚫고 지나간다.
  function groundAt(px, py) {
    if (!renderer || !camera) { return null; }
    if (!raycaster) { raycaster = new THREE.Raycaster(); }
    var w = view.clientWidth || 1, h = view.clientHeight || 1;
    raycaster.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), camera);
    var list = [];
    meshes.forEach(function (item) {
      if (item.floor && item.floor !== floorNow) { return; }
      if (item.key === "floor" || item.key === "equipment") { list.push(item.mesh); }
    });
    var found = raycaster.intersectObjects(list, false)[0];
    if (found) {
      var owner = null;
      for (var i = 0; i < meshes.length; i += 1) {
        if (meshes[i].mesh === found.object) { owner = meshes[i]; break; }
      }
      return { world: found.point.clone(), item: owner && owner.key === "equipment" ? owner : null };
    }
    // 바닥 판 밖이면 그 층 바닥 높이의 평면에 떨군다.
    var plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -currentDeck());
    var p = new THREE.Vector3();
    return raycaster.ray.intersectPlane(plane, p) ? { world: p, item: null } : null;
  }

  function setFocusAt(px, py) { focus = groundAt(px, py); }
  function setFocusWorld(spot) { focus = spot ? { world: spot.clone(), item: null } : null; }
  function clearFocus() { focus = null; }

  // 판정 영역 안에 고르게 뿌린 점(해바라기 배열). 반지름 1 인 원 기준이다.
  function disk(n) {
    if (diskCache && diskCache.length === n) { return diskCache; }
    var out = [], golden = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i += 1) {
      var r = Math.sqrt((i + 0.5) / n), a = i * golden;
      out.push({ x: r * Math.cos(a), y: r * Math.sin(a) });
    }
    diskCache = out;
    return out;
  }

  /*
   * 대상(Focus Point · 로봇) 하나와 카메라 사이에 무엇이 끼어 있는지 센다.
   *
   * 판정은 두 겹이다.
   *
   *   중심선  카메라 -> 대상 한 줄. 여기에 걸린 덩이는 대상을 직접 가린 것이라
   *           비율과 상관없이 투명해진다. 계단처럼 한 단 한 단이 따로 된 구조물은
   *           하나하나가 영역의 몇 %만 가려 20% 문턱을 못 넘는데, 모이면 대상을 통째로 덮는다.
   *   영역    대상 둘레 radius px 에 광선 samples 줄. 한 줄에서 대상보다 카메라 쪽에서 맞은
   *           덩이가 그 줄을 "가린" 것이다. 앞뒤는 카메라 깊이로 잰다 — 광선마다 대상을 지나는
   *           화면 평행면까지의 거리를 구해 그보다 앞에서 맞았는지 본다.
   *
   * 바닥은 가리는 것이 아니라 받치는 것이라 세지 않는다. 고른 설비 · Focus Point 가 붙은
   * 설비(skip)도 세지 않는다 — 보려는 그것이 사라지면 안 된다.
   */
  function toScreen(world) {
    var v = world.clone().project(camera);
    if (v.z > 1 || v.z < -1) { return null; }
    var w = view.clientWidth || 1, h = view.clientHeight || 1;
    return { x: (v.x + 1) / 2 * w, y: (1 - v.y) / 2 * h };
  }

  function coverage(world, skip, area) {
    var out = { ratio: {}, center: {} };
    var at = toScreen(world);
    if (!at) { return out; }
    if (!raycaster) { raycaster = new THREE.Raycaster(); }
    var w = view.clientWidth || 1, h = view.clientHeight || 1;
    var camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    var depthF = new THREE.Vector3().subVectors(world, camera.position).dot(camDir);
    // 제 표면에 맞은 광선만 거를 만큼. 대상에 바짝 붙은 벽도 사이에 끼인 것이다(1.5% 로 두었더니 놓쳤다).
    var margin = span * 0.002;

    /*
     * 광선을 쏘기 전에 추린다. 카메라 -> 대상 선분을 판정 반경만큼 두른 원기둥에
     * 경계구가 닿지도 않는 덩이는 어느 광선에도 걸릴 수 없다. 모두 훑으면 대상 둘에 16ms 가 넘었다.
     */
    var toT = new THREE.Vector3().subVectors(world, camera.position);
    var len = toT.length();
    var reachW = OPT.radius * perPixel() * 1.5;
    var closest = new THREE.Vector3();
    var seg = new THREE.Line3(camera.position, world);
    var list = [];
    meshes.forEach(function (item) {
      if (item.key === "floor") { return; }
      if (item.floor && item.floor !== floorNow) { return; }
      if (item === picked || item === skip) { return; }
      var g = item.mesh.geometry;
      if (!g.boundingSphere) { g.computeBoundingSphere(); }
      seg.closestPointToPoint(g.boundingSphere.center, true, closest);
      if (closest.distanceTo(g.boundingSphere.center) > g.boundingSphere.radius + reachW) { return; }
      list.push(item.mesh);
    });

    // 중심선 — 카메라에서 대상까지 곧게 한 줄.
    raycaster.set(camera.position, toT.normalize());
    raycaster.intersectObjects(list, false).forEach(function (found) {
      if (found.distance < len - margin) { out.center[found.object.uuid] = true; }
    });

    if (area) {
      var pts = disk(OPT.samples);
      pts.forEach(function (d) {
        var sx = at.x + d.x * OPT.radius, sy = at.y + d.y * OPT.radius;
        raycaster.setFromCamera(new THREE.Vector2((sx / w) * 2 - 1, -(sy / h) * 2 + 1), camera);
        var cos = raycaster.ray.direction.dot(camDir) || 1;
        var far = depthF / cos - margin;
        var seen = {};
        raycaster.intersectObjects(list, false).forEach(function (found) {
          if (found.distance >= far || seen[found.object.uuid]) { return; }
          seen[found.object.uuid] = true;
          out.ratio[found.object.uuid] = (out.ratio[found.object.uuid] || 0) + 1;
        });
      });
      Object.keys(out.ratio).forEach(function (k) { out.ratio[k] /= pts.length; });
    }
    return out;
  }

  /*
   * 지금 판정할 대상들. Focus Point 는 사용자가 찍었을 때만 있고,
   * 로봇은 길이 깔린 층을 보는 동안 늘 대상이다 — 누르지 않아도 벽 뒤에 숨으면 안 된다.
   * 로봇 표식은 바닥 점에 서므로 몸 높이만큼 살짝 띄워 잰다.
   */
  function targets() {
    var list = [];
    if (focus) { list.push({ world: focus.world, skip: focus.item }); }
    if (OPT.robotTarget && onLane && floorNow === (onLane.floor || ROBOT_ON) && !floorBusy) {
      list.push({ world: onLane.here.clone().add(new THREE.Vector3(0, span * 0.006, 0)), skip: null });
    }
    return list;
  }

  /*
   * 앞을 가린 것만 비쳐 보인다. 대상(Focus Point · 로봇)과 카메라 사이에 낀 정도로 가른다.
   *
   *   중심선에 걸림                투명(벽 · 계단 fadeTo, 설비 fadeSoft)
   *   가림 >= enter(20%)          투명(fadeSoft). 모서리 선은 거의 그대로 남는다.
   *   이미 투명 · 가림 >= leave     투명 유지 — 문턱 근처에서 켜졌다 꺼졌다 하지 않는다.
   *   그 밖                        제 불투명도(채움)
   *
   * 선 강조(close → peak)는 Focus Point 둘레에 준다.
   */
  function plan() {
    if (!meshes.length) { return; }
    // 탑뷰에서는 영역 판정을 쉰다(벽 둘레가 늘 영역에 걸린다). 중심선 판정은 그대로 둔다 —
    // 위에서 봐도 대상 바로 위를 덮은 것은 대상을 가린 것이다.
    var topView = pitch * 180 / Math.PI >= OPT.topPitch;
    aim();
    var ratio = {}, blockC = {};
    targets().forEach(function (t) {
      var r = coverage(t.world, t.skip, !topView);
      Object.keys(r.center).forEach(function (k) { blockC[k] = true; });
      if (topView) { return; }
      Object.keys(r.ratio).forEach(function (k) { ratio[k] = Math.max(ratio[k] || 0, r.ratio[k]); });
    });
    var center = focus ? focus.world : target;
    var near = span * 0.3;

    meshes.forEach(function (item) {
      var c = ratio[item.mesh.uuid] || 0;
      item.cover = c;
      item.onLine = !!blockC[item.mesh.uuid];
      item.faded = item.onLine || (item.faded ? c >= OPT.leave : c >= OPT.enter);
      var close = focus && item.center.distanceTo(center) < near;

      // 설비는 관제 대상이다. 가려도 주변 가림 수준(fadeSoft) 밑으로는 내리지 않는다 — 통째로 비면
      // "설비 하나가 사라졌다"로 읽힌다. 깊이 비치는 것은 벽 · 계단 몫이다.
      var deep = item.onLine && item.key !== "equipment";
      var want = !item.faded ? item.alpha
        : Math.min(item.alpha, deep ? OPT.fadeTo : OPT.fadeSoft);
      var edge = item.faded ? item.line * 0.85 : (close ? item.peak : item.line);

      if (item === picked) { want = 1; edge = 1; }
      item.want = want;
      item.edgeWant = edge;
      item.glowWant = item === picked ? 1 : 0;
    });
    settle();
  }

  /*
   * 덩이 하나를 지금 값으로 칠한다.
   * 층 전환 중에는 층의 페이드(floorFade)가 여기에 곱해진다 — 옅어지는 층은
   * 면 · 모서리 · 그림자가 함께 빠진다. 0 이면 아예 안 그린다.
   */
  function paintOne(item) {
    var vis = item.floor ? (floorFade[item.floor] || 0) : 1;
    // 두 층을 잇는 계단은 두 층 어디서 봐도 보인다.
    if (item.floors) { vis = Math.max(floorFade[item.floors[0]] || 0, floorFade[item.floors[1]] || 0); }
    item.mesh.visible = vis > 0.004;
    item.mat.opacity = item.now * vis;
    // 눌린 설비는 파랗게 물들고, 옅어질수록 납작한 유령색으로 간다.
    // 유령색을 나중에 섞는다 — 사라지는 중인 것이 파랗게 빛나면 안 된다.
    // 옅어진 정도는 레이어의 기본 불투명도(alpha)에서 잰다 — 원래 비쳐 보이게 깔린 벽이
    // 처음부터 회색으로 바래면 덩이끼리 색이 다시 비슷해진다.
    var fade = Math.max(0, 1 - item.now / item.alpha);
    // 채운 판에서는 제 색을 지킨다 — 유령색까지 끝까지 가면 밝은 회색 막이 되어 벽이 읽히지 않는다.
    fade *= 0.3;
    tone.copy(item.base).lerp(PICKED, item.glowNow);
    item.mat.color.copy(tone).lerp(GHOSTC, fade);
    item.mat.emissive.copy(tone).multiplyScalar(PALETTE[item.key].lift);
    item.mat.depthWrite = item.now > 0.95 && vis > 0.95;
    /*
     * 그리는 차례를 못 박는다. 재질이 전부 transparent 라 three.js 는 덩이 한가운데까지의
     * 거리로 뒤에서부터 그리는데, 큰 바닥 판의 한가운데가 설비보다 가까우면 옅어진 설비를 먼저 그리고
     * 바닥이 그 위를 덮어 버렸다(옅어진 것은 깊이를 안 쓰므로 막을 것이 없다) — 35% 여야 할 설비가
     * 아예 안 보였다. 바닥 -> 단단한 덩이 -> 옅어진 덩이 순서로 그린다.
     */
    item.mesh.renderOrder = item.key === "floor" ? -2 : (item.mat.depthWrite ? 0 : 1);
    item.edgeMat.opacity = item.edgeNow * vis;
    // 비쳐 보이게 낮춘 덩이가 그림자만 멀쩡히 남으면 유령이 선 것처럼 보인다.
    item.mesh.castShadow = vis > 0.9 && item.now > item.alpha * 0.5;
  }

  // 값은 그대로 두고 다시 칠하기만 한다 — 층 전환이 프레임마다 부른다.
  function repaint() {
    meshes.forEach(paintOne);
    frame();
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

        paintOne(item);
      });
      frame();
      if (moving) { window.requestAnimationFrame(step); }
      else { ticking = false; }
    })();
  }

  /* ---------- 층 ----------
   *
   * 층은 모델에서 나온다. 덩이마다 제 층이 적혀 있으니(outfit 의 fid) 그것을 모아
   * 층마다 상자 · 바닥 높이 · 계단 자리를 구해 둔다. 아래층이 앞이다.
   */
  function readFloors() {
    var by = {};
    meshes.forEach(function (item) {
      if (!item.floor) { return; }
      var f = by[item.floor];
      if (!f) {
        f = by[item.floor] = {
          id: item.floor, label: floorLabel(item.floor),
          box: new THREE.Box3(), deck: -Infinity, stairs: new THREE.Box3()
        };
      }
      var b = item.mesh.geometry.boundingBox;
      if (!b) { item.mesh.geometry.computeBoundingBox(); b = item.mesh.geometry.boundingBox; }
      f.box.union(b);
      // 바닥 판의 윗면이 그 층의 발 딛는 높이다. 계단은 아래층까지 내려가므로 빼고 잰다.
      if (item.key === "floor") { f.deck = Math.max(f.deck, b.max.y); }
      if (item.key === "stairs") { f.stairs.union(b); }
    });

    floors = Object.keys(by).map(function (id) { return by[id]; });
    floors.forEach(function (f) {
      if (f.deck === -Infinity) { f.deck = f.box.min.y; }
      f.center = f.box.getCenter(new THREE.Vector3());
      f.size = f.box.getSize(new THREE.Vector3());
      f.stairAt = f.stairs.isEmpty() ? f.center.clone() : f.stairs.getCenter(new THREE.Vector3());
    });
    // 깊은 층이 먼저다 — 지하 4층, 지하 3층 차례.
    floors.sort(function (a, b) { return a.deck - b.deck; });
    return floors;
  }

  function floorOf(id) {
    for (var i = 0; i < floors.length; i += 1) { if (floors[i].id === id) { return floors[i]; } }
    return null;
  }

  // 지금 층에서 화면에 담기는 크기를 다시 잰다. 두 층을 합친 크기로 재면 한 층만 볼 때 작아 보인다.
  function fitFloor() {
    var f = floorOf(floorNow);
    var size = f ? f.size : null;
    if (!size) { return; }
    fitH = across(right, size);
    fitV = across(upOnGround, size);
    fitBase();
  }

  // 층마다 도면 크기가 달라도 화면상 배율이 순간적으로 튀지 않게 기준 크기 변화만 zoom에 보상한다.
  function fitFloorKeepingView() {
    var before = baseSize;
    fitFloor();
    if (before > 0 && baseSize > 0) { zoom *= baseSize / before; }
  }

  /* 층 버튼 · 상태바에 지금 층을 알린다. 버튼은 화면마다 있을 수도 없을 수도 있다. */
  function tellFloor() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-map-floor]"), function (btn) {
      var on = btn.getAttribute("data-map-floor") === floorNow;
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-floor-label]"), function (node) {
      node.textContent = floorLabel(floorNow);
    });
    document.dispatchEvent(new CustomEvent("aprism:floor", { detail: { floor: floorNow } }));
  }

  // 로봇 · 길 · 웨이포인트는 로봇이 선 층에만 깔린다.
  function layRobots() {
    if (!floors.length) { return; }
    // 층을 오가는 로봇의 길은 층마다 알아서 켜고 끈다(travelSync). 골라져 있으면 늘 깐다.
    var ln = lanes[activeRobot()];
    if (ln && ln.travel) { showLane(activeRobot(), true); return; }
    if (floorNow === ROBOT_ON) { showLane(activeRobot(), true); }
    else { showLane(-1, true); }
  }

  function smooth(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

  // 구간 [a, b] 안에서의 진행도. 구간 밖은 0 · 1 로 눌린다.
  function seg(t, a, b) { return smooth((t - a) / (b - a)); }

  /*
   * 층을 옮긴다.
   *
   *   via "stairs"  계단을 눌러서 간다. 카메라가 먼저 계단 쪽으로 다가간 뒤 올라간다.
   *   via "button"  층 버튼으로 바로 간다. 다가가는 일 없이 올라가며 갈아입는다.
   *
   * 어느 쪽이든 순서는 같다 — 떠나는 층이 20% 까지 옅어지고 갈 층이 40% 까지 떠오른 다음,
   * 카메라가 높이를 옮기고, 그제야 갈 층이 100% 로 차오르며 떠나는 층이 사라진다.
   */
  function goFloor(next, via, at) {
    if (!floors.length || next === floorNow) { return; }
    // 옮기는 중에 또 누르면 흘려보내지 않고 적어 두었다가 이어서 간다.
    if (floorBusy) { floorNext = next; return; }
    var from = floorOf(floorNow), to = floorOf(next);
    if (!from || !to) { return; }

    floorBusy = true;
    clearFocus();                      // 다른 층의 기준을 들고 가지 않는다
    choose(null);                      // 옮기는 층의 설비를 고른 채로 남겨 두지 않는다
    var prev = floorNow;
    floorNow = next;
    tellFloor();
    showLane(-1, true);                // 옮기는 동안에는 길을 걷어 둔다

    var stair = via === "stairs" ? (at || from.stairAt) : null;   // 누른 계단의 입구로 다가간다
    var span0 = target.clone();
    var rise = to.deck - from.deck;
    var dur = stair ? 1400 : 900;
    var gridY0 = gridMesh ? gridMesh.position.y : 0;
    var t0 = (window.performance || Date).now();

    (function step() {
      var t = Math.min(1, ((window.performance || Date).now() - t0) / dur);

      // 1. 계단으로 갈 때만 — 계단 쪽으로 다가간다(가로 · 세로만, 높이는 아래에서 옮긴다).
      if (stair) {
        var near = seg(t, 0, 0.3);
        target.x = span0.x + (stair.x - span0.x) * near;
        target.z = span0.z + (stair.z - span0.z) * near;
      }

      // 2. 떠나는 층 100 -> 20, 갈 층 0 -> 40
      var out1 = stair ? seg(t, 0.22, 0.48) : seg(t, 0, 0.45);
      var in1 = out1;
      // 3. 카메라가 높이를 옮긴다
      var lift = stair ? seg(t, 0.34, 0.74) : seg(t, 0.15, 0.75);
      // 4. 갈 층 40 -> 100, 떠나는 층 20 -> 0
      var out2 = stair ? seg(t, 0.62, 1) : seg(t, 0.55, 1);

      floorFade[prev] = (1 - 0.8 * out1) * (1 - out2);
      floorFade[next] = 0.4 * in1 + 0.6 * out2;
      target.y = span0.y + rise * lift;
      if (gridMesh) { gridMesh.position.y = gridY0 + rise * lift; }

      clamp();
      repaint();
      if (t < 1) { window.requestAnimationFrame(step); }
      else {
        floorFade[prev] = 0;
        floorFade[next] = 1;
        home = to.center.clone();
        home.y = span0.y + rise;          // 돌아오는 자리도 새 층 높이다
        fitFloorKeepingView();
        floorBusy = false;
        layRobots();
        plan();
        repaint();
        if (!floorNext) { arrivalOverview(via === "stairs" ? 520 : 320); }   // 계단 전환은 한 호흡으로 길게 잇는다
        if (floorNext) {
          var queued = floorNext;
          floorNext = "";
          goFloor(queued, "button");
        }
      }
    })();
  }

  function setupFloors() {
    readFloors();
    if (!floors.length) { return; }
    // 기본은 로봇이 선 층이다. 모델에 그 층이 없으면 가장 깊은 층으로 연다.
    floorNow = floorOf(ROBOT_ON) ? ROBOT_ON : floors[0].id;
    floors.forEach(function (f) { floorFade[f.id] = f.id === floorNow ? 1 : 0; });
    tellFloor();

    Array.prototype.forEach.call(document.querySelectorAll("[data-map-floor]"), function (btn) {
      btn.addEventListener("click", function () { goFloor(btn.getAttribute("data-map-floor"), "button"); });
    });
  }

  /* ---------- 층 이동 — 로봇이 계단으로 층을 옮긴다 ----------
   *
   * 로봇 한 대(ROBOT 02)가 B3 에서 걸어와 계단으로 내려가 B4 출구로 나와 제 길을 잇는다.
   * 그 로봇이 우측에서 골라져 있으면(= 트래킹) 지도가 따라가고, 아니면 지도는 제자리에 있다.
   * 모드는 따로 고르지 않는다 — 골라져 있는지(onLane 이 이 로봇의 길인지)로 매 프레임 가른다.
   *
   *   트래킹      계단 진입 -> "B3 → B4 이동 중" 칩 · 층 선택기 B4 이동 표시
   *               -> 카메라가 로봇을 따라 내려가며(수직 이동) 계단 둘레부터 B4 가 드러난다(부분 마스킹)
   *               -> B4 계단 출구에서 길이 끊기지 않고 이어진다
   *   비트래킹    계단 진입 -> 마커가 계단 지점으로 줄며(SHRINK) 배지로 바뀐다 -> 배지만 잠시(BADGE)
   *               -> 층 선택기 B4 에 로봇 수 +1 · 도착 표시 -> B4 로 가 보면 계단 출구에서 나타난다
   *
   * 로봇은 출구에서 DWELL 초 자세를 고른다. 실제 로봇도 계단을 내려오면 멈춰 정렬하고,
   * 그 사이에 층을 옮긴 사람이 "계단 출구에서 나타나는" 것을 볼 수 있다.
   */
  var TRAVEL = {
    SPEED: 7,          // 평지(월드 길이/초)
    STAIR_SPEED: 3.2,  // 계단
    DWELL: 2.2,        // 출구에서 멈추는 시간(초)
    SHRINK: 260,       // 마커가 계단 지점으로 줄어드는 시간(ms) — 200~300
    BADGE: 2600,       // 배지가 남는 시간(ms)
    OVERVIEW: 1600     // 수동 층 선택 뒤 전체 보기 유지 시간(ms)
  };
  var trav = null;
  var gridByFloor = {};
  var stairHole = {};
  var modelBox = null;

  /*
   * 위층 바닥 판의 계단실 구멍만 유지한다.
   * 층 이동 마스크나 청사진 효과는 적용하지 않는다.
   */
  function stairHoleFor(fid, slab) {
    if (!stairHole[fid]) {
      stairHole[fid] = {
        uHoleOn: { value: 0 }, uHole: { value: new THREE.Vector4() }
      };
    }
    var u = stairHole[fid];
    var hole = slab ? "if (uHoleOn > 0.5 && vMaskXZ.x > uHole.x && vMaskXZ.x < uHole.z && vMaskXZ.y > uHole.y && vMaskXZ.y < uHole.w) { discard; }\n" : "";
    return function (shader) {
      Object.keys(u).forEach(function (k) { shader.uniforms[k] = u[k]; });
      shader.vertexShader = "varying vec2 vMaskXZ;\n" + shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  vMaskXZ = (modelMatrix * vec4(transformed, 1.0)).xz;");
      shader.fragmentShader =
        "uniform float uHoleOn;\nuniform vec4 uHole;\nvarying vec2 vMaskXZ;\n" +
        shader.fragmentShader.replace("#include <premultiplied_alpha_fragment>", hole + "#include <premultiplied_alpha_fragment>");
    };
  }

  /*
   * 계단 인식 — 계단이 어느 층과 어느 층을 잇는지, 층마다 어디로 드나드는지 모델에서 읽는다.
   *
   * 예전에는 계단을 "그 층 레이어에 들어 있는 덩이"로만 알았다. 그런데 이 모델의 계단실은
   * 한 자리에 세 줄기가 겹쳐 있다 — B4 -> B3 로 오르는 줄기, B3 -> B2 로 오르는 줄기(B2 는 모델에 없다),
   * B4 -> B5 로 내려가는 줄기(B5 도 없다). 덩이째 묶어 "가장 낮은 단"을 출구로 잡았더니
   * B5 로 가는 줄기 바닥(B4 바닥보다 3 넘게 아래)이 출구가 됐다. 게다가 B3 바닥 판이 계단실을
   * 덮고 있어 B3 에서 보면 내려가는 계단이 아예 안 보이고, 위층으로 오르는 계단만 보였다.
   *
   * 그래서 단을 하나씩 따라 내려간다.
   *   1. 계단 덩이를 이웃끼리 묶어 계단실(core)로 본다.
   *   2. 위층 바닥 높이 가까이 있는 단(층계참)에서 시작해, 한 단 높이(0.2~0.6)만큼 낮고
   *      바로 붙은 단으로 한 칸씩 내려간다. 아래층 바닥 높이에 닿으면 그 줄이 두 층을 잇는 계단이다.
   *      다른 줄기는 높이가 이어지지 않아 따라가지지 않는다.
   *   3. 줄의 양 끝이 층마다의 입구다. 입구에서 가장 가까운, 계단실 밖의 빈 칸이 그 층의 출입 지점이다.
   *   4. 모델 맨 위층보다 높이 올라가는 단 · 맨 아래층보다 낮게 내려가는 단은 "모델 밖 층" 계단으로 적어 둔다.
   */
  var stairLinks = [];   // { lower, upper, items, path, upMouth, lowMouth, entry, exit, mid, rect }
  var stairEnds = [];    // 모델 밖으로 이어지는 계단 — { floor, dir, at }
  var stairTagBox = [];

  function topY(m) { return m.mesh.geometry.boundingBox.max.y; }
  function gapXZ(a, b) {
    var A = a.mesh.geometry.boundingBox, B = b.mesh.geometry.boundingBox;
    var gx = Math.max(0, A.min.x - B.max.x, B.min.x - A.max.x);
    var gz = Math.max(0, A.min.z - B.max.z, B.min.z - A.max.z);
    return Math.max(gx, gz);
  }
  function centerOf(m) { return m.mesh.geometry.boundingBox.getCenter(new THREE.Vector3()); }

  function descend(items, start, lowDeck) {
    var chain = [start], cur = start;
    for (var guard = 0; topY(cur) > lowDeck + 0.6 && guard < 80; guard += 1) {
      var c0 = centerOf(cur);
      var next = null, best = Infinity;
      for (var i = 0; i < items.length; i += 1) {
        var m = items[i], dy = topY(cur) - topY(m);
        if (dy < 0.2 || dy > 0.6 || chain.indexOf(m) >= 0 || gapXZ(m, cur) > 0.6) { continue; }
        var d = centerOf(m).distanceTo(c0);
        if (d < best) { best = d; next = m; }
      }
      if (!next) { return null; }
      chain.push(next);
      cur = next;
    }
    return topY(cur) <= lowDeck + 0.6 ? chain : null;
  }

  // 층의 격자에서, 계단실 사각형 밖에 있는 가장 가까운 빈 칸(월드 좌표).
  function gridOf(fid) {
    if (gridByFloor[fid] === undefined) {
      var keep = ROBOT_ON; ROBOT_ON = fid;
      gridByFloor[fid] = mapFloor(modelBox);
      ROBOT_ON = keep;
    }
    return gridByFloor[fid];
  }
  function openNear(fid, p, rect) {
    var g = gridOf(fid);
    var f = floorOf(fid);
    if (!g) { return new THREE.Vector3(p.x, f.deck, p.z); }
    var best = null, near = Infinity;
    [g.room, g.open].some(function (grid) {
      for (var k = 0; k < grid.length; k += 1) {
        if (!grid[k]) { continue; }
        var c = k % g.cols, r = (k - c) / g.cols;
        var x = g.minX + (c + 0.5) * ROUTE_STEP, z = g.minZ + (r + 0.5) * ROUTE_STEP;
        if (x > rect[0] - 0.3 && x < rect[2] + 0.3 && z > rect[1] - 0.3 && z < rect[3] + 0.3) { continue; }
        var d = (x - p.x) * (x - p.x) + (z - p.z) * (z - p.z);
        if (d < near) { near = d; best = new THREE.Vector3(x, 0, z); }
      }
      return !!best;
    });
    best = best || new THREE.Vector3(p.x, 0, p.z);
    best.y = f.deck + NAV.lift / NAV.unit;   // 경로선과 같은 높이
    return best;
  }

  function readStairs() {
    stairLinks = []; stairEnds = [];
    if (floors.length < 1) { return; }
    var list = meshes.filter(function (m) { return m.key === "stairs"; });
    var group = list.map(function (_, i) { return i; });
    function root(i) { while (group[i] !== i) { i = group[i] = group[group[i]]; } return i; }
    for (var i = 0; i < list.length; i += 1) {
      var bi = list[i].mesh.geometry.boundingBox.clone().expandByScalar(1.2);
      for (var j = i + 1; j < list.length; j += 1) {
        if (bi.intersectsBox(list[j].mesh.geometry.boundingBox)) { group[root(i)] = root(j); }
      }
    }
    var cores = {};
    list.forEach(function (m, k) { (cores[root(k)] = cores[root(k)] || []).push(m); });

    var lift = span * 0.005;
    var topDeck = floors[floors.length - 1].deck, botDeck = floors[0].deck;
    Object.keys(cores).forEach(function (key) {
      var items = cores[key];
      var used = [];
      for (var f = 0; f < floors.length - 1; f += 1) {
        var L = floors[f], U = floors[f + 1];
        var chain = null;
        items.forEach(function (s) {
          var y = topY(s);
          if (y < U.deck - 1.1 || y > U.deck + 0.1) { return; }
          var c = descend(items, s, L.deck);
          if (c && (!chain || c.length > chain.length)) { chain = c; }
        });
        if (!chain) { continue; }
        used = used.concat(chain);
        var rect = [Infinity, Infinity, -Infinity, -Infinity];
        chain.forEach(function (m) {
          var b = m.mesh.geometry.boundingBox;
          rect[0] = Math.min(rect[0], b.min.x); rect[1] = Math.min(rect[1], b.min.z);
          rect[2] = Math.max(rect[2], b.max.x); rect[3] = Math.max(rect[3], b.max.z);
        });
        // 줄을 따라 한 단에 한 점. 같은 높이의 조각(디딤판 · 챌판)은 한 점으로 모은다.
        var path = [], lastY = Infinity;
        chain.forEach(function (m) {
          var y = topY(m), c = centerOf(m);
          if (Math.abs(y - lastY) < 0.1 && path.length) {
            path[path.length - 1].lerp(new THREE.Vector3(c.x, y + lift, c.z), 0.5);
          } else { path.push(new THREE.Vector3(c.x, y + lift, c.z)); lastY = y; }
        });
        var upMouth = path[0].clone(), lowMouth = path[path.length - 1].clone();
        var link = {
          lower: L.id, upper: U.id, items: chain, path: path, rect: rect,
          upMouth: upMouth, lowMouth: lowMouth,
          entry: openNear(U.id, upMouth, rect),    // 위층에서 계단으로 드는 자리
          exit: openNear(L.id, lowMouth, rect),    // 아래층에서 계단을 나서는 자리
          mid: new THREE.Vector3((rect[0] + rect[2]) / 2, (upMouth.y + lowMouth.y) / 2, (rect[1] + rect[3]) / 2)
        };
        stairLinks.push(link);
        // 두 층을 잇는 단은 두 층 어디서 봐도 보여야 한다 — 레이어는 한 층에만 들어 있다.
        chain.forEach(function (m) { m.link = link; m.floors = [L.id, U.id]; });
      }
      // 모델 밖으로 이어지는 줄기 — 잇는 줄에 안 쓰인 단 가운데 맨 위층보다 높거나 맨 아래층보다 낮은 것.
      var rest = items.filter(function (m) { return used.indexOf(m) < 0; });
      var above = rest.filter(function (m) { return topY(m) > topDeck + 1.5; });
      var below = rest.filter(function (m) { return topY(m) < botDeck - 1.0; });
      function mean(arr) { var c = new THREE.Vector3(); arr.forEach(function (m) { c.add(centerOf(m)); }); return c.multiplyScalar(1 / arr.length); }
      if (above.length) {
        var a = mean(above); a.y = topDeck;
        stairEnds.push({ floor: floors[floors.length - 1].id, dir: "up", at: a, items: above });
        above.forEach(function (m) { m.beyond = "up"; });
      }
      if (below.length) {
        var b2 = mean(below); b2.y = botDeck;
        stairEnds.push({ floor: floors[0].id, dir: "down", at: b2, items: below });
        below.forEach(function (m) { m.beyond = "down"; });
      }
    });

    // 위층 바닥 판에 계단실 구멍을 낸다 — 판이 덮고 있으면 위층에서 내려가는 계단이 안 보인다.
    stairLinks.forEach(function (link) {
      var u = stairHole[link.upper];
      if (u) { u.uHoleOn.value = 1; u.uHole.value.set(link.rect[0], link.rect[1], link.rect[2], link.rect[3]); }
    });
  }

  // 지금 층에서 이 계단을 누르면 어디로 가나. 잇는 줄의 단이면 반대편 층, 모델 밖 줄기면 갈 곳이 없다.
  function stairTo(px, py) {
    if (!renderer || !camera || floorBusy || floors.length < 2) { return null; }
    if (!raycaster) { raycaster = new THREE.Raycaster(); }
    var w = view.clientWidth || 1, h = view.clientHeight || 1;
    raycaster.setFromCamera(new THREE.Vector2((px / w) * 2 - 1, -(py / h) * 2 + 1), camera);
    var list = [];
    meshes.forEach(function (item) {
      if (item.key !== "stairs") { return; }
      var on = item.floors ? item.floors.indexOf(floorNow) >= 0 : item.floor === floorNow;
      if (on) { list.push(item.mesh); }
    });
    var found = list.length ? raycaster.intersectObjects(list, false)[0] : null;
    if (!found) { return null; }
    var owner = null;
    for (var i = 0; i < meshes.length; i += 1) { if (meshes[i].mesh === found.object) { owner = meshes[i]; break; } }
    if (!owner || !owner.link) { return null; }
    var link = owner.link;
    return {
      floor: link.upper === floorNow ? link.lower : link.upper,
      at: link.upper === floorNow ? link.upMouth : link.lowMouth
    };
  }

  /*
   * 계단 입구 표 — 두 층을 잇는 계단의 층마다 입구에 "↓ B4" · "↑ B3" 를 단다.
   * 모델 밖 층으로 이어지는 계단에는 달지 않는다.
   */
  function syncStairTags() {
    if (!OPT.stairTags || !stairLinks.length) {
      stairTagBox.forEach(function (n) { n.hidden = true; });
      return;
    }
    var want = [];
    stairLinks.forEach(function (link) {
      var dn = floorOf(link.lower).deck < floorOf(link.upper).deck;
      if (floorNow === link.upper) { want.push({ at: link.upMouth, text: (dn ? "↓ " : "↑ ") + link.lower, kind: "go" }); }
      if (floorNow === link.lower) { want.push({ at: link.lowMouth, text: (dn ? "↑ " : "↓ ") + link.upper, kind: "go" }); }
    });
    // 모델에 없는 층으로 이어지는 계단에는 칩을 달지 않는다(피드백). 눌러도 안 가는 것은 stairTo 가 맡는다.
    while (stairTagBox.length < want.length) {
      var n = document.createElement("div");
      n.className = "stair-tag"; n.hidden = true;
      hit.appendChild(n);
      stairTagBox.push(n);
    }
    stairTagBox.forEach(function (n, i) {
      var w = want[i];
      // 줌아웃한 판(둘러보기)에서는 뺀다 — 로봇 표식과 겹쳐 몇 대인지 세는 것을 가린다.
      n.hidden = !w || floorBusy || zoom < 1.4;
      if (!w) { return; }
      n.textContent = w.text;
      n.classList.toggle("is-off", w.kind === "off");
      put(n, w.at);
    });
  }

  // 점을 고르게 다시 찍는다 — 지나온 길을 토막 수로 끊어 그리려면 토막이 고르게 짧아야 한다.
  function resample(points, step) {
    var out = [points[0].clone()];
    for (var i = 1; i < points.length; i += 1) {
      var a = points[i - 1], b = points[i], d = a.distanceTo(b);
      var n = Math.max(1, Math.ceil(d / step));
      for (var k = 1; k <= n; k += 1) { out.push(a.clone().lerp(b, k / n)); }
    }
    return out;
  }

  function miles(points) {
    var m = [0];
    for (var i = 1; i < points.length; i += 1) { m.push(m[i - 1] + points[i].distanceTo(points[i - 1])); }
    return m;
  }

  function pointAt(pts, mi, s) {
    if (s <= 0) { return pts[0].clone(); }
    var n = pts.length - 1;
    if (s >= mi[n]) { return pts[n].clone(); }
    var lo = 0, hi = n;
    while (hi - lo > 1) { var md = (lo + hi) >> 1; if (mi[md] <= s) { lo = md; } else { hi = md; } }
    return pts[lo].clone().lerp(pts[hi], (s - mi[lo]) / Math.max(1e-6, mi[hi] - mi[lo]));
  }

  /*
   * 한 토막(층 하나 · 계단 하나)을 선 두 벌로 깐다. 지나온 길은 앞에서부터, 남은 길은
   * 거꾸로 깔아 뒤에서부터 그린다 — 그리는 토막 수(instanceCount)만 바꾸면
   * 로봇이 움직여도 선을 다시 만들지 않는다.
   */
  function lanePart(points, s0, bot, floor) {
    var pts = resample(points, 0.35);
    var mi = miles(pts);
    var done = strand(pts, bot.done, false);
    var left = strand(pts.slice().reverse(), bot.left, true);
    return { pts: pts, mi: mi, s0: s0, len: mi[mi.length - 1], done: done, left: left, floor: floor };
  }

  function showPart(part, s) {
    var n = part.pts.length - 1;
    var k = Math.max(0, Math.min(n, Math.round(n * (s - part.s0) / Math.max(1e-6, part.len))));
    part.done.geometry.instanceCount = k;
    part.left.geometry.instanceCount = n - k;
  }

  function travelBuild(up, low) {
    var box = modelBox, size = box.getSize(new THREE.Vector3());
    function world(fx, fz) { return new THREE.Vector3(box.min.x + fx * size.x, 0, box.min.z + fz * size.z); }
    var bot = ROBOTS[1];
    var flights = stairLinks.filter(function (l) { return l.upper === up && l.lower === low; });
    if (!flights.length) { return null; }
    var dest = bot.stops.slice(1).map(function (s) { return world(s[0], s[1]); });
    var flight = flights.reduce(function (a, b) {
      return b.exit.distanceTo(dest[0]) < a.exit.distanceTo(dest[0]) ? b : a;
    });
    var start = flight.entry.clone().add(new THREE.Vector3(14, 0, -10));

    var aPts = routeOnNav(up, [start, flight.entry]);
    // 위층 출입 지점 -> 층계참 -> 단을 하나씩 -> 아래층 입구 -> 아래층 출입 지점
    var sPts = [flight.entry].concat(flight.path.map(function (q) { return q.clone(); })).concat([flight.exit]);
    var bPts = routeOnNav(low, [flight.exit].concat(dest));
    if (!aPts || !bPts) { return null; }
    // 토막끼리 끝과 처음을 맞춘다 — 계단 출구에서 길이 끊겨 보이지 않게.
    aPts[aPts.length - 1] = flight.entry.clone();
    bPts[0] = flight.exit.clone();

    var A = lanePart(aPts, 0, bot, up);
    var S = lanePart(sPts, A.len, bot, "stair");
    var B = lanePart(bPts, A.len + S.len, bot, low);
    var here = aPts[0].clone();
    var fan = viewFan(bot, here, 1, 0);
    var parts = [A.done, A.left, S.done, S.left, B.done, B.left, fan];
    parts.forEach(function (p) { p.visible = false; scene.add(p); });

    var lane = {
      id: "1", bot: bot, parts: parts, travel: true, floor: up,
      here: here, ahead: here.clone(),
      // 웨이포인트는 B4 미션이라 B4 토막 위에 놓는다.
      turns: B.pts, mile: B.mi, total: B.len
    };
    return {
      up: up, low: low, flight: flight, lane: lane, segs: [A, S, B], fan: fan,
      s: 0, s1: A.len, s2: A.len + S.len, s3: A.len + S.len + B.len,
      phase: "walk", dwell: 0, floor: up, t: 0,
      down: floorOf(low).deck < floorOf(up).deck,
      backup: lanes["1"], seen: false, onStairs: false,
      shrinkAt: 0, badgeAt: 0, arriveAt: 0, gridY0: 0, followFrom: 0
    };
  }

  /* ----- 화면 위 표시(DOM) ----- */
  var travDom = null;
  function travelDom() {
    if (travDom) { return travDom; }
    function el(cls, html) {
      var n = document.createElement("div");
      n.className = cls; n.hidden = true; n.innerHTML = html || "";
      hit.appendChild(n);
      return n;
    }
    travDom = {
      pill: el("tr-pill", "<i></i><span>ROBOT 02</span>"),
      badge: el("tr-badge"),
      chip: el("tr-chip")
    };
    return travDom;
  }

  function onCanvas(world) {
    var v = view.getBoundingClientRect(), c = hit.getBoundingClientRect();
    var a = world.clone().project(camera);
    return { x: (a.x * 0.5 + 0.5) * v.width + v.left - c.left, y: (-a.y * 0.5 + 0.5) * v.height + v.top - c.top };
  }

  function put(node, world, dy) {
    var p = onCanvas(world);
    node.style.left = p.x.toFixed(1) + "px";
    node.style.top = (p.y + (dy || 0)).toFixed(1) + "px";
  }

  function arrow() { return trav.down ? "↓" : "↑"; }

  // 층 선택기 — 층마다 로봇 수, 도착하는 층에는 잠시 표시, 트래킹 중 옮겨 가는 층에는 이동 표시.
  // 층 선택기 — 로봇 수는 세지 않는다(층별 숫자는 우측 12대 목록과 맞지 않아 틀린 정보로 읽혔다).
  // 도착하는 층에 잠시 이동 표시, 트래킹 중 옮겨 가는 층에 이동 표시만 단다.
  // 몇 대가 있는지는 도착한 층을 줌아웃해 지도로 보인다(arrivalOverview).
  function tellFloorRobots(now) {
    if (!trav) { return; }
    Array.prototype.forEach.call(document.querySelectorAll("[data-map-floor]"), function (btn) {
      var id = btn.getAttribute("data-map-floor");
      var arriving = id === trav.low && trav.arriveAt && now - trav.arriveAt < TRAVEL.BADGE + TRAVEL.SHRINK;
      btn.classList.toggle("is-arriving", !!arriving);
      btn.setAttribute("data-arrow", arriving ? arrow() : "");
      btn.classList.toggle("is-moving", id === trav.low && trav.onStairs);
    });
  }

  function clearFloorRobots() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-map-floor]"), function (btn) {
      btn.removeAttribute("data-arrow");
      btn.classList.remove("is-arriving", "is-moving");
    });
  }

  /*
   * 지도에 보이는 로봇은 골라진 한 대(botBox)다 — 층을 옮기는 시연 로봇만 제 마커(travDom.pill)를 따로 든다.
   * 도착한 층을 줌아웃한 판에서 그 표식을 한 번씩 반짝여 어디 있는지 찾게 한다.
   */
  function ping() {
    var list = [];
    if (travDom && !travDom.pill.hidden) { list.push(travDom.pill); }
    if (botBox) { list.push(botBox); }
    list.forEach(function (n) { n.classList.remove("is-ping"); void n.offsetWidth; n.classList.add("is-ping"); });
    window.setTimeout(function () { list.forEach(function (n) { n.classList.remove("is-ping"); }); }, 1800);
  }

  /*
   * 층이 바뀌면 도착 맥락을 잠깐 보여 준다.
   * 트래킹 중에는 로봇을 화면 중심에서 놓지 않고 주변만 살짝 넓혀 본 뒤 원래 배율로 돌아간다.
   * 직접 층을 바꾼 경우에만 종전처럼 층 전체를 담는다.
   */
  function arrivalOverview(duration) {
    if (!OPT.arriveOverview || !renderer || !home) { return; }
    var overviewMs = duration || 320;
    var backZoom = zoom;
    clearFocus();
    unwind(yaw);
    glide(yaw, pitch, 1, home.clone(), overviewMs);
    window.setTimeout(ping, overviewMs + 20);
    if (trav && onLane === trav.lane) {
      var hold = overviewMs + TRAVEL.OVERVIEW;
      trav.followFrom = Date.now() + hold + 420;
      window.setTimeout(function () {
        if (trav && onLane === trav.lane) { glide(yaw, pitch, Math.max(backZoom, 2.2), trav.lane.here.clone()); }
      }, hold);
    }
  }

  /*
   * 매 프레임 — 선 · 부채꼴 · 웨이포인트를 층에 맞춰 켜고 끄고, 표식을 제자리에 놓는다.
   * frame() 이 그리기 직전에 부른다.
   */
  function travelSync() {
    if (!trav) { return; }
    var now = Date.now();
    var d = travelDom();
    var tracked = onLane === trav.lane;
    var both = trav.onStairs;

    trav.segs.forEach(function (part) {
      // 계단 토막은 내려가기 전 · 내려가는 중 · 출구에서 멈춘 동안만 — B4 를 걷기 시작하면 B3 높이까지 솟은
      // 선이 공중에 떠 설비를 가로지른다.
      var stairOn = trav.phase === "walk" || trav.phase === "stair" || trav.phase === "dwell";
      var on = tracked && (part.floor === "stair" ? stairOn : part.floor === floorNow);
      part.done.visible = on; part.left.visible = on;
    });
    trav.fan.visible = tracked && (trav.floor === floorNow || trav.floor === "stair" || both);
    if (tracked) { wpMarks.forEach(function (m) { m.visible = floorNow === trav.low; }); }

    // 트래킹 — 칩(층 이동 중)
    var chipOn = tracked && trav.phase === "stair";
    d.chip.hidden = !chipOn;
    if (chipOn) {
      d.chip.textContent = trav.up + " → " + trav.low + " 이동 중";
      put(d.chip, trav.lane.here, -38 * Math.min(2.8, Math.max(1, Math.pow(zoom, 0.7))));
    }

    // 비트래킹 — 작은 마커 · 배지
    var shrinking = trav.shrinkAt && now - trav.shrinkAt < TRAVEL.SHRINK;
    var visible = !tracked && trav.floor === floorNow && trav.phase !== "stair";
    var showPill = !tracked && (visible || (shrinking && floorNow === trav.up));
    if (showPill && !visible) {
      d.pill.classList.add("is-shrink");
    } else {
      d.pill.classList.remove("is-shrink");
      // 안 보이다가 보이게 되면(층을 옮겨 와서든, 로봇이 출구로 나와서든) 계단 출구에서 떠오른다.
      if (visible && d.pill.hidden) {
        d.pill.classList.remove("is-appear"); void d.pill.offsetWidth; d.pill.classList.add("is-appear");
      }
    }
    d.pill.hidden = !showPill;
    if (showPill) {
      d.pill.style.setProperty("--tint", "#" + ("00000" + (trav.lane.bot.mark || trav.lane.bot.done).toString(16)).slice(-6));
      put(d.pill, shrinking && !visible ? trav.flight.upMouth : trav.lane.here);
    }

    var badgeOn = !tracked && trav.badgeAt && now >= trav.badgeAt && now - trav.badgeAt < TRAVEL.BADGE &&
      floorNow === trav.up;
    d.badge.hidden = !badgeOn;
    if (badgeOn) {
      d.badge.textContent = arrow() + " " + trav.low + " 이동";
      d.badge.style.setProperty("--tint", "#" + ("00000" + (trav.lane.bot.mark || trav.lane.bot.done).toString(16)).slice(-6));
      d.badge.classList.toggle("is-leaving", now - trav.badgeAt > TRAVEL.BADGE - 400);
      put(d.badge, trav.flight.upMouth);
    }
    tellFloorRobots(now);
  }

  /* ----- 움직임 ----- */
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  function where(s) {
    var seg = s < trav.s1 ? trav.segs[0] : (s < trav.s2 ? trav.segs[1] : trav.segs[2]);
    return pointAt(seg.pts, seg.mi, s - seg.s0);
  }

  // 트래킹 중 계단에 들어섰다 — 별도 전환 효과 없이 높이 이동만 시작한다.
  function beginStairMove() {
    trav.onStairs = true;
    floorBusy = true;                 // 그 사이 층 버튼은 줄을 세워 둔다(goFloor 의 floorNext)
    clearFocus();
    floorFade[trav.up] = 1; floorFade[trav.low] = 0;
    trav.gridY0 = gridMesh ? gridMesh.position.y : 0;
    trav.homeY0 = home.y;
  }

  function stepStairMove(u) {
    u = Math.max(0, Math.min(1, u));
    var rise = floorOf(trav.low).deck - floorOf(trav.up).deck;
    if (gridMesh) { gridMesh.position.y = trav.gridY0 + rise * ease(u); }
    // 로봇이 계단 한가운데를 지날 때 모델과 경로를 한 번만 교체한다. 마스크·페이드 효과는 없다.
    if (u >= 0.5 && floorNow !== trav.low) {
      floorFade[trav.up] = 0; floorFade[trav.low] = 1;
      floorNow = trav.low;
      tellFloor();
      meshes.forEach(paintOne);
    }
  }

  function endStairMove() {
    if (!trav || !trav.onStairs) { return; }
    var rise = floorOf(trav.low).deck - floorOf(trav.up).deck;
    trav.onStairs = false;
    floorFade[trav.up] = 0; floorFade[trav.low] = 1;
    if (gridMesh) { gridMesh.position.y = trav.gridY0 + rise; }
    if (floorNow !== trav.low) { floorNow = trav.low; tellFloor(); }
    var to = floorOf(trav.low);
    home = to.center.clone();
    home.y = trav.homeY0 + rise;          // 돌아오는 자리도 새 층 높이다(goFloor 와 같은 셈)
    fitFloorKeepingView();
    floorBusy = false;
    meshes.forEach(paintOne);
    if (floorNext) { var q = floorNext; floorNext = ""; goFloor(q, "button"); }
    // 트래킹 이동은 도착 후 줌아웃하지 않는다. 로봇을 같은 화면 위치에서 계속 따라간다.
  }

  var travLast = 0;
  function travelTick() {
    if (!trav) { return; }
    var nowT = (window.performance ? performance.now() : Date.now());
    var dt = Math.min(0.1, (nowT - travLast) / 1000);
    travLast = nowT;
    var now = Date.now();
    var tracked = onLane === trav.lane;
    var before = trav.s;

    if (trav.phase === "dwell") {
      trav.dwell -= dt;
      if (trav.dwell <= 0) { trav.phase = "walk2"; }
    } else if (trav.phase !== "done") {
      trav.s += dt * (trav.phase === "stair" ? TRAVEL.STAIR_SPEED : TRAVEL.SPEED);
    }

    // 계단 진입
    if (before < trav.s1 && trav.s >= trav.s1) {
      trav.s = trav.s1;
      trav.phase = "stair";
      trav.arriveAt = now;
      if (tracked) { beginStairMove(); }
      else if (floorNow === trav.up) { trav.shrinkAt = now; trav.badgeAt = now + TRAVEL.SHRINK; }
    }
    // 계단 출구
    if (trav.phase === "stair" && trav.s >= trav.s2) {
      trav.s = trav.s2;
      trav.phase = "dwell";
      trav.dwell = TRAVEL.DWELL;
      endStairMove();
    }
    if (trav.phase === "walk2" && trav.s >= trav.s3) { trav.s = trav.s3; trav.phase = "done"; }

    trav.floor = trav.phase === "walk" ? trav.up : (trav.phase === "stair" ? "stair" : trav.low);
    trav.lane.floor = trav.floor;

    var here = where(trav.s);
    var ahead = where(Math.min(trav.s3, trav.s + 1.5));
    if (ahead.distanceTo(here) < 1e-3) { ahead = here.clone().add(trav.lane.ahead.clone().sub(trav.lane.here)); }
    trav.lane.here.copy(here);
    trav.lane.ahead.copy(ahead);
    trav.segs.forEach(function (part) { showPart(part, trav.s); });
    trav.fan.position.copy(here);
    trav.fan.position.y += span * 0.002;
    trav.fan.rotation.y = Math.atan2(ahead.x - here.x, ahead.z - here.z);
    tellHeading();

    if (trav.onStairs) { stepStairMove((trav.s - trav.s1) / Math.max(1e-6, trav.s2 - trav.s1)); }

    if (tracked) {
      // 트래킹 — 로봇이 선 층을 보고 있지 않으면 그 층으로 간다(계단 위가 아닐 때만).
      if (trav.floor !== "stair" && trav.floor !== floorNow && !floorBusy) { goFloor(trav.floor, "button"); }
      // 로봇 마커와 카메라 중심을 붙여 둔다. 높이까지 따라가므로 계단을 내려가면 카메라도 내려간다.
      else if (now > trav.followFrom && !down.length) {
        target.lerp(here, 1 - Math.pow(0.002, dt));
      }
    }
    plan();
    frame();
    if (trav.phase !== "done" || (trav.badgeAt && now - trav.badgeAt < TRAVEL.BADGE + 500)) {
      window.requestAnimationFrame(travelTick);
    } else { trav.running = false; }
  }

  function travelReset() {
    if (!trav) { return; }
    if (trav.onStairs) { endStairMove(); }
    trav.lane.parts.forEach(function (p) { scene.remove(p); });
    lanes["1"] = trav.backup;
    if (travDom) { travDom.pill.hidden = travDom.badge.hidden = travDom.chip.hidden = true; }
    clearFloorRobots();
    var was = onLane === trav.lane;
    trav = null;
    if (was) { onLane = null; }
    layRobots();
    plan();
  }

  /*
   * 시연을 건다. tracked 면 ROBOT 02 를 골라 두고(트래킹), 아니면 ROBOT 01 을 골라 둔다.
   * 둘 다 B3 에서 시작한다 — 비트래킹은 "지도가 B3 에 그대로 있는" 경우를 보려는 것이다.
   */
  function travelStart(tracked) {
    if (!renderer || floors.length < 2) { return; }
    travelReset();
    var up = "B3", low = "B4";
    var built = travelBuild(up, low);
    if (!built) { return; }
    trav = built;
    lanes["1"] = trav.lane;
    if (trav.backup) { trav.backup.parts.forEach(function (p) { p.visible = false; }); }

    function go() {
      if (floorBusy) { window.setTimeout(go, 60); return; }
      var card = document.querySelector(".robot-strip .robot-card[data-robot='" + (tracked ? "1" : "0") + "']");
      if (tracked) {
        if (card) { card.click(); }
        glide(yaw, pitch, Math.max(zoom, 2.2), trav.lane.here.clone());
      } else {
        // 다른 로봇을 골라 둔다. 카드를 누르면 카메라가 그 로봇(B4)으로 끌려가므로 끌려간 것을 되돌린다.
        if (card && activeRobot() === "1") {
          var keep = target.clone();
          card.click();
          trip = null;
          target.copy(keep);
        }
        layRobots();
        glide(yaw, pitch, Math.max(zoom, 2), trav.lane.here.clone().lerp(trav.flight.entry, 0.5));
      }
      trav.followFrom = Date.now() + 400;
      travLast = window.performance ? performance.now() : Date.now();
      if (!trav.running) { trav.running = true; window.requestAnimationFrame(travelTick); }
    }
    if (floorNow !== up) { goFloor(up, "button"); }
    go();
  }

  window.APRISM_TRAVEL = { start: travelStart, reset: travelReset, config: TRAVEL,
    state: function () { return trav && { phase: trav.phase, floor: trav.floor, s: trav.s, s1: trav.s1, s2: trav.s2, s3: trav.s3, tracked: onLane === trav.lane, floorNow: floorNow, onStairs: trav.onStairs }; } };

  /* ---------- 경로 재구성 — 미터 좌표 · 장애물 여유 · 폐회로 ----------
   *
   * 좌표
   *   1 UNIT = 1 m. 모델 원본에 단위가 없어서 층고로 맞췄다 — B3 · B4 바닥 사이가 4.49 UNIT 이고
   *   지하층 층고 4.5 m 로 읽으면 건물이 73.6 m × 120 m 가 된다. 실제 치수가 다르면 NAV.unit 만 고친다.
   *   도면 좌표(plan)는 탑뷰 화면의 좌측 하단이 (0, 0, 0) 이다. X 오른쪽(월드 +x) · Y 위쪽(월드 -z) · Z 위.
   *   바닥 경로의 Z 는 언제나 0 이다. 그릴 때만 경로선을 바닥에서 NAV.lift(0.02 m) 띄운다.
   *
   * 장애물
   *   벽 · 설비(그리고 계단 — 로봇이 디딤판을 가로지르면 안 된다)의 삼각형 가운데 바닥에서
   *   로봇 키(NAV.height) 사이에 걸치는 것을 0.25 m 격자에 찍는다. 머리 위 덕트는 막지 않는다.
   *   찍은 칸에서 떨어진 거리(거리장)를 재 두고, 로봇 반경 + 안전거리 안쪽은 못 가는 곳으로 친다.
   *
   * 길
   *   0.5 m 마디에서 A*. 여덟 방향으로만 가고, 꺾을 때마다 값을 더 치른다(45° < 90° < 135°, 되돌기 금지).
   *   그래서 결과가 45° · 90° 로 꺾인 몇 토막으로 나온다. 웨이포인트 사이에 장애물이 있으면 이동 가능한
   *   곳으로 돌아간다. 좁아서 안전거리를 못 지키는 구간은 반경만 지켜 다시 찾고 표시해 둔다(reduced).
   */
  var NAV = {
    unit: 1,          // 월드 1 UNIT 이 몇 m 인가
    raster: 0.25,     // 장애물 격자(m)
    cell: 0.5,        // 길찾기 마디 간격(m) — 웨이포인트 좌표도 이 간격에 맞춘다
    radius: 0.4,      // 로봇 반경(m)
    safety: 0.2,      // 안전거리(m)
    height: 1.5,      // 이 높이 안에 걸치는 것만 장애물(m)
    lift: 0.02,       // 경로선을 바닥에서 띄우는 높이(m) — 그릴 때만
    turn45: 0.6, turn90: 1.4, turn135: 4   // 꺾는 값(m 로 친다)
  };
  var navByFloor = {};
  var routeLog = [];    // 좌표 보정 · 여유 부족 구간 기록 — APRISM_ROUTE.report()

  function deckOf(fid) { var f = floorOf(fid); return f ? f.deck : floorY; }
  function toWorld(X, Y, fid, lift) {
    return new THREE.Vector3(modelBox.min.x + X / NAV.unit, deckOf(fid) + (lift || 0) / NAV.unit,
      modelBox.max.z - Y / NAV.unit);
  }
  function toPlan(v) { return { X: (v.x - modelBox.min.x) * NAV.unit, Y: (modelBox.max.z - v.z) * NAV.unit }; }

  function buildNav(fid) {
    var r = NAV.raster;
    var Wm = (modelBox.max.x - modelBox.min.x) * NAV.unit, Hm = (modelBox.max.z - modelBox.min.z) * NAV.unit;
    var cw = Math.ceil(Wm / r), ch = Math.ceil(Hm / r);
    var solid = new Uint8Array(cw * ch);
    var deck = deckOf(fid), low = deck + 0.05 / NAV.unit, high = deck + NAV.height / NAV.unit;

    meshes.forEach(function (item) {
      if (item.key === "floor") { return; }
      var on = item.floors ? item.floors.indexOf(fid) >= 0 : (!item.floor || item.floor === fid);
      if (!on) { return; }
      var bb = item.mesh.geometry.boundingBox;
      if (bb.max.y < low || bb.min.y > high) { return; }
      var pos = item.mesh.geometry.attributes.position, idx = item.mesh.geometry.index;
      var count = idx ? idx.count : pos.count;
      for (var t = 0; t + 2 < count; t += 3) {
        var lox = Infinity, hix = -Infinity, loz = Infinity, hiz = -Infinity, loy = Infinity, hiy = -Infinity;
        for (var k = 0; k < 3; k += 1) {
          var v = idx ? idx.getX(t + k) : t + k;
          var x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
          if (x < lox) { lox = x; } if (x > hix) { hix = x; }
          if (z < loz) { loz = z; } if (z > hiz) { hiz = z; }
          if (y < loy) { loy = y; } if (y > hiy) { hiy = y; }
        }
        if (hiy < low || loy > high) { continue; }
        var c0 = Math.max(0, Math.floor((lox - modelBox.min.x) * NAV.unit / r));
        var c1 = Math.min(cw - 1, Math.floor((hix - modelBox.min.x) * NAV.unit / r));
        var r0 = Math.max(0, Math.floor((modelBox.max.z - hiz) * NAV.unit / r));
        var r1 = Math.min(ch - 1, Math.floor((modelBox.max.z - loz) * NAV.unit / r));
        for (var rr = r0; rr <= r1; rr += 1) {
          for (var cc = c0; cc <= c1; cc += 1) { solid[rr * cw + cc] = 1; }
        }
      }
    });
    for (var c = 0; c < cw; c += 1) { solid[c] = 1; solid[(ch - 1) * cw + c] = 1; }
    for (var q = 0; q < ch; q += 1) { solid[q * cw] = 1; solid[q * cw + cw - 1] = 1; }

    // 거리장 — 두 번 훑는 모따기 거리(1 · √2). 값은 가장 가까운 장애물 칸 중심까지의 m.
    var d = new Float32Array(cw * ch), D1 = r, D2 = r * Math.SQRT2, i, j, p;
    for (i = 0; i < d.length; i += 1) { d[i] = solid[i] ? 0 : 1e9; }
    for (j = 0; j < ch; j += 1) {
      for (i = 0; i < cw; i += 1) {
        p = j * cw + i;
        if (!d[p]) { continue; }
        if (i > 0) { d[p] = Math.min(d[p], d[p - 1] + D1); }
        if (j > 0) {
          d[p] = Math.min(d[p], d[p - cw] + D1);
          if (i > 0) { d[p] = Math.min(d[p], d[p - cw - 1] + D2); }
          if (i < cw - 1) { d[p] = Math.min(d[p], d[p - cw + 1] + D2); }
        }
      }
    }
    for (j = ch - 1; j >= 0; j -= 1) {
      for (i = cw - 1; i >= 0; i -= 1) {
        p = j * cw + i;
        if (!d[p]) { continue; }
        if (i < cw - 1) { d[p] = Math.min(d[p], d[p + 1] + D1); }
        if (j < ch - 1) {
          d[p] = Math.min(d[p], d[p + cw] + D1);
          if (i < cw - 1) { d[p] = Math.min(d[p], d[p + cw + 1] + D2); }
          if (i > 0) { d[p] = Math.min(d[p], d[p + cw - 1] + D2); }
        }
      }
    }
    return {
      fid: fid, cw: cw, ch: ch, dist: d,
      ni: Math.floor(Wm / NAV.cell) + 1, nj: Math.floor(Hm / NAV.cell) + 1
    };
  }

  function navOf(fid) { return navByFloor[fid] || (navByFloor[fid] = buildNav(fid)); }

  // 마디 (i, j) 의 여유 — 가장 가까운 장애물 가장자리까지(m).
  function clearAt(nav, i, j) {
    var c = Math.min(nav.cw - 1, Math.floor(i * NAV.cell / NAV.raster));
    var r = Math.min(nav.ch - 1, Math.floor(j * NAV.cell / NAV.raster));
    return nav.dist[r * nav.cw + c] - NAV.raster / 2;
  }

  // 못 가는 곳에 찍힌 점은 가장 가까운 갈 수 있는 마디로 옮긴다.
  function snapNode(nav, P, need) {
    var i0 = Math.round(P.X / NAV.cell), j0 = Math.round(P.Y / NAV.cell);
    for (var ring = 0; ring < 40; ring += 1) {
      var best = null, bd = Infinity;
      for (var dj = -ring; dj <= ring; dj += 1) {
        for (var di = -ring; di <= ring; di += 1) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== ring) { continue; }
          var i = i0 + di, j = j0 + dj;
          if (i < 0 || j < 0 || i >= nav.ni || j >= nav.nj) { continue; }
          if (clearAt(nav, i, j) < need) { continue; }
          var dd = di * di + dj * dj;
          if (dd < bd) { bd = dd; best = [i, j]; }
        }
      }
      if (best) { return best; }
    }
    return [i0, j0];
  }

  var DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  function astar(nav, s, g, need) {
    var ni = nav.ni, nj = nav.nj, N = ni * nj;
    var cost = new Float32Array(N * 9).fill(Infinity);
    var from = new Int32Array(N * 9).fill(-1);
    var heapF = [], heapS = [];
    function push(f, st) {
      heapF.push(f); heapS.push(st);
      var k = heapF.length - 1;
      while (k > 0) {
        var up = (k - 1) >> 1;
        if (heapF[up] <= heapF[k]) { break; }
        var tf = heapF[up]; heapF[up] = heapF[k]; heapF[k] = tf;
        var ts = heapS[up]; heapS[up] = heapS[k]; heapS[k] = ts;
        k = up;
      }
    }
    function pop() {
      var top = heapS[0], lf = heapF.pop(), ls = heapS.pop();
      if (heapF.length) {
        heapF[0] = lf; heapS[0] = ls;
        var k = 0;
        for (;;) {
          var a = 2 * k + 1, b = a + 1, m = k;
          if (a < heapF.length && heapF[a] < heapF[m]) { m = a; }
          if (b < heapF.length && heapF[b] < heapF[m]) { m = b; }
          if (m === k) { break; }
          var tf = heapF[m]; heapF[m] = heapF[k]; heapF[k] = tf;
          var ts = heapS[m]; heapS[m] = heapS[k]; heapS[k] = ts;
          k = m;
        }
      }
      return top;
    }
    function h(i, j) {
      var dx = Math.abs(i - g[0]), dy = Math.abs(j - g[1]);
      return NAV.cell * (Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy));
    }
    var free = function (i, j) { return i >= 0 && j >= 0 && i < ni && j < nj && clearAt(nav, i, j) >= need; };
    var TURN = [0, NAV.turn45, NAV.turn90, NAV.turn135, Infinity];
    var st0 = (s[1] * ni + s[0]) * 9 + 8;
    cost[st0] = 0;
    push(h(s[0], s[1]), st0);
    var goal = -1, guard = 0;
    while (heapF.length && guard < 4e6) {
      guard += 1;
      var st = pop(), node = (st / 9) | 0, dir = st % 9;
      var i = node % ni, j = (node - i) / ni;
      if (i === g[0] && j === g[1]) { goal = st; break; }
      var base = cost[st];
      for (var k = 0; k < 8; k += 1) {
        var turn = 0;
        if (dir !== 8) { var dd = Math.abs(dir - k); turn = TURN[Math.min(dd, 8 - dd)]; }
        if (turn === Infinity) { continue; }
        var ii = i + DIRS[k][0], jj = j + DIRS[k][1];
        if (!free(ii, jj)) { continue; }
        if ((k & 1) && (!free(i + DIRS[k][0], j) || !free(i, j + DIRS[k][1]))) { continue; }
        var nst = (jj * ni + ii) * 9 + k;
        var nc = base + NAV.cell * ((k & 1) ? Math.SQRT2 : 1) + turn;
        if (nc < cost[nst]) { cost[nst] = nc; from[nst] = st; push(nc + h(ii, jj), nst); }
      }
    }
    if (goal < 0) { return null; }
    var out = [];
    for (var w = goal; w >= 0; w = from[w]) {
      var nd = (w / 9) | 0, x = nd % ni;
      out.push([x, (nd - x) / ni]);
    }
    return out.reverse();
  }

  // 같은 방향으로 이어지는 마디는 한 토막으로 — 꺾이는 자리만 남긴다.
  function straighten(nodes) {
    if (nodes.length < 3) { return nodes.slice(); }
    var out = [nodes[0]];
    for (var i = 1; i < nodes.length - 1; i += 1) {
      var a = out[out.length - 1], b = nodes[i], c = nodes[i + 1];
      var d1x = Math.sign(b[0] - a[0]), d1y = Math.sign(b[1] - a[1]);
      var d2x = Math.sign(c[0] - b[0]), d2y = Math.sign(c[1] - b[1]);
      if (d1x !== d2x || d1y !== d2y) { out.push(b); }
    }
    out.push(nodes[nodes.length - 1]);
    return out;
  }

  /*
   * 점들을 차례로 잇는 길(도면 좌표). closed 면 마지막 점에서 처음 점으로 돌아온다.
   * 돌려주는 것: { path:[{X,Y,Z}], stops:[{X,Y,Z}](보정된 웨이포인트), reduced:[구간 번호] }
   */
  function planChain(fid, pts, closed, names) {
    var nav = navOf(fid);
    var need = NAV.radius + NAV.safety;
    var stops = pts.map(function (P, k) {
      var n = snapNode(nav, P, need);
      var S = { X: n[0] * NAV.cell, Y: n[1] * NAV.cell, Z: 0 };
      var moved = Math.hypot(S.X - P.X, S.Y - P.Y);
      if (moved > 0.01) {
        routeLog.push((names ? names[k] : "점 " + k) + " 좌표 보정 " + moved.toFixed(2) + " m (장애물 여유 안쪽)");
      }
      return S;
    });
    var order = closed ? stops.concat([stops[0]]) : stops;
    var nodes = [], reduced = [];
    for (var k = 0; k < order.length - 1; k += 1) {
      var a = [Math.round(order[k].X / NAV.cell), Math.round(order[k].Y / NAV.cell)];
      var b = [Math.round(order[k + 1].X / NAV.cell), Math.round(order[k + 1].Y / NAV.cell)];
      var leg = astar(nav, a, b, need);
      if (!leg) {
        leg = astar(nav, a, b, NAV.radius) || astar(nav, a, b, 0);
        reduced.push(k);
        routeLog.push((names ? names[k] + " → " + (names[k + 1] || names[0]) : "구간 " + k) +
          (leg ? " : 안전거리 미확보(반경만 지킴)" : " : 길 없음 — 직선으로 둠"));
      }
      leg = leg || [a, b];
      nodes = nodes.concat(nodes.length ? leg.slice(1) : leg);
    }
    var path = straighten(nodes).map(function (n) { return { X: n[0] * NAV.cell, Y: n[1] * NAV.cell, Z: 0 }; });
    return { path: path, stops: stops, reduced: reduced };
  }

  /*
   * 로봇 경로 데이터 — 도면 좌표(m). 도커 -> WP-01 -> … -> WP-20 -> 같은 도커(폐회로).
   * ROBOT_WPS 가 비어 있는 로봇은 예전 경유지(stops, 건물 비율)로 한 바퀴를 먼저 찾고
   * 그 위에 20 개를 고르게 뿌려 씨앗으로 쓴다. 뿌린 좌표는 APRISM_ROUTE.report() 로 꺼내
   * ROBOT_WPS 에 붙여 넣으면 그때부터 고정 데이터가 된다.
   */
  var ROBOT_WPS = {};

  function planRobot(bot, id) {
    if (!modelBox) { return null; }
    var size = modelBox.getSize(new THREE.Vector3());
    function frac(f) { return { X: f[0] * size.x * NAV.unit, Y: (1 - f[1]) * size.z * NAV.unit }; }
    var fid = ROBOT_ON;
    var dock = frac(bot.dock);
    var count = readWaypoints().length || WAYPOINTS;
    var names = ["DOCK"];
    for (var n = 1; n <= count; n += 1) { names.push("WP-" + ("0" + n).slice(-2)); }
    var wps = ROBOT_WPS[id];
    if (!wps) {
      var seed = planChain(fid, [dock].concat(bot.stops.map(frac)), true, null);
      var mi = [0];
      for (var s = 1; s < seed.path.length; s += 1) {
        mi.push(mi[s - 1] + Math.hypot(seed.path[s].X - seed.path[s - 1].X, seed.path[s].Y - seed.path[s - 1].Y));
      }
      var total = mi[mi.length - 1];
      wps = [];
      for (var k = 1; k <= count; k += 1) {
        var far = total * k / (count + 1), a = 1;
        while (a < mi.length - 1 && mi[a] < far) { a += 1; }
        var t = (far - mi[a - 1]) / Math.max(1e-6, mi[a] - mi[a - 1]);
        var P = seed.path[a - 1], Q = seed.path[a];
        wps.push([Math.round((P.X + (Q.X - P.X) * t) / NAV.cell) * NAV.cell,
                  Math.round((P.Y + (Q.Y - P.Y) * t) / NAV.cell) * NAV.cell]);
      }
      routeLog.push(bot.name + " 웨이포인트 " + count + "개는 씨앗 좌표(ROBOT_WPS 비어 있음)");
    }
    var pts = [dock].concat(wps.map(function (w) { return { X: w[0], Y: w[1] }; }));
    var res = planChain(fid, pts, true, names);
    var lift = NAV.lift;
    return {
      fid: fid, names: names, dockPlan: res.stops[0], wpPlan: res.stops.slice(1), pathPlan: res.path,
      reduced: res.reduced,
      world: res.path.map(function (q) { return toWorld(q.X, q.Y, fid, lift); }),
      wpWorld: res.stops.slice(1).map(function (q) { return toWorld(q.X, q.Y, fid, lift); }),
      dockWorld: toWorld(res.stops[0].X, res.stops[0].Y, fid, lift)
    };
  }

  // 층을 오가는 로봇(시연)의 평지 구간도 같은 길찾기를 쓴다 — 열린 길(폐회로 아님).
  function routeOnNav(fid, worldPts) {
    var res = planChain(fid, worldPts.map(toPlan), false, null);
    return res.path.map(function (q) { return toWorld(q.X, q.Y, fid, NAV.lift); });
  }

  /*
   * 도커 — 출발점이자 복귀점이라 아이콘 하나에 두 상태를 같이 싣는다.
   * 둘레의 고리가 한 바퀴 중 어디까지 왔는지(출발 → 복귀)를 채우고, 옆 글자가 지금 상태를 말한다.
   *   출발 대기 · 출발 완료 → 복귀 대기(n%) · 복귀 완료
   */
  var dockBox = null;
  function syncDock() {
    var ln = onLane && onLane.plan ? onLane : null;
    if (!dockBox) {
      dockBox = document.createElement("div");
      dockBox.className = "map-dock"; dockBox.hidden = true;
      dockBox.innerHTML = '<span class="map-dock-ic" aria-hidden="true"><svg viewBox="0 0 16 16" width="12" height="12">' +
        '<path d="M9 1 3 9h4l-1 6 6-8H8l1-6z" fill="currentColor"/></svg></span><span class="map-dock-txt"></span>';
      hit.appendChild(dockBox);
    }
    var show = !!ln && (ln.floor || ROBOT_ON) === floorNow && !floorBusy;
    dockBox.hidden = !show;
    if (!show) { return; }
    var at = ln.bot.at;
    // 도커는 아이콘이 말하므로 "DOCK" 글자는 싣지 않는다. 출발 · 복귀는 조각 둘로.
    var txt = at <= 0.001 ? ["출발 대기"] : (at >= 0.999 ? ["복귀 완료"] : ["출발 완료", "복귀 대기 " + Math.round(at * 100) + "%"]);
    window.APRISM_TEXT.fill(dockBox.querySelector(".map-dock-txt"), txt);
    dockBox.style.setProperty("--p", String(Math.max(0, Math.min(1, at))));
    dockBox.style.setProperty("--tint", "#" + ("00000" + (ln.bot.mark || ln.bot.done).toString(16)).slice(-6));
    put(dockBox, ln.dock);
  }

  window.APRISM_ROUTE = {
    config: NAV,
    // 로봇별 도면 좌표(m)를 꺼낸다. 경로선 좌표의 Z 는 0 이다(그릴 때만 +lift).
    report: function () {
      var out = { unit: "1 UNIT = " + NAV.unit + " m", origin: "도면 좌측 하단 (0,0,0)", log: routeLog.slice(), robots: {} };
      Object.keys(lanes).forEach(function (id) {
        var ln = lanes[id];
        if (!ln || !ln.plan) { return; }
        out.robots[ln.bot.name] = {
          dock: ln.plan.dockPlan, wps: ln.plan.wpPlan.map(function (w, k) { return { id: ln.plan.names[k + 1], X: w.X, Y: w.Y, Z: 0 }; }),
          path: ln.plan.pathPlan, reducedLegs: ln.plan.reduced
        };
      });
      return out;
    }
  };

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

    // 덩이마다 광선 가속 나무를 한 번 심는다. 좌표가 월드로 굳어 있어 다시 만들 일이 없다.
    if (Bvh) {
      meshes.forEach(function (item) {
        item.mesh.geometry.computeBoundsTree = Bvh.computeBoundsTree;
        item.mesh.geometry.computeBoundsTree();
        item.mesh.raycast = Bvh.acceleratedRaycast;
      });
    }

    var box = new THREE.Box3().setFromObject(model);
    modelBox = box;   // 층 이동이 층마다 길을 찾을 때 쓴다
    var size = box.getSize(new THREE.Vector3());
    span = size.length() / 2;

    // 층을 읽는다. 층이 있으면 처음 자리는 그 층 한가운데다(두 층을 합친 한가운데가 아니다).
    setupFloors();
    readStairs();   // 계단이 잇는 층 · 층마다 입구
    var here = floors.length ? floorOf(floorNow) : null;

    home = (here ? here.center : box.getCenter(new THREE.Vector3())).clone();
    target = home.clone();
    /*
     * 바닥 판의 윗면을 찾는다. 모델의 가장 낮은 곳이 아니다.
     *
     * 이 건물은 계단이 아래층으로 내려가서, box.min.y 는 바닥보다 세 뼘 아래다.
     * 거기에 길을 깔면 바닥 판 밑으로 들어가 한 점도 안 보인다.
     * 고른 설비 표시도 같은 이유로 엉뚱한 자리에 뜬 선처럼 보였다 —
     * 아이소메트릭에서 아래로 밀린 것은 옆으로 밀린 것과 구별되지 않는다.
     */
    /*
     * 길과 웨이포인트는 로봇이 선 층의 바닥에 깔린다.
     * 층이 둘이 되면서 "모델에서 가장 높은 바닥" 은 위층 바닥이다 —
     * 그걸 쓰면 지하 4층 로봇의 길이 지하 3층 바닥에 그려진다.
     */
    var deckOn = floors.length ? (floorOf(ROBOT_ON) || floors[0]) : null;
    floorY = deckOn ? deckOn.deck : box.min.y;
    if (!deckOn) {
      var deck = -Infinity;
      meshes.forEach(function (item) {
        if (item.key === "floor") { deck = Math.max(deck, item.mesh.geometry.boundingBox.max.y); }
      });
      if (deck > -Infinity) { floorY = deck; }
    }

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
      tintRobot(bot, id);
      // 길은 도킹 스테이션에서 시작한다.
      // 도커 -> WP-01 … -> 같은 도커 폐회로(미터 좌표 · 장애물 여유). 못 만들면 예전 길로 둔다.
      var planned = planRobot(bot, id);
      drawRoute(planned ? planned.world : layRoute(box, [bot.dock].concat(bot.stops)), bot, id, planned);
    });
    layRobots();
    layWaypoints();
    // 뜨기 전에 고른 웨이포인트가 있으면 이제 그리로 간다(쪽지도 이때 자리를 잡는다).
    if (chosenWp) { chooseWaypoint(chosenWp, "panel"); }

    /*
     * 키 라이트를 모델 크기에 맞춰 세운다. 그림자 카메라가 여기서 나온다.
     *
     * 방위는 처음 카메라에서 90도 옆이다. 카메라와 같은 쪽에 두면 그림자가 전부
     * 덩이 뒤로 숨어 한 점도 안 보인다 — 처음에 그렇게 뒀다가 그림자가 안 나온다고
     * 한참을 들여다봤다. 옆에서 비추면 그림자가 화면 왼쪽으로 눕는다.
     */
    key.position.copy(home).add(new THREE.Vector3(0.62, 0.8, -0.62).normalize().multiplyScalar(span * 2));
    key.target.position.copy(home);

    // 바닥 격자는 지금 층 바닥에 깐다. 층을 옮기면 같이 따라 올라간다.
    gridMesh = floorGrid(box, here ? here.deck : box.min.y);
    scene.add(gridMesh);

    WORLD_UP = new THREE.Vector3(0, 1, 0);
    dirV = new THREE.Vector3();
    right = new THREE.Vector3();
    upOnGround = new THREE.Vector3();
    orient();   // yaw · pitch 가 아직 처음 각도다 — 여기서 잰 것이 fit 의 기준이 된다.

    // 화면에 담는 크기는 지금 층 것이다 — 두 층을 합친 크기로 재면 한 층만 볼 때 작아 보인다.
    var fitSize = here ? here.size : size;
    fitH = across(right, fitSize);
    fitV = across(upOnGround, fitSize);
    fitBase();

    camera = new THREE.PerspectiveCamera(10, 1, 1, span * 40);

    /*
     * data-map-keep 이 붙은 캔버스만 그린 판을 남겨 둔다. 다른 곳(시안 2 의 알림 상세 모달)이
     * 이 캔버스를 잘라 작은 지도로 옮겨 그리려면 판이 지워지지 않아야 한다.
     * 메모리를 조금 더 쓰므로 필요한 화면에서만 켠다.
     */
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: true,
      preserveDrawingBuffer: canvas.hasAttribute("data-map-keep")
    });
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

    /*
     * 층 이동 시연 — 로봇 위치 실데이터가 붙기 전까지 URL 로 켠다.
     *   ?demo=travel       ROBOT 02 를 골라 둔 채(트래킹) B3 -> B4
     *   ?demo=travel-free  다른 로봇을 골라 둔 채(비트래킹) B3 -> B4
     * 콘솔에서는 APRISM_TRAVEL.start(true | false) · APRISM_TRAVEL.reset().
     */
    var demo = (window.location.search.match(/[?&]demo=([\w-]+)/) || [])[1];
    if (demo === "travel" || demo === "travel-free") {
      window.setTimeout(function () { travelStart(demo === "travel"); }, 600);
    }

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
    import("three/addons/lines/LineSegmentsGeometry.js"),
    // 광선 가속 — 판정이 광선 백여 줄을 쏜다. 못 가져오면 그냥 느린 광선으로 돈다.
    import("https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.8/build/index.module.js").catch(function () { return null; })
  ]).then(function (mods) {
    Bvh = mods[8];
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
