// 지도 렌더 실험 — screens/lab-map-render-v5.html 만 읽는다(10/29 디자이너 "레퍼런스처럼 3D 맵 퀄리티").
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
(function () {
  "use strict";

  var S = {
    on: true,
    tone: "AgX", exposure: 1.0,
    env: true, envAmt: 0.35, rough: 0.8,
    ao: true, aoRadius: 1.2, aoAmt: 1.0,
    bloom: true, bloomAmt: 0.45, bloomRadius: 0.5, bloomTh: 0.7,
    vignette: 0.45,
    shadow: 2048, shadowSoft: 4
  };
  var TONES = { "없음": "none", "AgX": "AgX", "ACES": "ACES" };
  if (/[?&]fx=off/.test(window.location.search)) { S.on = false; }   // ?fx=off — 꺼진 채로 연다(전후 캡처용)
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

  window.APRISM_MAP_FX = { init: init, render: render, S: S };

  function init(c) {
    ctx = c;
    T = c.THREE;
    Promise.all([
      import("three/addons/postprocessing/EffectComposer.js"),
      import("three/addons/postprocessing/RenderPass.js"),
      import("three/addons/postprocessing/GTAOPass.js"),
      import("three/addons/postprocessing/UnrealBloomPass.js"),
      import("three/addons/postprocessing/OutputPass.js"),
      import("three/addons/postprocessing/ShaderPass.js"),
      import("three/addons/environments/RoomEnvironment.js"),
      import("https://cdn.jsdelivr.net/npm/lil-gui@0.19.2/dist/lil-gui.esm.min.js")
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

    panel(m[7].GUI);
    window.addEventListener("keydown", function (e) {
      if ((e.key === "b" || e.key === "B") && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) { S.on = !S.on; sync(); }
    });
    if (window.MutationObserver) {
      new MutationObserver(sync).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    }
    ready = true;
    sync();
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

    P.ao.enabled = S.ao;
    // 반지름은 모델 크기에 맞춘다 — 모델 반지름(span)의 몇 % 인가.
    P.ao.updateGtaoMaterial({ radius: ctx.span * S.aoRadius / 100, distanceExponent: 1, thickness: ctx.span * 0.01, scale: 1, samples: 16 });
    P.ao.blendIntensity = S.aoAmt;
    P.bloom.enabled = S.bloom && !light;
    P.bloom.strength = S.bloomAmt;
    P.bloom.radius = S.bloomRadius;
    P.bloom.threshold = S.bloomTh;
    P.vig.enabled = S.vignette > 0;
    P.vig.uniforms.amount.value = S.vignette;

    badge();
    ctx.redraw();
  }

  function render(w, h) {
    if (!ready || !S.on) { return false; }
    var pr = ctx.renderer.getPixelRatio();
    if (w !== size.w || h !== size.h || pr !== size.pr) {
      size = { w: w, h: h, pr: pr };
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      P.vig.uniforms.aspect.value = w / h;
    }
    composer.render();
    return true;
  }

  /* ---------- 조절판 ---------- */

  var tag = null;
  function badge() {
    if (!tag) {
      tag = document.createElement("div");
      tag.className = "lab-fx-tag";
      document.body.appendChild(tag);
    }
    tag.textContent = (S.on ? "효과 켜짐" : "효과 꺼짐 · 운영 화면과 같음") + "  ·  B 로 전환";
    tag.classList.toggle("is-off", !S.on);
  }

  function panel(GUI) {
    var gui = new GUI({ title: "렌더 실험 (1단계)" });
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
    f.add(S, "aoRadius", 0.2, 5, 0.1).name("반경 (모델 %)").onChange(sync);
    f.add(S, "aoAmt", 0, 1.5, 0.05).name("세기").onChange(sync);

    f = gui.addFolder("블룸 (다크만)");
    f.add(S, "bloom").name("켜기").onChange(sync);
    f.add(S, "bloomAmt", 0, 2, 0.05).name("세기").onChange(sync);
    f.add(S, "bloomRadius", 0, 1, 0.05).name("번짐 폭").onChange(sync);
    f.add(S, "bloomTh", 0, 1, 0.01).name("문턱 (밝은 것만)").onChange(sync);

    f = gui.addFolder("화면 · 그림자");
    f.add(S, "vignette", 0, 0.9, 0.05).name("비네트").onChange(sync);
    f.add(S, "shadow", { "1024 (원래)": 1024, "2048": 2048, "4096": 4096 }).name("그림자 해상도").onChange(function (v) { S.shadow = +v; sync(); });
    f.add(S, "shadowSoft", 1, 10, 0.5).name("그림자 번짐").onChange(sync);

    gui.add({ copy: function () {
      var txt = JSON.stringify(S, null, 2);
      if (navigator.clipboard) { navigator.clipboard.writeText(txt); }
      console.log("[렌더 실험] 지금 값\n" + txt);
    } }, "copy").name("지금 값 복사");
  }
})();
