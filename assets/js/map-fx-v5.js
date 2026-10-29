// v5 지도 효과 — map-v5.js 를 쓰는 v5 화면이 모두 읽는다(10/29 디자이너가 렌더 실험에서 고른 값을 운영에 반영).
// 조절판 · 효과 표시 · B 키는 렌더 실험(screens/lab-map-render-v5.html · <html data-fx-lab>)에서만 뜬다.
// map-v5.js 가 지도를 다 세운 뒤 APRISM_MAP_FX.init 을 부르고, 그릴 때마다 render 를 부른다.
// render 가 false 를 돌려주면 map-v5.js 가 예전처럼 직접 그린다 — 효과를 끄면 운영 화면과 똑같다.
//
// 얹는 것(1단계 · 코드만으로)
//   톤 매핑      AgX · ACES — 밝은 곳이 하얗게 날아가지 않고 부드럽게 눕는다. 대신 경로 · 상태색도 같이 바뀐다.
//   환경광       RoomEnvironment — 면에 은은한 반사가 생겨 단색 덩이가 재질처럼 읽힌다.
//   AO           GTAO — 벽 밑동 · 모서리 · 틈에 지는 그늘. 레퍼런스의 "무게감"이 대부분 여기서 나온다.
//   블룸         밝은 것만 번지게 한다. 다크 전용 — 라이트는 바탕이 밝아 화면 전체가 번진다.
//   비네트       가장자리를 바탕보다 한 단 어둡게 — 시선이 가운데 지도로 모인다.
//   그림자       해상도 · 번짐을 올린다.
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
    ao: true, aoRadius: 4.5, aoAmt: 0.6, aoDeep: 1, aoRest: true, aoView: 0,   // aoView 0 합친 화면 · 5 AO 만 · 3 노멀 판
    bloom: true, bloomAmt: 0.4, bloomRadius: 0.15, bloomTh: 0.51,
    vignette: 0.25,
    shadow: 2048, shadowSoft: 5,
    res: 1   // 후처리 판 배율 — 1 이면 효과 없던 때(2)의 ¼ 픽셀
  };
  var TONES = { "없음": "none", "AgX": "AgX", "ACES": "ACES" };
  var LAB = document.documentElement.hasAttribute("data-fx-lab");
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
    P.ao.blendIntensity = S.aoAmt;
    P.bloom.enabled = S.bloom && !light;
    P.bloom.strength = S.bloomAmt;
    P.bloom.radius = S.bloomRadius;
    P.bloom.threshold = S.bloomTh;
    P.vig.enabled = S.vignette > 0 && !light;   // 라이트는 밝은 바탕 가장자리가 회색으로 때 묻어 보인다 — 다크만
    P.vig.uniforms.amount.value = S.vignette;

    if (LAB) { badge(); }
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
    if (t - fps.t0 >= 1000) { fps.v = Math.round(fps.n * 1000 / (t - fps.t0)); fps.n = 0; fps.t0 = t; if (LAB) { badge(); } }
  }

  var tag = null;
  function badge() {
    if (!tag) {
      tag = document.createElement("div");
      tag.className = "lab-fx-tag";
      document.body.appendChild(tag);
    }
    tag.textContent = (S.on ? "효과 켜짐" + (fps.v ? " · " + fps.v + " fps" : "") : "효과 꺼짐 · 운영 화면과 같음") + "  ·  B 로 전환";
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

    f = gui.addFolder("AO (모서리 그늘)");
    f.add(S, "ao").name("켜기").onChange(sync);
    f.add(S, "aoRadius", 1, 20, 0.5).name("반경 (모델 %)").onChange(sync);
    f.add(S, "aoDeep", 1, 4, 0.1).name("진하기").onChange(sync);
    f.add(S, "aoAmt", 0, 2, 0.05).name("세기").onChange(sync);
    f.add(S, "aoRest").name("돌리는 동안 쉬기").onChange(sync);
    f.add(S, "aoView", { "합친 화면": 0, "AO 만 보기": 5, "AO 날것": 4, "노멀 판": 3, "깊이 판": 2 }).name("보기").onChange(function (v) { S.aoView = +v; sync(); });

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
