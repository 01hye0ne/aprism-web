// v6 지도 효과(map-fx-v5.js 를 10/30 복제) — map-v6.js 를 쓰는 v6 화면이 모두 읽는다(10/29 디자이너가 렌더 실험에서 고른 값을 운영에 반영).
// 조절판 · 효과 표시 · B 키는 렌더 실험(screens/lab-map-render-v5.html · <html data-fx-lab>)에서만 뜬다.
// map-v6.js 가 지도를 다 세운 뒤 APRISM_MAP_FX.init 을 부르고, 그릴 때마다 render 를 부른다.
// render 가 false 를 돌려주면 map-v6.js 가 예전처럼 직접 그린다 — 효과를 끄면 운영 화면과 똑같다.
//
// 얹는 것(1단계 · 코드만으로)
//   톤 매핑      AgX · ACES — 밝은 곳이 하얗게 날아가지 않고 부드럽게 눕는다. 대신 경로 · 상태색도 같이 바뀐다.
//   환경광       RoomEnvironment — 면에 은은한 반사가 생겨 단색 덩이가 재질처럼 읽힌다.
//   AO           GTAO — 벽 밑동 · 모서리 · 틈에 지는 그늘. 레퍼런스의 "무게감"이 대부분 여기서 나온다.
//   블룸         밝은 것만 번지게 한다. 다크 전용 — 라이트는 바탕이 밝아 화면 전체가 번진다.
//   비네트       가장자리를 바탕보다 한 단 어둡게 — 시선이 가운데 지도로 모인다.
//   그림자       해상도 · 번짐을 올린다.
//
// 2단계 — AO 굽기(bake). [11/03] 디자이너 결정으로 운영 AO 를 GTAO → 굽기로 바꿈(값 = 렌더 실험 screens/lab-map-render-v6.html 기본값).
//   GTAO 는 조절판 "AO 방식"으로 다시 견줄 수 있다.
//   지도를 세운 뒤 한 번만, 층마다 위에서 내려다본 높이 판을 그려 바닥 그늘(높이장 AO)을 계산해 텍스처로 굳힌다.
//   면은 자기 자리(벽은 노멀 쪽으로 조금 비켜) 그늘을 읽고, 바닥에서 올라갈수록 옅게 한다.
//   카메라와 상관없어 돌려도 그늘이 그대로이고, 매 프레임 계산(GTAO)이 없다. 블렌더 · UV 없이 된다.
//
// 키보드 B — 효과 켜기 · 끄기(전후 비교).
//
// 무게 — 로봇이 걷는 동안 지도는 매 프레임(초당 60번) 다시 그려진다. 그래서
//   · 후처리 판은 배율 1 + MSAA 로 그린다(운영 화면은 배율 2 로 그려 줄인다 — 픽셀이 4배).
//   · AO 는 반 해상도로 계산하고, 카메라 · 비치는 벽이 그대로면 지난 결과를 다시 쓴다 — 건물은 안 움직인다.
//   · 끌어 돌리는 동안에는 AO 를 쉬고, 멈추면 한 번 계산한다.
//   · 캔버스도 배율 res 로 그린다 — 효과 판이 이미 res 라 캔버스만 2배로 두면 마지막 칠만 4배로 든다.
//   · 그림자 맵은 덩이가 보이고 · 숨고 · 비칠 때만 다시 굽는다 — 건물 · 키 라이트가 안 움직이니 매 프레임 구울 까닭이 없다.
(function () {
  "use strict";

  // 값 — 10/29 디자이너가 렌더 실험 조절판에서 고른 값 그대로.
  var S = {
    on: true,
    tone: "none", exposure: 0.9,   // AgX 는 경로 · 상태색의 채도를 크게 뺀다(10/29 캡처) — 톤 매핑은 끔
    env: true, envAmt: 0.1, rough: 0.8,
    ao: false, aoRadius: 4.5, aoAmt: 0.6, aoDeep: 1, aoRest: true, aoView: 0,   // aoView 0 합친 화면 · 5 AO 만 · 3 노멀 판
    bloom: true, bloomAmt: 0.4, bloomRadius: 0.15, bloomTh: 0.51,
    vignette: 0.3,   // 10/30 디자이너 0.25 → 0.3
    shadow: 2048, shadowSoft: 5,
    res: 1,   // 후처리 판 배율 — 1 이면 효과 없던 때(2)의 ¼ 픽셀
    // AO 굽기 — 11/03 운영 AO(GTAO 대신)
    bake: true, bakeR: 1.6, bakeAmt: 1.4, bakeFade: 1.2, bakeDirect: 0.6, bakeOff: 0.12, bakeRes: 2048, bakeView: false
  };
  var TONES = { "없음": "none", "AgX": "AgX", "ACES": "ACES" };
  var LAB = document.documentElement.hasAttribute("data-fx-lab");
  var FPS = LAB || /[?&]fps/.test(window.location.search);   // ?fps — 운영 화면에서도 지도 fps 를 띄운다(버벅임 확인용)
  if (/[?&]fx=off/.test(window.location.search)) { S.on = false; }   // ?fx=off — 효과 없이 연다(전후 비교 · 느린 PC)
  // ?fxset=tone:ACES,envAmt:0.2 — 값을 주소로 넘긴다. 마음에 드는 조합을 링크 하나로 나눌 수 있다.
  ((window.location.search.match(/[?&]fxset=([^&]+)/) || [])[1] || "").split(",").forEach(function (kv) {
    var p = decodeURIComponent(kv).split(":");
    if (!(p[0] in S)) { return; }
    S[p[0]] = typeof S[p[0]] === "number" ? +p[1] : typeof S[p[0]] === "boolean" ? p[1] === "1" || p[1] === "true" : p[1];
  });

  var ctx = null, T = null, composer = null, rt = null;
  var P = {};          // 패스 — render · ao · bloom · out · vig
  var envTex = null, ready = false, size = { w: 0, h: 0, pr: 0 };
  var bgNow = null;    // 지금 바탕색(CSS) — 투명 캔버스를 메우는 데 쓴다
  var aoSig = "", aoPrev = "", aoMoved = 0, aoTimer = 0;   // AO 다시 쓰기 — 지난 계산 때 · 직전 프레임의 카메라 · 벽 상태, 마지막으로 바뀐 때
  var fps = { n: 0, t0: 0, v: 0 };
  var pr0 = 0, shSig = "";   // 효과 없던 때의 캔버스 배율 · 그림자를 마지막으로 구운 때의 덩이 상태

  window.APRISM_MAP_FX = { init: init, render: render, S: S };

  function init(c) {
    ctx = c;
    T = c.THREE;
    pr0 = c.renderer.getPixelRatio();
    Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
      import("three/addons/postprocessing/ShaderPass.js"),
      import("three/addons/environments/RoomEnvironment.js"),
      LAB ? import("https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/dist/lil-gui.esm.min.js") : null
    ]).then(build).catch(function (e) { console.warn("[렌더 실험] 효과를 못 불러와 원래대로 그린다", e); });
  }

  function build(m) {
    var r = ctx.renderer;
    /*
     * 후처리 판은 기본이 안티에일리어싱 없음이라 모서리 선이 계단진다.
     * WebGL2 의 MSAA(samples 4)를 판에 건다. HalfFloat 은 블룸 · 톤 매핑이 1 을 넘는 밝기를 다뤄야 해서다.
     */
    rt = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType, samples: 4 });
    composer = new m[0].EffectComposer(r, rt);

    P.render = new m[1].RenderPass(ctx.scene, ctx.camera);
    composer.addPass(P.render);

    P.ao = new m[2].GTAOPass(ctx.scene, ctx.camera, 1, 1);
    P.ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, rings: 2, samples: 16 });
    /*
     * AO 바탕 판(노멀 · 깊이)에는 건물 덩이만 넣는다.
     * 길(굵은 선 = Line2 는 Mesh 다) · 표식 · 바닥 띠까지 들어가면 그것들이 그늘을 드리운다.
     * Focus Point 판정으로 비쳐 보이게 된 벽도 뺀다 — 넣으면 안 보이는 벽의 그늘만 바닥에 남는다.
     */
    P.ao.overrideVisibility = function () {
      var keep = new Set();
      ctx.meshes.forEach(function (it) { if (it.mesh.visible && it.now > 0.9) { keep.add(it.mesh); } });
      var cache = this._visibilityCache;
      this.scene.traverse(function (o) {
        cache.set(o, o.visible);
        if ((o.isMesh || o.isLine || o.isPoints || o.isSprite) && !keep.has(o)) { o.visible = false; }
      });
    };
    // 반 해상도 — 그늘은 부드러운 것이라 반으로 계산해 늘려도 티가 안 난다. 계산량은 ¼.
    var aoSize = P.ao.setSize;
    P.ao.setSize = function (w, h) { aoSize.call(this, Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2))); aoSig = ""; };
    /*
     * 같은 장면이면 AO 계산(노멀 판 · GTAO · 잡티 지우기)을 건너뛰고 지난 결과만 덧입힌다.
     * 로봇이 걷기만 할 때가 그렇다 — 로봇 · 길은 AO 판에 안 들어가니 바뀐 것이 없다.
     * 끌어 돌리는 동안(aoRest)은 AO 를 아예 쉬고, 멈춘 뒤 한 번 다시 그린다.
     */
    var aoRender = P.ao.render;
    P.ao.render = function (r, wb, rb) {
      var sig = sceneSig(), out = this.renderToScreen ? null : wb;
      var now = performance.now();
      if (sig !== aoPrev) { aoMoved = now; aoPrev = sig; }   // 직전 프레임과 견준다 — 지난 계산과 견주면 한 번 움직인 뒤 영영 "움직이는 중"이다
      var moving = S.aoRest && now - aoMoved < 180;
      if (moving) {
        window.clearTimeout(aoTimer);
        aoTimer = window.setTimeout(ctx.redraw, 200);
      }
      if (this.output !== 0) { aoSig = ""; return aoRender.call(this, r, wb, rb); }   // 진단 보기는 늘 새로
      if (!moving && sig !== aoSig) { aoSig = sig; return aoRender.call(this, r, wb, rb); }
      this.copyMaterial.uniforms.tDiffuse.value = rb.texture;
      this.copyMaterial.blending = T.NoBlending;
      this.renderPass(r, this.copyMaterial, out);
      if (moving || !aoSig) { return; }
      this.blendMaterial.uniforms.intensity.value = this.blendIntensity;
      this.blendMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture;
      this.renderPass(r, this.blendMaterial, out);
    };
    composer.addPass(P.ao);

    P.bloom = new m[3].UnrealBloomPass(new T.Vector2(1, 1), S.bloomAmt, S.bloomRadius, S.bloomTh);
    composer.addPass(P.bloom);

    P.out = new m[4].OutputPass();   // 톤 매핑 · sRGB 변환 — renderer.toneMapping 을 읽는다
    composer.addPass(P.out);

    // 비네트 — 화면에 나간 색(sRGB)에서 가장자리만 어둡게 한다. 바탕색 쪽으로 눌러서 판 둘레가 바탕에 녹는다.
    P.vig = new m[5].ShaderPass({
      uniforms: { tDiffuse: { value: null }, amount: { value: S.vignette }, aspect: { value: 1 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: [
        "uniform sampler2D tDiffuse; uniform float amount; uniform float aspect; varying vec2 vUv;",
        "void main(){",
        "  vec4 c = texture2D(tDiffuse, vUv);",
        "  vec2 d = (vUv - 0.5) * vec2(aspect, 1.0);",
        "  float v = smoothstep(0.35, 1.05, length(d));",
        "  gl_FragColor = vec4(c.rgb * (1.0 - amount * v), c.a);",
        "}"
      ].join("\n")
    });
    composer.addPass(P.vig);

    var pm = new T.PMREMGenerator(r);
    envTex = pm.fromScene(new m[6].RoomEnvironment(r), 0.04).texture;
    pm.dispose();

    if (LAB) {
      Object.assign(window.APRISM_MAP_FX, { sync: sync, bk: BK, ctx: ctx, inject: inject });   // 실험 화면 진단용
      panel(m[7].GUI);
      window.addEventListener("keydown", function (e) {
        if ((e.key === "b" || e.key === "B") && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { S.on = !S.on; sync(); }
      });
    }
    if (window.MutationObserver) {
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    ready = true;
    sync();
  }

  // AO 판을 다시 계산해야 하나 — 카메라 자리 · 렌즈, 덩이마다 보이는지 · 비치는지.
  function sceneSig() {
    var e = ctx.camera.matrixWorld.elements, p = ctx.camera.projectionMatrix.elements, s = "";
    for (var i = 12; i < 15; i++) { s += e[i].toFixed(3) + ","; }
    s += e[8].toFixed(4) + "," + e[10].toFixed(4) + "," + p[0].toFixed(5) + "," + p[5].toFixed(5) + "|";
    ctx.meshes.forEach(function (it) { s += it.mesh.visible ? (it.now > 0.9 ? "1" : "0") : "-"; });
    return s;
  }

  // 투명 캔버스 뒤로 비치던 바탕색 — 지도 칸에서 위로 올라가며 처음 칠해진 배경을 찾는다.
  function backdrop() {
    var el = ctx.view;
    while (el && el !== document.documentElement) {
      var c = getComputedStyle(el).backgroundColor;
      if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) { return c; }
      el = el.parentElement;
    }
    return getComputedStyle(document.body).backgroundColor || "#070a10";
  }

  /*
   * 값을 장면에 넣는다. 효과를 끄면 원래 값으로 되돌린다 — 운영 화면과 똑같이 보여야 비교가 된다.
   * 원래 값: 톤 매핑 없음 · 환경광 없음 · 거칠기 0.85 · 그림자 1024/3 · 바탕 투명.
   */
  function sync() {
    if (!ready) { return; }
    var r = ctx.renderer, on = S.on, light = ctx.isLight();
    r.setPixelRatio(on ? Math.min(pr0, S.res) : pr0);
    r.shadowMap.autoUpdate = !on;   // 켜져 있으면 render 가 덩이 상태를 보고 필요할 때만 굽는다
    r.shadowMap.needsUpdate = true;
    shSig = "";
    r.toneMapping = !on || S.tone === "none" ? T.NoToneMapping : (S.tone === "ACES" ? T.ACESFilmicToneMapping : T.AgXToneMapping);
    r.toneMappingExposure = on ? S.exposure : 1;
    ctx.scene.environment = on && S.env ? envTex : null;
    ctx.scene.background = on ? new T.Color(bgNow = backdrop()) : null;
    ctx.meshes.forEach(function (it) {
      it.mat.envMapIntensity = S.envAmt;
      it.mat.roughness = on ? S.rough : 0.85;
    });

    var res = on ? S.shadow : 1024;
    if (ctx.key.shadow.mapSize.x !== res) {
      ctx.key.shadow.mapSize.set(res, res);
      if (ctx.key.shadow.map) { ctx.key.shadow.map.dispose(); ctx.key.shadow.map = null; }
    }
    ctx.key.shadow.radius = on ? S.shadowSoft : 3;
    if (on) { r.shadowMap.needsUpdate = true; }

    P.ao.enabled = S.ao;
    P.ao.output = S.aoView;
    P.ao.updatePdMaterial({ samples: 8 });
    aoSig = "";
    // 반지름은 모델 크기에 맞춘다 — 모델 반지름(span)의 몇 % 인가.
    // 두께는 반경보다 커야 한다 — 작으면 표본이 다 "너무 멀다"로 버려져 그늘이 하나도 안 생긴다(10/29 AO 판이 온통 흰색).
    var aoR = ctx.span * S.aoRadius / 100;
    P.ao.updateGtaoMaterial({ radius: aoR, distanceExponent: 1, thickness: aoR * 3, scale: S.aoDeep, samples: 8 });   // scale = 그늘을 몇 제곱하나 — 클수록 진하다
    P.ao.blendIntensity = S.aoAmt * (light ? 0.55 : 1);   // [11/03] 라이트는 AO 그늘을 55% 로 — 밝은 바탕에서 건물 그림자 톤이 셌다(디자이너)
    P.bloom.enabled = S.bloom && !light;
    P.bloom.strength = S.bloomAmt;
    P.bloom.radius = S.bloomRadius;
    P.bloom.threshold = S.bloomTh;
    P.vig.enabled = S.vignette > 0 && !light;   // 라이트는 밝은 바탕 가장자리가 회색으로 때 묻어 보인다 — 다크만
    P.vig.uniforms.amount.value = S.vignette;

    if (on && S.bake) { bakeAll(); }
    var bu = BK.u;
    bu.uBakeOn.value = on && S.bake ? 1 : 0;
    bu.uBakeAmt.value = S.bakeAmt * (light ? 0.7 : 1);
    bu.uBakeFade.value = S.bakeFade;
    bu.uBakeDirect.value = S.bakeDirect;
    bu.uBakeOff.value = S.bakeOff;
    bu.uBakeView.value = on && S.bake && S.bakeView ? 1 : 0;

    if (FPS) { badge(); }
    ctx.redraw();
  }

  function render(w, h) {
    if (!ready || !S.on) { return false; }
    var pr = Math.min(ctx.renderer.getPixelRatio(), S.res);
    if (w !== size.w || h !== size.h || pr !== size.pr) {
      size = { w: w, h: h, pr: pr };
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      P.vig.uniforms.aspect.value = w / h;
    }
    /*
     * 깊이 판을 모델 둘레로 좁힌다. 지도 카메라는 멀리 서서(EYE 9) near 1 · far 반지름 ×40 이라
     * 모델이 깊이 판의 아주 얇은 띠에만 앉는다 — 그 정밀도로는 AO 가 모서리를 못 찾는다.
     */
    var sh = shadowSig();
    if (sh !== shSig) { shSig = sh; ctx.renderer.shadowMap.needsUpdate = true; }
    var cam = ctx.camera, n0 = cam.near, f0 = cam.far, z = depthSpan();
    if (z) { cam.near = Math.max(n0, z[0]); cam.far = Math.min(f0, z[1]); cam.updateProjectionMatrix(); }
    composer.render();
    if (z) { cam.near = n0; cam.far = f0; cam.updateProjectionMatrix(); }
    tick();
    return true;
  }

  /* ---------- AO 굽기(2단계 실험) ---------- */

  /*
   * 층마다 한 번:
   *   1. 높이 판 — 그 층 덩이를 위에서 내려다보며 "바닥에서 몇 m 위인가"를 칠한다(가장 높은 면이 남는다).
   *   2. 그늘 판 — 칸마다 24 방향으로 반경 안의 높이를 훑어, 가장 높이 솟은 각(지평선)만큼 하늘이 가린 비율을 낸다.
   *   3. 다듬기 — 높이가 비슷한 이웃끼리만 흐리게(벽 너머로 번지지 않게).
   * 덩이 지오메트리는 월드 좌표로 굳어 있다(map-v6 flatten) — 물체 좌표가 곧 평면 좌표라 UV 가 필요 없다.
   */
  var BK = {
    injected: false, sig: "",
    u: { uBakeOn: { value: 0 }, uBakeAmt: { value: 1 }, uBakeFade: { value: 1 }, uBakeDirect: { value: 0.5 }, uBakeOff: { value: 0.1 }, uBakeView: { value: 0 } },
    floors: {}   // fid → { tex, rect, base(유니폼), rts }
  };

  function bakeAll() {
    var sig = [S.bakeR, S.bakeRes].join(",");
    if (sig === BK.sig) { return; }
    BK.sig = sig;
    var t0 = performance.now(), r = ctx.renderer;
    var groups = {};
    ctx.meshes.forEach(function (it) { (groups[it.floor] = groups[it.floor] || []).push(it); });

    var prevRT = r.getRenderTarget(), prevClear = new T.Color(), prevAlpha = r.getClearAlpha(), prevAuto = r.autoClear, prevSh = r.shadowMap.autoUpdate;
    r.getClearColor(prevClear);
    r.shadowMap.autoUpdate = false;
    var cam = new T.Camera(), log = [];
    var vs = "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }";
    var quad = function (mat, src, dst) {
      var q = new T.Mesh(new T.PlaneGeometry(2, 2), mat), qs = new T.Scene();
      q.frustumCulled = false;
      qs.add(q);
      mat.uniforms.tSrc.value = src.texture;
      r.setRenderTarget(dst);
      r.render(qs, cam);
      q.geometry.dispose();
    };

    Object.keys(groups).forEach(function (fid) {
      var list = groups[fid], box = new T.Box3(), base = -Infinity, lo = Infinity;
      list.forEach(function (it) {
        var b = it.mesh.geometry.boundingBox;
        box.union(b);
        lo = Math.min(lo, b.min.y);
        if (it.key === "floor") { base = Math.max(base, b.max.y); }
      });
      if (!isFinite(base)) { base = lo; }
      var pad = S.bakeR * 1.1, top = box.max.y;
      var rx = box.min.x - pad, rz = box.min.z - pad, sx = box.max.x - box.min.x + pad * 2, sz = box.max.z - box.min.z + pad * 2;
      var N = S.bakeRes, w = sx >= sz ? N : Math.max(64, Math.round(N * sx / sz)), h = sx >= sz ? Math.max(64, Math.round(N * sz / sx)) : N;

      var F = BK.floors[fid] || (BK.floors[fid] = { tex: { value: null }, rect: { value: new T.Vector4() }, base: { value: 0 }, rts: [] });
      F.rts.forEach(function (t) { t.dispose(); });
      var mk = function () { return new T.WebGLRenderTarget(w, h, { type: T.HalfFloatType, minFilter: T.LinearFilter, magFilter: T.LinearFilter, depthBuffer: true }); };
      var rtH = mk(), rtA = mk(), rtB = mk();
      F.rect.value.set(rx, rz, sx, sz);
      F.base.value = base;

      // 1. 높이 판 — xz 를 그대로 화면에, 높을수록 앞(깊이 작게)
      var hMat = new T.ShaderMaterial({
        uniforms: { uRect: { value: F.rect.value }, uBase: { value: base }, uLo: { value: base - 1 }, uHi: { value: top + 1 } },
        side: T.DoubleSide,
        vertexShader: [
          "uniform vec4 uRect; uniform float uLo, uHi; varying float vY;",
          "void main(){ vY = position.y;",
          "  vec2 p = (position.xz - uRect.xy) / uRect.zw * 2.0 - 1.0;",
          "  gl_Position = vec4(p, 1.0 - 2.0 * clamp((position.y - uLo) / (uHi - uLo), 0.0, 1.0), 1.0); }"
        ].join("\n"),
        fragmentShader: "uniform float uBase; varying float vY; void main(){ gl_FragColor = vec4(max(vY - uBase, 0.0), 0.0, 0.0, 1.0); }"
      });
      var hs = new T.Scene();
      list.forEach(function (it) {
        var m = new T.Mesh(it.mesh.geometry, hMat);
        m.frustumCulled = false;
        hs.add(m);
      });
      r.setRenderTarget(rtH);
      r.setClearColor(0x000000, 1);
      r.autoClear = true;
      r.clear(true, true, true);
      r.render(hs, cam);

      // 2. 그늘 판
      var aoMat = new T.ShaderMaterial({
        uniforms: { tSrc: { value: null }, uWorld: { value: new T.Vector2(sx, sz) }, uR: { value: S.bakeR } },
        vertexShader: vs,
        fragmentShader: [
          "uniform sampler2D tSrc; uniform vec2 uWorld; uniform float uR; varying vec2 vUv;",
          "float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }",
          "void main(){",
          "  float h0 = texture2D(tSrc, vUv).r, occ = 0.0, j = hash(vUv * 4096.0);",
          "  for (int k = 0; k < 24; k++) {",
          "    float a = (float(k) + j) * 0.2617994;",
          "    vec2 dir = vec2(cos(a), sin(a)) / uWorld;",
          "    float best = 0.0;",
          "    for (int s = 0; s < 20; s++) {",
          "      float t = (float(s) + 0.5) / 20.0, d = uR * t * t;",
          "      float dh = texture2D(tSrc, vUv + dir * d).r - h0;",
          "      if (dh > 0.0) { best = max(best, dh / sqrt(dh * dh + d * d) * (1.0 - t * t)); }",
          "    }",
          "    occ += best;",
          "  }",
          "  gl_FragColor = vec4(1.0 - occ / 24.0, h0, 0.0, 1.0);",
          "}"
        ].join("\n")
      });
      quad(aoMat, rtH, rtA);

      // 3. 다듬기 — 가로 · 세로 두 번. 높이가 다른 칸(벽 위 · 설비 위)은 섞지 않는다.
      var blur = function (dx, dy, src, dst) {
        var bm = new T.ShaderMaterial({
          uniforms: { tSrc: { value: null }, uStep: { value: new T.Vector2(dx / w, dy / h) } },
          vertexShader: vs,
          fragmentShader: [
            "uniform sampler2D tSrc; uniform vec2 uStep; varying vec2 vUv;",
            "void main(){",
            "  vec4 c = texture2D(tSrc, vUv); float sum = c.r, wt = 1.0;",
            "  for (int i = 1; i <= 4; i++) {",
            "    float g = exp(-float(i * i) / 8.0);",
            "    vec4 a = texture2D(tSrc, vUv + uStep * float(i)), b = texture2D(tSrc, vUv - uStep * float(i));",
            "    float wa = g * step(abs(a.g - c.g), 0.05), wb = g * step(abs(b.g - c.g), 0.05);",
            "    sum += a.r * wa + b.r * wb; wt += wa + wb;",
            "  }",
            "  gl_FragColor = vec4(sum / wt, c.g, 0.0, 1.0);",
            "}"
          ].join("\n")
        });
        quad(bm, src, dst);
        bm.dispose();
      };
      blur(1.5, 0, rtA, rtB);
      blur(0, 1.5, rtB, rtA);
      F.tex.value = rtA.texture;
      F.rts = [rtA];
      rtH.dispose(); rtB.dispose(); hMat.dispose(); aoMat.dispose();
      log.push((fid || "층") + " 바닥 " + base.toFixed(2) + " · 높이 " + (top - base).toFixed(2) + " · 판 " + sx.toFixed(1) + "×" + sz.toFixed(1) + " → " + w + "×" + h);
    });

    r.setRenderTarget(prevRT);
    r.setClearColor(prevClear, prevAlpha);
    r.autoClear = prevAuto;
    r.shadowMap.autoUpdate = prevSh;
    r.shadowMap.needsUpdate = true;
    inject();
    console.log("[AO 굽기] " + Math.round(performance.now() - t0) + " ms · " + log.join(" | "));
  }

  // 덩이 면 재질에 구운 그늘을 잇는다 — 기존 onBeforeCompile(계단실 구멍)은 그대로 먼저 부른다.
  function inject() {
    if (BK.injected) { return; }
    BK.injected = true;
    ctx.meshes.forEach(function (it) {
      var F = BK.floors[it.floor], mat = it.mat;
      if (!F) { return; }
      var prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey;
      mat.onBeforeCompile = function (sh, rr) {
        if (prev) { prev.call(this, sh, rr); }
        Object.keys(BK.u).forEach(function (k) { sh.uniforms[k] = BK.u[k]; });
        sh.uniforms.uBkTex = F.tex; sh.uniforms.uBkRect = F.rect; sh.uniforms.uBkBase = F.base;
        sh.vertexShader = "varying vec3 vBkP;\nvarying vec3 vBkN;\n" + sh.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\n  vBkP = transformed; vBkN = objectNormal;");
        sh.fragmentShader = [
          "uniform sampler2D uBkTex; uniform vec4 uBkRect; uniform float uBkBase;",
          "uniform float uBakeOn, uBakeAmt, uBakeFade, uBakeDirect, uBakeOff, uBakeView;",
          "varying vec3 vBkP; varying vec3 vBkN;",
          "float bakedAO(){",
          "  vec3 n = normalize(vBkN);",
          "  vec4 s = texture2D(uBkTex, (vBkP.xz + n.xz * uBakeOff - uBkRect.xy) / uBkRect.zw);",
          "  float w = 1.0 - smoothstep(0.0, uBakeFade, vBkP.y - uBkBase - s.g);",
          "  w *= step(-0.5, n.y);",   // 아래를 보는 면(천장 밑면)은 바닥 그늘과 상관없다
          "  return mix(1.0, pow(clamp(s.r, 0.0, 1.0), uBakeAmt), w * uBakeOn);",
          "}"
        ].join("\n") + "\n" + sh.fragmentShader
          .replace("#include <aomap_fragment>", "#include <aomap_fragment>\n  float bkAO = bakedAO();\n  reflectedLight.indirectDiffuse *= bkAO;\n  reflectedLight.directDiffuse *= mix(1.0, bkAO, uBakeDirect);")
          .replace("#include <premultiplied_alpha_fragment>", "if (uBakeView > 0.5) { gl_FragColor.rgb = vec3(bkAO); }\n#include <premultiplied_alpha_fragment>");
      };
      mat.customProgramCacheKey = function () { return (prevKey ? prevKey.call(this) : "") + "|bake-ao"; };
      mat.needsUpdate = true;
    });
  }

  /* ---------- 조절판 ---------- */

  // 그림자를 다시 구워야 하나 — 덩이마다 보이는지 · 그림자를 드리우는지(map-v5 가 비칠 때 castShadow 를 끈다).
  function shadowSig() {
    var s = "";
    ctx.meshes.forEach(function (it) { s += it.mesh.visible ? (it.mesh.castShadow ? "1" : "0") : "-"; });
    return s;
  }

  // 모델 상자의 여덟 꼭짓점을 카메라 앞 방향으로 재서 가장 가까운 · 먼 깊이(여유 10%)를 낸다.
  var _fw = null, _pt = null;
  function depthSpan() {
    var b = ctx.box;
    if (!b) { return null; }
    _fw = _fw || new T.Vector3(); _pt = _pt || new T.Vector3();
    ctx.camera.getWorldDirection(_fw);
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i < 8; i++) {
      _pt.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).sub(ctx.camera.position);
      var d = _pt.dot(_fw);
      lo = Math.min(lo, d); hi = Math.max(hi, d);
    }
    var pad = (hi - lo) * 0.1;
    return hi > 0 ? [Math.max(0.01, lo - pad), hi + pad] : null;
  }

  // 초당 그린 횟수 — 로봇이 걷는 동안(계속 그릴 때) 의미가 있다.
  function tick() {
    var t = performance.now();
    if (!fps.t0) { fps.t0 = t; }
    fps.n += 1;
    if (t - fps.t0 >= 1000) { fps.v = Math.round(fps.n * 1000 / (t - fps.t0)); fps.n = 0; fps.t0 = t; if (FPS) { badge(); } }
  }

  var tag = null;
  function badge() {
    if (!tag) {
      tag = document.createElement("div");
      tag.className = "lab-fx-tag";
      // 운영 화면에는 실험 페이지의 .lab-fx-tag 규칙이 없다 — 같은 꼴을 직접 입힌다.
      if (!LAB) { tag.style.cssText = "position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:9999;padding:6px 12px;border-radius:999px;font:600 12px/1.4 SUIT,sans-serif;background:rgba(60,66,80,.9);color:#fff;pointer-events:none;white-space:pre"; }
      document.body.appendChild(tag);
    }
    var c = ctx.renderer.domElement;
    tag.textContent = LAB
      ? (S.on ? "효과 켜짐" + (fps.v ? " · " + fps.v + " fps" : "") : "효과 꺼짐 · 운영 화면과 같음") + "  ·  B 로 전환"
      : "지도 " + (fps.v || "–") + " fps · 화면 배율 " + window.devicePixelRatio + " · 캔버스 " + c.width + "×" + c.height + (S.on ? "" : " · 효과 꺼짐");
    tag.classList.toggle("is-off", !S.on);
  }

  function panel(GUI) {
    var gui = new GUI({ title: "렌더 실험 (1단계) — 기본값 = 운영" });
    gui.domElement.classList.add("lab-fx-gui");
    gui.add(S, "on").name("효과 켜기 (B)").onChange(sync).listen();

    var f = gui.addFolder("톤 · 환경광");
    f.add(S, "tone", TONES).name("톤 매핑").onChange(sync);
    f.add(S, "exposure", 0.5, 2, 0.05).name("노출").onChange(sync);
    f.add(S, "env").name("환경광").onChange(sync);
    f.add(S, "envAmt", 0, 1.5, 0.05).name("환경광 세기").onChange(sync);
    f.add(S, "rough", 0.2, 1, 0.05).name("거칠기").onChange(sync);

    f = gui.addFolder("GTAO (11/03 전 운영 · 지금 꺼짐)");
    f.add(S, "ao").name("켜기").onChange(sync).listen();
    f.add(S, "aoRadius", 1, 20, 0.5).name("반경 (모델 %)").onChange(sync);
    f.add(S, "aoDeep", 1, 4, 0.1).name("진하기").onChange(sync);
    f.add(S, "aoAmt", 0, 2, 0.05).name("세기").onChange(sync);
    f.add(S, "aoRest").name("돌리는 동안 쉬기").onChange(sync);
    f.add(S, "aoView", { "합친 화면": 0, "AO 만 보기": 5, "AO 날것": 4, "노멀 판": 3, "깊이 판": 2 }).name("보기").onChange(function (v) { S.aoView = +v; sync(); });

    f = gui.addFolder("AO 굽기 (운영)");
    var mode = { v: S.bake ? (S.ao ? "both" : "bake") : (S.ao ? "gtao" : "none") };
    f.add(mode, "v", { "GTAO (11/03 전 운영)": "gtao", "굽기 (운영)": "bake", "둘 다": "both", "없음": "none" }).name("AO 방식").onChange(function (v) {
      S.ao = v === "gtao" || v === "both"; S.bake = v === "bake" || v === "both"; sync();
    });
    f.add(S, "bakeR", 0.4, 4, 0.1).name("반경 (m) · 다시 굽기").onFinishChange(sync);
    f.add(S, "bakeAmt", 0.3, 4, 0.1).name("진하기").onChange(sync);
    f.add(S, "bakeFade", 0.2, 4, 0.1).name("벽 위로 옅어지는 높이 (m)").onChange(sync);
    f.add(S, "bakeDirect", 0, 1, 0.05).name("직사광에도 (0 = 환경광만)").onChange(sync);
    f.add(S, "bakeOff", 0, 0.5, 0.01).name("벽 면에서 비켜 읽기 (m)").onChange(sync);
    f.add(S, "bakeRes", { "1024": 1024, "2048": 2048, "4096": 4096 }).name("판 해상도 · 다시 굽기").onChange(function (v) { S.bakeRes = +v; sync(); });
    f.add(S, "bakeView").name("구운 그늘만 보기").onChange(sync);

    f = gui.addFolder("블룸 (다크만)");
    f.add(S, "bloom").name("켜기").onChange(sync);
    f.add(S, "bloomAmt", 0, 2, 0.05).name("세기").onChange(sync);
    f.add(S, "bloomRadius", 0, 1, 0.05).name("번짐 폭").onChange(sync);
    f.add(S, "bloomTh", 0, 1, 0.01).name("문턱 (밝은 것만)").onChange(sync);

    f = gui.addFolder("화면 · 그림자");
    f.add(S, "vignette", 0, 0.9, 0.05).name("비네트").onChange(sync);
    f.add(S, "res", { "1 (가벼움)": 1, "1.5": 1.5, "2 (운영 화면과 같음)": 2 }).name("해상도 배율").onChange(function (v) { S.res = +v; ctx.redraw(); });
    f.add(S, "shadow", { "1024 (원래)": 1024, "2048": 2048, "4096": 4096 }).name("그림자 해상도").onChange(function (v) { S.shadow = +v; sync(); });
    f.add(S, "shadowSoft", 1, 10, 0.5).name("그림자 번짐").onChange(sync);

    gui.add({ copy: function () {
      var txt = JSON.stringify(S, null, 2);
      if (navigator.clipboard) { navigator.clipboard.writeText(txt); }
      console.log("[렌더 실험] 지금 값\n" + txt);
    } }, "copy").name("지금 값 복사");
  }
})();
