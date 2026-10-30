// 통합 순회 현황 연출 — 홀로그램 디지털 트윈(10/30 디자이너 "B2B 셀링용, 우선 멋있어 보여야").
// 레퍼런스 ③ 파랑 홀로그램 건물 · ④ 지하 주차장 — 반투명 면, 빛나는 윤곽선, 바닥에 깔린 빛 테두리, 격자 바닥.
// 지하 층이라 건물 외관 · 주변 도로는 그리지 않는다(실제 현장과 다른 그림이 된다). 층 내부를 비춰 보이는 쪽이다.
//
// building.js 가 층을 다 쌓은 뒤 APRISM_BLD_FX.init 을 부르고, 매 프레임 step(덧칠) → render 를 부른다.
// render 가 false 면 building.js 가 예전처럼 그린다 — 효과를 끄거나 라이트 테마면 운영 화면과 같다.
//
// 색 — 구조는 청백(차가운 흰빛), 올린 층의 테두리만 브랜드 파랑. 빨강 · 노랑은 알림 표식(HTML)에만 남긴다.
//      "파랑은 상태 또는 단 하나의 주요 행동"(10/12)이라 구조 전체를 파랑으로 빛내지 않는다.
// 지금은 렌더 실험(screens/lab-bld-render-v5.html · <html data-fx-lab>)만 읽는다. 키보드 B — 켜기 · 끄기.
(function () {
  "use strict";

  var S = {
    on: true,
    edge: "#8fbcff", edgeOp: 0.5,           // 윤곽선 — 청백. 0.85 · 블룸 0.85 면 판 전체가 우윳빛으로 하얗게 번졌다(10/30 첫 캡처)
    face: "#0d1b36", faceOp: 0.45, faceSolidOp: 0.9,   // 면 — 쌓인 판은 비치고, 들어간 층은 차오른다
    base: "#3d8bff", baseGlow: 0.8, hotGlow: 2.2,      // 층 바닥 빛 테두리 — 브랜드 파랑, 올리면 밝아진다
    grid: true, gridOp: 0.22,
    pillars: true,
    scan: true, scanSec: 7,
    bg: true,
    bloom: true, bloomAmt: 0.5, bloomRadius: 0.35, bloomTh: 0.32,
    res: 1.5
  };
  var LAB = document.documentElement.hasAttribute("data-fx-lab");
  if (/[?&]fx=off/.test(window.location.search)) { S.on = false; }
  ((window.location.search.match(/[?&]fxset=([^&]+)/) || [])[1] || "").split(",").forEach(function (kv) {
    var p = decodeURIComponent(kv).split(":");
    if (!(p[0] in S)) { return; }
    S[p[0]] = typeof S[p[0]] === "number" ? +p[1] : typeof S[p[0]] === "boolean" ? p[1] === "1" || p[1] === "true" : p[1];
  });

  var ctx = null, T = null, composer = null, P = {}, ready = false;
  var X = {};            // 층마다 { line, glow }
  var grid = null, pillars = null, scan = null, bgTex = null;
  var size = { w: 0, h: 0, pr: 0 };
  var fps = { n: 0, t0: 0, v: 0 };
  var c1 = null, c2 = null;

  window.APRISM_BLD_FX = { init: init, step: step, render: render, S: S };

  function init(c) {
    ctx = c; T = c.THREE;
    Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
      LAB ? import("https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/dist/lil-gui.esm.min.js") : null
    ]).then(build).catch(function (e) { console.warn("[통합 순회 연출] 효과를 못 불러와 원래대로 그린다", e); });
  }

  /* ---------- 그림 재료(캔버스) ---------- */

  function pad(w, h) { var cv = document.createElement("canvas"); cv.width = w; cv.height = h; return cv; }
  function tex(cv) { var t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; t.anisotropy = 4; return t; }
  function flat(w, d, t, opacity) {
    var geo = new T.PlaneGeometry(w, d); geo.rotateX(-Math.PI / 2);
    return new T.Mesh(geo, new T.MeshBasicMaterial({ map: t, transparent: true, opacity: opacity, depthWrite: false, blending: T.AdditiveBlending }));
  }

  // 층 바닥 빛 테두리 — 가운데는 비고 가장자리만 부드럽게 빛난다. 층 비율대로 그려 테 굵기가 고르다.
  function frameArt(w, d) {
    var W = 512, H = Math.max(64, Math.round(512 * d / w)), cv = pad(W, H), g = cv.getContext("2d");
    var m = Math.round(Math.min(W, H) * 0.08);
    g.strokeStyle = "#ffffff"; g.lineJoin = "round";
    g.shadowColor = "#ffffff"; g.shadowBlur = m * 0.9;
    g.lineWidth = m * 0.18; g.strokeRect(m, m, W - m * 2, H - m * 2);
    g.shadowBlur = m * 0.3; g.lineWidth = m * 0.06; g.strokeRect(m, m, W - m * 2, H - m * 2);
    return tex(cv);
  }
  // 격자 바닥 — 가운데에서 멀어질수록 사라진다.
  function gridArt() {
    var N = 1024, cv = pad(N, N), g = cv.getContext("2d"), step = N / 32;
    g.strokeStyle = "rgba(150,190,255,.55)"; g.lineWidth = 1.5;
    for (var i = 0; i <= N; i += step) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, N); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(N, i); g.stroke(); }
    g.globalCompositeOperation = "destination-in";
    var r = g.createRadialGradient(N / 2, N / 2, 0, N / 2, N / 2, N / 2);
    r.addColorStop(0, "rgba(0,0,0,1)"); r.addColorStop(0.55, "rgba(0,0,0,.6)"); r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r; g.fillRect(0, 0, N, N);
    return tex(cv);
  }
  // 바탕 — 가운데가 한 단 밝은 남색.
  function bgArt() {
    var N = 512, cv = pad(N, N), g = cv.getContext("2d");
    var r = g.createRadialGradient(N / 2, N * 0.45, 0, N / 2, N * 0.45, N * 0.75);
    r.addColorStop(0, "#0e1d38"); r.addColorStop(0.6, "#070d1a"); r.addColorStop(1, "#04070d");
    g.fillStyle = r; g.fillRect(0, 0, N, N);
    return tex(cv);
  }

  function build(m) {
    var r = ctx.renderer;
    c1 = new T.Color(); c2 = new T.Color();
    var rt = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 4 });
    composer = new m[0].EffectComposer(r, rt);
    composer.addPass(P.render = new m[1].RenderPass(ctx.scene, ctx.camera));
    composer.addPass(P.bloom = new m[2].UnrealBloomPass(new T.Vector2(1, 1), S.bloomAmt, S.bloomRadius, S.bloomTh));
    composer.addPass(new m[3].OutputPass());
    bgTex = bgArt();

    var foot = null;   // 가장 넓은 층의 바닥 — 격자 · 스캔 · 모서리 점선이 쓴다
    ctx.FLOORS.forEach(function (f) {
      var s = ctx.F[f]; if (!s) { return; }
      var b = s.bounds, w = b.max.x - b.min.x, d = b.max.z - b.min.z, cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2;
      var glow = flat(w * 1.16, d * 1.16, frameArt(w * 1.16, d * 1.16), 1);
      glow.position.set(cx, b.min.y + 0.05, cz); glow.renderOrder = 5;
      var pts = [[b.min.x, b.min.z], [b.max.x, b.min.z], [b.max.x, b.max.z], [b.min.x, b.max.z]].map(function (p) { return new T.Vector3(p[0], b.min.y + 0.08, p[1]); });
      var line = new T.LineLoop(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ transparent: true, depthWrite: false }));
      line.renderOrder = 6;
      glow.raycast = line.raycast = function () {};
      s.holder.add(glow, line);
      X[f] = { glow: glow, line: line };
      if (!foot || w * d > foot.w * foot.d) { foot = { w: w, d: d, cx: cx, cz: cz, b: b }; }
    });

    var gs = Math.max(foot.w, foot.d) * 4;
    grid = flat(gs, gs, gridArt(), S.gridOp);
    grid.material.map.wrapS = grid.material.map.wrapT = T.RepeatWrapping;
    grid.position.set(foot.cx, 0, foot.cz); grid.renderOrder = -1; grid.raycast = function () {};
    ctx.scene.add(grid);

    pillars = new T.LineSegments(new T.BufferGeometry(), new T.LineDashedMaterial({ dashSize: 2.2, gapSize: 1.6, transparent: true, depthWrite: false }));
    pillars.userData.foot = foot; pillars.raycast = function () {};
    ctx.scene.add(pillars);

    scan = flat(foot.w * 1.02, foot.d * 1.02, frameArt(foot.w, foot.d), 0);
    scan.position.set(foot.cx, 0, foot.cz); scan.renderOrder = 7; scan.raycast = function () {};
    ctx.scene.add(scan);

    if (LAB) {
      panel(m[4].GUI);
      window.addEventListener("keydown", function (e) {
        if ((e.key === "b" || e.key === "B") && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { S.on = !S.on; badge(); }
      });
    }
    ready = true;
    badge();
  }

  function active() { return ready && S.on && !ctx.isLight(); }

  /* ---------- 매 프레임 덧칠 ---------- */

  function step(now) {
    if (!ready) { return; }
    var on = active();
    ctx.scene.background = on && S.bg ? bgTex : null;
    grid.visible = pillars.visible = scan.visible = false;
    ctx.FLOORS.forEach(function (f) { if (X[f]) { X[f].glow.visible = X[f].line.visible = on; } });
    if (!on) { return; }   // building.js 가 매 프레임 제 색을 다시 칠하므로 되돌릴 것이 없다

    var st = ctx.state(), base = c2.set(S.base), lo = Infinity, hi = -Infinity;
    ctx.FLOORS.forEach(function (f) {
      var s = ctx.F[f], x = X[f]; if (!s || !x) { return; }
      var dim = (st.hot && st.mode === "all" && st.hot !== f) ? 0.45 : 1;
      s.meshes.forEach(function (mesh) {
        var mt = mesh.material, floor = mesh.userData.kind === "floor";
        mt.color.set(S.face);
        if (floor) { mt.color.multiplyScalar(0.55); }
        mt.emissive.set(S.face).multiplyScalar(floor ? 0.3 : 0.6 + 0.6 * s.hot);
        mt.opacity = (floor ? Math.max(S.faceOp, 0.8) : S.faceOp + (S.faceSolidOp - S.faceOp) * s.solid) * s.op * (floor ? 1 : dim);
        mt.transparent = true;
        mt.depthWrite = floor && s.op > 0.5;   // 바닥판만 깊이를 쓴다 — 아래층 선이 바닥을 뚫고 비치지 않게, 벽은 서로 비친다
      });
      s.lines.forEach(function (ls) {
        var floor = ls.userData.kind === "floor";
        ls.material.color.set(S.edge).lerp(c1.setRGB(1, 1, 1), s.hot * 0.5);
        ls.material.opacity = S.edgeOp * (floor ? 0.45 : 1) * s.op * dim;
      });
      var g = (S.baseGlow + (S.hotGlow - S.baseGlow) * s.hot) * s.op;
      x.glow.material.color.copy(base); x.glow.material.opacity = Math.min(1, g * 0.55);
      x.line.material.color.copy(base).lerp(c1.setRGB(1, 1, 1), 0.25 + 0.35 * s.hot); x.line.material.opacity = Math.min(1, g);
      x.glow.visible = x.line.visible = s.op > 0.01;
      if (s.op > 0.01) { lo = Math.min(lo, s.y); hi = Math.max(hi, s.y + s.size.y); }
    });
    if (lo === Infinity) { return; }

    grid.visible = S.grid;
    grid.position.y = lo - 1.5;
    grid.material.opacity = S.gridOp;

    // 층을 잇는 모서리 점선 — 쌓인 판(전체 보기)에서만. 층 사이가 한 건물로 읽힌다.
    var ft = pillars.userData.foot;
    pillars.visible = S.pillars && st.mode === "all";
    if (pillars.visible) {
      var arr = [];
      [[ft.b.min.x, ft.b.min.z], [ft.b.max.x, ft.b.min.z], [ft.b.max.x, ft.b.max.z], [ft.b.min.x, ft.b.max.z]].forEach(function (p) { arr.push(p[0], lo, p[1], p[0], hi, p[1]); });
      pillars.geometry.setAttribute("position", new T.Float32BufferAttribute(arr, 3));
      pillars.computeLineDistances();
      pillars.material.color.set(S.edge); pillars.material.opacity = 0.35;
    }

    // 스캔 — 빛 테 하나가 아래에서 위로 천천히 훑고 사라진다.
    scan.visible = S.scan;
    if (scan.visible) {
      var t = (now / 1000 % S.scanSec) / S.scanSec;
      scan.position.y = lo + (hi - lo) * t;
      scan.material.color.set(S.edge);
      scan.material.opacity = Math.sin(Math.PI * t) * 0.55;
    }
  }

  function render() {
    if (!active()) { return false; }
    var r = ctx.renderer, v = r.getSize(new T.Vector2()), pr = Math.min(r.getPixelRatio(), S.res);
    if (v.x !== size.w || v.y !== size.h || pr !== size.pr) {
      size = { w: v.x, h: v.y, pr: pr };
      composer.setPixelRatio(pr); composer.setSize(v.x, v.y);
    }
    P.bloom.enabled = S.bloom;
    P.bloom.strength = S.bloomAmt; P.bloom.radius = S.bloomRadius; P.bloom.threshold = S.bloomTh;
    composer.render();
    tick();
    return true;
  }

  /* ---------- 실험 조절판 ---------- */

  function tick() {
    var t = performance.now();
    if (!fps.t0) { fps.t0 = t; }
    fps.n += 1;
    if (t - fps.t0 >= 1000) { fps.v = Math.round(fps.n * 1000 / (t - fps.t0)); fps.n = 0; fps.t0 = t; badge(); }
  }
  var tag = null;
  function badge() {
    if (!LAB) { return; }
    if (!tag) { tag = document.createElement("div"); tag.className = "lab-fx-tag"; document.body.appendChild(tag); }
    tag.textContent = (S.on ? (ctx.isLight() ? "라이트 — 연출은 다크만" : "연출 켜짐" + (fps.v ? " · " + fps.v + " fps" : "")) : "연출 꺼짐 · 운영 화면과 같음") + "  ·  B 로 전환";
    tag.classList.toggle("is-off", !S.on);
  }
  function panel(GUI) {
    var gui = new GUI({ title: "통합 순회 연출 (홀로그램)" });
    gui.domElement.classList.add("lab-fx-gui");
    gui.add(S, "on").name("연출 켜기 (B)").onChange(badge).listen();
    var f = gui.addFolder("구조");
    f.addColor(S, "edge").name("윤곽선 색");
    f.add(S, "edgeOp", 0, 1, 0.05).name("윤곽선 세기");
    f.addColor(S, "face").name("면 색");
    f.add(S, "faceOp", 0, 1, 0.05).name("면 (쌓인 판)");
    f.add(S, "faceSolidOp", 0, 1, 0.05).name("면 (들어간 층)");
    f = gui.addFolder("층 빛 테두리");
    f.addColor(S, "base").name("색");
    f.add(S, "baseGlow", 0, 2, 0.05).name("평소");
    f.add(S, "hotGlow", 0, 3, 0.05).name("올렸을 때");
    f = gui.addFolder("배경 · 움직임");
    f.add(S, "bg").name("남색 바탕");
    f.add(S, "grid").name("격자 바닥");
    f.add(S, "gridOp", 0, 1, 0.05).name("격자 세기");
    f.add(S, "pillars").name("모서리 점선");
    f.add(S, "scan").name("스캔 빛");
    f.add(S, "scanSec", 3, 15, 0.5).name("스캔 주기 (초)");
    f = gui.addFolder("블룸");
    f.add(S, "bloom").name("켜기");
    f.add(S, "bloomAmt", 0, 2, 0.05).name("세기");
    f.add(S, "bloomRadius", 0, 1, 0.05).name("번짐 폭");
    f.add(S, "bloomTh", 0, 1, 0.01).name("문턱");
    f.add(S, "res", { "1 (가벼움)": 1, "1.5": 1.5, "2": 2 }).name("해상도 배율").onChange(function (v) { S.res = +v; });
    gui.add({ copy: function () {
      var txt = JSON.stringify(S, null, 2);
      if (navigator.clipboard) { navigator.clipboard.writeText(txt); }
      console.log("[통합 순회 연출] 지금 값\n" + txt);
    } }, "copy").name("지금 값 복사");
  }
})();
